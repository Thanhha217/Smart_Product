
import catboost
import numpy as np
import re
import unicodedata

from product_embeddings import create_text_embedding
from product_featurer import compute_features
from product_searcher import get_products_from_ids, get_similar_products_indices

MAX_RELEVANT_PRODUCTS = 20
new_ranker = catboost.CatBoostRanker() 
new_ranker.load_model('models/catboost_ranker_model.txt')
print("Model loaded from 'catboost_ranker_model.txt'")


def _normalize_text(value):
    normalized = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", normalized.lower()).strip()


def _build_name_boosts(query, product_list):
    normalized_query = _normalize_text(query)
    query_tokens = [token for token in normalized_query.split(" ") if token]

    boosts = []
    for product in product_list:
        normalized_name = _normalize_text(product.product_name)

        if normalized_query and normalized_query == normalized_name:
            boosts.append(2.0)
            continue

        if normalized_query and normalized_query in normalized_name:
            boosts.append(1.5)
            continue

        if not query_tokens:
            boosts.append(0.0)
            continue

        matched_tokens = sum(1 for token in query_tokens if token in normalized_name)

        if matched_tokens == len(query_tokens):
            boosts.append(1.0)
        else:
            boosts.append(0.25 * (matched_tokens / len(query_tokens)))

    return np.array(boosts, dtype=float)

def query_ranking_system(query, limit):

    query_embedding = create_text_embedding(query)
    indices, distances = get_similar_products_indices(query_embedding, limit)
    ranked_pairs = [
        (int(product_id), similarity)
        for product_id, similarity in zip(indices[0].tolist(), distances[0])
        if int(product_id) >= 0
    ]
    ranked_ids = [product_id for product_id, _ in ranked_pairs]
    query_distance = np.array([similarity for _, similarity in ranked_pairs])
    product_list = get_products_from_ids(ranked_ids)

    if len(product_list) != len(ranked_ids):
        available_ids = {int(product.product_id) for product in product_list}
        ranked_pairs = [(product_id, similarity) for product_id, similarity in ranked_pairs if product_id in available_ids]
        ranked_ids = [product_id for product_id, _ in ranked_pairs]
        query_distance = np.array([similarity for _, similarity in ranked_pairs])

    offset = 0
    for i in range(len(product_list)):     
        if product_list[i-offset].final_price == 0:
            product_list.pop(i-offset)
            query_distance = np.delete(query_distance, (i-offset))
            ranked_ids.pop(i-offset)
            offset += 1

    features = compute_features(product_list, query_distance)


    # Get rankings for new data
    new_predictions = new_ranker.predict(features) + _build_name_boosts(query, product_list)
  
    # Sort items by ranking score (highest first)
    ranked_indices = np.argsort(-new_predictions)  # Negative for descending order

    return np.array(ranked_ids)[ranked_indices].tolist()