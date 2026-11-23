"""Weighted Reciprocal Rank Fusion of relevance and CO2 (pure numpy, unit-tested in test_rrf.py).

    score = 1 / (RRF_K + relevance rank) + CARBON_RRF_WEIGHT / (RRF_K + CO2 rank)

Relevance stays dominant; the CO2 rank (1 = lowest kg CO2e) only breaks near-ties.
Only ranks are used, so the absolute error of the kg estimate does not matter as
long as the order is right.
"""
import numpy as np

RRF_K = 60  # standard RRF damping constant
CARBON_RRF_WEIGHT = 0.2


def _ranks_from_scores(scores, higher_is_better=True):
    """1-based rank for each item; tied values share the same rank.

    Ties must not be broken by array position: when no product has a CO2e
    estimate they all tie, and handing rank 1 to whichever came first would let
    candidate order leak into the final ranking.
    """
    scores = np.asarray(scores, dtype=float)
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


def carbon_ranks(co2e_values):
    """CO2 rank per item (1 = lowest kg). Items without a number (NaN) get the
    middle rank of the items that have one, so a missing number is neither
    rewarded nor punished. All missing -> all rank 1 (no effect)."""
    co2e_values = np.asarray(co2e_values, dtype=float)
    known = ~np.isnan(co2e_values)
    ranks = np.ones(len(co2e_values), dtype=float)
    if known.any():
        ranks[known] = _ranks_from_scores(co2e_values[known], higher_is_better=False)
        ranks[~known] = (known.sum() + 1) / 2.0
    return ranks


def _rrf_fuse(relevance_scores, co2e_values):
    """Return candidate indices ordered best-to-worst."""
    relevance_ranks = _ranks_from_scores(relevance_scores, higher_is_better=True)
    rrf_scores = 1.0 / (RRF_K + relevance_ranks) + CARBON_RRF_WEIGHT / (RRF_K + carbon_ranks(co2e_values))
    return np.argsort(-rrf_scores, kind="stable")
