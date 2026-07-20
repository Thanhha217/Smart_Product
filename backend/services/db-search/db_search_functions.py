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
                product.id AS product_id,
                product.name AS product_name,
                product.product_url AS product_url,
                product.original_price AS original_price,
                product.final_price AS final_price,
                product.description AS product_description,
                product.product_rating AS product_rating,
                product.review_count AS review_count,

                category.name AS category_name,

                seller.name AS seller_name,
                seller.seller_rating AS seller_rating,

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

        product_data = session.exec(text(product_data_query), params={"product_id": product_id}).mappings().first()
        product_images = session.exec(text(product_images_query), params={"product_id": product_id}).all()

        if not product_data:
            return None

        product_data_dict = dict(product_data)
        image_urls = [image.image_url for image in product_images]

        return {
            "platform_name": product_data_dict["platform_name"],
            "category_name": product_data_dict["category_name"],
            "image_url": image_urls[0] if image_urls else None,
            "seller": {
                "name": product_data_dict["seller_name"],
                "seller_rating": product_data_dict["seller_rating"],
            },
            "product": {
                "id": product_data_dict["product_id"],
                "product_url": product_data_dict["product_url"],
                "name": product_data_dict["product_name"],
                "original_price": product_data_dict["original_price"],
                "final_price": product_data_dict["final_price"],
                "product_rating": product_data_dict["product_rating"],
                "review_count": product_data_dict["review_count"],
                "gwp": 0.0,
            },
            "return_policy": {
                "days_for_return": product_data_dict["days_for_return"],
                "free_delivery": product_data_dict["free_delivery"],
                "warranty_duration": product_data_dict["warranty_duration"],
            },
        }

def get_products_data_from_ids(product_ids):
    products = []

    for product_id in product_ids:
        product_data = get_product_data_from_ids(product_id)
        if product_data:
            products.append(product_data)

    return products