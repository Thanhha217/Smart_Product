"""Which product group the system focuses on (advisor requirement #1).

The advisor asked to narrow the catalogue to ONE product group and, if
possible, keep only green / eco-friendly products.  Two groups are defined:

* ``appliances`` (default, recommended) -- energy-using home appliances.  Their
  carbon footprint is dominated by the use phase (electricity), Vietnam has a
  mandatory energy label (TCVN / "nhãn năng lượng" 1-5 sao) so "green" can be
  decided from published data, and "CO2 saved over 6 months / 1 year" is large
  and measurable.
* ``electronics`` -- the current catalogue (phones, laptops, monitors...).  Kept
  as a fallback because the existing data, CO2 seed and CatBoost model are
  built on it, but the use-phase share is small, so 6/12-month savings are
  small too.

Select with the ``FOCUS_GROUP`` environment variable.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class FocusGroup:
    key: str
    name_vi: str
    name_en: str
    # Taxonomy slugs (taxonomy/categories.py) that belong to the group.
    category_slugs: tuple[str, ...]
    # Minimum GreenScore (0-100) for a product to be kept in "green only" mode.
    min_green_score: float


APPLIANCES = FocusGroup(
    key="appliances",
    name_vi="Điện gia dụng tiết kiệm năng lượng",
    name_en="Energy-efficient home appliances",
    category_slugs=(
        "air_conditioners",
        "refrigerators",
        "washing_machines",
        "televisions",
        "electric_fans",
        "rice_cookers",
        "air_purifiers",
        "water_purifiers",
        "vacuum_cleaners",
        "microwaves_ovens",
        "stoves",
        "lighting",
    ),
    min_green_score=60.0,
)

ELECTRONICS = FocusGroup(
    key="electronics",
    name_vi="Sản phẩm công nghệ",
    name_en="Consumer electronics",
    category_slugs=(
        "smartphones",
        "laptops",
        "gaming_laptops",
        "tablets",
        "monitors",
        "desktops",
        "smartwatches",
        "headphones",
        "speakers",
    ),
    min_green_score=50.0,
)

_GROUPS = {g.key: g for g in (APPLIANCES, ELECTRONICS)}


def get_focus_group(key: str | None = None) -> FocusGroup:
    key = (key or os.environ.get("FOCUS_GROUP", "appliances")).strip().lower()
    if key not in _GROUPS:
        raise ValueError(f"Unknown FOCUS_GROUP {key!r}; expected one of {sorted(_GROUPS)}")
    return _GROUPS[key]


FOCUS_GROUP = get_focus_group()


def is_in_focus(category_slug: str | None, group: FocusGroup | None = None) -> bool:
    """True if a product with this taxonomy slug belongs to the focus group."""
    group = group or FOCUS_GROUP
    return bool(category_slug) and category_slug in group.category_slugs
