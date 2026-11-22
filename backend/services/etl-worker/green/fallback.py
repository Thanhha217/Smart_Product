"""CO2 estimate for products with no similar reference product.

carbon_estimator.py first averages the reference products whose CLIP cosine is
>= SIMILARITY_THRESHOLD (0.66).  When none passes, it calls
``estimate_without_neighbours`` here instead of asking the LLM to guess.

The first step that applies wins:

1. ``lifecycle_formula`` - appliance categories (air conditioner, fridge, TV, washing
   machine, fan, rice cooker...): green.co2_formula with the energy label / power /
   capacity read from the product text.  The use phase dominates these products and
   manufacturers almost never publish a per-model footprint.
2. ``category_model``    - categories with >= MIN_REFS manufacturer numbers in the
   reference catalogue: median of the category, shifted by the brand's own median and
   scaled by screen size for monitors and laptops.
3. ``eeio_price``        - price x US EPA supply-chain factor of the product's industry
   (the method of P5 / CaML).  Cradle-to-shelf only: no use phase, no end of life.
4. ``None``              - nothing applies: the product stays without a number.

Leave-one-family-out test on the 1,450 products with manufacturer numbers (Nov 2026):
the category model has a median error of 18.5 % (monitors 9 %, phones 14 %, laptops
20 %, desktops 22 %) against 24 % for the plain category median; the formula gives
1,925 kg for a 75" TV against 982-2,388 kg in Samsung's four 75" reports.
Details: docs/research/co2-fallback.md.

Pure Python, no database or network, so it is unit-tested in tests/test_fallback.py.
"""

from __future__ import annotations

import json
import math
import os
import re
import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Mapping

from green.co2_formula import EF_GRID, estimate_co2
from green.spec_parser import parse_specs

# A category needs at least this many manufacturer numbers before its median is used.
MIN_REFS = 4
# A brand needs at least this many numbers in a category before its own level is used.
MIN_BRAND_REFS = 3

# Reference-catalogue categories that are the same product type.
CATEGORY_ALIASES = {"earphone": "headphone", "gaming_laptop": "laptop"}

# Appliance categories that go to green.co2_formula (reference key -> formula key).
FORMULA_CATEGORY = {
    "air_conditioner": "air_conditioners",
    "refrigerator": "refrigerators",
    "washing_machine": "washing_machines",
    "television": "televisions",
    "electric_fan": "electric_fans",
    "rice_cooker": "rice_cookers",
    "air_purifier": "air_purifiers",
    "water_purifier": "water_purifiers",
    "vacuum_cleaner": "vacuum_cleaners",
    "microwave_oven": "microwaves_ovens",
    "stove": "stoves",
    "lighting": "lighting",
}

# log(kg) against log(screen inches), fitted on the catalogue in Nov 2026:
# monitors n=304 (slope 0.81, median size 23.8"), laptops n=467 (0.53, 14.0").
# (slope, reference size, plausible size range)
SIZE_MODEL = {
    "computer_monitor": (0.81, 23.8, (15.0, 57.0)),
    "laptop": (0.53, 14.0, (10.0, 18.5)),
}

CONFIDENCE = {
    "category_model": 0.35,
    "lifecycle_formula_label": 0.35,
    "lifecycle_formula_rated_power": 0.3,
    "lifecycle_formula_category_default": 0.25,
    "eeio_price": 0.15,
}

LABEL_VI = {
    "smartphone": "điện thoại", "laptop": "laptop", "tablet": "máy tính bảng", "desktop": "máy tính để bàn",
    "computer_monitor": "màn hình máy tính", "computer_peripheral": "chuột / bàn phím / webcam",
    "smartwatch": "đồng hồ thông minh", "headphone": "tai nghe", "speaker": "loa", "smart_home": "thiết bị nhà thông minh",
    "gaming_console": "máy chơi game", "networking": "thiết bị mạng", "television": "tivi", "wearable": "thiết bị đeo",
}

_DATA = Path(__file__).parent / "data" / "eeio_factors.json"


def canonical_category(category: str | None) -> str | None:
    if not category:
        return category
    return CATEGORY_ALIASES.get(category, category)


@dataclass(frozen=True)
class Estimate:
    co2e_kg: float
    source: str                 # lifecycle_formula | category_model | eeio_price
    confidence: float
    explanation_en: str
    explanation_vi: str
    detail: dict = field(default_factory=dict)


# ---------------------------------------------------------------- category model

@dataclass(frozen=True)
class _CategoryLevel:
    n: int
    log_median: float
    brand_offset: dict          # brand (lower case) -> median log(kg) - category log median
    brand_n: dict


