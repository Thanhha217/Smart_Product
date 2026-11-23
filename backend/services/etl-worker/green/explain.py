"""Show HOW a stored CO2 number was obtained, with the real values substituted
into the formula of its method ("Công thức áp dụng" on the AI page).

Input is one product row as db-search returns it (co2e_kg, co2e_source,
co2e_detail, co2e_references, co2e_category, name, description, final_price).
Rows written before ``co2e_detail`` existed are rebuilt when the method can be
recomputed from the row itself (lifecycle formula, price/EEIO); otherwise
``complete`` is False and only the total is shown.

Pure Python, unit-tested in tests/test_explain.py.
"""
from __future__ import annotations

import json
from typing import Any

from green import fallback
from green.lifecycle import decompose

TITLES = {
    "manufacturer": ("Số của hãng (trùng đúng mẫu)", "Manufacturer figure (exact model)",
                     "CO₂ = số hãng công bố cho đúng mẫu"),
    "neighbor_average": ("Trung bình sản phẩm giống (cosine ≥ 0,66)", "Average of similar products (cosine ≥ 0.66)",
                         "CO₂ = (Σ CO₂ mẫu giống) ÷ n"),
    "llm_estimate": ("AI chỉnh trung bình mẫu giống (thí nghiệm)", "LLM-adjusted neighbour average (experiment)",
                     "CO₂ = AI(trung bình mẫu giống)"),
    "lifecycle_formula": ("Công thức vòng đời (điện gia dụng)", "Lifecycle formula (appliances)",
                          "CO₂ = E_sx + L × (kWh/năm × EF_VN + rò rỉ ga) + E_thải bỏ"),
    "category_model": ("Mức giữa của loại (hãng + cỡ màn hình)", "Category model (brand + screen size)",
                       "CO₂ = trung vị (loại hoặc hãng) × (inch ÷ inch chuẩn)^b"),
    "eeio_price": ("Theo giá bán × hệ số ngành (US EPA)", "Price × industry factor (US EPA)",
                   "CO₂ = giá ÷ tỷ giá × (CPI 2022 ÷ CPI nay) × hệ số ngành"),
    "none": ("Chưa có số CO₂", "No CO2 figure", "—"),
}


def vn(x: float | None, digits: int = 1) -> str:
    """Vietnamese number format: 1234.5 -> '1.234,5'."""
    if x is None:
        return "—"
    s = f"{x:,.{digits}f}"
    if digits:
        s = s.rstrip("0").rstrip(".")
    return s.replace(",", " ").replace(".", ",").replace(" ", ".")


def _json(raw: Any) -> Any:
    if raw is None or isinstance(raw, (dict, list)):
        return raw
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return None


def _step(label_vi: str, label_en: str, expr: str, value_kg: float | None = None) -> dict[str, Any]:
    return {"label_vi": label_vi, "label_en": label_en, "expr": expr, "value_kg": value_kg}


def _rebuild_detail(source: str, row: dict[str, Any]) -> dict[str, Any] | None:
    cat, name, desc = row.get("co2e_category"), row.get("name"), row.get("description")
    est = None
    if source == "lifecycle_formula":
        est = fallback.formula_estimate(cat, name, desc)
    elif source == "eeio_price":
        est = fallback.eeio_estimate(cat, row.get("final_price") or row.get("price_vnd"))
    return dict(est.detail) if est else None


