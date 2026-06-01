from sqlmodel import Session, select
from data import engine

def get_or_create(session: Session, instance, unique_column="name"):

    if(type(unique_column) == list):
        model_class = type(instance)
        filters = [getattr(model_class, col) == getattr(instance, col) for col in unique_column]
        statement = select(model_class).where(*filters)
        existing_instance = session.exec(statement).first()

        if existing_instance:
            return existing_instance
        
        session.add(instance)
        session.commit()
        session.refresh(instance)
        return instance
    
    model_class = type(instance)
    unique_value = getattr(instance, unique_column)

    statement = select(model_class).where(getattr(model_class, unique_column) == unique_value)
    existing_instance = session.exec(statement).first()

    if existing_instance:
        return existing_instance
    
    session.add(instance)
    session.commit()
    session.refresh(instance)
    return instance


def load_data_into_database(obj: dict): # Object containing all the mapped instances of scraped data
    
    with Session(engine) as session:
        platform = get_or_create(session, obj["platform"])
        seller = get_or_create(session, obj["seller"])
        return_policy = get_or_create(session, obj["return_policy"], unique_column=["days_for_return", "free_delivery", "warranty_duration"])
        category = get_or_create(session, obj["category"])


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