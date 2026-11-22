"""Retrain CatBoost on LLM-judged labels with a leakage-free, query-grouped CV.

The old notebook reported ~95 % because (1) augmented copies of the same query
could land in both train and test, and (2) 1/3 of the rows were synthetic
"garbage" negatives that are trivially separable.  Here:

* labels come from the Claude judge (labels.jsonl via run_eval.py),
* only real FAISS candidates are used (no synthetic rows),
* GroupKFold on the query id -> a query is never in train and test at once,
* NDCG@10 is reported per fold, not classification accuracy.

    python -m evaluation.train_ranker --out evaluation/out --save models/catboost_ranker_model.txt
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import catboost
import numpy as np
from sklearn.model_selection import GroupKFold

from evaluation.metrics import ndcg_at_k
from evaluation.run_eval import load_candidates


def build_matrix(candidates: Path, labels: Path):
    judged = {}
    for line in labels.read_text(encoding="utf-8").splitlines():
        if line.strip():
            row = json.loads(line)
            judged[(row["query"], row["product_id"])] = row["label"]
    X, y, groups = [], [], []
    for qid, rows in sorted(load_candidates(candidates).items()):
        for r in rows:
            key = (r["query"], r["product_id"])
            if key in judged:
                X.append(r["features"])
                y.append(judged[key])
                groups.append(qid)
    return np.asarray(X, dtype=float), np.asarray(y, dtype=float), np.asarray(groups)


def _ndcg_per_query(model, X, y, groups, k=10):
    scores = model.predict(X)
    out = []
    for g in np.unique(groups):
        mask = groups == g
        order = np.argsort(-scores[mask])
        out.append(ndcg_at_k(list(y[mask][order]), k, list(y[mask])))
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=Path("evaluation/out"))
    parser.add_argument("--folds", type=int, default=5)
    parser.add_argument("--save", type=Path, help="write the model trained on all data here")
    args = parser.parse_args()

    X, y, groups = build_matrix(args.out / "candidates.jsonl", args.out / "labels.jsonl")
    params = dict(iterations=500, learning_rate=0.05, depth=6, loss_function="YetiRank",
                  eval_metric="NDCG:top=10", random_seed=42, verbose=False)

    fold_scores = []
    for fold, (tr, te) in enumerate(GroupKFold(n_splits=args.folds).split(X, y, groups), 1):
        order_tr, order_te = np.argsort(groups[tr], kind="stable"), np.argsort(groups[te], kind="stable")
        tr, te = tr[order_tr], te[order_te]
        model = catboost.CatBoostRanker(**params)
        model.fit(catboost.Pool(X[tr], y[tr], group_id=groups[tr]))
        per_query = _ndcg_per_query(model, X[te], y[te], groups[te])
        fold_scores.append(float(np.mean(per_query)))
        print(f"fold {fold}: NDCG@10 = {fold_scores[-1]:.4f} ({len(per_query)} test queries)")

    report = {"ndcg@10_mean": float(np.mean(fold_scores)), "ndcg@10_std": float(np.std(fold_scores)),
              "folds": fold_scores, "n_rows": int(len(y)), "n_queries": int(len(np.unique(groups)))}
    (args.out / "train_cv.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))

    if args.save:
        order = np.argsort(groups, kind="stable")
        model = catboost.CatBoostRanker(**params)
        model.fit(catboost.Pool(X[order], y[order], group_id=groups[order]))
        model.save_model(str(args.save))
        print(f"model saved to {args.save}")


if __name__ == "__main__":
    main()
