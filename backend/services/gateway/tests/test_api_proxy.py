"""The gateway forwards /api/* unchanged (status, JSON, confirm header) - upstream is faked."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("RANKING_SYSTEM_URL", "http://ranking.test")
os.environ.setdefault("DB_SEARCH_URL", "http://db.test")
os.environ.setdefault("ASSISTANT_URL", "http://assistant.test")

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402

calls = []


class FakeResponse:
    def __init__(self, status, body):
        self.status_code, self._body, self.text = status, body, ""
        self.ok = status < 400

    def json(self):
        return self._body


def fake_request(method, url, params=None, json=None, headers=None, timeout=None):
    calls.append({"method": method, "url": url, "params": params, "json": json, "headers": headers})
    if url.endswith("/confirm") and (headers or {}).get("X-Confirm-Source") != "web-ui":
        return FakeResponse(403, {"error": {"code": "confirmation_requires_web"}})
    return FakeResponse(200, {"ok": True, "url": url})


main.requests.request = fake_request
client = TestClient(main.app)


def test_routes_go_to_the_right_service():
    assert client.get("/api/products/5/related?limit=3").json()["url"] == "http://db.test/products/5/related"
    assert calls[-1]["params"] == {"limit": "3"}
    assert client.get("/api/categories/laptop/stats").json()["url"] == "http://db.test/categories/laptop/stats"
    assert client.get("/api/products/5/co2").json()["url"] == "http://assistant.test/api/products/5/co2"
    r = client.post("/api/assistant", json={"message": "laptop", "lang": "vi"})
    assert r.json()["url"] == "http://assistant.test/api/assistant" and calls[-1]["json"]["message"] == "laptop"


def test_confirm_header_is_forwarded_and_status_passed_through():
    assert client.post("/api/orders/test/abc/confirm").status_code == 403
    ok = client.post("/api/orders/test/abc/confirm", headers={"X-Confirm-Source": "web-ui"})
    assert ok.status_code == 200


def test_health_statuses(monkeypatch):
    import time as _t

    def fake_get(url, timeout=None):
        if "mcp" in url:
            raise main.requests.exceptions.ConnectionError("refused")
        if "ranking" in url:
            _t.sleep(0.05)
        return FakeResponse(200 if "ranking" not in url else 503, {"model": "rule-based"})
    monkeypatch.setattr(main.requests, "get", fake_get)
    services = {s["key"]: s for s in client.get("/api/health").json()["services"]}
    assert services["mcp"]["status"] == "offline"
    assert services["ranking"]["status"] == "degraded"
    assert services["db-search"]["status"] == "online"
    assert services["assistant"]["detail"] == "rule-based"
