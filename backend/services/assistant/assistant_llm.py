"""LLM calls for the assistant (OpenAI or Claude, see llm_provider): understand the request, then write the
chart code (Vega-Lite) and the explanation from numbers computed by our own
CO2 formula.  The model never invents product data -- it only receives rows we
computed and writes specs that reference them by field name.
"""

from __future__ import annotations

import json
import os
import re

import llm_provider
from pydantic import BaseModel, Field

from green.co2_formula import CATEGORY_PARAMS

MODEL = llm_provider.ANTHROPIC_MODEL  # kept for callers that print it


class Plan(BaseModel):
    search_query: str = Field(description="Short Vietnamese search query for the product search engine")
    category_slug: str
    budget_max_vnd: float | None = None
    required_features: list[str] = []
    horizons_months: list[int] = [6, 12]
    chart_request: str = Field(description="What the user wants to see, e.g. 'compare CO2 saved over 1 year'")


PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "search_query": {"type": "string"},
        "category_slug": {"type": "string", "enum": sorted(CATEGORY_PARAMS)},
        "budget_max_vnd": {"type": ["number", "null"]},
        "required_features": {"type": "array", "items": {"type": "string"}},
        "horizons_months": {"type": "array", "items": {"type": "integer", "enum": [1, 3, 6, 12, 24, 36]}},
        "chart_request": {"type": "string"},
    },
    "required": ["search_query", "category_slug", "budget_max_vnd", "required_features",
                 "horizons_months", "chart_request"],
    "additionalProperties": False,
}

PLAN_SYSTEM = """You turn a shopper's request (Vietnamese or English, possibly transcribed from voice, may contain
recognition errors) into a search plan for a Vietnamese home-appliance / electronics comparison site.
- search_query: concise Vietnamese query for the product search engine (product type + key constraints).
- category_slug: the single best matching category.
- budget_max_vnd: maximum price in VND if the user mentions one ("10 triệu" = 10000000), else null.
- horizons_months: usage horizons to report CO2 for; default [6, 12] unless the user asks otherwise.
- chart_request: one sentence describing the chart/table the user wants; if unspecified, ask for a
  comparison of price, electricity use and CO2 saved."""


class Composition(BaseModel):
    charts: list[dict]
    table_columns: list[str]
    explanation: str
    product_reasons: dict[str, str]


COMPOSE_SCHEMA = {
    "type": "object",
    "properties": {
        "charts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"title": {"type": "string"}, "vega_lite_spec": {"type": "string"}},
                "required": ["title", "vega_lite_spec"],
                "additionalProperties": False,
            },
        },
        "table_columns": {"type": "array", "items": {"type": "string"}},
        "explanation": {"type": "string"},
        "product_reasons": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"product_id": {"type": "string"}, "reason": {"type": "string"}},
                "required": ["product_id", "reason"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["charts", "table_columns", "explanation", "product_reasons"],
    "additionalProperties": False,
}

COMPOSE_SYSTEM = """You are the analysis assistant of Smart Product Finder, an eco-conscious product comparison site in Vietnam.
You receive the user's request and a table `products` whose numbers were computed by the site's CO2 formula:
  co2_saved_<N>m_kg  = CO2 avoided vs a standard product of the same capacity after N months of use
  kwh_<N>m           = electricity used in N months;   cost_<N>m_vnd = its cost
  lifecycle_co2_kg   = cradle-to-grave CO2;             green_score = 0-100 (higher is greener)

Produce:
1. charts: 1-2 Vega-Lite v5 specs (as JSON strings) that answer the user's chart request. Use
   "data": {"name": "products"} and ONLY field names that exist in the table. No external URLs, no href.
   Prefer simple bar / grouped bar charts; label axes in the user's language.
2. table_columns: the most useful columns (existing field names) for a comparison table, in order.
3. explanation: 4-8 sentences in the user's language: which product fits best and why (price, features, rating),
   and how much CO2 / electricity / money it saves over the requested horizons. Quote numbers exactly from the table.
   Mention that CO2 figures are estimates.
4. product_reasons: one short reason per product_id (why it fits, including its CO2 saving)."""


