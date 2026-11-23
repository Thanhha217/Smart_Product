"""Step 1 of the CO2 method: the manufacturer published a figure for this exact model.

Pure Python (no database, no CLIP), unit-tested in tests/test_exact_match.py.
"""
from __future__ import annotations

import re
from typing import Iterable, Mapping

MIN_TOKENS = 3  # a reference name needs at least this many words to count as an exact model


def tokens(text: str | None) -> str:
    """Lower-case words and numbers joined by single spaces: 'MacBook Air 13" (M3)' -> 'macbook air 13 m3'."""
    return " ".join(re.findall(r"[a-z0-9]+", (text or "").lower()))


def find_exact_reference(name: str | None, references: Iterable[Mapping]) -> Mapping | None:
    """Longest reference name (>= MIN_TOKENS words) contained word for word in the product name.

    The reference brand may be missing from the product name, because shops often
    write 'Điện thoại iPhone 15 128GB' for 'Apple iPhone 15 128GB'.
    """
    haystack = f" {tokens(name)} "
    best, best_len = None, 0
    for ref in references:
        key = tokens(ref.get("name"))
        keys = [key]
        brand = tokens(ref.get("brand"))
        if brand and key.startswith(brand + " "):
            keys.append(key[len(brand) + 1:])
        for k in keys:
            if len(k.split()) >= MIN_TOKENS and f" {k} " in haystack and len(k) > best_len:
                best, best_len = ref, len(k)
    return best
