from fastapi import FastAPI, HTTPException
from ranker import query_ranking_system
from dto.ranking_system_dto import QueryWithImageDTO
from typing import Optional

import traceback
app = FastAPI()

@app.get("/")
def root():
    return {"message": "Hello World"}

@app.post("/query")
async def query_endpoint(q: str = None, limit: int = 32, payload: QueryWithImageDTO = None):
  try:
    image_base64 = payload.image if payload else None

    product_ids, reasons = query_ranking_system(
        query=q, limit=limit, image_base64=image_base64
    )

    return {"products": product_ids, "reasons": reasons}

  except Exception as e:
    print("--- ERREUR INTERNE DETAILS ---")
    traceback.print_exc()
    raise HTTPException(status_code=500, detail=str(e))