import os
import requests

from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from dto.gateway_dto import AssistantPayload, ImagePayload
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

# Optional: the AI assistant service. Left unset, /assistant answers 503 and
# the rest of the gateway keeps working.
ASSISTANT_URL = os.environ.get("ASSISTANT_URL")


@app.post("/assistant")
def assistant_endpoint(payload: AssistantPayload):
    if not ASSISTANT_URL:
        raise HTTPException(status_code=503, detail="Assistant service is not configured")
    try:
        response = requests.post(f"{ASSISTANT_URL}/assistant", json=payload.model_dump(), timeout=300)
        response.raise_for_status()
    except requests.exceptions.RequestException:
        raise HTTPException(status_code=502, detail="Error communicating with the assistant service")
    return response.json()


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