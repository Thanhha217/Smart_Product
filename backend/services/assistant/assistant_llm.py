"""Claude calls for the assistant: understand the request, then write the
chart code (Vega-Lite) and the explanation from numbers computed by our own
CO2 formula.  The model never invents product data -- it only receives rows we
computed and writes specs that reference them by field name.
"""

from __future__ import annotations

import json
import os

import anthropic
from pydantic import BaseModel, Field

from green.co2_formula import CATEGORY_PARAMS

MODEL = os.environ.get("ASSISTANT_MODEL", "claude-opus-5-5")
_client = anthropic.Anthropic()


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
    response = _client.beta.messages.create(
        model=MODEL,
        max_tokens=16000,
        system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": user}],
        output_config={"effort": effort, "format": {"type": "json_schema", "schema": schema}},
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("The model declined this request.")
    if response.stop_reason == "max_tokens":
        raise RuntimeError("The model response was truncated.")
    return json.loads(next(b.text for b in response.content if b.type == "text"))


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
