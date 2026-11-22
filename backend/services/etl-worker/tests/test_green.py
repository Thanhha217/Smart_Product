import pytest

from green import assess_green, estimate_co2, estimate_savings, is_in_focus, parse_specs
from green.focus import APPLIANCES, ELECTRONICS
from green.spec_parser import ProductSpecs


class TestSpecParser:
    def test_air_conditioner_name(self):
        specs = parse_specs("Máy lạnh Daikin Inverter 1.5 HP FTKB35YVMV", "Nhãn năng lượng 5 sao")
        assert specs.inverter
        assert specs.cooling_hp == 1.5
        assert specs.energy_label_stars == 5

    def test_annual_and_daily_kwh(self):
        assert parse_specs("Điện năng tiêu thụ 280 kWh/năm").annual_kwh == 280
        assert parse_specs("Tiêu thụ 0,9 kWh/ngày").effective_annual_kwh() == pytest.approx(328.5)

    def test_power_and_sizes(self):
        specs = parse_specs("Tủ lạnh Samsung 322 lít, công suất 1.2 kW")
        assert specs.volume_l == 322
        assert specs.power_w == 1200
        assert parse_specs("Smart Tivi LG 55 inch").screen_inch == 55
        assert parse_specs("Máy giặt LG 9 kg").load_kg == 9

    def test_model_code_is_not_power(self):
        assert parse_specs("Máy giặt LG Inverter 9 kg FV1409S4W").power_w is None
        assert parse_specs("Quạt đứng 55W").power_w == 55

    def test_btu_converted_to_hp(self):
        assert parse_specs("Điều hòa 18.000 BTU").cooling_hp == 2.0

    def test_refurbished_and_certification(self):
        specs = parse_specs("Laptop Dell Latitude 5420 - Cũ Xước Cấn", "Đạt chuẩn Energy Star, EPEAT Gold")
        assert specs.refurbished
        assert set(specs.certifications) >= {"energy_star", "epeat"}

    def test_empty(self):
        assert parse_specs(None, "") == ProductSpecs()


class TestCO2Formula:
    def test_horizon_is_linear_in_time(self):
        r = estimate_co2("air_conditioners", ProductSpecs(cooling_hp=1.0, annual_kwh=1000))
        six, twelve = r.horizons
        assert twelve.use_kg == pytest.approx(2 * six.use_kg)
        assert twelve.use_kg == pytest.approx(1000 * 0.6592, rel=1e-3)
        assert r.kwh_source == "label"

    def test_lifecycle_decomposition(self):
        r = estimate_co2("refrigerators", ProductSpecs(volume_l=300))
        expected = r.embodied_kg + r.lifetime_years * (r.use_kg_per_year + r.refrigerant_kg_per_year) + r.eol_kg
        assert r.lifecycle_kg == pytest.approx(expected, abs=0.2)
        assert r.lifecycle_low_kg < r.lifecycle_kg < r.lifecycle_high_kg

    def test_inverter_saves_co2(self):
        savings = estimate_savings("air_conditioners", ProductSpecs(cooling_hp=1.0, inverter=True))
        six, twelve = savings
        assert six.co2_net_saved_kg > 0
        assert twelve.co2_net_saved_kg == pytest.approx(2 * six.co2_net_saved_kg, rel=1e-3)
        assert twelve.money_saved_vnd > 0

    def test_standard_product_saves_nothing(self):
        (s,) = estimate_savings("refrigerators", ProductSpecs(volume_l=300), horizons_months=(12,))
        assert s.co2_net_saved_kg == pytest.approx(0)

    def test_refurbished_cuts_embodied(self):
        new = estimate_co2("laptops", ProductSpecs())
        used = estimate_co2("laptops", ProductSpecs(refurbished=True))
        assert used.embodied_kg == pytest.approx(new.embodied_kg * 0.2)

    def test_unknown_category(self):
        with pytest.raises(KeyError):
            estimate_co2("books_vi", ProductSpecs())


class TestGreenScore:
    def test_efficient_ac_is_green(self):
        a = assess_green("air_conditioners", ProductSpecs(cooling_hp=1, inverter=True, energy_label_stars=5), APPLIANCES)
        assert a.is_green and a.score >= 60 and a.reasons_vi

    def test_standard_fridge_is_not_green(self):
        assert not assess_green("refrigerators", ProductSpecs(volume_l=300), APPLIANCES).is_green

    def test_refurbished_laptop_is_green_in_electronics(self):
        a = assess_green("laptops", ProductSpecs(refurbished=True, certifications=["epeat"]), ELECTRONICS)
        assert a.is_green and a.score == 80

    def test_focus_membership(self):
        assert is_in_focus("air_conditioners", APPLIANCES)
        assert not is_in_focus("laptops", APPLIANCES)
        assert is_in_focus("laptops", ELECTRONICS)
