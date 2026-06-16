import math
import random
import numpy as np
import statistics
import os
import sys
import faiss

# Get absolute path to the directory containing hyphens
subfolder_path = os.path.join(os.path.dirname(__file__), "backend/services/etl-worker")

# Insert it into the module search paths
sys.path.insert(0, subfolder_path)

os.environ["POSTGRES_URL"] = "postgresql://postgres:password@localhost:5432/smart_product_finder"

from data import engine
from data.schemes.product import Product
from data.schemes.seller import Seller
from data.schemes.return_policy import ReturnPolicy
from data.schemes.platform import Platform
from sqlmodel import Session, select, create_engine, col
from data.process.data_transfomer import generate_text_embedding

EMBED_DIM = 512
FAISS_INDEX_PATH = os.environ.get("FAISS_INDEX_PATH", "./faiss_index/products.faiss")
index = None

print(f"Loading FAISS Index from {FAISS_INDEX_PATH}...")
index = faiss.read_index(FAISS_INDEX_PATH)
print(f"Index loaded successfully. Total text vectors: {index.ntotal}")


MAX_RELEVANT_PRODUCTS = 8
NB_GARBAGE_PRODUCTS = 4


def create_dataset():
    content = ""
    metadata = ""

    with open('query_list.txt', 'r', encoding="utf-8") as f:
        qid = 1
        for line in f:
            query = line.strip()
            query_embedding = normalize_embedding(generate_text_embedding(query))
            distances, indices = index.search(query_embedding, MAX_RELEVANT_PRODUCTS)
            product_list = get_product_list_from_ids(indices[0].tolist())

            content += compute_features(query_embedding, qid, product_list)
            content += compute_garbage_mock_features(NB_GARBAGE_PRODUCTS, qid)

            metadata += compute_metadata(query, product_list)
            metadata += compute_mock_metadata(NB_GARBAGE_PRODUCTS, query)
            
            qid += 1
    
    with open("ranking_dataset.txt", "w", encoding="utf-8") as f:
        f.write(content)

    with open("ranking_dataset_metadata.txt", "w", encoding="utf-8") as f:
        f.write(metadata)

def get_product_list_for_query(query):
    with Session(engine) as session:
        statement = select(Product, Seller, ReturnPolicy, Platform).join(Seller).join(ReturnPolicy).join(Platform).limit(20)

        return session.exec(statement).all()
    
    return []

def get_product_list_from_ids(product_ids):
    with Session(engine) as session:
        statement = select(Product, Seller, ReturnPolicy, Platform).join(Seller).join(ReturnPolicy).join(Platform).where(col(Product.id).in_(product_ids), Product.final_price != 0)

        return session.exec(statement).all()
    
    return []




def compute_features(query_embedding, qid, product_list):

    def robust_score_min_max(values):
        median = statistics.median(values)
        q75, q25 = np.percentile(values, [75, 25])
        iqr = q75 - q25

        if iqr == 0:
            return {values[i]:0.5 for i in range(len(values))}

        robust_values = [(v - median)/iqr for v in values]

        max_value = max(robust_values)
        min_value = min(robust_values)

        return {values[i]:(robust_values[i] - min_value)/(max_value - min_value) for i in range(len(values))}


    price_list = [p.final_price for (p,s,rp,pl) in product_list]
    robust_prices = robust_score_min_max(price_list)

    days_for_return_list = [rp.days_for_return for (p,s,rp,pl) in product_list]
    robust_days_for_return = robust_score_min_max(days_for_return_list)

    warranty_duration_list = [rp.warranty_duration for (p,s,rp,pl) in product_list]
    robust_warranty_duration = robust_score_min_max(warranty_duration_list)

    query_content = ""

    for (p,s,rp,pl) in product_list:
        features = []

        # Start of the features
        query_content += f"X qid:{qid} "

        # ID
        # features.append(p.id)

        # Sementic score
        product_embedding = index.reconstruct(p.id).reshape(1, -1)
        similarities, indices = faiss.knn(query_embedding, product_embedding, k=1, metric=faiss.METRIC_INNER_PRODUCT)
        # print(f"FAISS Cosine Similarity: {similarities[0][0]}")
        features.append(similarities[0][0])

        # Price score (reverse the value so the cheapest products have the highest score)
        features.append(1 - robust_prices[p.final_price])
    
        # Review score
        AVERAGE_RATING = 0.8 
        CONFIDENCE_VALUE = 10 # number of reviews to be considered a "reliable" rating
        product_rating = p.product_rating
        if product_rating > 1:
            product_rating /= 5 # temp fix
        features.append(((p.review_count * product_rating) + (CONFIDENCE_VALUE * AVERAGE_RATING)) / (p.review_count + CONFIDENCE_VALUE))
        
        # Seller rating
        if s.seller_rating == -1:
            features.append(AVERAGE_RATING)
        else:
            features.append(s.seller_rating)

        # Free delivery
        features.append(rp.free_delivery)

        # Days for return
        features.append(robust_days_for_return[rp.days_for_return])

        # Warranty duration
        features.append(robust_warranty_duration[rp.warranty_duration])

        for i in range(len(features)):
            query_content += f"{i+1}:{features[i]:.4f} "

        query_content += "\n"


    return query_content