def _call(system: str, user: str, schema: dict, effort: str) -> dict:
    """Structured JSON from whichever provider has a key (OpenAI or Anthropic), see llm_provider."""
    return llm_provider.structured_call(system, user, schema, name="result", effort=effort, max_tokens=8000)


def make_plan(message: str) -> Plan:
    return Plan.model_validate(_call(PLAN_SYSTEM, message, PLAN_SCHEMA, effort="low"))


def compose(message: str, plan: Plan, rows: list[dict], lang: str) -> Composition:
    user = (
        f"User language: {lang}\nUser request: {message}\nChart request: {plan.chart_request}\n"
        f"Horizons (months): {plan.horizons_months}\n\nproducts = {json.dumps(rows, ensure_ascii=False)}"
    )
    data = _call(COMPOSE_SYSTEM, user, COMPOSE_SCHEMA, effort="medium")
    return Composition(
        charts=data["charts"],
        table_columns=data["table_columns"],
        explanation=data["explanation"],
        product_reasons={r["product_id"]: r["reason"] for r in data["product_reasons"]},
    )


# ---------------------------------------------------------------- rule-based plan (no model available)

_CATEGORY_WORDS = [
    ("gaming_laptops", ("laptop gaming", "laptop chơi game", "gaming laptop")),
    ("laptops", ("laptop", "máy tính xách tay", "macbook", "notebook")),
    ("smartphones", ("điện thoại", "smartphone", "iphone", "phone")),
    ("tablets", ("máy tính bảng", "tablet", "ipad")),
    ("monitors", ("màn hình", "monitor")),
    ("televisions", ("tivi", "tv", "smart tv")),
    ("air_conditioners", ("máy lạnh", "điều hòa", "điều hoà", "air conditioner")),
    ("refrigerators", ("tủ lạnh", "fridge", "refrigerator")),
    ("washing_machines", ("máy giặt", "washing machine")),
    ("electric_fans", ("quạt", "fan")),
    ("rice_cookers", ("nồi cơm", "rice cooker")),
    ("air_purifiers", ("máy lọc không khí", "air purifier")),
    ("water_purifiers", ("máy lọc nước", "water purifier")),
    ("vacuum_cleaners", ("máy hút bụi", "vacuum")),
    ("smartwatches", ("đồng hồ thông minh", "smartwatch", "apple watch")),
    ("headphones", ("tai nghe", "headphone", "earbuds")),
    ("speakers", ("loa", "speaker")),
    ("desktops", ("máy tính để bàn", "pc", "desktop")),
]
_ECO_WORDS = re.compile(r"(ít|thấp)\s*(co2|co₂|phát thải|khí thải)|xanh nhất|thân thiện môi trường|tiết kiệm điện( nhất)?|"
                        r"low[- ]carbon|eco|greenest|least co2", re.I)
_BUDGET = re.compile(r"(dưới|tối đa|không quá|<|under|below)?\s*(\d+(?:[.,]\d+)?)\s*(triệu|tr\b|million|m\b|k\b|nghìn|ngàn)", re.I)


def heuristic_plan(message: str) -> Plan:
    low = message.lower()
    category = next((slug for slug, words in _CATEGORY_WORDS if any(w in low for w in words)), "laptops")
    budget = None
    m = _BUDGET.search(low)
    if m:
        value = float(m.group(2).replace(",", "."))
        unit = m.group(3).lower()
        budget = value * (1_000 if unit in ("k", "nghìn", "ngàn") else 1_000_000)
    query = _BUDGET.sub(" ", message)
    query = _ECO_WORDS.sub(" ", query)
    query = re.sub(r"\b(tìm|giúp tôi|cho tôi|gợi ý|nên mua|chọn|rồi đặt mua|đặt mua|find|suggest)\b", " ", query, flags=re.I)
    query = re.sub(r"\s+", " ", query).strip(" ,.?") or message
    return Plan(search_query=query, category_slug=category, budget_max_vnd=budget, required_features=[],
                horizons_months=[6, 12], chart_request="compare CO2 of the candidates")


