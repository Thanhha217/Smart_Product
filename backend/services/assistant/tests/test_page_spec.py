import page_spec as ps


def test_fill_text_substitutes_placeholders():
    values = {"p1.name": "MacBook Air", "p1.co2e_kg": "135", "stats.median_kg": "300"}
    text, failures = ps.fill_text("Chọn {{p1.name}}: {{p1.co2e_kg}} kg so với trung vị {{stats.median_kg}} kg.", values)
    assert text == "Chọn MacBook Air: 135 kg so với trung vị 300 kg."
    assert failures == 0


def test_sentence_with_hand_written_number_is_dropped():
    values = {"p1.co2e_kg": "135"}
    text, failures = ps.fill_text("Máy này chỉ {{p1.co2e_kg}} kg. Nó tiết kiệm 50 kg mỗi năm!", values)
    assert text == "Máy này chỉ 135 kg."
    assert failures == 1


def test_unknown_placeholder_is_dropped():
    text, failures = ps.fill_text("Giảm {{savings.kg_99m}} kg.", {})
    assert text == "" and failures == 1


def test_digits_inside_product_names_and_question_are_allowed():
    text, failures = ps.fill_text("iPhone 15 là lựa chọn tốt.", {}, allowed_literals=["Điện thoại iPhone 15 128GB", "iPhone 15"])
    assert failures == 0 and text.startswith("iPhone 15")


def test_validate_layout_keeps_known_types_and_order():
    order, charts = ps.validate_layout(["chart", "html", "recommendations", "chart", "savings"], ["co2_bar", "pie"])
    assert order[0] == "recommendations" and order[-1] == "sources"
    assert "html" not in order and order.count("chart") == 1
    assert charts == ["co2_bar"]
    assert ps.validate_layout(None, [])[1] == ps.DEFAULT_CHARTS


def test_valid_refs_only_candidates():
    alias = ps.aliases(["10", "20"])
    assert ps.valid_refs(["p2", "p9", "10", "999"], alias) == ["20", "10"]


def test_shortlist_greenest_first_missing_in_middle():
    cards = [{"product_id": str(i), "category": "laptop", "co2e_kg": kg} for i, kg in enumerate([300, None, 100, 500])]
    order = [c["product_id"] for c in ps.shortlist(cards)]
    assert order[0] == "2"           # 100 kg
    assert order.index("1") in (1, 2)  # missing -> middle rank
    assert order[-1] == "3"          # 500 kg


def test_savings_vs_category_median():
    best = {"product_id": "2", "co2e_kg": 135.0, "category": "laptop"}
    s = ps.compute_savings(best, {"median_kg": 300.0}, (6, 12))
    assert s["lifecycle_kg_saved"] == 165.0 and s["scope"] == "cradle_to_grave"
    assert s["horizons"] == [] and s["horizon_basis"] is None     # no use-phase basis: no monthly figure
    assert s["trees_year"] == round(165 / 21.8, 1)
    a = ps.compute_savings(best, {"median_kg": 300.0}, (6, 12),
                           [{"months": 12, "kwh_saved": 400.0, "money_saved_vnd": 1080000, "co2_use_saved_kg": 272.4}])
    assert a["horizons"] == [{"months": 12, "kg": 272.4, "kwh": 400.0, "vnd": 1080000}]
    assert a["horizon_basis"] == "standard_unit_same_capacity"
    assert ps.compute_savings({**best, "co2e_kg": 400}, {"median_kg": 300.0}) is None


def test_charts_only_real_rows_and_known_types():
    cards = [{"product_id": "1", "name": "A", "co2e_kg": 100, "price_vnd": 1e7, "green_score": 3},
             {"product_id": "2", "name": "B", "co2e_kg": None, "price_vnd": 2e7, "green_score": None},
             {"product_id": "3", "name": "C", "co2e_kg": 200, "price_vnd": 1.5e7, "green_score": 2}]
    bar = ps.build_chart("co2_bar", cards, {})
    assert [r["name"] for r in bar["spec"]["data"]["values"]] == ["A", "C"]
    assert ps.build_chart("pie", cards, {}) is None
    assert "url" not in str(bar["spec"]["data"])


def test_formatting():
    assert ps.fmt_kg(1234.56) == "1.234,6"
    assert ps.fmt_kg(0.8) == "0,8" and ps.fmt_kg(0.123) == "0,12"
    assert ps.fmt_price(18990000) == "18.990.000 đ"
    assert ps.fmt_kg(1234.5, "en") == "1,234.5"


def test_reference_urls_from_source_text():
    from pages import with_urls
    refs = with_urls([
        {"name": "A", "source": "Dell PCF datasheet (2018), https://i.dell.com/x.pdf"},
        {"name": "B", "source": "Apple MacBook Air Product Environmental Report (June 2022), apple.com/environment"},
        {"name": "C", "source": None},
    ])
    assert refs[0]["url"] == "https://i.dell.com/x.pdf"
    assert refs[1]["url"] == "https://apple.com/environment"
    assert "url" not in refs[2]
