import os
import faiss
from sqlmodel import Session, create_engine, text
from product_embeddings import create_text_embedding
import numpy as np

POSTGRES_URL = os.environ.get("POSTGRES_URL")
FAISS_INDEX_PATH = os.environ.get("FAISS_INDEX_PATH")
FAISS_IMAGE_INDEX_PATH = os.environ.get("FAISS_IMAGE_INDEX_PATH")

_TEXT_INDEX = None
_IMAGE_INDEX = None

if not POSTGRES_URL:
    raise ValueError("POSTGRES_URL environment variable is not set")
if not FAISS_INDEX_PATH:
    raise ValueError("FAISS_INDEX_PATH environment variable is not set")

engine = create_engine(POSTGRES_URL, pool_pre_ping=True)  # survive a database restart: test a pooled connection before use

# print(f"Loading FAISS Index from {FAISS_INDEX_PATH}...")
# index = faiss.read_index(FAISS_INDEX_PATH)
# print(f"Index loaded successfully. Total text vectors: {index.ntotal}")

def _load_faiss():
    global _TEXT_INDEX, _IMAGE_INDEX
    _TEXT_INDEX = faiss.read_index(FAISS_INDEX_PATH)
    _IMAGE_INDEX = faiss.read_index(FAISS_IMAGE_INDEX_PATH)

    return _TEXT_INDEX, _IMAGE_INDEX

def get_similar_products_indices(query_embedding, n, index_type='text'):
    text_index, image_index = _load_faiss()

    query_embedding = np.asarray(query_embedding, dtype=np.float32)
    if(len(query_embedding.shape) == 1):
        query_embedding = np.expand_dims(query_embedding, axis=0)

    if index_type == 'text':
        distances, indices = text_index.search(query_embedding, n)
    
    elif index_type == "both":
        dist_text, idx_text = text_index.search(query_embedding, n)
        dist_img, idx_img = image_index.search(query_embedding, n)

        combined_scores = {}
        for idx, dist in zip(idx_text[0], dist_text[0]):
            if idx >= 0:
                combined_scores[idx] = max(combined_scores.get(idx, -1.0), dist)

        for idx, dist in zip(idx_img[0], dist_img[0]):
            if idx >= 0:
                combined_scores[idx] = max(combined_scores.get(idx, -1.0), dist)

        sorted_pairs = sorted(
            combined_scores.items(), key=lambda x: x[1], reverse=True
        )[:n]
        indices = np.array([[p[0] for p in sorted_pairs]])
        distances = np.array([[p[1] for p in sorted_pairs]])

    else:
        distances, indices = image_index.search(query_embedding, n)

    normalized_distances = (distances + 1) / 2
    return indices, normalized_distances

def get_products_from_ids(product_ids):
    product_ids = [int(product_id) for product_id in product_ids if int(product_id) >= 0]

    with Session(engine) as session:
        query = """
            SELECT
                *, 
                product.id AS product_id,
                product.name AS product_name,
                seller.name AS seller_name,
                platform.name AS platform_name
            FROM product
            INNER JOIN seller ON product.seller_id = seller.id
            INNER JOIN return_policy ON product.return_policy_id = return_policy.id
            INNER JOIN platform ON product.platform_id = platform.id
            WHERE product.id = ANY(CAST(:product_ids AS integer[]))
            ORDER BY array_position(CAST(:product_ids AS integer[]), product.id)
        """
        
        # 2. Execute the string wrapped in text()
        return session.exec(text(query), params={"product_ids": product_ids}).all()
    
    return []

def get_product_embedings_from_ids(product_ids):
    index = _load_faiss()
    return index.reconstruct(product_ids).reshape(1, -1)
    