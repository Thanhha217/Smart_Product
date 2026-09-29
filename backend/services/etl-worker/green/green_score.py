"""GreenScore: decide whether a product counts as "green" (advisor requirement #1).

Score in [0, 100], transparent and rule-based so each point can be explained
to the user:

    GreenScore = sum(weight_i * component_i)   (weights depend on the focus group)

    appliances : 40 efficiency + 25 label + 15 technology + 10 certification + 10 circularity
    electronics: 20 efficiency +  0 label +  0 technology + 35 certification + 45 circularity
      (use phase is small for electronics, so reuse and eco-certification dominate)

    efficiency    1 - AEC_p / AEC_baseline, clipped to [0, 1]   (from co2_formula)
    label         energy-label stars / 5 (0 if unknown)
    technology    1 if inverter / DC motor, else 0
    certification 1 if any eco certification (Energy Star, EPEAT, TCO, Nhãn Xanh VN...)
    circularity   1 if refurbished / used (reuse avoids manufacturing emissions)

A product is "green" when GreenScore >= FocusGroup.min_green_score, or when it
carries a 5-star energy label.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from green.co2_formula import CATEGORY_PARAMS, baseline_annual_kwh, product_annual_kwh
from green.focus import FOCUS_GROUP, FocusGroup
from green.spec_parser import ProductSpecs

WEIGHTS = {
    "appliances": {"efficiency": 40, "label": 25, "technology": 15, "certification": 10, "circularity": 10},
    "electronics": {"efficiency": 20, "label": 0, "technology": 0, "certification": 35, "circularity": 45},
}


@dataclass
class GreenAssessment:
    score: float
    is_green: bool
    components: dict[str, float] = field(default_factory=dict)
    reasons_vi: list[str] = field(default_factory=list)


def assess_green(category: str, specs: ProductSpecs, group: FocusGroup | None = None) -> GreenAssessment:
    group = group or FOCUS_GROUP
    weights = WEIGHTS[group.key]
    comps = {k: 0.0 for k in weights}
    reasons = []

    if category in CATEGORY_PARAMS:
        aec_p, _ = product_annual_kwh(category, specs)
        aec_b = baseline_annual_kwh(category, specs)
        if aec_b > 0:
            comps["efficiency"] = min(1.0, max(0.0, 1 - aec_p / aec_b))
            if comps["efficiency"] > 0:
                reasons.append(f"Tiêu thụ điện thấp hơn {comps['efficiency']:.0%} so với sản phẩm tiêu chuẩn cùng công suất")

    if specs.energy_label_stars:
        comps["label"] = specs.energy_label_stars / 5
        reasons.append(f"Nhãn năng lượng {specs.energy_label_stars} sao")
    if specs.inverter:
        comps["technology"] = 1.0
        reasons.append("Công nghệ Inverter / động cơ DC")
    if specs.certifications:
        comps["certification"] = 1.0
        reasons.append("Chứng nhận môi trường: " + ", ".join(specs.certifications))
    if specs.refurbished:
        comps["circularity"] = 1.0
        reasons.append("Sản phẩm tái sử dụng / đã qua sử dụng (giảm phát thải sản xuất)")

    score = round(sum(weights[k] * v for k, v in comps.items()), 1)
    is_green = score >= group.min_green_score or specs.energy_label_stars == 5
    return GreenAssessment(score=score, is_green=is_green, components=comps, reasons_vi=reasons)
