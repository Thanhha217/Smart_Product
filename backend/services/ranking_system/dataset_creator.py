import os
import random
import numpy as np
import statistics

from product_embeddings import create_text_embedding
from product_searcher import get_similar_products_indices, get_products_from_ids
from product_featurer import compute_features

MAX_RELEVANT_PRODUCTS = 8
NB_GARBAGE_PRODUCTS = 4

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def create_dataset():
    content = ""
    metadata = ""

    query_path = os.path.join(BASE_DIR, 'query_list.txt')
    with open(query_path, 'r', encoding="utf-8") as f:
        qid = 1
        for line in f:
            query = line.strip()
            query_embedding = create_text_embedding(query)
            indices, distances = get_similar_products_indices(query_embedding, MAX_RELEVANT_PRODUCTS)
            query_distance = distances[0]
            product_list = get_products_from_ids(indices[0].tolist())

            offset = 0
            for i in range(len(product_list)):     
                if product_list[i-offset].final_price == 0:
                    product_list.pop(i-offset)
                    query_distance = np.delete(query_distance, (i-offset))
                    offset += 1

            features = compute_features(product_list, query_distance)

            content += generate_dataset(qid, features, base_label="X")
            content += generate_garbage_mock_features(NB_GARBAGE_PRODUCTS, qid)

            metadata += generate_metadata(query, product_list)
            metadata += generate_mock_metadata(NB_GARBAGE_PRODUCTS, query)
            
            qid += 1
    
    dataset_path = os.path.join(BASE_DIR, 'datasets/ranking_dataset.txt')
    metadata_path = os.path.join(BASE_DIR, 'datasets/ranking_dataset_metadata.txt')
    dataset_dir = os.path.dirname(dataset_path)
    os.makedirs(dataset_dir, exist_ok=True)
    
    with open(dataset_path, "w", encoding="utf-8") as f:
        f.write(content)

    with open(metadata_path, "w", encoding="utf-8") as f:
        f.write(metadata)


def generate_dataset(qid, features, base_label="0"):
    query_content = ""

    for f in features:
        query_content += f"{base_label} qid={qid} "
        for i in range(len(f)):
            query_content += f"{i+1}:{f[i]:.4f} "

        query_content += "\n"

    return query_content


def generate_metadata(query, product_list):
    metadata_content = ""
    for p in product_list:
        metadata_content += f"id:{p.product_id:8}  "

        metadata_content += f"name:{p.product_name:60}  "
        
        metadata_content += f"price:{int(p.final_price):9}  "

        metadata_content += f"platform:{p.platform_name:15}  "

        metadata_content += f"query:{query}"

        metadata_content += "\n"

    return metadata_content

def generate_mock_metadata(n, query):
    metadata_content = ""
    for i in range(n):
        metadata_content += f"id:{-1:8}  "

        metadata_content += f"name:{"mock_product":60}  "
        
        metadata_content += f"price:{"???":9}  "

        metadata_content += f"platform:{"mock":15}  "

        metadata_content += f"query:{query}"

        metadata_content += "\n"

    return metadata_content


def generate_mock_features(n, qid, base_label=0, variance=0.1, base_features=None):
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


def generate_garbage_mock_features(n, qid):

    query_content = ""

    features = [
        [0.1, -1, -1, -1, -1, -1, -1], # Irrelevant
        [0.3, 0.5, 0.65, 0.65, 0, 0.5, 0.5], # Mid
        [0.8, 0.8, 0.2, 0.2, 1, 0.8, 0.8], # Terrible reviews
    ]

    for i in range(n):
        query_content += generate_mock_features(1, qid, base_label=0, variance=0.1, base_features=random.choice(features))
    
    return query_content



create_dataset()