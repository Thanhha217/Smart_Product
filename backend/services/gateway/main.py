import os
import requests

from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from dto.gateway_dto import ImagePayload
app = FastAPI()

origins = [
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Hello World"}

RANKING_SYSTEM_URL = os.environ.get("RANKING_SYSTEM_URL")
DB_SEARCH_URL = os.environ.get("DB_SEARCH_URL")

if not RANKING_SYSTEM_URL:
    raise ValueError("RANKING_SYSTEM_URL environment variable is not set")

if not DB_SEARCH_URL:
    raise ValueError("DB_SEARCH_URL environment variable is not set")


@app.post("/query")
async def query_endpoint(q: str = None, limit: int = 32, payload: Optional[ImagePayload] = None):

    # First of all, retrieve the products ids from the ranking system after passing the query to it
    try:
        image_base64 = payload.image if payload else None

        ranking_url = f"{DB_SEARCH_URL}/query?limit={limit}"
        if q and q != "None":
            ranking_url += f"&q={q}"

        json_data = {"image": image_base64} if image_base64 else {}

        response = requests.post(ranking_url, json=json_data)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error communicating with the ranking system")
        
    products_data = response.json()
    return {"products": products_data}

@app.get("/product/{product_id}")
def product_endpoint(product_id: str):

    try:
        request = f"{DB_SEARCH_URL}/product/{product_id}"
        response = requests.get(request)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error communicating with the db-search service")
    
    product_data = response.json()
    return {"product": product_data}