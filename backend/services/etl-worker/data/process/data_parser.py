from data.schemes.product import Product
from data.schemes.platform import Platform
from data.schemes.seller import Seller
from data.schemes.return_policy import ReturnPolicy
from data.schemes.category import Category
from data.schemes.image import Image

def parse_product_data(data: dict):

    platform = Platform(name=data.get("platform", ""))
    
    seller = Seller(
        name=data.get("seller", ""),
        seller_rating=data.get("seller_rating", -1.0)
    )

    return_policy = ReturnPolicy( 
        days_for_return=data.get("days_for_return", -1),
        free_delivery=data.get("free_delivery", False),
        warranty_duration=data.get("warranty_duration", -1)
    )

    category = Category(name=data.get("category", ""))
    
    product = Product(
        name=data.get("name", ""),
        product_url=data.get("url", ""),
        original_price=data.get("original_price", 0.0),
        final_price=data.get("final_price", 0.0),
        description=data.get("short_description", ""),
        product_rating=data.get("product_rating", 0.0),
        review_count=data.get("review_count", 0),
        scraped_at=data.get("scraped_at", 0.0),
    )

    images = []
    for file_info in data.get("files", []):
        if isinstance(file_info, dict):
            images.append(Image(
                image_url=file_info.get("url", ""),
                image_path=file_info.get("path", "")
            ))

    return {
        "platform": platform,
        "seller": seller,
        "return_policy": return_policy,
        "category": category,
        "product": product,
        "images": images
    }


