import math

import pytest

from green.fallback import (
    CategoryStats,
    canonical_category,
    category_model_estimate,
    eeio_estimate,
    estimate_without_neighbours,
    formula_estimate,
    vnd_to_usd2022,
)

REFS = (
    [{"name": f"Dell Latitude {i}", "brand": "Dell", "category": "laptop", "co2e_kg": 400} for i in range(4)]
    + [{"name": f"Apple MacBook {i}", "brand": "Apple", "category": "laptop", "co2e_kg": 150} for i in range(3)]
    + [{"name": f"Lenovo IdeaPad {i}", "brand": "Lenovo", "category": "laptop", "co2e_kg": 250} for i in range(2)]
    + [{"name": f"Dell U27{i} Monitor", "brand": "Dell", "category": "computer_monitor", "co2e_kg": 500} for i in range(5)]
    + [{"name": "AirPods", "brand": "Apple", "category": "earphone", "co2e_kg": 10}]
    + [{"name": f"Logitech M{i}", "brand": "Logitech", "category": "computer_peripheral", "co2e_kg": 5} for i in range(2)]
)
STATS = CategoryStats.from_references(REFS)


class TestCategoryModel:
    def test_category_median_without_brand(self):
        est = category_model_estimate(STATS, "laptop", "Laptop Acer Aspire 5")
        assert est.source == "category_model"
        assert est.co2e_kg == pytest.approx(250)          # median of 9 laptops
        assert est.detail["brand"] is None

    def test_brand_level_used_with_enough_refs(self):
        assert category_model_estimate(STATS, "laptop", "Laptop Dell Inspiron 15").co2e_kg == pytest.approx(400)
        assert category_model_estimate(STATS, "laptop", "MacBook Air Apple M4").co2e_kg == pytest.approx(150)
        # only 2 Lenovo refs (< MIN_BRAND_REFS): falls back to the category median
        assert category_model_estimate(STATS, "laptop", "Lenovo LOQ 15").co2e_kg == pytest.approx(250)

    def test_brand_is_a_whole_word(self):
        assert STATS.guess_brand("Laptop Delloitte X") is None
        assert STATS.guess_brand("Màn hình DELL P2425H") == "Dell"

    def test_screen_size_scaling(self):
        base = category_model_estimate(STATS, "computer_monitor", "Màn hình Dell 23.8 inch").co2e_kg
        big = category_model_estimate(STATS, "computer_monitor", "Màn hình Dell 34 inch").co2e_kg
        assert base == pytest.approx(500)
        assert big == pytest.approx(500 * (34 / 23.8) ** 0.81)
        # implausible size is ignored
        assert category_model_estimate(STATS, "computer_monitor", "Dell 2 inch").co2e_kg == pytest.approx(500)

    def test_too_few_refs(self):
        assert category_model_estimate(STATS, "computer_peripheral", "Chuột Logitech") is None
        assert category_model_estimate(STATS, "smartwatch", "Apple Watch") is None

    def test_aliases(self):
        assert canonical_category("earphone") == "headphone"
        assert canonical_category("gaming_laptop") == "laptop"
        assert category_model_estimate(STATS, "gaming_laptop", "Laptop gaming MSI").co2e_kg == pytest.approx(250)


class TestFormula:
    def test_appliance_uses_formula(self):
        est = formula_estimate("air_conditioner", "Máy lạnh Daikin Inverter 1 HP", "Nhãn năng lượng 5 sao")
        assert est.source == "lifecycle_formula"
        assert est.detail["kwh_source"] == "category_default"
        assert "Ước tính theo vòng đời" in est.explanation_vi

    def test_label_raises_confidence(self):
        a = formula_estimate("refrigerator", "Tủ lạnh 300 lít", "Điện năng tiêu thụ 280 kWh/năm")
        b = formula_estimate("refrigerator", "Tủ lạnh 300 lít", "")
        assert a.detail["kwh_source"] == "label" and a.confidence > b.confidence
        assert a.co2e_kg < b.co2e_kg                       # 280 kWh < 420 kWh default

    def test_tv_75_inch_is_in_samsung_range(self):
        est = formula_estimate("television", "Smart Tivi Samsung 75 inch", "")
        assert 982 <= est.co2e_kg <= 2388                  # Samsung 75" reports, 2023-2024

    def test_not_an_appliance(self):
        assert formula_estimate("laptop", "Laptop Dell", "") is None


class TestEEIO:
    def test_conversion(self):
        usd = vnd_to_usd2022(25_900_000)
        assert usd == pytest.approx(1000 * 292.655 / 336.940)

    def test_estimate(self):
        est = eeio_estimate("fashion_clothing", 500_000)
        assert est.source == "eeio_price"
        assert est.co2e_kg == pytest.approx(vnd_to_usd2022(500_000) * 0.12)
        assert "chưa gồm điện" in est.explanation_vi

    def test_missing_price_or_mapping(self):
        assert eeio_estimate("fashion_clothing", None) is None
        assert eeio_estimate("fashion_clothing", 0) is None
        assert eeio_estimate("software", 1_000_000) is None


class TestChain:
    def test_formula_first_for_appliances(self):
        est = estimate_without_neighbours("refrigerator", "Tủ lạnh LG 300 lít", "", 15_000_000, STATS)
        assert est.source == "lifecycle_formula"

    def test_category_model_before_price(self):
        est = estimate_without_neighbours("laptop", "Laptop Dell Vostro", "", 20_000_000, STATS)
        assert est.source == "category_model"

    def test_price_when_no_catalogue(self):
        est = estimate_without_neighbours("computer_peripheral", "Chuột Logitech M240", "", 400_000, STATS)
        assert est.source == "eeio_price"

    def test_nothing_applies(self):
        assert estimate_without_neighbours(None, "Thẻ quà tặng", "", 100_000, STATS) is None
        assert estimate_without_neighbours("computer_peripheral", "Chuột", "", None, STATS) is None

    def test_works_without_stats(self):
        assert estimate_without_neighbours("laptop", "Laptop", "", None, None) is None
        assert estimate_without_neighbours("laptop", "Laptop", "", 20_000_000, None).source == "eeio_price"
