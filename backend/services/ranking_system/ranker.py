
import catboost
import numpy as np

from product_embeddings import create_text_embedding
from product_featurer import compute_features
from product_searcher import get_products_from_ids, get_similar_products_indices

MAX_RELEVANT_PRODUCTS = 20
RRF_K = 60  # standard RRF damping constant

new_ranker = catboost.CatBoostRanker()
new_ranker.load_model('models/catboost_ranker_model.txt')
print("Model loaded from 'catboost_ranker_model.txt'")


def _ranks_from_scores(scores, higher_is_better=True):
    """1-based rank for each item; tied values share the same rank.

    Ties must not be broken by array position: when no product has a CO2e
    estimate they all tie, and handing rank 1 to whichever came first would let
    candidate order leak into the final ranking.
    """
    values = -scores if higher_is_better else scores
    ordered = np.argsort(values, kind="stable")
    sorted_values = values[ordered]

    # Competition ranking: every member of a tie group takes the group's first position.
    starts_group = np.ones(len(values), dtype=bool)
    starts_group[1:] = sorted_values[1:] != sorted_values[:-1]
    group_ranks = np.maximum.accumulate(
        np.where(starts_group, np.arange(1, len(values) + 1), 0)
    )

    ranks = np.empty(len(values), dtype=int)
    ranks[ordered] = group_ranks
    return ranks


def _rrf_fuse(relevance_scores, co2e_values):
    """Fuse a relevance ranking with a carbon ranking via Reciprocal Rank Fusion.

    Equal weights. Lower co2e ranks better; products with no estimate (NaN)
    sort last. Returns candidate indices ordered best-to-worst.
    """
    relevance_ranks = _ranks_from_scores(relevance_scores, higher_is_better=True)
   
    carbon = np.where(np.isnan(co2e_values), np.inf, co2e_values)
    carbon_ranks = _ranks_from_scores(carbon, higher_is_better=False)

    rrf_scores = 1.0 / (RRF_K + relevance_ranks) + 1.0 / (RRF_K + carbon_ranks)
    return np.argsort(-rrf_scores, kind="stable")

def query_ranking_system(query, limit):

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

    # Relevance ranking from the CatBoost model.
    new_predictions = new_ranker.predict(features)

    # Carbon footprint per candidate (NaN when not yet estimated -> ranked last).
    co2e_values = np.array(
        [p.co2e_kg if p.co2e_kg is not None else np.nan for p in product_list],
        dtype=float,
    )

    # Fuse relevance + carbon rankings with RRF (equal weights).
    fused_order = _rrf_fuse(new_predictions, co2e_values)

    product_ids = [product_list[i].product_id for i in fused_order]

    print("\nFinal product ID ranking (RRF: relevance + carbon)")
    for i in fused_order:
        p = product_list[i]
        print(f"name: {p.product_name}, platform: {p.platform_name}, "
              f"price: {p.final_price}, reviews: {p.product_rating}, co2e: {p.co2e_kg}")

    return product_ids