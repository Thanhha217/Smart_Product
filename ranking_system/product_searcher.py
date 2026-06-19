import os
import faiss
from sqlmodel import Session, create_engine, text
from product_embeddings import create_text_embedding

POSTGRES_URL = os.environ.get("POSTGRES_URL")
FAISS_INDEX_PATH = os.environ.get("FAISS_INDEX_PATH")

if not POSTGRES_URL:
    raise ValueError("POSTGRES_URL environment variable is not set")
if not FAISS_INDEX_PATH:
    raise ValueError("FAISS_INDEX_PATH environment variable is not set")

engine = create_engine(POSTGRES_URL)

# print(f"Loading FAISS Index from {FAISS_INDEX_PATH}...")
# index = faiss.read_index(FAISS_INDEX_PATH)
# print(f"Index loaded successfully. Total text vectors: {index.ntotal}")

def _load_faiss():
    print(f"Loading FAISS Index from {FAISS_INDEX_PATH}...")
    index = faiss.read_index(FAISS_INDEX_PATH)
    print(f"Index loaded successfully. Total text vectors: {index.ntotal}")

def get_similar_products_indices(query_embedding, n):
    _load_faiss()
    distances, indices = index.search(query_embedding, n)
    return indices, (distances + 1) / 2

def get_products_from_ids(product_ids):
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
            WHERE product.id = ANY(:product_ids)
        """
        
        # 2. Execute the string wrapped in text()
        return session.exec(text(query), params={"product_ids": product_ids}).all()
    
    return []

def get_product_embedings_from_ids(product_ids):
    _load_faiss()
    return index.reconstruct(product_ids).reshape(1, -1)
    