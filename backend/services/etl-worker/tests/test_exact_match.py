"""Step 1 of the CO2 method: exact manufacturer model (green/matching.py)."""
from green.matching import find_exact_reference, tokens

REFS = [
    {"name": "Apple iPhone 15 128GB", "brand": "Apple", "co2e_kg": 56},
    {"name": "Apple iPhone 15 Pro Max 256GB", "brand": "Apple", "co2e_kg": 75},
    {"name": "MacBook Air 13-inch M3", "brand": "Apple", "co2e_kg": 135},
    {"name": "Dell Latitude 5450", "brand": "Dell", "co2e_kg": 320},
    {"name": "Pixel 8", "brand": "Google", "co2e_kg": 70},
]


def _match(name):
    ref = find_exact_reference(name, REFS)
    return ref["name"] if ref else None


def test_tokens():
    assert tokens('MacBook Air 13" (M3)') == "macbook air 13 m3"
    assert tokens(None) == ""


def test_full_name_matches():
    assert _match("Laptop MacBook Air 13-inch M3 8GB/256GB") == "MacBook Air 13-inch M3"
    assert _match("Dell Latitude 5450 i5 1335U") == "Dell Latitude 5450"


def test_brand_prefix_may_be_missing():
    assert _match("Điện thoại iPhone 15 128GB chính hãng") == "Apple iPhone 15 128GB"


def test_longest_name_wins():
    assert _match("iPhone 15 Pro Max 256GB") == "Apple iPhone 15 Pro Max 256GB"


def test_no_partial_word_or_other_variant():
    assert _match("iPhone 15 256GB") is None          # other storage -> step 2 instead
    assert _match("Dell Latitude 54500") is None      # whole words only


def test_short_names_never_match_alone():
    # "pixel 8" has only 2 words: too generic to count as an exact model
    assert _match("Google Pixel 8 Pro") is None
