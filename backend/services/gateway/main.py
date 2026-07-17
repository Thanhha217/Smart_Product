import os
import requests

from fastapi import FastAPI, HTTPException, Depends

app = FastAPI()

@app.get("/")
def root():
    return {"message": "Hello World"}

RANKING_SYSTEM_URL = os.environ.get("RANKING_SYSTEM_URL")
DB_SEARCH_URL = os.environ.get("DB_SEARCH_URL")

if not RANKING_SYSTEM_URL:
    raise ValueError("RANKING_SYSTEM_URL environment variable is not set")

if not DB_SEARCH_URL:
    raise ValueError("DB_SEARCH_URL environment variable is not set")


@app.get("/query")
def query_endpoint(q: str, limit: int = 32):

    # First of all, retrieve the products ids from the ranking system after passing the query to it
    try:
        request = f"{RANKING_SYSTEM_URL}/query?q={q}&limit={limit}"
        response = requests.get(request)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error communicating with the ranking system")
    
    product_ids = response.json()

    dto = {"product_ids": product_ids}

    # Now, retrieve the products data from the db-search service
    try:
        request = f"{DB_SEARCH_URL}/products-from-ids"
        response = requests.post(request, json=dto)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error communicating with the db-search service")
    
    products_data = response.json()
    return {"products": products_data}