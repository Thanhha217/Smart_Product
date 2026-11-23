"""Key specs per category, read from the product name (the shops' structured specs are
not stored). Returns only what is actually written; nothing is guessed.
Pure Python: unit-tested in tests/test_product_specs.py.
"""
from __future__ import annotations

import re

from search_query import BRAND_ALIASES, BRANDS, fold


def brand_of(name: str | None) -> str | None:
    low = f" {fold(name)} "
    for brand, aliases in BRAND_ALIASES.items():
        if any(re.search(rf"(?<![a-z0-9]){re.escape(a)}(?![a-z0-9])", low) for a in aliases):
            return brand
    for brand in sorted(BRANDS, key=len, reverse=True):
        if re.search(rf"(?<![a-z0-9]){re.escape(fold(brand))}(?![a-z0-9])", low):
            return brand.split()[0]
    return None


def condition_of(name: str | None) -> str | None:
    low = fold(name)
    if re.search(r"\b(cu|da kich hoat|like new|qua su dung|refurbished|used|99%)\b", low):
        return "used"
    return None


def _inch(text: str) -> str | None:
    m = re.search(r"(\d{2}(?:[.,]\d)?)\s*(?:-?\s*inch|\"|”|in\b)", text)
    return m.group(1).replace(",", ".") if m else None


def specs_of(name: str | None, category: str | None) -> list[dict]:
    """[{key, value}] with keys: cpu, ram, storage, screen, resolution, refresh, panel, size, connectivity."""
    raw = name or ""
    text = raw.lower()
    out: list[dict] = []

    def add(key, value):
        if value and not any(s["key"] == key for s in out):
            out.append({"key": key, "value": value})

    if category in ("laptops", "tablets", "smartphones"):
        cpu = re.search(r"\b(core\s*ultra\s*\d|ultra\s*[579]|i[3579][- ]?\d{0,5}[a-z]{0,2}|ryzen\s*[3579](?:\s*\d{4}[a-z]{0,2})?|"
                        r"apple\s*m\d|\bm[1-4](?:\s*(?:pro|max))?\b|celeron\s*\w*|pentium\s*\w*|snapdragon\s*[\w+ ]{0,12}|"
                        r"helio\s*\w+|dimensity\s*\d+|a1[5-9]\s*(?:pro|bionic)?)", text)
        if cpu and category != "smartphones":
            add("cpu", cpu.group(0).strip().upper().replace("CORE ULTRA", "Core Ultra").replace("RYZEN", "Ryzen")
                .replace("CELERON", "Celeron").replace("SNAPDRAGON", "Snapdragon"))
        pair = re.search(r"\b(\d{1,2})\s*gb\s*[/|\- ]\s*(\d{2,4}\s*gb|\d\s*tb)\b", text)
        if pair:
            add("ram", f"{pair.group(1)} GB")
            add("storage", pair.group(2).upper().replace("GB", " GB").replace("TB", " TB").replace("  ", " "))
        else:
            ram = re.search(r"\b(\d{1,2})\s*gb\s*(?:ram|ddr\d|lpddr\d)", text)
            if ram:
                add("ram", f"{ram.group(1)} GB")
            sto = re.search(r"\b(\d{3,4}\s*gb|\d\s*tb)\b(?!\s*ram)", text)
            if sto:
                add("storage", sto.group(1).upper().replace("GB", " GB").replace("TB", " TB").replace("  ", " "))
        inch = _inch(text)
        if inch:
            add("screen", f'{inch}"')
    elif category == "monitors":
        inch = _inch(text)
        if inch:
            add("screen", f'{inch}"')
        res = re.search(r"\b(4k|uhd|qhd|wqhd|2k|fhd|full\s*hd|5k|\d{4}\s*x\s*\d{3,4})\b", text)
        if res:
            add("resolution", res.group(1).upper().replace("FULL HD", "Full HD").replace(" ", ""))
        hz = re.search(r"\b(\d{2,3})\s*hz\b", text)
        if hz:
            add("refresh", f"{hz.group(1)} Hz")
        panel = re.search(r"\b(ips|va|oled|qd-oled|tn|mini\s*led)\b", text)
        if panel:
            add("panel", panel.group(1).upper())
    elif category == "headphones":
        if re.search(r"true wireless|tws|bluetooth|khong day|wireless", fold(raw)):
            add("connectivity", "wireless")
        elif re.search(r"co day|wired|jack 3", fold(raw)):
            add("connectivity", "wired")
        if re.search(r"chup tai|over-ear|headset", fold(raw)):
            add("form", "over_ear")
        elif re.search(r"nhet tai|in-ear|earbuds|buds", fold(raw)):
            add("form", "in_ear")
    elif category == "smartwatches":
        mm = re.search(r"\b(\d{2})\s*mm\b", text)
        if mm:
            add("size", f"{mm.group(1)} mm")
        if "cellular" in text or "lte" in text or "esim" in text:
            add("connectivity", "cellular")
    return out[:4]
