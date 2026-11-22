from fastapi import FastAPI

from db_search_functions import get_products_data_from_ids
from dto.QueryDTO import ProductsFromIdsDTO
app = FastAPI()

# Even though its a retrieve function, we have to make it a POST because
# we can fit all ids into the body and not into query params
@app.post("/products-from-ids")
def get_products_from_ids(dto: ProductsFromIdsDTO):
    products = get_products_data_from_ids(dto.product_ids)
    return products