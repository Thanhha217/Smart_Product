import os
from pathlib import Path
import threading

import faiss
import numpy as np

from sqlmodel import Session, select

from data import engine
from datetime import datetime
from data.schemes.product import Product
from data.schemes.image import Image

_faiss_lock = threading.Lock()

EMBED_DIM = 512
FAISS_INDEX_PATH = os.environ.get("FAISS_INDEX_PATH", "/opt/faiss_index/products.faiss")
FAISS_IMAGE_INDEX_PATH = os.environ.get("FAISS_IMAGE_INDEX_PATH", "/opt/faiss_index/images.faiss")

base_index = faiss.IndexHNSWFlat(EMBED_DIM, 32)
base_index.metric_type = faiss.METRIC_INNER_PRODUCT
index = faiss.IndexIDMap2(base_index)

image_base_index = faiss.IndexHNSWFlat(EMBED_DIM, 32)
image_base_index.metric_type = faiss.METRIC_INNER_PRODUCT
image_index = faiss.IndexIDMap2(image_base_index)

index_path = Path(FAISS_INDEX_PATH)
index_path.parent.mkdir(parents=True, exist_ok=True)

image_index_path = Path(FAISS_IMAGE_INDEX_PATH)
image_index_path.parent.mkdir(parents=True, exist_ok=True)

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


def get_or_create_product(session: Session, product, platform_id):
    
    model_class = type(product)
    
    statement = select(model_class).where(
        (model_class.product_url == product.product_url) &
        (model_class.platform_id == platform_id)
    )

    existing_product = session.exec(statement).first()

    if existing_product:
        
        existing_product.original_price = product.original_price
        existing_product.final_price = product.final_price
        existing_product.description = product.description
        existing_product.product_rating = product.product_rating
        existing_product.review_count = product.review_count
        existing_product.seller_id = product.seller_id
        existing_product.return_policy_id = product.return_policy_id
        existing_product.scraped_at = datetime.now().timestamp()
        
        session.add(existing_product)
        session.commit()
        session.refresh(existing_product)
        return existing_product
    
    session.add(product)
    session.commit()
    session.refresh(product)
    return product


def load_data_into_database(obj: dict, embeddings: tuple):
    
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

        product = get_or_create_product(session, product, platform.id)
        
        images = []

        for image, image_embedding in zip(obj["images"], embeddings[1]):
            image.product_id = product.id
            session.add(image)
            images.append((image, image_embedding))

        session.commit()

        image_ids = [image.id for image, _ in images]
        image_embeddings = [image_embedding for _, image_embedding in images]

        load_image_embeddings(image_ids, image_embeddings)
        load_embedding(product.id, embeddings[0])

    with _faiss_lock:
        faiss.write_index(index, FAISS_INDEX_PATH)
        faiss.write_index(image_index, FAISS_IMAGE_INDEX_PATH)


def load_embedding(id: int, embedding: list[float]):
    
    np_embedding = np.array(embedding)
    np_embedding = np_embedding.astype("float32")
    np_embedding = np_embedding.reshape(1, -1)

    ids = np.array([id], dtype=np.int64)

    # the variable index is a global variable containing the faiss index
    faiss.normalize_L2(np_embedding)
    with _faiss_lock:
        index.add_with_ids(np_embedding, ids)

def load_embeddings(ids: list[int], embeddings: list[list[float]], index=index):
    print(f"Loading embeddings for IDs: {ids}", flush=True)
    if not ids:
        return
    try:
        np_embeddings = np.asarray(embeddings, dtype="float32")
        ids_array = np.asarray(ids, dtype=np.int64)
    except Exception as e:
        print(f"Error converting embeddings to numpy arrays: {e}", flush=True)
        return

    faiss.normalize_L2(np_embeddings)
    with _faiss_lock:
        index.add_with_ids(np_embeddings, ids_array)
    
def load_image_embeddings(image_ids: list[int], image_embeddings: list[list[float]]):
    if not image_embeddings or is_list_of_lists_empty(image_embeddings):
        return
    load_embeddings(image_ids, image_embeddings, index=image_index)

def is_list_of_lists_empty(lst):
    if not lst:
        return True
    for sublist in lst:
        if sublist:
            return False
    return True