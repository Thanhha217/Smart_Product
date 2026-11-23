"""API tests with db-search and the model replaced by fakes (no network, no key)."""
import pytest
from fastapi.testclient import TestClient

import data_client
import main
import pages
from assistant_llm import heuristic_plan
from fixtures import BY_ID, LAPTOPS, STATS


@pytest.fixture(autouse=True)
def fake_backend(monkeypatch):
    monkeypatch.setattr(data_client, "search", lambda q, limit=32: list(LAPTOPS))
    monkeypatch.setattr(data_client, "product", lambda pid: BY_ID.get(str(pid)))
    monkeypatch.setattr(data_client, "stats", lambda cat, pid=None: dict(STATS) if cat == "laptop" else None)
    monkeypatch.setattr(data_client, "related", lambda pid, limit=6: {
        "product_id": pid, "category": "laptop", "items": [BY_ID["3"], BY_ID["1"]], "greener_alternative": BY_ID["3"]})
    import assistant_llm
    monkeypatch.setattr(assistant_llm, "plan_request", lambda msg: (heuristic_plan(msg), "rule-based"))

    def no_model(*a, **k):
        raise RuntimeError("no model in tests")
    monkeypatch.setattr(assistant_llm, "compose_page", no_model)
    yield


client = TestClient(main.app)


def test_rule_based_page_when_model_unavailable():
    r = client.post("/api/assistant", json={"message": "laptop dưới 20 triệu ít CO2", "lang": "vi"})
    assert r.status_code == 200
    body = r.json()
    page = body["page"]
    assert body["url"] == f"/assistant/{body['id']}"
    assert "llm_unavailable" in page["warnings"]
    assert page["meta"]["model"] == "rule-based"
    # budget 20 M removes the 35 M gaming laptop; greenest first -> MacBook (135 kg)
    assert "5" not in page["products"] or page["sections"][0]["product_ids"][0] != "5"
    rec = next(s for s in page["sections"] if s["type"] == "recommendations")
    assert rec["product_ids"][0] == "2"
    assert "135" in page["summary"]
    types = [s["type"] for s in page["sections"]]
    assert types[0] == "recommendations" and types[-1] == "sources"
    assert {"formula", "lifecycle", "chart", "category_stats", "savings"} <= set(types)
    # same number as the product row (YC-5)
    assert page["products"]["2"]["co2e_kg"] == LAPTOPS[1]["product"]["co2e_kg"]
    again = client.get(f"/api/assistant/{body['id']}")
    assert again.status_code == 200 and again.json()["page"]["summary"] == page["summary"]


def test_model_layout_numbers_are_checked(monkeypatch):
    import assistant_llm

    def fake_compose(message, lang, candidates, stats, savings, placeholders):
        assert "p1.co2e_kg" in placeholders
        return {"summary": "Nên chọn {{p1.name}} vì chỉ {{p1.co2e_kg}} kg. Nó rẻ hơn 2 triệu.",
                "focus_ref": "p1", "recommended_refs": ["p1", "p3", "p99"],
                "section_order": ["recommendations", "chart", "why_low_co2", "sources"], "charts": ["lifecycle_stack"],
                "why_bullets": ["Ít hơn {{stats.median_kg}} kg trung vị.", "Tiết kiệm 99 kg."],
                "reasons": [{"ref": "p1", "reason": "Số của hãng."}]}
    monkeypatch.setattr(assistant_llm, "compose_page", fake_compose)
    page = client.post("/api/assistant", json={"message": "laptop ít CO2"}).json()["page"]
    assert page["summary"].startswith("Nên chọn MacBook Air") and "2 triệu" not in page["summary"]
    assert page["meta"]["number_check_failures"] == 2
    assert "number_check_failed" in page["warnings"]
    rec = page["sections"][0]
    assert all(pid in page["products"] for pid in rec["product_ids"])
    chart = next(s for s in page["sections"] if s["type"] == "chart")
    assert chart["chart"] == "lifecycle_stack"


def test_follow_up_uses_parent():
    first = client.post("/api/assistant", json={"message": "laptop ít CO2"}).json()
    r = client.post("/api/assistant", json={"message": "còn loại rẻ hơn không?", "parent_id": first["id"]})
    assert r.status_code == 200 and r.json()["page"]["parent_id"] == first["id"]


