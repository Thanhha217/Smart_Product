from sqlmodel import Session 
from data import engine

def load_data_into_database(obj: dict): # Object containing all the mapped instances of scraped data
    
    with Session(engine) as session:
        platform = obj["platform"]
        
        session.add(platform)
        session.commit()
        session.refresh(platform)

        seller = obj["seller"]

        session.add(seller)
        session.commit()
        session.refresh(seller)

        return_policy = obj["return_policy"]

        session.add(return_policy)
        session.commit()
        session.refresh(return_policy)

        category = obj["category"]

        session.add(category)
        session.commit()
        session.refresh(category)

        product = obj["product"]
        product.platform_id = platform.id
        product.seller_id = seller.id
        product.return_policy_id = return_policy.id
        product.category_id = category.id

        session.add(product)
        session.commit()
        session.refresh(product)

        for image in obj["images"]:
            image.product_id = product.id
            session.add(image)
        session.commit()