class CategoryStats:
    """Per-category levels of the reference catalogue (built once with the FAISS index)."""

    def __init__(self, levels: dict[str, _CategoryLevel], brands: list[str]):
        self.levels = levels
        # longest first, so "Fairphone" wins over a shorter brand inside it
        self.brands = sorted({b for b in brands if b}, key=len, reverse=True)

    @classmethod
    def from_references(cls, references: Iterable[Mapping]) -> "CategoryStats":
        by_cat: dict[str, list[tuple[str, float]]] = defaultdict(list)
        brands = []
        for ref in references:
            kg = float(ref.get("co2e_kg") or 0)
            if kg <= 0:
                continue
            brand = (ref.get("brand") or "").strip()
            brands.append(brand)
            by_cat[canonical_category(ref.get("category"))].append((brand.lower(), math.log(kg)))
        levels = {}
        for cat, rows in by_cat.items():
            log_median = statistics.median(v for _, v in rows)
            per_brand: dict[str, list[float]] = defaultdict(list)
            for b, v in rows:
                if b:
                    per_brand[b].append(v)
            offset = {b: statistics.median(vs) - log_median for b, vs in per_brand.items() if len(vs) >= MIN_BRAND_REFS}
            levels[cat] = _CategoryLevel(len(rows), log_median, offset, {b: len(per_brand[b]) for b in offset})
        return cls(levels, brands)

    def level(self, category: str | None) -> _CategoryLevel | None:
        return self.levels.get(canonical_category(category))

    def guess_brand(self, text: str | None) -> str | None:
        if not text:
            return None
        low = text.lower()
        for brand in self.brands:
            if re.search(r"(?<![a-z0-9])" + re.escape(brand.lower()) + r"(?![a-z0-9])", low):
                return brand
        return None


def _screen_inch(name: str | None, description: str | None) -> float | None:
    for text in (name, description):
        if text:
            inch = parse_specs(text).screen_inch
            if inch:
                return inch
    return None


def category_model_estimate(stats: CategoryStats | None, category: str | None,
                            name: str | None, description: str | None = None) -> Estimate | None:
    if stats is None:
        return None
    category = canonical_category(category)
    level = stats.level(category)
    if level is None or level.n < MIN_REFS:
        return None

    log_kg = level.log_median
    parts_en, parts_vi = [], []
    brand = stats.guess_brand(name)
    if brand and brand.lower() in level.brand_offset:
        log_kg += level.brand_offset[brand.lower()]
        n_brand = level.brand_n[brand.lower()]
        parts_en.append(f"{brand}'s own level ({n_brand} {brand} products)")
        parts_vi.append(f"mức riêng của {brand} ({n_brand} sản phẩm {brand})")
    else:
        brand = None

    inch = None
    if category in SIZE_MODEL:
        slope, ref_size, (lo, hi) = SIZE_MODEL[category]
        inch = _screen_inch(name, description)
        if inch and lo <= inch <= hi:
            log_kg += slope * math.log(inch / ref_size)
            parts_en.append(f'{inch:g}" screen')
            parts_vi.append(f"màn hình {inch:g} inch")
        else:
            inch = None

    kg = math.exp(log_kg)
    label_vi = LABEL_VI.get(category, category.replace("_", " "))
    adj_en = f", adjusted for {' and '.join(parts_en)}" if parts_en else ""
    adj_vi = f", điều chỉnh theo {' và '.join(parts_vi)}" if parts_vi else ""
    return Estimate(
        co2e_kg=kg,
        source="category_model",
        confidence=CONFIDENCE["category_model"],
        explanation_en=(f"Estimated from the typical footprint of {category.replace('_', ' ')} products "
                        f"(median of {level.n} manufacturer-reported products{adj_en})."),
        explanation_vi=(f"Ước tính theo mức CO₂ điển hình của {label_vi} (trung vị {level.n} sản phẩm có số "
                        f"do hãng công bố{adj_vi})."),
        detail={"category": category, "n_refs": level.n, "brand": brand, "screen_inch": inch},
    )


# ---------------------------------------------------------------- lifecycle formula

def _vn(x: float) -> str:
    """12345.6 -> '12.346' (Vietnamese thousands separator)."""
    return f"{x:,.0f}".replace(",", ".")


def _vn_dec(x: float) -> str:
    """315.2 -> '315,2'; 1234.5 -> '1.234,5' (Vietnamese decimal comma)."""
    return f"{x:,g}".replace(",", " ").replace(".", ",").replace(" ", ".") if abs(x) >= 1000 else f"{x:g}".replace(".", ",")

_KWH_SOURCE_VI = {"label": "theo nhãn năng lượng", "rated_power": "theo công suất ghi trên sản phẩm",
                  "category_default": "mức điển hình của loại sản phẩm"}