def test_page_not_found_and_bad_input():
    assert client.get("/api/assistant/nope").status_code == 404
    assert client.get("/api/assistant/nope").json()["error"]["code"] == "page_not_found"
    assert client.post("/api/assistant", json={"message": ""}).status_code == 422


def test_product_co2_formula_and_lifecycle():
    r = client.get("/api/products/3/co2")
    assert r.status_code == 200
    body = r.json()
    assert body["formula"]["method"] == "category_model"
    assert body["formula"]["steps"][-1]["value_kg"] == pytest.approx(255 * (15.6 / 14) ** 0.53, abs=0.1)
    assert body["lifecycle"]["basis"] == "typical_share"
    assert client.get("/api/products/999/co2").status_code == 404
    assert client.get("/api/products/abc/co2").status_code == 400


def test_compare_best_cells():
    body = client.get("/api/compare", params={"ids": "1,2,3"}).json()
    assert body["best"]["co2e_kg"] == "2" and body["best"]["price_vnd"] == "3"
    assert "MacBook" in body["conclusion"]
    assert client.get("/api/compare", params={"ids": "1,2,3,4,5"}).status_code == 400


def test_test_order_flow_requires_web_confirmation():
    r = client.post("/api/orders/test", json={"items": [{"product_id": "2", "quantity": 1}], "created_by": "mcp"})
    assert r.status_code == 200
    order = r.json()
    assert order["mode"] == "test" and order["status"] == "awaiting_confirmation"
    assert order["saved_co2e_kg"] == 165.0
    oid = order["id"]
    denied = client.post(f"/api/orders/test/{oid}/confirm")
    assert denied.status_code == 403
    ok = client.post(f"/api/orders/test/{oid}/confirm", headers={"X-Confirm-Source": "web-ui"})
    assert ok.status_code == 200 and ok.json()["status"] == "confirmed_test"
    assert [e["action"] for e in ok.json()["events"]] == ["created", "awaiting_confirmation", "confirmed_test"]
    assert client.post(f"/api/orders/test/{oid}/cancel").status_code == 409


def test_order_validation():
    assert client.post("/api/orders/test", json={"items": [], "created_by": "user"}).status_code == 400
    assert client.post("/api/orders/test", json={"items": [{"product_id": "999"}]}).status_code == 404
    assert client.post("/api/orders/test", json={"items": [{"product_id": "2", "quantity": 50}]}).status_code == 400
    assert client.post("/api/orders/test", json={"items": [{"product_id": "2"}], "created_by": "hacker"}).status_code == 400


def test_checkout_mode_must_be_test(monkeypatch):
    import orders
    monkeypatch.setattr(orders, "CHECKOUT_MODE", "live")
    with pytest.raises(RuntimeError):
        orders.require_test_mode()


def test_method_summary():
    body = client.get("/api/method").json()
    assert body["chain"][0]["method"] == "manufacturer" and body["url"] == "/method"


def test_order_co2_total_only_adds_whole_life_figures(monkeypatch):
    import orders
    from store import MemoryStore
    cards = {"1": {"name": "A", "price_vnd": 100, "co2e_kg": 50.0, "category": "laptop", "co2e_source": "manufacturer"},
             "2": {"name": "B", "price_vnd": 100, "co2e_kg": 2.0, "category": "laptop", "co2e_source": "eeio_price"},
             "3": {"name": "C", "price_vnd": 100, "co2e_kg": None, "category": "laptop", "co2e_source": None}}
    o = orders.create_order(MemoryStore(), [{"product_id": k, "quantity": 1} for k in cards], "user",
                            lambda pid: cards.get(pid), lambda cat: 80.0)
    assert o["total_co2e_kg"] == 50.0 and o["co2_other_scope_items"] == 1 and o["co2_missing_items"] == 1
    assert o["saved_co2e_kg"] == 30.0


def test_order_rejects_products_without_price():
    import orders
    from store import MemoryStore
    import pytest as _pytest
    with _pytest.raises(orders.OrderError) as err:
        orders.create_order(MemoryStore(), [{"product_id": "9", "quantity": 1}], "mcp",
                            lambda pid: {"name": "X", "price_vnd": None, "co2e_kg": 1.0}, lambda cat: None)
    assert err.value.code == "missing_price" and err.value.status == 409