def compute_metadata(query, product_list):
    metadata_content = ""
    for (p,s,rp,pl) in product_list:
        metadata_content += f"id:{p.id:8}  "

        metadata_content += f"name:{p.name:60}  "
        
        metadata_content += f"price:{int(p.final_price):9}  "

        metadata_content += f"platform:{pl.name:15}  "

        metadata_content += f"query:{query}"

        metadata_content += "\n"

    return metadata_content

def compute_mock_metadata(n, query):
    metadata_content = ""
    for i in range(n):
        metadata_content += f"id:{-1:8}  "

        metadata_content += f"name:{"mock_product":60}  "
        
        metadata_content += f"price:{"???":9}  "

        metadata_content += f"platform:{"mock":15}  "

        metadata_content += f"query:{query}"

        metadata_content += "\n"

    return metadata_content

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



def compute_mock_features(n, qid, base_label=0, variance=0.1, base_features=None):
    """
    Generates mock LibSVM formatted ranking data.
    
    :param n: Number of product rows to generate for this query.
    :param qid: The query ID.
    :param base_label: The ground truth relevance label (e.g., 0=Irrelevant, 1=Relevant, 2=Highly Relevant).
    :param variance: The maximum deviation added or subtracted from base values.
    :param base_features: A list of base floats for features index 1 to 7. 
                          If None, defaults to midpoints. Pass -1 for fully random.
    """
    if base_features is None:
        base_features = [0.5, 0.5, 0.5, 0.5, 0, 0.5, 0.5] # 7 features (excl. ID)

    query_content = ""
    
    for i in range(n):
        features = []

        # Start of LibSVM formatting with the target relevance label
        query_content += f"{base_label} qid:{qid} "

        # Feature index 0: ID (hardcoded to -1 per your spec)
        # features.append(-1.0)

        # Process features 1 through 7
        for idx, base_val in enumerate(base_features, start=1):
            # Feature index 5 is binary (Free Delivery)
            if idx == 5:
                if base_val == -1:
                    final_val = float(random.choice([0, 1]))
                else:
                    # Apply variance to the base chance, then threshold it at 0.5
                    noise = random.uniform(-variance, variance)
                    chance = base_val + noise
                    final_val = 1.0 if chance >= 0.5 else 0.0
            else:
                # Standard continuous features
                if base_val == -1:
                    final_val = random.uniform(0.0, 1.0)
                else:
                    noise = random.uniform(-variance, variance)
                    final_val = base_val + noise
                    final_val = max(0.0, min(1.0, final_val))
                
            features.append(final_val)

        # Build string formatting index-by-index using the correct tracker `j`
        for j in range(len(features)):
            query_content += f"{j+1}:{features[j]:.4f} "

        query_content += "\n"

    return query_content


def compute_garbage_mock_features(n, qid):

    query_content = ""

    features = [
        [0.1, -1, -1, -1, -1, -1, -1], # Irrelevant
        [0.3, 0.5, 0.65, 0.65, 0, 0.5, 0.5], # Mid
        [0.8, 0.8, 0.2, 0.2, 1, 0.8, 0.8], # Terrible reviews
    ]

    for i in range(n):
        query_content += compute_mock_features(1, qid, base_label=0, variance=0.1, base_features=random.choice(features))
    
    return query_content



create_dataset()