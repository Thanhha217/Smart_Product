"""The AI-generated result page: layout rules, number placeholders, charts.

The model never writes a number and never writes HTML.  It returns a *layout*
(which sections, which chart types, which product is the focus) and short texts
in which every number is a placeholder such as ``{{p1.co2e_kg}}``.  This module

* fills the placeholders from the real rows (``fill_text``),
* drops every sentence that still contains a hand-written number and counts it
  (``number_check_failures``, YC-3),
* builds the Vega-Lite charts itself from the rows (YC-4: only three chart types),
* computes the "savings" panel (best product vs. the category median).

Pure Python (no network, no database), unit-tested in tests/test_page_spec.py.
"""
from __future__ import annotations

import re
from typing import Any, Iterable

SECTION_TYPES = ("recommendations", "formula", "lifecycle", "chart", "category_stats", "savings",
                 "why_low_co2", "related", "sources")
CHART_TYPES = ("co2_bar", "price_vs_co2", "lifecycle_stack")
DEFAULT_ORDER = ["recommendations", "formula", "lifecycle", "chart", "category_stats", "savings",
                 "why_low_co2", "related", "sources"]
DEFAULT_CHARTS = ["co2_bar", "price_vs_co2"]
TREE_KG_PER_YEAR = 21.8

# Typical service life (years) per reference category, from green/co2_formula.py CATEGORY_PARAMS.
LIFETIME_YEARS = {
    "smartphone": 3, "feature_phone": 3, "laptop": 4, "gaming_laptop": 4, "tablet": 4, "desktop": 5,
    "computer_monitor": 6, "smartwatch": 3, "wearable": 3, "headphone": 3, "speaker": 5, "television": 8,
    "air_conditioner": 10, "refrigerator": 12, "washing_machine": 10, "electric_fan": 7, "rice_cooker": 6,
    "air_purifier": 7, "water_purifier": 8, "vacuum_cleaner": 6, "microwave_oven": 8, "stove": 8, "lighting": 8,
}
DEFAULT_LIFETIME = 4

SOURCE_LIMITS = {
    "manufacturer": ("Số do hãng công bố; phần sử dụng tính theo lưới điện nơi hãng chọn (thường không phải Việt Nam).",
                     "Manufacturer figure; its use phase follows the grid the maker chose (usually not Vietnam's)."),
    "neighbor_average": ("Trung bình các sản phẩm giống (cosine ≥ 0,66); sai số khoảng 20% với loại đã có mẫu.",
                         "Average of similar products (cosine ≥ 0.66); about 20 % error for covered categories."),
    "lifecycle_formula": ("Công thức vòng đời với tham số giả định của loại; chưa đủ số thật để kiểm định.",
                          "Lifecycle formula with assumed category parameters; not yet validated on real figures."),
    "category_model": ("Mức giữa của loại; sai số trung vị khoảng 21% (màn hình 14%, ngoại vi khoảng 40%).",
                       "Category model; median error about 21 % (monitors 14 %, peripherals about 40 %)."),
    "eeio_price": ("Ước tính thô theo giá: chỉ gồm sản xuất và vận chuyển, không gồm điện khi dùng.",
                   "Rough price-based estimate: production and delivery only, no use phase."),
    "llm_estimate": ("Số do AI chỉnh từ trung bình mẫu giống (chỉ dùng cho thí nghiệm).",
                     "LLM-adjusted neighbour average (experiments only)."),
}

_PLACEHOLDER = re.compile(r"\{\{\s*([a-z0-9_]+)\.([a-z0-9_]+)\s*\}\}")
_SENTENCE = re.compile(r"(?<=[.!?…])\s+")
_SCORE_SCALE = re.compile(r"\}\}\s*/\s*5(?![0-9])")
_CO2 = re.compile(r"\bCO2(e)?\b", re.IGNORECASE)


# ------------------------------------------------------------------ formatting

def fmt_number(x: float | None, lang: str = "vi", digits: int = 1) -> str:
    if x is None:
        return "—"
    s = f"{x:,.{digits}f}"
    if digits:
        s = s.rstrip("0").rstrip(".")
    if lang == "vi":
        return s.replace(",", " ").replace(".", ",").replace(" ", ".")
    if lang == "fr":   # 1 234,5 (narrow no-break space for thousands)
        return s.replace(",", " ").replace(".", ",")
    return s


