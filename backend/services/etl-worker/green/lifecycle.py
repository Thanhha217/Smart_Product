"""Split a product's stored CO2 total into lifecycle stages, for the
"from factory to your home" diagram.

The total is never changed here: it is the number stored in ``product.co2e_kg``
(YC-5: the same number on every page).  How it is split depends on where it came
from:

* ``lifecycle_formula`` -> exact: manufacturing (embodied), use phase on the
  Vietnamese grid (+ refrigerant leakage), end of life.  The freight leg to
  Vietnam is computed (mass x distance x mode factor) and carved out of the
  embodied term.  ``basis = "formula"``.
* any other number -> typical stage shares of the category
  (green/data/stage_shares.json, an assumption).  ``basis = "typical_share"``.
* no number -> ``basis = "none"`` and no stages.

Pure Python, unit-tested in tests/test_lifecycle.py.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

STAGES = ("materials_production", "transport", "use", "end_of_life")
LABELS = {
    "materials_production": ("Nguyên liệu & sản xuất", "Materials & manufacturing"),
    "transport": ("Vận chuyển về Việt Nam", "Transport to Vietnam"),
    "use": ("Sử dụng tại Việt Nam", "Use in Vietnam"),
    "end_of_life": ("Thải bỏ / tái chế", "End of life"),
}
_DATA = Path(__file__).parent / "data" / "stage_shares.json"


@lru_cache(maxsize=1)
def _data() -> dict[str, Any]:
    return json.loads(_DATA.read_text(encoding="utf-8"))


def guess_origin(name: str | None) -> str:
    """Country code of the assumed origin from the brand in the product name."""
    low = (name or "").lower()
    for brand, origin in _data()["brand_origin"].items():
        if re.search(r"(?<![a-z0-9])" + re.escape(brand) + r"(?![a-z0-9])", low):
            return origin
    return _data()["default_origin"]


def route(category: str | None, name: str | None, mass_kg: float | None = None) -> dict[str, Any]:
    """Assumed freight leg from the factory country to the buyer in Vietnam."""
    data = _data()
    code = guess_origin(name)
    origin = data["origins"][code]
    masses = data["default_mass_kg"]
    mass = mass_kg if mass_kg and mass_kg > 0 else masses.get(category or "", masses["_default"])
    f = data["freight_kg_per_tkm"]
    tonnes = mass / 1000
    kg = tonnes * (origin["sea_km"] * f["sea"] + origin["road_km"] * f["road"])
    return {
        "origin_code": code,
        "origin_vi": origin["name_vi"],
        "origin_en": origin["name_en"],
        "destination": "Việt Nam",
        "sea_km": origin["sea_km"],
        "road_km": origin["road_km"],
        "distance_km": origin["sea_km"] + origin["road_km"],
        "mode": "sea+road" if origin["sea_km"] else "road",
        "mass_kg": mass,
        "kg": round(kg, 3),
        "assumed": True,
    }


def _stage(key: str, kg: float, total: float) -> dict[str, Any]:
    vi, en = LABELS[key]
    return {"key": key, "label_vi": vi, "label_en": en, "kg": round(kg, 2),
            "pct": round(100 * kg / total, 1) if total > 0 else 0.0}


def decompose(total_kg: float | None, source: str | None, category: str | None,
              detail: dict[str, Any] | None = None, name: str | None = None) -> dict[str, Any]:
    """Lifecycle object of docs/demo/api-contract.md."""
    detail = detail or {}
    if total_kg is None or total_kg <= 0:
        return {"basis": "none", "total_kg": None, "stages": [], "route": None, "use_phase": None,
                "note_vi": "Chưa có số CO₂ nên không tách được theo giai đoạn.",
                "note_en": "No CO2 figure, so no stage breakdown."}

    leg = route(category, name, detail.get("weight_kg"))

    if source == "lifecycle_formula" and detail.get("embodied_kg") is not None:
        life = float(detail["lifetime_years"])
        use = life * (float(detail["use_kg_per_year"]) + float(detail.get("refrigerant_kg_per_year") or 0))
        eol = float(detail.get("eol_kg") or 0)
        embodied = max(0.0, total_kg - use - eol)  # equals detail["embodied_kg"] up to rounding
        transport = min(leg["kg"], 0.3 * embodied)
        parts = {"materials_production": embodied - transport, "transport": transport, "use": use, "end_of_life": eol}
        return {
            "basis": "formula", "total_kg": total_kg,
            "stages": [_stage(k, parts[k], total_kg) for k in STAGES],
            "route": leg,
            "use_phase": {"years": life, "kwh_year": detail.get("annual_kwh"), "grid_ef": detail.get("ef_grid"),
                          "kwh_source": detail.get("kwh_source"),
                          "refrigerant_kg_per_year": detail.get("refrigerant_kg_per_year")},
            "note_vi": "Tách đúng theo công thức vòng đời; chặng vận chuyển về Việt Nam là ước tính (giả định nơi sản xuất).",
            "note_en": "Exact split of the lifecycle formula; the freight leg to Vietnam is an estimate (assumed origin).",
        }

    shares_all = _data()["shares"]
    if source == "eeio_price":
        shares, note_vi, note_en = shares_all["_eeio"], (
            "Số theo giá bán chỉ gồm sản xuất và vận chuyển (không gồm điện khi dùng); tỷ lệ chia là giả định."), (
            "The price-based figure covers production and delivery only; the split is an assumption.")
    else:
        shares = shares_all.get(category or "", shares_all["_default"])
        note_vi = ("Hãng chỉ công bố tổng vòng đời; tỷ lệ từng giai đoạn là mức điển hình của loại (giả định), "
                   "tổng không đổi.")
        note_en = ("Only the lifecycle total is published; stage shares are typical for the category "
                   "(assumption), the total is unchanged.")
    return {
        "basis": "typical_share", "total_kg": total_kg,
        "stages": [_stage(k, total_kg * shares[k], total_kg) for k in STAGES],
        "route": leg, "use_phase": None, "note_vi": note_vi, "note_en": note_en,
    }
