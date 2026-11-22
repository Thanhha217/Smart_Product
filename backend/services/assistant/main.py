"""Assistant service (advisor requirement #4).

POST /assistant  {"message": "...", "lang": "vi"}

1. Claude turns the (typed or voice-transcribed) request into a search plan.
2. The existing search pipeline (db-search -> ranking system) returns candidates.
3. Our CO2 formula computes lifecycle CO2 and the CO2 / kWh / VND saved over
   6 and 12 months (or the horizons the user asked for) for every candidate.
4. Claude writes Vega-Lite chart code + the explanation from those numbers.
5. The server sanitises the chart code and injects the real data rows.
"""

from __future__ import annotations

import os
import traceback

import anthropic
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from assistant_llm import compose, make_plan
from chart_sanitizer import sanitize_spec
from green import assess_green, estimate_co2, estimate_savings, parse_specs

DB_SEARCH_URL = os.environ.get("DB_SEARCH_URL")
MAX_PRODUCTS = int(os.environ.get("ASSISTANT_MAX_PRODUCTS", "6"))

if not DB_SEARCH_URL:
    raise ValueError("DB_SEARCH_URL environment variable is not set")

app = FastAPI()


class AssistantRequest(BaseModel):
    message: str
    lang: str = "vi"


def _search(query: str, limit: int = 32) -> list[dict]:
    response = requests.post(f"{DB_SEARCH_URL}/query", params={"q": query, "limit": limit}, json={}, timeout=120)
    response.raise_for_status()
    return response.json().get("products", [])


def _row(item: dict, category: str, horizons: tuple[int, ...]) -> tuple[dict, list[str], str | None, str | None]:
    product = item["product"]
    specs = parse_specs(product.get("name"), product.get("co2e_explanation"))
    co2 = estimate_co2(category, specs, horizons)
    savings = estimate_savings(category, specs, horizons)
    green = assess_green(category, specs)

    row = {
        "product_id": str(product["id"]),
        "name": product["name"],
        "platform": item.get("platform_name"),
        "price_vnd": product.get("final_price"),
        "rating": round((product.get("product_rating") or 0) * 5, 1),
        "review_count": product.get("review_count"),
        "annual_kwh": co2.annual_kwh,
        "kwh_source": co2.kwh_source,
        "lifecycle_co2_kg": co2.lifecycle_kg,
        "green_score": green.score,
        "is_green": green.is_green,
        "energy_label_stars": specs.energy_label_stars,
        "inverter": specs.inverter,
    }
    for h in co2.horizons:
        row[f"kwh_{h.months}m"] = h.kwh
        row[f"co2_{h.months}m_kg"] = h.total_kg
        row[f"cost_{h.months}m_vnd"] = h.cost_vnd
    for s in savings:
        row[f"co2_saved_{s.months}m_kg"] = s.co2_net_saved_kg
        row[f"kwh_saved_{s.months}m"] = s.kwh_saved
        row[f"money_saved_{s.months}m_vnd"] = s.money_saved_vnd
    return row, green.reasons_vi, product.get("product_url"), item.get("image_url")


@app.get("/")
def root():
    return {"message": "assistant up"}


@app.post("/assistant")
def assistant(req: AssistantRequest):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Empty message")
    try:
        plan = make_plan(req.message)
        horizons = tuple(sorted(set(plan.horizons_months or [6, 12])))
        candidates = _search(plan.search_query)
        if plan.budget_max_vnd:
            candidates = [c for c in candidates if (c["product"].get("final_price") or 0) <= plan.budget_max_vnd]

        rows, extras = [], {}
        for item in candidates:
            row, green_reasons, url, image = _row(item, plan.category_slug, horizons)
            rows.append(row)
            extras[row["product_id"]] = {"green_reasons": green_reasons, "product_url": url, "image_url": image}
        # Keep the search ranking, but let clearly greener products move up within the shortlist.
        shortlist = list(enumerate(rows[: MAX_PRODUCTS * 2]))
        shortlist.sort(key=lambda pair: (not pair[1]["is_green"], pair[0]))
        rows = [row for _, row in shortlist][:MAX_PRODUCTS]
        if not rows:
            return {"plan": plan.model_dump(), "products": [], "charts": [], "table": None,
                    "explanation": "Không tìm thấy sản phẩm phù hợp." if req.lang == "vi" else "No matching product found."}

        composition = compose(req.message, plan, rows, req.lang)
        charts = []
        for chart in composition.charts:
            spec = sanitize_spec(chart.get("vega_lite_spec", ""), rows)
            if spec is not None:
                charts.append({"title": chart.get("title", ""), "spec": spec})

        columns = [c for c in composition.table_columns if c in rows[0]] or ["name", "price_vnd", "co2_saved_12m_kg"]
        return {
            "plan": plan.model_dump(),
            "products": [
                {**r, **extras[r["product_id"]], "reason": composition.product_reasons.get(r["product_id"], "")}
                for r in rows
            ],
            "charts": charts,
            "table": {"columns": columns, "rows": [[r.get(c) for c in columns] for r in rows]},
            "explanation": composition.explanation,
        }
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Search service unavailable")
    except anthropic.APIError as error:
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"LLM error: {error.__class__.__name__}")
