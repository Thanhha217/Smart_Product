import os
import requests
from fastapi import FastAPI, HTTPException
from typing import Optional

from db_search_functions import get_product_data_from_id, get_products_data_from_ids
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

    product_ids = response.json()
    product_ids = product_ids.get("products", [])

    products_data = get_products_data_from_ids(product_ids)
    return {"products": products_data}