_KWH_SOURCE_EN = {"label": "from the energy label", "rated_power": "from the rated power",
                  "category_default": "typical for the category"}


def formula_estimate(category: str | None, name: str | None, description: str | None = None) -> Estimate | None:
    key = FORMULA_CATEGORY.get(canonical_category(category) or "")
    if key is None:
        return None
    specs = parse_specs(name, description)
    r = estimate_co2(key, specs)
    use_total = r.lifecycle_kg - r.embodied_kg - r.eol_kg
    return Estimate(
        co2e_kg=r.lifecycle_kg,
        source="lifecycle_formula",
        confidence=CONFIDENCE[f"lifecycle_formula_{r.kwh_source}"],
        explanation_en=(f"Lifecycle estimate: manufacturing {r.embodied_kg:g} kg + electricity {r.annual_kwh:g} kWh/year "
                        f"({_KWH_SOURCE_EN[r.kwh_source]}) over {r.lifetime_years:g} years on the Vietnamese grid "
                        f"({EF_GRID} kg CO2e/kWh) = {use_total:.0f} kg, + end of life {r.eol_kg:g} kg."),
        explanation_vi=(f"Ước tính theo vòng đời: sản xuất {_vn_dec(r.embodied_kg)} kg + điện {_vn_dec(r.annual_kwh)} kWh/năm "
                        f"({_KWH_SOURCE_VI[r.kwh_source]}) trong {_vn_dec(r.lifetime_years)} năm với lưới điện Việt Nam "
                        f"({_vn_dec(EF_GRID)} kg CO₂e/kWh) = {_vn(use_total)} kg, + thải bỏ {_vn_dec(r.eol_kg)} kg."),
        detail={"formula_category": key, "kwh_source": r.kwh_source, "annual_kwh": r.annual_kwh,
                "low_kg": r.lifecycle_low_kg, "high_kg": r.lifecycle_high_kg},
    )


# ---------------------------------------------------------------- EEIO (price)

_eeio_cache: dict | None = None


def _eeio() -> dict:
    global _eeio_cache
    if _eeio_cache is None:
        _eeio_cache = json.loads(_DATA.read_text(encoding="utf-8"))
    return _eeio_cache




def vnd_to_usd2022(price_vnd: float) -> float:
    cur = _eeio()["currency"]
    vnd_per_usd = float(os.environ.get("CO2_VND_PER_USD", cur["vnd_per_usd"]))
    cpi_now = float(os.environ.get("CO2_CPI_NOW", cur["cpi_u_now"]))
    return price_vnd / vnd_per_usd * cur["cpi_u_2022"] / cpi_now


def eeio_estimate(category: str | None, price_vnd: float | None) -> Estimate | None:
    if not price_vnd or price_vnd < 1000:
        return None
    data = _eeio()
    naics = data["category_to_naics"].get(canonical_category(category) or "")
    if naics is None:
        return None
    factor = data["factors"][naics]
    usd = vnd_to_usd2022(float(price_vnd))
    kg = usd * factor["kg_per_usd2022"]
    title = factor["title"]
    return Estimate(
        co2e_kg=kg,
        source="eeio_price",
        confidence=CONFIDENCE["eeio_price"],
        explanation_en=(f"Rough estimate from the price: {price_vnd:,.0f} VND ≈ {usd:,.0f} USD (2022) × "
                        f"{factor['kg_per_usd2022']} kg CO2e/USD for '{title}' (US EPA supply-chain factors v1.3). "
                        f"Covers production and delivery only, not electricity during use."),
        explanation_vi=(f"Ước tính thô theo giá bán: {_vn(price_vnd)} đ ≈ {_vn(usd)} USD (giá 2022) × "
                        f"{str(factor['kg_per_usd2022']).replace('.', ',')} kg CO₂e/USD của ngành '{title}' "
                        f"(hệ số chuỗi cung ứng US EPA v1.3). Chỉ gồm sản xuất và vận chuyển, chưa gồm điện khi sử dụng."),
        detail={"naics": naics, "usd2022": usd, "factor": factor["kg_per_usd2022"]},
    )


# ---------------------------------------------------------------- chain

def estimate_without_neighbours(category: str | None, name: str | None, description: str | None,
                                price_vnd: float | None, stats: CategoryStats | None) -> Estimate | None:
    """First of formula -> category model -> EEIO that applies, or None."""
    for step in (
        lambda: formula_estimate(category, name, description),
        lambda: category_model_estimate(stats, category, name, description),
        lambda: eeio_estimate(category, price_vnd),
    ):
        est = step()
        if est is not None and est.co2e_kg > 0:
            return est
    return None
