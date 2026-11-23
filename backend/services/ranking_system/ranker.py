
import catboost
import numpy as np
import re
import unicodedata


from product_embeddings import create_text_embedding, create_image_embedding
from product_featurer import compute_features
from product_searcher import get_products_from_ids, get_similar_products_indices
from explanation_generator import generate_ranking_explanations

MAX_RELEVANT_PRODUCTS = 20
RRF_K = 60  # standard RRF damping constant
CARBON_RRF_WEIGHT = 0.2

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

    Relevance stays dominant, while the carbon signal is applied as a softer
    penalty. Lower co2e ranks better. Products with no estimate (NaN) get the
    middle carbon rank of the products that have one, so a missing number is
    neither rewarded nor punished.
    Returns candidate indices ordered best-to-worst.
    """
    relevance_ranks = _ranks_from_scores(relevance_scores, higher_is_better=True)

    co2e_values = np.asarray(co2e_values, dtype=float)
    known = ~np.isnan(co2e_values)
    carbon_ranks = np.ones(len(co2e_values), dtype=float)
    if known.any():
        carbon_ranks[known] = _ranks_from_scores(co2e_values[known], higher_is_better=False)
        carbon_ranks[~known] = (known.sum() + 1) / 2.0

    rrf_scores = 1.0 / (RRF_K + relevance_ranks) + CARBON_RRF_WEIGHT / (RRF_K + carbon_ranks)
    return np.argsort(-rrf_scores, kind="stable")

def query_ranking_system(query, limit, image_base64=None):

    if not query and not image_base64:
        raise ValueError("Either query or image_base64 must be provided")

    text_embedding = None
    image_embedding = None
    index_type = 'text'

    if query:
        text_embedding = create_text_embedding(query)

    if image_base64:
        image_embedding = create_image_embedding(image_base64)

    if text_embedding is not None and image_embedding is not None:
      text_embedding = text_embedding / np.linalg.norm(text_embedding)
      image_embedding = image_embedding / np.linalg.norm(image_embedding)
      query_embedding = (text_embedding + image_embedding) / 2.0
      query_embedding = query_embedding / np.linalg.norm(query_embedding)
      index_type = (
          "image"  
      )

    elif text_embedding is not None:
      query_embedding = text_embedding
      index_type = "text"

    elif image_embedding is not None:
      query_embedding = image_embedding
      index_type = "image"
    
    indices, distances = get_similar_products_indices(query_embedding, limit, index_type=index_type)
    print(f"Indices: {indices}, Distances: {distances}")
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

    query_distance = np.asarray(query_distance).reshape(-1)

    if len(product_list) != len(query_distance):
        aligned_length = min(len(product_list), len(query_distance))
        product_list = product_list[:aligned_length]
        ranked_ids = ranked_ids[:aligned_length]
        query_distance = query_distance[:aligned_length]

    features = compute_features(product_list, query_distance)

    name_boosts = (
        _build_name_boosts(query, product_list)
        if query
        else np.zeros(len(product_list))
    )
    new_predictions = new_ranker.predict(features) + name_boosts

    # Sort items by ranking score (highest first)
    # ranked_indices = np.argsort(-new_predictions)  # Negative for descending order

    # Carbon footprint per candidate (NaN when not estimated -> middle carbon rank).
    co2e_values = np.array(
        [p.co2e_kg if p.co2e_kg is not None else np.nan for p in product_list],
        dtype=float,
    )

    # Fuse relevance + carbon rankings with RRF (carbon weight CARBON_RRF_WEIGHT).
    fused_order = _rrf_fuse(new_predictions, co2e_values)

    product_ids = [product_list[i].product_id for i in fused_order]

    # Generate brief LLM recommendation explanations for top 4 ranked products
    top_4_products = [product_list[i] for i in fused_order[:4]]
    reasons = generate_ranking_explanations(query, top_4_products)

    return product_ids, reasons