def fmt_kg(x: float | None, lang: str = "vi") -> str:
    """1 decimal from 1 kg, 2 decimals below (spec §3.3)."""
    if x is None:
        return "—"
    return fmt_number(x, lang, 1 if abs(x) >= 1 else 2)


def fmt_price(x: float | None, lang: str = "vi") -> str:
    if x is None:
        return "—"
    return f"{fmt_number(x, lang, 0)} đ" if lang == "vi" else f"{fmt_number(x, lang, 0)} ₫" if lang == "fr" else f"{fmt_number(x, lang, 0)} VND"


# ------------------------------------------------------------------ placeholders

def aliases(product_ids: Iterable[str]) -> dict[str, str]:
    """{'p1': '123', 'p2': '456', ...} in the given order."""
    return {f"p{i}": pid for i, pid in enumerate(product_ids, start=1)}


# Where a product's CO2 figure comes from, in words (the model may cite it as {{pN.source}}; no digits)
SOURCE_LABEL = {
    "manufacturer": {"vi": "số do hãng công bố", "en": "the manufacturer's published figure", "fr": "le chiffre publié par le fabricant"},
    "neighbor_average": {"vi": "trung bình các sản phẩm giống có số của hãng", "en": "the average of similar products with published figures",
                         "fr": "la moyenne de produits similaires avec chiffres publiés"},
    "category_model": {"vi": "mức điển hình của loại", "en": "the typical level of the category", "fr": "le niveau typique de la catégorie"},
    "lifecycle_formula": {"vi": "công thức theo điện năng", "en": "the electricity-based formula", "fr": "la formule basée sur l'électricité"},
    "eeio_price": {"vi": "ước tính thô theo giá bán", "en": "a rough estimate from the price", "fr": "une estimation grossière par le prix"},
    "llm_estimate": {"vi": "ước tính có AI chỉnh", "en": "an AI-adjusted estimate", "fr": "une estimation ajustée par IA"},
}


def placeholder_values(cards: dict[str, dict], alias_map: dict[str, str], savings: dict | None,
                       stats: dict | None, lang: str = "vi") -> dict[str, str]:
    """Every value the model may cite, already formatted for the page language."""
    values: dict[str, str] = {}
    for alias, pid in alias_map.items():
        c = cards.get(pid) or {}
        values[f"{alias}.name"] = c.get("name") or ""
        values[f"{alias}.co2e_kg"] = fmt_kg(c.get("co2e_kg"), lang)
        values[f"{alias}.price"] = fmt_price(c.get("price_vnd"), lang)
        values[f"{alias}.green_score"] = fmt_number(c.get("green_score"), lang, 1)
        values[f"{alias}.platform"] = c.get("platform") or ""
        src = SOURCE_LABEL.get(c.get("co2e_source") or "", {})
        values[f"{alias}.source"] = src.get(lang) or src.get("en") or ""
    if savings:
        values["savings.lifecycle_kg"] = fmt_kg(savings.get("lifecycle_kg_saved"), lang)
        values["savings.trees"] = fmt_number(savings.get("trees_year"), lang, 1)
        # the model also sees the savings object, whose keys differ: accept them as names for the same values
        values["savings.lifecycle_kg_saved"] = values["savings.lifecycle_kg"]
        values["savings.trees_year"] = values["savings.trees"]
        values["savings.baseline_kg"] = fmt_kg(savings.get("baseline_kg"), lang)
        for h in savings.get("horizons", []):
            values[f"savings.kg_{h['months']}m"] = fmt_kg(h.get("kg"), lang)
            if h.get("kwh") is not None:
                values[f"savings.kwh_{h['months']}m"] = fmt_number(h["kwh"], lang, 0)
            if h.get("vnd") is not None:
                values[f"savings.vnd_{h['months']}m"] = fmt_price(h["vnd"], lang)
    if stats:
        values["stats.median_kg"] = fmt_kg(stats.get("median_kg"), lang)
        values["stats.n"] = fmt_number(stats.get("n"), lang, 0)
        values["stats.greener_than_pct"] = fmt_number(stats.get("greener_than_pct"), lang, 0) + "%"
    return {k: v for k, v in values.items() if v not in ("", "—", "—%")}