def build_formula(row: dict[str, Any]) -> dict[str, Any]:
    kg = row.get("co2e_kg")
    source = row.get("co2e_source") or "none"
    if kg is None:
        source = "none"
    detail = _json(row.get("co2e_detail")) or {}
    refs = _json(row.get("co2e_references")) or []
    title_vi, title_en, expression = TITLES.get(source, (source, source, "—"))
    steps: list[dict[str, Any]] = []
    complete = True

    if source == "manufacturer":
        ref = refs[0] if refs else {}
        steps.append(_step(f"Mẫu trong danh sách: {ref.get('name', '—')}", f"Reference: {ref.get('name', '—')}",
                           f"{vn(ref.get('co2e_kg'))} kg", ref.get("co2e_kg")))
        complete = bool(refs)
    elif source in ("neighbor_average", "llm_estimate"):
        for r in refs:
            steps.append(_step(f"{r.get('name')} (giống {vn((r.get('cosine') or 0) * 100, 0)}%)",
                               f"{r.get('name')} (cosine {r.get('cosine')})", f"{vn(r.get('co2e_kg'))} kg",
                               r.get("co2e_kg")))
        if refs:
            values = [float(r.get("co2e_kg") or 0) for r in refs]
            avg = sum(values) / len(values)
            steps.append(_step("Trung bình", "Average",
                               f"({' + '.join(vn(v) for v in values)}) ÷ {len(values)} = {vn(avg)} kg", round(avg, 2)))
        complete = bool(refs)
    elif source in ("lifecycle_formula", "category_model", "eeio_price"):
        if not detail or (source == "lifecycle_formula" and "embodied_kg" not in detail) or (
                source == "eeio_price" and "price_vnd" not in detail) or (
                source == "category_model" and "category_median_kg" not in detail):
            detail = _rebuild_detail(source, row) or detail
        if source == "lifecycle_formula" and "embodied_kg" in detail:
            life, ef = detail["lifetime_years"], detail.get("ef_grid")
            kwh, refr = detail.get("annual_kwh"), detail.get("refrigerant_kg_per_year") or 0
            use = life * detail["use_kg_per_year"]
            kwh_src = {"label": "nhãn năng lượng", "rated_power": "công suất ghi trên máy",
                       "category_default": "mức điển hình của loại"}.get(detail.get("kwh_source"), "")
            steps += [
                _step("Sản xuất (E_sx)", "Manufacturing", f"{vn(detail['embodied_kg'])} kg", detail["embodied_kg"]),
                _step(f"Điện khi dùng ({kwh_src})", "Electricity in use",
                      f"{vn(life)} năm × {vn(kwh)} kWh/năm × {vn(ef, 3)} = {vn(use)} kg", round(use, 2)),
                _step("Rò rỉ môi chất lạnh", "Refrigerant leakage",
                      f"{vn(life)} năm × {vn(refr, 2)} kg/năm = {vn(life * refr)} kg", round(life * refr, 2)),
                _step("Thải bỏ (E_thải bỏ)", "End of life", f"{vn(detail.get('eol_kg'))} kg", detail.get("eol_kg")),
            ]
        elif source == "category_model" and "category_median_kg" in detail:
            n = detail.get("n_refs")
            if detail.get("brand"):
                base = detail["brand_median_kg"]
                steps.append(_step(f"Trung vị của {detail['brand']} ({detail.get('brand_n')} mẫu, loại có {n} mẫu)",
                                   f"{detail['brand']} median", f"{vn(base)} kg", base))
            else:
                base = detail["category_median_kg"]
                steps.append(_step(f"Trung vị của loại ({n} mẫu do hãng công bố)", "Category median",
                                   f"{vn(base)} kg", base))
            if detail.get("screen_inch") and detail.get("slope"):
                factor = (detail["screen_inch"] / detail["ref_inch"]) ** detail["slope"]
                steps.append(_step("Hệ số cỡ màn hình", "Screen-size factor",
                                   f"({vn(detail['screen_inch'])} ÷ {vn(detail['ref_inch'])})^{vn(detail['slope'], 2)} "
                                   f"= {vn(factor, 3)}"))
                steps.append(_step("Kết quả", "Result", f"{vn(base)} × {vn(factor, 3)} = {vn(base * factor)} kg",
                                   round(base * factor, 2)))
        elif source == "eeio_price" and "price_vnd" in detail:
            steps += [
                _step("Đổi giá sang USD năm 2022", "Price in 2022 USD",
                      f"{vn(detail['price_vnd'], 0)} đ ÷ {vn(detail['vnd_per_usd'], 0)} × ({vn(detail['cpi_2022'], 3)} ÷ "
                      f"{vn(detail['cpi_now'], 3)}) = {vn(detail['usd2022'], 2)} USD"),
                _step(f"Hệ số ngành: {detail.get('title', detail.get('naics'))}", "Industry factor",
                      f"{vn(detail['usd2022'], 2)} × {vn(detail['factor'], 3)} = {vn(detail['usd2022'] * detail['factor'], 2)} kg",
                      round(detail["usd2022"] * detail["factor"], 3)),
            ]
        complete = bool(steps)

    return {
        "method": source, "title_vi": title_vi, "title_en": title_en, "expression": expression,
        "steps": steps, "result_kg": kg, "confidence": row.get("co2e_confidence"),
        "complete": complete, "detail": detail,
    }


def explain(row: dict[str, Any]) -> dict[str, Any]:
    """Formula + lifecycle objects for one product row."""
    formula = build_formula(row)
    lifecycle = decompose(row.get("co2e_kg"), formula["method"], row.get("co2e_category"),
                          formula["detail"], row.get("name"))
    return {"formula": formula, "lifecycle": lifecycle}
