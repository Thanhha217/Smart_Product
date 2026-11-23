"""Formula-with-numbers and lifecycle split shown on the AI page (green.explain, green.lifecycle)."""
import json

import pytest

from green import fallback
from green.explain import build_formula, explain, vn
from green.lifecycle import STAGES, decompose, guess_origin, route


def test_vn_format():
    assert vn(1234.5) == "1.234,5"
    assert vn(332.6) == "332,6"
    assert vn(135.0) == "135"
    assert vn(0.681, 3) == "0,681"


def test_manufacturer_formula_shows_reference():
    row = {"co2e_kg": 135, "co2e_source": "manufacturer", "co2e_confidence": 0.9,
           "co2e_references": json.dumps([{"name": "Apple MacBook Air 13-inch M3", "co2e_kg": 135, "cosine": 1.0}])}
    f = build_formula(row)
    assert f["method"] == "manufacturer" and f["complete"]
    assert f["steps"][0]["value_kg"] == 135


def test_neighbour_average_substitutes_numbers():
    refs = [{"name": f"Dell Latitude {i}", "co2e_kg": kg, "cosine": 0.8} for i, kg in enumerate([290, 321, 312, 349, 391])]
    f = build_formula({"co2e_kg": 332.6, "co2e_source": "neighbor_average", "co2e_references": refs})
    last = f["steps"][-1]
    assert last["expr"] == "(290 + 321 + 312 + 349 + 391) ÷ 5 = 332,6 kg"
    assert last["value_kg"] == pytest.approx(332.6)


def test_category_model_screen_factor_matches_spec_example():
    detail = {"category": "computer_monitor", "n_refs": 330, "brand": None, "screen_inch": 27.0,
              "category_median_kg": 491.5, "brand_median_kg": None, "slope": 0.81, "ref_inch": 23.8}
    f = build_formula({"co2e_kg": 544.4, "co2e_source": "category_model", "co2e_detail": json.dumps(detail),
                       "co2e_category": "computer_monitor"})
    assert f["steps"][-1]["value_kg"] == pytest.approx(544.4, abs=0.5)
    assert "(27 ÷ 23,8)^0,81" in f["steps"][1]["expr"]


def test_formula_rebuilt_for_old_rows_without_detail():
    name = "Máy lạnh Daikin Inverter 1.5 HP FTKB35. Điện năng tiêu thụ 820 kWh/năm"
    est = fallback.formula_estimate("air_conditioner", name)
    row = {"co2e_kg": round(est.co2e_kg, 1), "co2e_source": "lifecycle_formula", "co2e_category": "air_conditioner",
           "name": name}
    out = explain(row)
    assert out["formula"]["complete"]
    assert out["lifecycle"]["basis"] == "formula"
    total = sum(s["kg"] for s in out["lifecycle"]["stages"])
    assert total == pytest.approx(row["co2e_kg"], abs=0.1)
    use = next(s for s in out["lifecycle"]["stages"] if s["key"] == "use")
    assert use["pct"] > 80                      # the use phase dominates an air conditioner
    assert out["lifecycle"]["route"]["origin_code"] == "VN"   # Daikin is assumed made in Vietnam


def test_eeio_rebuilt_and_split_has_no_use_phase():
    row = {"co2e_kg": 0.8, "co2e_source": "eeio_price", "co2e_category": "fashion_clothing", "final_price": 199000,
           "name": "Áo thun nam"}
    est = fallback.eeio_estimate("fashion_clothing", 199000)
    if est is None:
        pytest.skip("clothing has no EEIO mapping in this catalogue")
    out = explain(row)
    assert out["formula"]["complete"]
    assert next(s for s in out["lifecycle"]["stages"] if s["key"] == "use")["kg"] == 0


def test_typical_share_keeps_total_and_order():
    lc = decompose(147.0, "manufacturer", "laptop", None, "Apple MacBook Air M2")
    assert lc["basis"] == "typical_share"
    assert [s["key"] for s in lc["stages"]] == list(STAGES)
    assert sum(s["kg"] for s in lc["stages"]) == pytest.approx(147.0, abs=0.05)
    assert lc["route"]["origin_code"] == "CN" and lc["route"]["assumed"]


def test_no_number_no_stages():
    lc = decompose(None, None, "laptop")
    assert lc["basis"] == "none" and lc["stages"] == []
    assert build_formula({"co2e_kg": None, "co2e_source": None})["method"] == "none"


def test_route_uses_brand_and_mass():
    assert guess_origin("Điện thoại Samsung Galaxy A55") == "VN"
    assert guess_origin("Laptop không rõ hãng") == "CN"
    heavy = route("refrigerator", "Tủ lạnh Panasonic 322 lít")
    light = route("smartphone", "iPhone 15")
    assert heavy["kg"] > light["kg"] > 0