def fill_text(text: str, values: dict[str, str], allowed_literals: Iterable[str] = ()) -> tuple[str, int]:
    """Fill placeholders sentence by sentence; drop sentences with a raw number or an unknown placeholder.

    ``allowed_literals`` are strings whose digits are not "numbers the model wrote"
    (product names such as "iPhone 15", the user's own question).
    Returns (clean text, number of dropped sentences).
    """
    literals = sorted({s for s in allowed_literals if s}, key=len, reverse=True)
    kept, failures = [], 0
    for sentence in _SENTENCE.split(text.strip()) if text and text.strip() else []:
        unknown = False

        def sub(m: re.Match) -> str:
            nonlocal unknown
            key = f"{m.group(1)}.{m.group(2)}"
            if key not in values:
                unknown = True
                return ""
            return values[key]

        # "{{p1.green_score}}/5" is the score scale the prompt asks for, not a figure the model made up
        bare = _PLACEHOLDER.sub(" ", _SCORE_SCALE.sub("}}", sentence))
        low = _CO2.sub(" ", bare).lower()   # the "2" of "CO2" / "CO2e" is chemistry, not a figure
        for lit in literals:
            low = low.replace(lit.lower(), " ")
        # the percentage value already ends in "%": "{{stats.greener_than_pct}}%" must not print "49%%"
        filled = re.sub(r"%\s*%", "%", _PLACEHOLDER.sub(sub, sentence))
        filled = _CO2.sub(lambda m: "CO₂" + (m.group(1) or ""), filled)
        if unknown or re.search(r"[0-9]", low):
            failures += 1
            print(f"assistant: dropped a sentence ({'unknown placeholder' if unknown else 'hand-written number'}): "
                  f"{sentence[:160]!r}", flush=True)
            continue
        kept.append(filled)
    return " ".join(kept), failures


# ------------------------------------------------------------------ layout

def validate_layout(order: Iterable[str] | None, charts: Iterable[str] | None) -> tuple[list[str], list[str]]:
    """Keep only known section / chart types, unique, recommendations first and sources last."""
    seen: list[str] = []
    for t in order or []:
        if t in SECTION_TYPES and t not in seen:
            seen.append(t)
    if not seen:
        seen = list(DEFAULT_ORDER)
    for must in ("recommendations", "formula", "lifecycle", "sources"):
        if must not in seen:
            seen.append(must)
    seen.remove("recommendations")
    seen.insert(0, "recommendations")
    seen.remove("sources")
    seen.append("sources")
    chart_list = [c for c in dict.fromkeys(charts or []) if c in CHART_TYPES] or list(DEFAULT_CHARTS)
    return seen, chart_list


def valid_refs(refs: Iterable[str] | None, alias_map: dict[str, str]) -> list[str]:
    """Aliases -> product ids, keeping only candidates (YC: product_ids must be among the candidates)."""
    out = []
    for r in refs or []:
        pid = alias_map.get(r) or (r if r in alias_map.values() else None)
        if pid and pid not in out:
            out.append(pid)
    return out


# ------------------------------------------------------------------ recommendation order

