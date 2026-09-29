"""Ranking / agreement metrics used in the experiments section.

Graded relevance labels are integers 0..3 (0 = irrelevant, 3 = perfect match).
"""

from __future__ import annotations

import math
import random
from collections.abc import Callable, Sequence


def dcg(labels: Sequence[float], k: int) -> float:
    return sum((2 ** rel - 1) / math.log2(i + 2) for i, rel in enumerate(labels[:k]))


def ndcg_at_k(ranked_labels: Sequence[float], k: int, all_labels: Sequence[float] | None = None) -> float:
    """NDCG@k. ``all_labels`` = every judged label for the query (ideal ranking pool)."""
    pool = sorted(all_labels if all_labels is not None else ranked_labels, reverse=True)
    ideal = dcg(pool, k)
    return dcg(ranked_labels, k) / ideal if ideal > 0 else 0.0


def precision_at_k(ranked_labels: Sequence[float], k: int, threshold: int = 2) -> float:
    top = ranked_labels[:k]
    return sum(1 for r in top if r >= threshold) / k if top else 0.0


def average_precision(ranked_labels: Sequence[float], threshold: int = 2) -> float:
    hits, total = 0, 0.0
    for i, rel in enumerate(ranked_labels, 1):
        if rel >= threshold:
            hits += 1
            total += hits / i
    return total / hits if hits else 0.0


def reciprocal_rank(ranked_labels: Sequence[float], threshold: int = 2) -> float:
    for i, rel in enumerate(ranked_labels, 1):
        if rel >= threshold:
            return 1 / i
    return 0.0


def accuracy(y_true: Sequence[int], y_pred: Sequence[int]) -> float:
    return sum(a == b for a, b in zip(y_true, y_pred)) / len(y_true) if y_true else 0.0


def quadratic_weighted_kappa(a: Sequence[int], b: Sequence[int], n_classes: int = 4) -> float:
    """Cohen's kappa with quadratic weights -- agreement between two annotators."""
    n = len(a)
    if n == 0:
        return 0.0
    observed = [[0] * n_classes for _ in range(n_classes)]
    for x, y in zip(a, b):
        observed[x][y] += 1
    hist_a = [sum(row) for row in observed]
    hist_b = [sum(observed[i][j] for i in range(n_classes)) for j in range(n_classes)]
    num = den = 0.0
    for i in range(n_classes):
        for j in range(n_classes):
            w = (i - j) ** 2 / (n_classes - 1) ** 2
            num += w * observed[i][j]
            den += w * hist_a[i] * hist_b[j] / n
    return 1 - num / den if den else 1.0


def _rank(values: Sequence[float]) -> list[float]:
    order = sorted(range(len(values)), key=lambda i: values[i])
    ranks = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        for t in range(i, j + 1):
            ranks[order[t]] = (i + j) / 2
        i = j + 1
    return ranks


def spearman(a: Sequence[float], b: Sequence[float]) -> float:
    ra, rb = _rank(a), _rank(b)
    n = len(a)
    ma, mb = sum(ra) / n, sum(rb) / n
    cov = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    var = math.sqrt(sum((x - ma) ** 2 for x in ra) * sum((y - mb) ** 2 for y in rb))
    return cov / var if var else 0.0


def bootstrap_ci(values: Sequence[float], stat: Callable[[Sequence[float]], float] = None,
                 n_boot: int = 2000, alpha: float = 0.05, seed: int = 42) -> tuple[float, float, float]:
    """Mean (or ``stat``) with a percentile bootstrap confidence interval over queries."""
    stat = stat or (lambda xs: sum(xs) / len(xs))
    rng = random.Random(seed)
    boots = sorted(stat([rng.choice(values) for _ in values]) for _ in range(n_boot))
    lo = boots[int(alpha / 2 * n_boot)]
    hi = boots[int((1 - alpha / 2) * n_boot) - 1]
    return stat(values), lo, hi


def paired_randomization_test(a: Sequence[float], b: Sequence[float], n_iter: int = 10000, seed: int = 42) -> float:
    """Two-sided p-value that per-query scores of systems A and B differ."""
    rng = random.Random(seed)
    diffs = [x - y for x, y in zip(a, b)]
    observed = abs(sum(diffs))
    count = sum(
        1 for _ in range(n_iter)
        if abs(sum(d if rng.random() < 0.5 else -d for d in diffs)) >= observed
    )
    return (count + 1) / (n_iter + 1)
