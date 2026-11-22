"""Leave-one-out validation of the carbon estimator.

Hides each reference product, estimates it from the others (same-category
neighbours first), and reports MAE / MAPE / Spearman for two methods:
the neighbour-average baseline and the LLM. Run inside the etl-worker container.
"""
import json
import os
from pathlib import Path
from types import SimpleNamespace

import numpy as np

from data.process.data_transformer import encode_text
from data.process.carbon_estimator import _estimate_with_llm

SEED_FILE = Path(__file__).parent / "data" / "seed" / "carbon_reference_seed_expanded.json"
TOP_K = 5
SAMPLE_N = int(os.environ.get("VALIDATE_N", "30"))
RANDOM_SEED = 42


def _rankdata(values):
    order = np.argsort(values, kind="mergesort")
    ranks = np.empty(len(values), dtype=float)
    ranks[order] = np.arange(len(values))
    return ranks


def _spearman(a, b):
    return float(np.corrcoef(_rankdata(a), _rankdata(b))[0, 1])


def _metrics(trues, preds):
    trues, preds = np.asarray(trues, dtype="float64"), np.asarray(preds, dtype="float64")
    mae = float(np.mean(np.abs(preds - trues)))
    mape = float(np.mean(np.abs(preds - trues) / trues) * 100)
    return mae, mape, _spearman(trues, preds)


def _neighbours(embeddings, rows, i, category):
    sims = embeddings @ embeddings[i]
    sims[i] = -1.0  # exclude itself
    ranked = [int(j) for j in np.argsort(sims)[::-1] if j != i]
    same = [j for j in ranked if rows[j]["category"] == category]
    chosen = same[:TOP_K] if len(same) >= TOP_K else (same + [j for j in ranked if j not in same])[:TOP_K]
    return [{"name": rows[j]["name"], "category": rows[j]["category"],
             "brand": rows[j].get("brand"), "co2e_kg": rows[j]["co2e_kg"]} for j in chosen]


def main():
    rows = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    print(f"Loaded {len(rows)} reference products. Embedding with CLIP...", flush=True)
    texts = [f"{(r.get('brand') or '')} {r['name']} {r['category']}".strip() for r in rows]
    embeddings = np.asarray([encode_text(t) for t in texts], dtype="float32")
    embeddings /= np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-9

    rng = np.random.default_rng(RANDOM_SEED)
    indices = range(len(rows))
    if SAMPLE_N and SAMPLE_N < len(rows):
        indices = sorted(rng.choice(len(rows), size=SAMPLE_N, replace=False).tolist())

    trues, baseline_preds, llm_preds, used_llm = [], [], [], 0
    for position, i in enumerate(indices, 1):
        neighbours = _neighbours(embeddings, rows, i, rows[i]["category"])
        baseline = sum(n["co2e_kg"] for n in neighbours) / len(neighbours)
        # _estimate_with_llm expects (neighbour_dict, score) tuples; score=1.0
        # because the validation loop already selects semantically close neighbours.
        scored_neighbours = [(n, 1.0) for n in neighbours]
        result = _estimate_with_llm(
            SimpleNamespace(name=rows[i]["name"], description=""),
            scored_neighbours,
            ref_category=rows[i]["category"],
        )
        llm = result[0] if result is not None else baseline
        used_llm += result is not None
        trues.append(rows[i]["co2e_kg"])
        baseline_preds.append(baseline)
        llm_preds.append(llm)
        print(f"[{position}/{len(indices)}] {rows[i]['name']}: "
              f"true={rows[i]['co2e_kg']} baseline={round(baseline, 1)} llm={round(llm, 1)}", flush=True)

    b_mae, b_mape, b_spear = _metrics(trues, baseline_preds)
    l_mae, l_mape, l_spear = _metrics(trues, llm_preds)
    print("\n================ VALIDATION RESULTS ================")
    print(f"Products tested: {len(trues)}  (LLM used: {used_llm})")
    print(f"{'Method':<16}{'MAE (kg)':>10}{'MAPE (%)':>10}{'Spearman':>10}")
    print(f"{'Neighbour avg':<16}{b_mae:>10.1f}{b_mape:>10.1f}{b_spear:>10.3f}")
    print(f"{'LLM':<16}{l_mae:>10.1f}{l_mape:>10.1f}{l_spear:>10.3f}")
    print("====================================================")


if __name__ == "__main__":
    main()
