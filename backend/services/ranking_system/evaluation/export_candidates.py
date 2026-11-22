"""Export the candidate pool and each system's ordering for offline evaluation.

Runs INSIDE the ranking-system container (needs FAISS + Postgres):

    python -m evaluation.export_candidates --queries evaluation/eval_queries.txt \
        --out evaluation/out/candidates.jsonl

For every query it records the FAISS top-N pool, the 7 CatBoost features, and
the rank of each product under three systems so they can be compared on the
same judged pool:

    faiss        cosine similarity only
    catboost     CatBoost score + title boost
    catboost_rrf CatBoost fused with CO2 rank (current production ranking)
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from product_embeddings import create_text_embedding
from product_featurer import compute_features
from product_searcher import get_products_from_ids, get_similar_products_indices
from ranker import _build_name_boosts, _rrf_fuse, new_ranker


def _order_to_ranks(order) -> list[int]:
    ranks = [0] * len(order)
    for position, idx in enumerate(order, 1):
        ranks[int(idx)] = position
    return ranks


def export(queries: list[str], pool_size: int, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as f:
        for qid, query in enumerate(queries, 1):
            indices, distances = get_similar_products_indices(create_text_embedding(query), pool_size)
            pairs = [(int(i), float(d)) for i, d in zip(indices[0], distances[0]) if int(i) >= 0]
            products = get_products_from_ids([i for i, _ in pairs])
            sims = dict(pairs)
            products = [p for p in products if p.final_price and p.final_price > 0]
            if len(products) < 2:
                continue
            similarity = np.array([sims[int(p.product_id)] for p in products])

            features = compute_features(products, similarity)
            catboost_scores = new_ranker.predict(features) + _build_name_boosts(query, products)
            co2 = np.array([p.co2e_kg if p.co2e_kg is not None else np.nan for p in products], dtype=float)

            ranks = {
                "faiss": _order_to_ranks(np.argsort(-similarity, kind="stable")),
                "catboost": _order_to_ranks(np.argsort(-catboost_scores, kind="stable")),
                "catboost_rrf": _order_to_ranks(_rrf_fuse(catboost_scores, co2)),
            }
            for i, p in enumerate(products):
                f.write(json.dumps({
                    "qid": qid,
                    "query": query,
                    "product_id": int(p.product_id),
                    "name": p.product_name,
                    "platform": p.platform_name,
                    "final_price": p.final_price,
                    "product_rating": p.product_rating,
                    "review_count": p.review_count,
                    "description": (p.description or "")[:600],
                    "co2e_kg": p.co2e_kg,
                    "features": [round(float(x), 4) for x in features[i]],
                    "ranks": {name: r[i] for name, r in ranks.items()},
                }, ensure_ascii=False) + "\n")
            print(f"[{qid}/{len(queries)}] {query}: {len(products)} candidates", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--queries", type=Path, default=Path("evaluation/eval_queries.txt"))
    parser.add_argument("--pool", type=int, default=50)
    parser.add_argument("--out", type=Path, default=Path("evaluation/out/candidates.jsonl"))
    args = parser.parse_args()
    queries = [q.strip() for q in args.queries.read_text(encoding="utf-8").splitlines() if q.strip()]
    export(queries, args.pool, args.out)


if __name__ == "__main__":
    main()
