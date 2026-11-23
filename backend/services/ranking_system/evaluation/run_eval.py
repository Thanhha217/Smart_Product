"""Judge the exported candidates with Claude and report ranking quality.

Does not need FAISS / Postgres -- only the JSONL from export_candidates.py:

    python -m evaluation.run_eval --candidates evaluation/out/candidates.jsonl \
        --human evaluation/human_labels.csv --out evaluation/out

Outputs (in --out):
    labels.jsonl        cached LLM judgements (re-runs are free)
    results.json        per-system metrics with 95 % bootstrap CI + p-values
    results_table.tex   LaTeX table ready for paper/research_paper.tex
    fig_ndcg.png        NDCG@k per system (bar chart with CI)
    fig_agreement.png   LLM-vs-human confusion matrix (only with --human)

--human is an optional CSV (query,product_id,label) of manually graded pairs
used to validate the judge itself (quadratic weighted kappa, accuracy).
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path

from evaluation.llm_judge import LLMJudge
from evaluation.metrics import (
    accuracy, average_precision, bootstrap_ci, ndcg_at_k, paired_randomization_test,
    precision_at_k, quadratic_weighted_kappa, reciprocal_rank,
)

SYSTEMS = ("faiss", "catboost", "catboost_rrf")
KS = (5, 10, 20)


def load_candidates(path: Path) -> dict[int, list[dict]]:
    by_query: dict[int, list[dict]] = defaultdict(list)
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            row = json.loads(line)
            by_query[row["qid"]].append(row)
    return by_query


def judge_all(by_query: dict[int, list[dict]], judge: LLMJudge) -> None:
    total = sum(len(v) for v in by_query.values())
    done = 0
    for rows in by_query.values():
        for row in rows:
            row["label"] = judge.judge(row["query"], row).label
            done += 1
            if done % 50 == 0:
                print(f"judged {done}/{total}", flush=True)


def per_query_scores(by_query: dict[int, list[dict]]) -> dict[str, dict[str, list[float]]]:
    scores: dict[str, dict[str, list[float]]] = {s: defaultdict(list) for s in SYSTEMS}
    for rows in by_query.values():
        pool = [r["label"] for r in rows]
        for system in SYSTEMS:
            ranked = [r["label"] for r in sorted(rows, key=lambda r: r["ranks"][system])]
            for k in KS:
                scores[system][f"ndcg@{k}"].append(ndcg_at_k(ranked, k, pool))
                scores[system][f"p@{k}"].append(precision_at_k(ranked, k))
            scores[system]["map"].append(average_precision(ranked))
            scores[system]["mrr"].append(reciprocal_rank(ranked))
    return scores


def summarise(scores) -> dict:
    summary = {}
    for system, metrics in scores.items():
        summary[system] = {}
        for metric, values in metrics.items():
            mean, lo, hi = bootstrap_ci(values)
            summary[system][metric] = {"mean": round(mean, 4), "ci95": [round(lo, 4), round(hi, 4)]}
    summary["p_values_vs_faiss"] = {
        system: {m: round(paired_randomization_test(scores[system][m], scores["faiss"][m]), 4)
                 for m in ("ndcg@10", "map")}
        for system in SYSTEMS if system != "faiss"
    }
    return summary


def human_agreement(by_query, human_csv: Path) -> dict:
    llm = {(r["query"], r["product_id"]): r["label"] for rows in by_query.values() for r in rows}
    pairs = []
    with human_csv.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            key = (row["query"], int(row["product_id"]))
            if key in llm:
                pairs.append((int(row["label"]), llm[key]))
    if not pairs:
        return {}
    human, model = zip(*pairs)
    confusion = [[0] * 4 for _ in range(4)]
    for h, m in pairs:
        confusion[h][m] += 1
    return {
        "n": len(pairs),
        "accuracy": round(accuracy(human, model), 4),
        "within_one": round(sum(abs(h - m) <= 1 for h, m in pairs) / len(pairs), 4),
        "quadratic_kappa": round(quadratic_weighted_kappa(list(human), list(model)), 4),
        "confusion": confusion,
    }


def write_latex(summary: dict, path: Path) -> None:
    names = {"faiss": "FAISS (cosine)", "catboost": "CatBoost", "catboost_rrf": "CatBoost + CO$_2$ RRF"}
    cols = ["ndcg@5", "ndcg@10", "map", "mrr", "p@10"]
    lines = [
        "\\begin{table}[htbp]", "\\caption{Ranking quality (LLM-judged, 95\\% CI)}", "\\centering",
        "\\begin{tabular}{l" + "c" * len(cols) + "}", "\\toprule",
        "\\textbf{System} & " + " & ".join(f"\\textbf{{{c.upper()}}}" for c in cols) + " \\\\", "\\midrule",
    ]
    for system in SYSTEMS:
        cells = [f"{summary[system][c]['mean']:.3f}" for c in cols]
        lines.append(f"{names[system]} & " + " & ".join(cells) + " \\\\")
    lines += ["\\bottomrule", "\\end{tabular}", "\\end{table}"]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def plot(summary: dict, agreement: dict, out: Path) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(6, 3.5))
    width = 0.25
    for i, system in enumerate(SYSTEMS):
        means = [summary[system][f"ndcg@{k}"]["mean"] for k in KS]
        errs = [[m - summary[system][f"ndcg@{k}"]["ci95"][0] for k, m in zip(KS, means)],
                [summary[system][f"ndcg@{k}"]["ci95"][1] - m for k, m in zip(KS, means)]]
        ax.bar([x + i * width for x in range(len(KS))], means, width, yerr=errs, capsize=3, label=system)
    ax.set_xticks([x + width for x in range(len(KS))], [f"NDCG@{k}" for k in KS])
    ax.set_ylim(0, 1)
    ax.set_ylabel("score")
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(out / "fig_ndcg.png", dpi=200)

    if agreement:
        fig, ax = plt.subplots(figsize=(3.6, 3.2))
        ax.imshow(agreement["confusion"], cmap="Blues")
        for i in range(4):
            for j in range(4):
                ax.text(j, i, agreement["confusion"][i][j], ha="center", va="center")
        ax.set_xlabel("LLM label")
        ax.set_ylabel("Human label")
        ax.set_title(f"kappa={agreement['quadratic_kappa']:.2f}")
        fig.tight_layout()
        fig.savefig(out / "fig_agreement.png", dpi=200)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidates", type=Path, default=Path("evaluation/out/candidates.jsonl"))
    parser.add_argument("--human", type=Path)
    parser.add_argument("--out", type=Path, default=Path("evaluation/out"))
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    by_query = load_candidates(args.candidates)
    judge_all(by_query, LLMJudge(args.out / "labels.jsonl"))

    summary = summarise(per_query_scores(by_query))
    summary["n_queries"] = len(by_query)
    summary["n_pairs"] = sum(len(v) for v in by_query.values())
    agreement = human_agreement(by_query, args.human) if args.human else {}
    summary["judge_vs_human"] = agreement

    (args.out / "results.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    write_latex(summary, args.out / "results_table.tex")
    plot(summary, agreement, args.out)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
