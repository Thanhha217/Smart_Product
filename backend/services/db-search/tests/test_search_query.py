import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from search_query import fold, parse_query  # noqa: E402


def test_fold_removes_accents_and_case():
    assert fold("  Điều HÒA   tiết kiệm ") == "dieu hoa tiet kiem"


def test_laptop_dell_under_20_million():
    q = parse_query("Laptop Dell dưới 20 triệu")
    assert (q.category, q.brand, q.max_price, q.min_price, q.terms) == ("laptops", "Dell", 20_000_000, None, [])


def test_budget_forms():
    assert parse_query("điện thoại dưới 10tr").max_price == 10_000_000
    assert parse_query("monitor under 5 million").max_price == 5_000_000
    assert parse_query("laptop từ 10 đến 20 triệu").to_dict()["min_price"] == 10_000_000
    assert parse_query("laptop từ 10 đến 20 triệu").max_price == 20_000_000
    assert parse_query("écran moins de 4 millions").max_price == 4_000_000
    assert parse_query("tai nghe dưới 500k").max_price == 500_000


def test_unsupported_category_is_reported_not_remapped():
    q = parse_query("điều hòa tiết kiệm điện")
    assert q.unsupported == "air_conditioners" and q.category is None and q.eco
    assert parse_query("tủ lạnh 300 lít").unsupported == "refrigerators"


def test_eco_intent_and_free_terms():
    q = parse_query("màn hình 27 inch xanh nhất")
    assert q.category == "monitors" and q.eco and "27" in q.terms and "inch" in q.terms
    q = parse_query("iPhone 15 128GB")
    assert q.category == "smartphones" and "iphone" in q.terms and "15" in q.terms


def test_brand_without_category_and_unknown_text():
    q = parse_query("Samsung Galaxy")
    assert q.brand == "Samsung" and q.terms == ["galaxy"]
    q = parse_query("xyzabc")
    assert q.category is None and q.brand is None and q.terms == ["xyzabc"]


def test_empty_query():
    q = parse_query(None)
    assert q.terms == [] and q.category is None and q.raw == ""


def test_co2_thap_is_the_low_co2_intent():
    for text in ("laptop dưới 20 triệu, CO₂ thấp", "laptop dưới 20 triệu CO2 thấp", "laptop under 20 million, lowest CO2"):
        q = parse_query(text)
        assert q.eco and q.category == "laptops" and q.max_price == 20_000_000 and q.terms == [], text
