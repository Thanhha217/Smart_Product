import open_clip
from PIL import Image
import threading
import faiss
import numpy as np

_model = None
_preprocess = None
_tokenizer = None
_load_lock = threading.Lock()

def _load_models():
    global _model, _preprocess, _tokenizer
    
    if _model is not None:
        return
    
    with _load_lock:
        if _model is None:
            print("Loading OpenCLIP model...", flush=True)
            _model, _, _preprocess = open_clip.create_model_and_transforms('ViT-B-32', pretrained='laion2b_s34b_b79k')
            _tokenizer = open_clip.get_tokenizer('ViT-B-32')
            print("OpenCLIP loaded!", flush=True)


def create_text_embedding(text_to_encode):
    _load_models()

    text_input = _tokenizer([text_to_encode])
    return normalize_embedding(_model.encode_text(text_input))
    

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