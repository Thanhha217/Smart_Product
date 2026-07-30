from fastapi import FastAPI

from db_search_functions import get_product_data_from_id, get_products_data_from_ids
from dto.QueryDTO import ProductsFromIdsDTO
app = FastAPI()

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