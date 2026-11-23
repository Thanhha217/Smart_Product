"""Does a cheaper, lower-CO2 product still do the job the shopper came for?

A "greener alternative" must first answer the same need. Swapping a gaming laptop for an
office laptop because the office one emits less is not advice, it is a different product.
These checks use the only signals the catalogue holds for every row — the product name —
and stay deliberately conservative: when a signal is missing, the candidate is kept.
"""
from __future__ import annotations

import re

# names that mean "built for games or heavy graphics"
GAMING_RE = re.compile(
    r"\b(gaming|game|rtx\s*\d{3,4}|gtx\s*\d{3,4}|rog\b|tuf\b|nitro\b|predator\b|legion\b|"
    r"katana\b|cyborg\b|victus\b|omen\b|alienware\b|raider\b|strix\b|helios\b|scar\b)",
    re.I,
)
# names that mean "very light machine", a real downgrade for someone who asked for power
ENTRY_RE = re.compile(r"\b(celeron|pentium|atom|chromebook|n4\d{3}|n5\d{3}|n100|n95)\b", re.I)

_RAM_RE = re.compile(r"\b(\d{1,2})\s*gb\s*[/|\-]", re.I)
_RAM_ALONE_RE = re.compile(r"\b(4|8|12|16|24|32|64)\s*gb\s*(?:ram\b|\b)", re.I)
_INCH_RE = re.compile(r"\b(\d{2}(?:[.,]\d)?)\s*(?:inch|\"|”|'')", re.I)


def is_gaming(name: str | None) -> bool:
    return bool(GAMING_RE.search(name or ""))


def is_entry_level(name: str | None) -> bool:
    return bool(ENTRY_RE.search(name or ""))


def ram_gb(name: str | None) -> int | None:
    text = name or ""
    m = _RAM_RE.search(text) or _RAM_ALONE_RE.search(text)
    if not m:
        return None
    value = int(m.group(1))
    return value if 2 <= value <= 128 else None


def screen_inch(name: str | None) -> float | None:
    m = _INCH_RE.search(name or "")
    if not m:
        return None
    value = float(m.group(1).replace(",", "."))
    return value if 5 <= value <= 90 else None


def fits_instead_of(candidate_name: str | None, base_name: str | None) -> bool:
    """True when `candidate` can stand in for `base` without losing what it was bought for."""
    # a machine bought for games must be replaced by another one
    if is_gaming(base_name) and not is_gaming(candidate_name):
        return False
    # and an entry-level chip is not an answer to a non-entry-level machine
    if is_entry_level(candidate_name) and not is_entry_level(base_name):
        return False
    base_ram, cand_ram = ram_gb(base_name), ram_gb(candidate_name)
    if base_ram and cand_ram and cand_ram < base_ram:
        return False
    base_inch, cand_inch = screen_inch(base_name), screen_inch(candidate_name)
    if base_inch and cand_inch and cand_inch < base_inch - 2:
        return False
    return True
