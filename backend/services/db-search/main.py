import os
import requests
from fastapi import FastAPI, HTTPException
from typing import Optional

import time
from datetime import datetime, timezone

from co2_queries import category_stats, overview, related_product_ids
import search_api
from db_search_functions import engine, get_product_data_from_id, get_products_data_from_ids
from dto.QueryDTO import ProductsFromIdsDTO, QueryWithImageDTO
app = FastAPI()

RANKING_SYSTEM_URL = os.environ.get("RANKING_SYSTEM_URL")

if not RANKING_SYSTEM_URL:
    raise ValueError("RANKING_SYSTEM_URL environment variable is not set")

# Even though its a retrieve function, we have to make it a POST because
# we can fit all ids into the body and not into query params
@app.post("/products-from-ids")
def get_products_from_ids(dto: ProductsFromIdsDTO):
    products = get_products_data_from_ids(dto.product_ids)
    return products

@app.get("/product/{product_id}")
def get_product_from_id(product_id: str):
    product_data = get_product_data_from_id(product_id)
    if not product_data:
        return {"error": "Product not found"}
    return product_data

@app.post("/query")
def query(q: str = None, limit: int = 32, payload: Optional[QueryWithImageDTO] = None):

    try:
        image_base64 = payload.image if payload else None

        ranking_url = f"{RANKING_SYSTEM_URL}/query?limit={limit}"
        if q and q != "None":
            ranking_url += f"&q={q}"

        json_data = {"image": image_base64} if image_base64 else {}

        response = requests.post(ranking_url, json=json_data)
        response.raise_for_status()

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error communicating with the ranking system")

    ranking_resp = response.json()
    product_ids = ranking_resp.get("products", [])
    reasons = ranking_resp.get("reasons", {})

    products_data = get_products_data_from_ids(product_ids)

    if reasons:
        for item in products_data:
            if isinstance(item, dict):
                pid = item.get("product", {}).get("id")
                pid_str = str(pid) if pid is not None else ""
                if pid_str in reasons:
                    explanation = reasons[pid_str]
                    item["product"]["recommendation_reason"] = explanation
                    item["recommendation_reason"] = explanation

    return {"products": products_data}


@app.get("/products/{product_id}/related")
def related(product_id: int, limit: int = 6):
    limit = max(1, min(limit, 24))
    result = related_product_ids(engine, product_id, limit)
    if result is None:
        raise HTTPException(status_code=404, detail="Product not found")
    category, ids, alternative = result
    return {
        "product_id": str(product_id),
        "category": category,
        "items": get_products_data_from_ids(ids),
        "greener_alternative": get_product_data_from_id(alternative) if alternative else None,
    }


@app.get("/categories/{category}/stats")
def stats(category: str, product_id: Optional[int] = None):
    return category_stats(engine, category, product_id)


_OVERVIEW_CACHE = {"at": 0.0, "body": None}
OVERVIEW_TTL_S = 300


@app.get("/stats/overview")
def stats_overview(refresh: bool = False):
    """Dashboard numbers (docs/demo/api-overview.md), cached for 5 minutes."""
    if refresh or _OVERVIEW_CACHE["body"] is None or time.time() - _OVERVIEW_CACHE["at"] > OVERVIEW_TTL_S:
        data = overview(engine)
        items = {str(i["product"]["id"]): i for i in get_products_data_from_ids(
            [g["id"] for g in data["greenest_ids"]] + [s[k] for s in data["suggestions"] for k in ("from_id", "to_id")])}
        data["greenest"] = [{"category": g["category"], "item": items.get(str(g["id"]))} for g in data.pop("greenest_ids")]
        data["suggestions"] = [{"category": s["category"], "from": items.get(str(s["from_id"])), "to": items.get(str(s["to_id"])),
                                "saved_kg": s["saved_kg"]} for s in data["suggestions"]]
        data["updated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        _OVERVIEW_CACHE.update(at=time.time(), body=data)
    return _OVERVIEW_CACHE["body"]



@app.on_event("startup")
def _enable_unaccent():
    """Accent-insensitive search (Điều hòa == dieu hoa). Idempotent."""
    from sqlmodel import text as _text
    try:
        with engine.begin() as conn:
            conn.execute(_text("CREATE EXTENSION IF NOT EXISTS unaccent"))
    except Exception as error:  # the search endpoint reports the problem instead of crashing the service
        print(f"unaccent extension unavailable: {error}", flush=True)


@app.get("/search")
def search_products(q: Optional[str] = None, category: Optional[str] = None, brand: Optional[str] = None,
                    platform: Optional[str] = None, min_price: Optional[float] = None, max_price: Optional[float] = None,
                    has_co2: bool = False, has_price: bool = False, co2_source: Optional[str] = None,
                    sort: str = "relevance", page: int = 1, page_size: int = 24, include_accessories: bool = False,
                    has_image: bool = False):
    """Filtered product search (see search_api.py)."""
    return search_api.search(engine, q, category, brand, platform, min_price, max_price, has_co2, has_price,
                             co2_source, sort, page, page_size, include_accessories, has_image=has_image)


@app.get("/categories")
def list_categories():
    return {"categories": search_api.categories(engine)}