def plan_request(message: str) -> tuple[Plan, str]:
    """(plan, model label | "rule-based"): the model when reachable, keywords otherwise."""
    try:
        return make_plan(message), llm_provider.model_label()
    except Exception as error:  # no key, timeout, refusal, invalid JSON...
        print(f"assistant: plan via rules ({error.__class__.__name__})", flush=True)
        return heuristic_plan(message), "rule-based"


# ---------------------------------------------------------------- page layout + texts (B1)

PAGE_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "focus_ref": {"type": "string"},
        "recommended_refs": {"type": "array", "items": {"type": "string"}},
        "section_order": {"type": "array", "items": {"type": "string", "enum": [
            "recommendations", "formula", "lifecycle", "chart", "category_stats", "savings",
            "why_low_co2", "related", "sources"]}},
        "charts": {"type": "array", "items": {"type": "string", "enum": ["co2_bar", "price_vs_co2", "lifecycle_stack"]}},
        "why_bullets": {"type": "array", "items": {"type": "string"}},
        "reasons": {"type": "array", "items": {
            "type": "object",
            "properties": {"ref": {"type": "string"}, "reason": {"type": "string"}},
            "required": ["ref", "reason"], "additionalProperties": False}},
    },
    "required": ["summary", "focus_ref", "recommended_refs", "section_order", "charts", "why_bullets", "reasons"],
    "additionalProperties": False,
}

PAGE_SYSTEM = """You design the result page of Smart Product Finder, a Vietnamese product comparison site that
shows each product's lifecycle carbon footprint (kg CO2e). You receive the shopper's question and candidate products
named p1, p2, ... with their price, CO2 figure, green score (0-5, higher is greener, compared within the category),
how the CO2 figure was obtained (source) and its confidence, plus category statistics and savings.

Return the page layout and short texts in the user's language:
- focus_ref: the product the page is about (best fit for the question; prefer lower CO2 when the fit is similar).
- recommended_refs: up to 3 products, best first.
- section_order: which sections to show and in what order. charts: 1-3 chart types that answer the question.
- summary: 2-3 sentences answering the question directly: which product and the main reason.
- why_bullets: 3-5 bullets on why choosing the lower-CO2 product is worth it, each tied to a concrete figure.
- reasons: one short reason per recommended product.

Hard rule on numbers: never write a digit yourself. Every figure, and every product name, must be written as a
placeholder. `placeholders` maps each placeholder name to the exact text the system will print for it, e.g.
{"p1.co2e_kg": "278.2", "p1.price": "16,590,000 ₫"}: to mention that figure write {{p1.co2e_kg}}, never 278.2.
The candidates' numbers are there only so you can compare them; do not copy them into the texts.
Write units after the placeholder where needed: {{p1.co2e_kg}} kg CO₂e, {{p1.green_score}}/5. Percentages and
prices already carry their sign: write {{stats.greener_than_pct}} and {{p1.price}} alone.
Good: "{{p1.name}} emits {{p1.co2e_kg}} kg CO₂e, below the median of {{stats.median_kg}} kg."
Bad (deleted): "It emits 278.2 kg, below the 277 kg median." / "one of the 3 best" / "under 20 million".
Avoid other digits too (model numbers, budgets, counts): describe them in words or leave them out.
A sentence containing a digit that is not a placeholder is deleted by the system. Use only placeholders that exist.
Products without a CO2 figure have no green score: say the figure is not available rather than guessing.
CO2 figures are estimates of different reliability (see source/confidence); do not overstate precision."""


def compose_page(message: str, lang: str, candidates: list[dict], stats: dict | None, savings: dict | None,
                 placeholders: list[str]) -> dict:
    user = json.dumps({"lang": lang, "question": message, "candidates": candidates, "category_stats": stats,
                       "savings_vs_category_median": savings, "placeholders": placeholders},
                      ensure_ascii=False)
    return _call(PAGE_SYSTEM, user, PAGE_SCHEMA, effort="low")
