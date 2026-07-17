from pydantic import BaseModel

class ProductsFromIdsDTO(BaseModel):
    product_ids: list[int]