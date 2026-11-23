"""'Chọn đâu hỏi đó': explanations use only real numbers; the LLM is faked."""
import pytest
from fastapi.testclient import TestClient

import data_client
import explain_api
import llm_provider
import main
from fixtures import BY_ID, STATS


@pytest.fixture(autouse=True)
def fake_backend(monkeypatch):
    monkeypatch.setattr(data_client, "product", lambda pid: BY_ID.get(str(pid)))
    monkeypatch.setattr(data_client, "stats", lambda cat, pid=None: dict(STATS) if cat == "laptop" else None)
    monkeypatch.setattr(data_client, "related", lambda pid, limit=6: {"items": [], "greener_alternative": BY_ID["2"]})
    for var in ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "LLM_PROVIDER"):
        monkeypatch.delenv(var, raising=False)
    explain_api._CACHE.clear()


client = TestClient(main.app)


def test_rule_based_without_any_key():
    r = client.post("/api/explain", json={"product_id": "3", "topic": "formula", "lang": "vi"})
    assert r.status_code == 200
    body = r.json()
    assert body["model"] == "rule-based"
    assert "Mức giữa" in body["answer"] or "4 cách" in body["answer"]
    assert body["facts"]["co2e_kg"] == 270.0
    assert body["follow_ups"]


@pytest.mark.parametrize("topic", explain_api.TOPICS)
def test_every_topic_answers(topic):
    body = client.post("/api/explain", json={"product_id": "1", "topic": topic, "lang": "en"}).json()
    assert body["answer"]


def test_llm_answer_with_invented_number_is_trimmed(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test")
    calls = []

    def fake_call(system, user, schema, **kw):
        calls.append(user)
        return {"title": "Sản xuất", "answer": "Máy này phát thải 332,6 kg CO₂e. Riêng nhà máy thải 999 kg.",
                "bullets": ["Trung vị của loại là 300 kg.", "Giảm 77 phần trăm nếu tái chế."],
                "follow_ups": ["Vì sao?"]}
    body = explain_api.explain(main.pages.product_co2(BY_ID["1"]), dict(STATS), None, "factory", None, "vi", None,
                               call=fake_call)
    assert body["model"].startswith("openai:")
    assert body["answer"] == "Máy này phát thải 332,6 kg CO₂e."
    assert body["bullets"] == ["Trung vị của loại là 300 kg."]
    assert body["number_check_failures"] == 2
    again = explain_api.explain(main.pages.product_co2(BY_ID["1"]), dict(STATS), None, "factory", None, "vi", None,
                                call=fake_call)
    assert again["cached"] and len(calls) == 1


def test_llm_failure_keeps_rule_based(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")

    def broken(*a, **k):
        raise TimeoutError("slow")
    body = explain_api.explain(main.pages.product_co2(BY_ID["2"]), None, None, "use", "Tốn điện không?", "vi", None, call=broken)
    assert body["model"] == "rule-based" and body["answer"]


def test_scenario_numbers_are_allowed(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test")
    scenario = {"origin": "VN", "mode": "sea", "grid": "solar", "years": 6, "refurbished": True, "total_kg": 61.4}
    out = explain_api.explain(main.pages.product_co2(BY_ID["2"]), None, None, "what_if", None, "vi", scenario,
                              call=lambda *a, **k: {"title": "Mô phỏng", "answer": "Với kịch bản này tổng còn 61,4 kg.",
                                                    "bullets": [], "follow_ups": []})
    assert out["number_check_failures"] == 0 and "61,4" in out["answer"]


def test_provider_selection(monkeypatch):
    assert llm_provider.provider() is None and llm_provider.model_label() == "rule-based"
    monkeypatch.setenv("ANTHROPIC_API_KEY", "x")
    assert llm_provider.provider() == "anthropic"
    monkeypatch.setenv("OPENAI_API_KEY", "y")
    assert llm_provider.provider() == "openai"
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    assert llm_provider.provider() == "anthropic"
    with pytest.raises(llm_provider.LLMUnavailable):
        monkeypatch.setenv("LLM_PROVIDER", "openai")
        monkeypatch.delenv("OPENAI_API_KEY")
        llm_provider.structured_call("s", "u", {})


def test_bad_input():
    assert client.post("/api/explain", json={"product_id": "abc", "topic": "x"}).status_code == 400
    assert client.post("/api/explain", json={"product_id": "999", "topic": "use"}).status_code == 404


def test_french_rule_based_and_formatting():
    body = client.post("/api/explain", json={"product_id": "1", "topic": "co2e_total", "lang": "fr"}).json()
    assert body["model"] == "rule-based"
    assert body["answer"].startswith("Sur tout son cycle de vie") and "332,6 kg" in body["answer"]
    assert body["follow_ups"][0].startswith("Pourquoi")
    for topic in explain_api.TOPICS:
        assert client.post("/api/explain", json={"product_id": "3", "topic": topic, "lang": "fr"}).json()["answer"]


def test_french_page_and_compare():
    import page_spec as ps
    assert ps.fmt_kg(1234.5, "fr") == "1\u202f234,5"
    assert ps.fmt_price(18990000, "fr") == "18\u202f990\u202f000 ₫"


def test_insight_encourages_a_low_co2_pick_with_real_numbers():
    body = client.post("/api/explain", json={"product_id": "2", "topic": "insight", "lang": "en"}).json()
    assert body["topic"] == "insight" and body["title"] == "Why this is a good pick"
    assert "92%" in body["answer"] and "300" in body["answer"]
    assert any("recycl" in b or "collection point" in b for b in body["bullets"])


def test_insight_is_honest_above_the_median(monkeypatch):
    monkeypatch.setattr(data_client, "stats", lambda cat, pid=None: {**STATS, "greener_than_pct": 20.0})
    body = client.post("/api/explain", json={"product_id": "2", "topic": "insight", "lang": "vi"}).json()
    assert body["title"] == "Cân nhắc trước khi mua"
    assert any("xanh hơn" in b for b in body["bullets"])


def test_co2_endpoint_shows_green_score_terms(monkeypatch):
    item = {**BY_ID["2"], "product": {**BY_ID["2"]["product"], "green_score_bounds": [60, 1000]}}
    monkeypatch.setattr(data_client, "product", lambda pid: item)
    g = client.get("/api/products/2/co2").json()["green_score_formula"]
    assert g["low"] == 60 and g["high"] == 1000 and g["score"] == item["product"]["green_score"]


def test_insight_says_lowest_instead_of_lower_than_everything(monkeypatch):
    monkeypatch.setattr(data_client, "stats", lambda cat, pid=None: {**STATS, "greener_than_pct": 100.0, "n": 4880})
    body = client.post("/api/explain", json={"product_id": "2", "topic": "insight", "lang": "en"}).json()
    assert body["title"] == "The lowest CO₂ in its category"
    assert "100%" not in body["answer"] and "4,880" in body["answer"]
