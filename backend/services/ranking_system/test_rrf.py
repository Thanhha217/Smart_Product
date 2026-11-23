"""Weighted RRF of relevance and CO2 (rrf.py). Run: python -m pytest test_rrf.py"""
import numpy as np

from rrf import CARBON_RRF_WEIGHT, RRF_K, _rrf_fuse, carbon_ranks

nan = np.nan


def test_method_example_b_overtakes_a():
    # A: relevance 1, CO2 rank 10; B: relevance 2, CO2 rank 1 -> B first
    relevance = np.arange(10, 0, -1, dtype=float)
    co2 = np.array([100, 1, 2, 3, 4, 5, 6, 7, 8, 9], dtype=float)
    assert list(_rrf_fuse(relevance, co2)[:2]) == [1, 0]
    a = 1 / (RRF_K + 1) + CARBON_RRF_WEIGHT / (RRF_K + 10)
    b = 1 / (RRF_K + 2) + CARBON_RRF_WEIGHT / (RRF_K + 1)
    assert b > a


def test_relevance_dominates_large_gaps():
    relevance = np.array([10, 1], dtype=float)
    co2 = np.array([500, 5], dtype=float)
    assert list(_rrf_fuse(relevance, co2)) == [0, 1]


def test_missing_co2_gets_middle_rank():
    ranks = carbon_ranks([10, nan, 30, 20])
    assert ranks.tolist() == [1, 2, 3, 2]


def test_all_missing_has_no_effect():
    assert carbon_ranks([nan, nan, nan]).tolist() == [1, 1, 1]
    assert list(_rrf_fuse(np.array([3, 2, 1], dtype=float), np.array([nan, nan, nan]))) == [0, 1, 2]


def test_ties_share_rank():
    assert carbon_ranks([5, 5, 1]).tolist() == [2, 2, 1]


def test_missing_sits_between_best_and_worst():
    # equal relevance: lowest CO2 first, missing in the middle, highest CO2 last
    order = _rrf_fuse(np.ones(3), np.array([300.0, nan, 100.0]))
    assert list(order) == [2, 1, 0]
