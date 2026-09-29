"""Green-product focus, spec parsing and the CO2 lifecycle formula.

Pure-Python, no DB / network access, so it can be unit-tested and reused by the
ETL worker, the ranking evaluation and the assistant service alike.
See docs/research/co2-formula.md for the maths.
"""

from green.co2_formula import CO2Result, estimate_co2, estimate_savings
from green.focus import FOCUS_GROUP, FocusGroup, get_focus_group, is_in_focus
from green.green_score import GreenAssessment, assess_green
from green.spec_parser import ProductSpecs, parse_specs

__all__ = [
    "CO2Result",
    "estimate_co2",
    "estimate_savings",
    "FOCUS_GROUP",
    "FocusGroup",
    "get_focus_group",
    "is_in_focus",
    "GreenAssessment",
    "assess_green",
    "ProductSpecs",
    "parse_specs",
]
