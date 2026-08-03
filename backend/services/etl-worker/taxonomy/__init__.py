"""Standard category taxonomy and the embedding matcher that resolves onto it."""

from taxonomy.categories import (
    BY_SLUG,
    STANDARD_CATEGORIES,
    UNCATEGORIZED,
    StandardCategory,
)
from taxonomy.matcher import (
    CategoryMatcher,
    MatchResult,
    clean,
    get_matcher,
    match_category,
    warm_matcher,
)

__all__ = [
    "BY_SLUG",
    "STANDARD_CATEGORIES",
    "UNCATEGORIZED",
    "StandardCategory",
    "CategoryMatcher",
    "MatchResult",
    "clean",
    "get_matcher",
    "match_category",
    "warm_matcher",
]
