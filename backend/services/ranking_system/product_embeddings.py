import os
import requests
import faiss
import numpy as np

OPEN_CLIP_PROVIDER = os.environ.get("OPEN_CLIP_PROVIDER_URL", "http://smartproductfinder-backend-clip-provider:8067")

_session = requests.Session()


def create_text_embedding(text_to_encode):

    query = {"text": text_to_encode}
    uri = f"{OPEN_CLIP_PROVIDER}/encode-text"
    encoded_text = _session.post(uri, json=query).json()
    return normalize_embedding(encoded_text)
    

def normalize_embedding(embedding):
    # Check if the embedding is a PyTorch tensor
    if hasattr(embedding, "detach"):
        np_embedding = embedding.detach().cpu().numpy()
    else:
        np_embedding = np.array(embedding)
        
    np_embedding = np_embedding.astype("float32")
    np_embedding = np_embedding.reshape(1, -1)
    
    # Note: faiss.normalize_L2 mutates the array in-place, 
    # but you still need to return it!
    faiss.normalize_L2(np_embedding)
    return np_embedding

# def compute_similarities(query_embeddings, product_embeddings, ):
#     similarities, indices = faiss.knn(query_embeddings, product_embeddings, k=nb_of_products, metric=faiss.METRIC_INNER_PRODUCT)