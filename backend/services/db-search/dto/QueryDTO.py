from pydantic import BaseModel
from typing import Optional

class ProductsFromIdsDTO(BaseModel):
    product_ids: list[int]

class QueryWithImageDTO(BaseModel):
    image: Optional[str] = None