import os
from sqlmodel import Session, create_engine, text

POSTGRES_URL = os.environ.get("POSTGRES_URL")

if not POSTGRES_URL:
    raise ValueError("POSTGRES_URL environment variable is not set")

engine = create_engine(POSTGRES_URL)

def get_product_data_from_ids(product_id):
    with Session(engine) as session:
        product_data_query = """
            SELECT
                *,
                product.id AS product_id,
                product.name AS product_name,
                category.name AS category_name,
                seller.name AS seller_name,
                platform.name AS platform_name,
                return_policy.days_for_return AS days_for_return,
                return_policy.free_delivery AS free_delivery,
                return_policy.warranty_duration AS warranty_duration
            FROM product
            INNER JOIN category ON product.category_id = category.id
            INNER JOIN seller ON product.seller_id = seller.id
            INNER JOIN return_policy ON product.return_policy_id = return_policy.id
            INNER JOIN platform ON product.platform_id = platform.id
            WHERE product.id = :product_id
        """

        product_images_query = """
            SELECT 
                image_url
                FROM image
                WHERE image.product_id = :product_id
        """

        product_data = session.exec(text(product_data_query), params={"product_id": product_id}).first()
        product_images = session.exec(text(product_images_query), params={"product_id": product_id}).all()

        if product_data:
            product_data_dict = product_data.dict()
            product_data_dict["images"] = [image.image_url for image in product_images]
            return product_data_dict

def get_products_data_from_ids(product_ids):
    for product_id in product_ids:
        yield get_product_data_from_ids(product_id)