def shortlist(cards: list[dict], size: int = 6) -> list[dict]:
    """Candidates of the dominant CO2 category, greenest first; relevance order breaks ties.

    Products without a number sit in the middle (same rule as rrf.carbon_ranks).
    """
    head = cards[: max(size * 2, 8)]
    cats = [c.get("category") for c in head if c.get("category")]
    if cats:
        main = max(set(cats), key=cats.count)
        same = [c for c in head if c.get("category") in (main, None)]
        head = same or head
    known = sorted(c["co2e_kg"] for c in head if c.get("co2e_kg") is not None)
    middle = known[len(known) // 2] if known else 0
    ranked = sorted(enumerate(head), key=lambda p: (p[1]["co2e_kg"] if p[1].get("co2e_kg") is not None else middle, p[0]))
    return [c for _, c in ranked][:size]


# ------------------------------------------------------------------ savings

def compute_savings(best: dict, stats: dict | None, horizons_months: Iterable[int] = (6, 12),
                    appliance_savings: list[dict] | None = None) -> dict | None:
    """Best product vs. the category median, on the whole-life (cradle-to-grave) scope.

    The lifecycle difference is NOT spread over months: emissions are not produced evenly
    during use. Monthly figures only appear for appliances, where green.estimate_savings
    compares the electricity of this product with a standard unit of the same capacity
    (``appliance_savings``: kWh, VND and the use-phase CO2 of that electricity).
    """
    kg = best.get("co2e_kg")
    median = (stats or {}).get("median_kg")
    if kg is None or median is None or median <= kg:
        return None
    saved = median - kg
    horizons = []
    for s in appliance_savings or []:
        if s.get("months") in tuple(horizons_months) and s.get("kwh_saved") is not None:
            horizons.append({"months": s["months"], "kg": s.get("co2_use_saved_kg"), "kwh": s["kwh_saved"],
                             "vnd": s.get("money_saved_vnd")})
    return {"best_id": best["product_id"], "baseline": "category_median", "baseline_kg": round(median, 2),
            "scope": "cradle_to_grave", "lifecycle_kg_saved": round(saved, 2),
            "horizons": horizons,
            "horizon_basis": "standard_unit_same_capacity" if horizons else None,
            # trees needed to absorb the whole lifecycle difference within one year
            "trees_year": round(saved / TREE_KG_PER_YEAR, 1)}


# ------------------------------------------------------------------ charts (server-built Vega-Lite)

_GREEN_SCALE = {"domain": [0, 2.5, 5], "range": ["#d64545", "#e0a526", "#2e9e5b"]}


def _short(name: str | None, n: int = 38) -> str:
    name = name or ""
    return name if len(name) <= n else name[: n - 1] + "…"


def build_chart(kind: str, cards: list[dict], lifecycles: dict[str, dict], lang: str = "vi") -> dict | None:
    vi = lang == "vi"
    known = [c for c in cards if c.get("co2e_kg") is not None]
    if kind == "co2_bar" and known:
        rows = [{"name": _short(c["name"]), "co2e_kg": c["co2e_kg"], "green_score": c.get("green_score"),
                 "source": c.get("co2e_source")} for c in known]
        return {
            "title": "CO₂ vòng đời của các ứng viên" if vi else "Lifecycle CO₂ of the candidates",
            "spec": {"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "width": "container", "height": 40 * len(rows) + 40,
                     "data": {"values": rows}, "mark": {"type": "bar", "cornerRadiusEnd": 3},
                     "encoding": {"y": {"field": "name", "type": "nominal", "sort": "x", "title": None},
                                  "x": {"field": "co2e_kg", "type": "quantitative", "title": "kg CO₂e"},
                                  "color": {"field": "green_score", "type": "quantitative", "scale": _GREEN_SCALE,
                                            "title": "Điểm xanh" if vi else "Green score"},
                                  "tooltip": [{"field": "name"}, {"field": "co2e_kg", "title": "kg CO₂e"},
                                              {"field": "green_score"}, {"field": "source"}]}}}
    if kind == "price_vs_co2":
        rows = [{"name": _short(c["name"]), "price_vnd": c["price_vnd"], "co2e_kg": c["co2e_kg"],
                 "green_score": c.get("green_score")} for c in known if c.get("price_vnd")]
        if len(rows) < 2:
            return None
        return {
            "title": "Giá và CO₂: góc dưới bên trái là vừa rẻ vừa xanh" if vi else "Price vs CO₂: bottom-left is cheap and green",
            "spec": {"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "width": "container", "height": 260,
                     "data": {"values": rows}, "mark": {"type": "point", "filled": True, "size": 140},
                     "encoding": {"x": {"field": "price_vnd", "type": "quantitative", "title": "Giá (đ)" if vi else "Price (VND)"},
                                  "y": {"field": "co2e_kg", "type": "quantitative", "title": "kg CO₂e"},
                                  "color": {"field": "green_score", "type": "quantitative", "scale": _GREEN_SCALE,
                                            "title": "Điểm xanh" if vi else "Green score"},
                                  "tooltip": [{"field": "name"}, {"field": "price_vnd"}, {"field": "co2e_kg"}]}}}
    if kind == "lifecycle_stack":
        rows = []
        for c in known:
            lc = lifecycles.get(c["product_id"]) or {}
            for s in lc.get("stages", []):
                rows.append({"name": _short(c["name"]), "stage": s["label_vi"] if vi else s["label_en"], "kg": s["kg"]})
        if not rows:
            return None
        return {
            "title": "CO₂ theo giai đoạn vòng đời" if vi else "CO₂ by lifecycle stage",
            "spec": {"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "width": "container", "height": 40 * len(known) + 60,
                     "data": {"values": rows}, "mark": "bar",
                     "encoding": {"y": {"field": "name", "type": "nominal", "title": None},
                                  "x": {"field": "kg", "type": "quantitative", "stack": "zero", "title": "kg CO₂e"},
                                  "color": {"field": "stage", "type": "nominal", "title": "Giai đoạn" if vi else "Stage"},
                                  "tooltip": [{"field": "name"}, {"field": "stage"}, {"field": "kg"}]}}}
    return None


# ------------------------------------------------------------------ rule-based texts (no AI available)

def default_texts(alias_map: dict[str, str], cards: dict[str, dict], savings: dict | None, stats: dict | None,
                  lang: str = "vi") -> tuple[str, list[str]]:
    """Summary + bullets with placeholders only, used when the model is unavailable or invalid (vi, en, fr)."""
    def T(vi, en, fr):
        return {"vi": vi, "fr": fr}.get(lang, en)
    has_kg = cards.get(alias_map.get("p1", ""), {}).get("co2e_kg") is not None
    summary = (T("Gợi ý {{p1.name}} giá {{p1.price}}, phát thải khoảng {{p1.co2e_kg}} kg CO₂e trong cả vòng đời.",
                 "We suggest {{p1.name}} at {{p1.price}}, about {{p1.co2e_kg}} kg CO₂e over its lifecycle.",
                 "Nous suggérons {{p1.name}} à {{p1.price}}, environ {{p1.co2e_kg}} kg CO₂e sur tout son cycle de vie.")
               if has_kg else
               T("Gợi ý {{p1.name}} giá {{p1.price}}; sản phẩm này chưa có số CO₂.",
                 "We suggest {{p1.name}} at {{p1.price}}; it has no CO₂ figure yet.",
                 "Nous suggérons {{p1.name}} à {{p1.price}} ; ce produit n’a pas encore de chiffre CO₂."))
    bullets = []
    if stats and stats.get("greener_than_pct") is not None:
        bullets.append(T("Xanh hơn {{stats.greener_than_pct}} sản phẩm cùng loại (trung vị của loại là {{stats.median_kg}} kg).",
                         "Greener than {{stats.greener_than_pct}} of its category (median {{stats.median_kg}} kg).",
                         "Plus sobre que {{stats.greener_than_pct}} des produits de sa catégorie (médiane {{stats.median_kg}} kg)."))
    if savings:
        bullets.append(T("So với món trung bình của loại, chọn món này giảm {{savings.lifecycle_kg}} kg CO₂e trong vòng đời.",
                         "Compared with a typical product, it avoids {{savings.lifecycle_kg}} kg CO₂e over its life.",
                         "Par rapport à un produit typique, il évite {{savings.lifecycle_kg}} kg CO₂e sur sa durée de vie."))
        bullets.append(T("Tương đương lượng CO₂ mà {{savings.trees}} cây xanh hấp thụ mỗi năm.",
                         "That is what {{savings.trees}} trees absorb in a year.",
                         "C’est ce qu’absorbent {{savings.trees}} arbres en un an."))
    if "p2" in alias_map and cards.get(alias_map["p2"], {}).get("co2e_kg") is not None and has_kg:
        bullets.append(T("{{p1.name}}: {{p1.co2e_kg}} kg so với {{p2.name}}: {{p2.co2e_kg}} kg.",
                         "{{p1.name}}: {{p1.co2e_kg}} kg vs {{p2.name}}: {{p2.co2e_kg}} kg.",
                         "{{p1.name}} : {{p1.co2e_kg}} kg contre {{p2.name}} : {{p2.co2e_kg}} kg."))
    return summary, bullets
