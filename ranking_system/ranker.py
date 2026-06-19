
import catboost
import numpy as np

from product_embeddings import create_text_embedding
from product_featurer import compute_features
from product_searcher import get_products_from_ids, get_similar_products_indices

MAX_RELEVANT_PRODUCTS = 20

def query_ranking_system(query, limit):
    # Load the model for reuse
    new_ranker = catboost.CatBoostRanker() 
    new_ranker.load_model('models/catboost_ranker_model.txt')
    print("Model loaded from 'catboost_ranker_model.txt'")

    query_embedding = create_text_embedding(query)
    indices, distances = get_similar_products_indices(query_embedding, limit)
    query_distance = distances[0]
    product_list = get_products_from_ids(indices[0].tolist())

    offset = 0
    for i in range(len(product_list)):     
        if product_list[i-offset].final_price == 0:
            product_list.pop(i-offset)
            query_distance = np.delete(query_distance, (i-offset))
            offset += 1

    features = compute_features(product_list, query_distance)

    print("\nFeatures : ")
    print(features)

    # Get rankings for new data
    new_predictions = new_ranker.predict(features)
    print("\nNew predictions:")
    print(new_predictions)

    # Sort items by ranking score (highest first)
    ranked_indices = np.argsort(-new_predictions)  # Negative for descending order
    print("\nRanked indices (best to worst):")
    print(ranked_indices)
    print("\nRanked scores:")
    print(new_predictions[ranked_indices])

    print("\nFinal product ID ranking")
    print(indices[0][ranked_indices])
    for p in get_products_from_ids(indices[0][ranked_indices].tolist()):
        print(f"name: {p.product_name}, platform: {p.platform_name}, price: {p.final_price}, reviews: {p.product_rating}")

    return indices[0][ranked_indices].tolist()

query_ranking_system("iphone 17", MAX_RELEVANT_PRODUCTS)