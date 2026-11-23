"""MCP server tests with the gateway mocked by httpx.MockTransport (no Docker, no network)."""

from __future__ import annotations

import json

import httpx
import pytest
from mcp import Client

import main
import tools

GW = "http://gw"
WEB = "http://web"


def query_item(pid, name, price, kg, source="neighbor_average", score=2.5, category="laptop"):
    return {"platform_name": "FPT Shop", "category_name": "Laptop", "image_url": None,
            "product": {"id": pid, "name": name, "final_price": price, "co2e_kg": kg, "co2e_source": source,
                        "green_score": score, "co2e_category": category, "product_url": f"https://shop/{pid}"}}


QUERY_RESPONSE = {"products": {"products": [
    query_item(1, "Dell Latitude 5450", 19_990_000, 332.6),
    query_item(2, "MacBook Air 13 M3", 26_990_000, 135.0, "manufacturer", 3.4),
    query_item(3, "Acer Aspire 5", 14_490_000, 270.0, "category_model", 2.1),
    query_item(4, "Laptop không rõ CO2", 12_000_000, None, None, None),
    query_item(5, "Màn hình Samsung 27", 5_000_000, 544.0, "category_model", 2.0, "computer_monitor"),
]}}

CO2_RESPONSE = {
    "product": {"product_id": "5", "name": "Màn hình Samsung 27", "price_vnd": 5_000_000, "platform": "TGDĐ",
                "category": "computer_monitor", "co2e_kg": 544.0, "co2e_source": "category_model",
                "co2e_confidence": 0.35, "green_score": 2.0},
    "explanation_vi": "Ước tính theo mức CO₂ điển hình của màn hình máy tính.",
    "references": [],
    "formula": {"method": "category_model", "title_vi": "Mức giữa của loại",
                "expression": "CO₂ = trung vị × (inch ÷ inch chuẩn)^b",
                "steps": [{"label_vi": "Trung vị màn hình (330 mẫu)", "expr": "491,5 kg", "value_kg": 491.5},
                          {"label_vi": "Hệ số cỡ màn hình", "expr": "(27 ÷ 23,8)^0,81 = 1,108", "value_kg": None}],
                "result_kg": 544.0, "complete": True},
    "lifecycle": {"basis": "typical_share", "total_kg": 544.0,
                  "stages": [{"key": "materials_production", "label_vi": "Nguyên liệu & sản xuất", "kg": 300.0, "pct": 55.1},
                             {"key": "use", "label_vi": "Sử dụng", "kg": 244.0, "pct": 44.9}]},
}

ORDER_RESPONSE = {"id": "ord-1", "mode": "test", "status": "awaiting_confirmation", "created_by": "mcp",
                  "items": [{"product_id": "2", "quantity": 1, "unit_price_vnd": 26_990_000, "co2e_kg": 135.0}],
                  "total_vnd": 26_990_000, "total_co2e_kg": 135.0, "saved_co2e_kg": 165.1, "confirm_url": "/orders/ord-1"}


class Recorder:
    """Mock gateway that records every request."""

    def __init__(self, routes=None, fail=False):
        self.calls: list[httpx.Request] = []
        self.routes = routes or {}
        self.fail = fail

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.calls.append(request)
        if self.fail:
            raise httpx.ConnectError("down", request=request)
        key = (request.method, request.url.path)
        if key not in self.routes:
            return httpx.Response(404, json={"error": {"code": "not_found", "message": "no"}})
        return httpx.Response(200, json=self.routes[key])


def make_api(recorder: Recorder) -> tools.Api:
    return tools.Api(GW, WEB, httpx.AsyncClient(transport=httpx.MockTransport(recorder)))


DEFAULT_ROUTES = {
    ("POST", "/query"): QUERY_RESPONSE,
    ("GET", "/api/products/5/co2"): CO2_RESPONSE,
    ("GET", "/api/compare"): {"products": [CO2_RESPONSE["product"] | {"annual_kwh": 45, "electricity_vnd_year": 121500},
                                           {"product_id": "2", "name": "MacBook Air 13 M3", "price_vnd": 26_990_000,
                                            "co2e_kg": 135.0, "co2e_source": "manufacturer", "green_score": 3.4}],
                              "rows": ["price_vnd", "co2e_kg"], "best": {"price_vnd": "5", "co2e_kg": "2"},
                              "conclusion": "MacBook Air ít CO₂ hơn."},
    ("POST", "/api/assistant"): {"id": "pg-1", "url": "/assistant/pg-1", "page": {}},
    ("POST", "/api/orders/test"): ORDER_RESPONSE,
}


async def test_search_products_ranked_filtered_and_linked():
    rec = Recorder(DEFAULT_ROUTES)
    out = await tools.search_products(make_api(rec), "laptop học tập", category="laptop", max_price_vnd=20_000_000)
    ids = [p["product_id"] for p in out.structured["products"]]
    assert ids == ["1", "3", "4"]                       # price filter + category filter, gateway order kept
    assert out.structured["greenest_product_id"] == "3"
    first = out.structured["products"][0]
    assert first["url"] == "http://web/product/1" and first["source_label"] == "trung bình sản phẩm giống"
    missing = out.structured["products"][2]
    assert missing["co2e_kg"] is None and missing["green_score"] is None and missing["source_label"] == "chưa có số CO₂"
    assert "332,6 kg CO₂e" in out.text and "http://web/product/1" in out.text and "chưa có số CO₂" in out.text
    request = rec.calls[0]
    assert request.url.params["q"] == "laptop học tập"
    assert "ai_page_url" not in out.structured            # no page unless asked
    assert [c.url.path for c in rec.calls] == ["/query"]


async def test_search_products_can_create_ai_page():
    rec = Recorder(DEFAULT_ROUTES)
    out = await tools.search_products(make_api(rec), "laptop", create_page=True)
    assert out.structured["ai_page_url"] == "http://web/assistant/pg-1"
    body = json.loads(rec.calls[1].content)
    assert body == {"message": "laptop", "lang": "vi", "parent_id": None}


async def test_search_products_unknown_category_falls_back():
    out = await tools.search_products(make_api(Recorder(DEFAULT_ROUTES)), "đồ", category="refrigerator", limit=2)
    assert out.structured["count"] == 2 and out.structured["notes"]


async def test_search_rejects_empty_query():
    with pytest.raises(ValueError):
        await tools.search_products(make_api(Recorder(DEFAULT_ROUTES)), "  ")


async def test_get_product_co2_formula_and_lifecycle():
    out = await tools.get_product_co2(make_api(Recorder(DEFAULT_ROUTES)), "5")
    assert out.structured["formula"]["result_kg"] == 544.0
    assert "(27 ÷ 23,8)^0,81 = 1,108" in out.text
    assert "giả định" in out.text                         # typical_share is flagged
    assert "mức giữa của loại" in out.text and "http://web/product/5" in out.text


async def test_get_product_co2_not_found():
    with pytest.raises(tools.GatewayError):
        await tools.get_product_co2(make_api(Recorder(DEFAULT_ROUTES)), "999")


async def test_compare_products():
    rec = Recorder(DEFAULT_ROUTES)
    out = await tools.compare_products(make_api(rec), ["5", "2", "5"])
    assert rec.calls[0].url.params["ids"] == "5,2"
    assert out.structured["compare_url"] == "http://web/compare?ids=5,2"
    assert out.structured["products"][0]["annual_kwh"] == 45
    assert "Ít CO₂ nhất: MacBook Air 13 M3" in out.text


async def test_compare_needs_two_to_four():
    api = make_api(Recorder(DEFAULT_ROUTES))
    for ids in (["1"], ["1", "2", "3", "4", "5"]):
        with pytest.raises(ValueError):
            await tools.compare_products(api, ids)


async def test_explain_method_falls_back_to_built_in():
    out = await tools.explain_co2_method(make_api(Recorder({})))
    assert out.structured["source"] == "built_in" and "0,66" in out.text and out.structured["method_url"] == "http://web/method"


async def test_create_test_order_never_confirms():
    rec = Recorder(DEFAULT_ROUTES)
    out = await tools.create_test_order(make_api(rec), "2", 1)
    assert [(c.method, c.url.path) for c in rec.calls] == [("POST", "/api/orders/test")]
    assert json.loads(rec.calls[0].content)["created_by"] == "mcp"
    assert not any("confirm" in c.url.path for c in rec.calls)
    assert out.structured["confirm_url"] == "http://web/orders/ord-1"
    assert out.structured["requires_user_confirmation"] is True and out.structured["payment"] == "none"
    assert "Không có tiền thật" in out.text


async def test_create_test_order_quantity_bounds():
    with pytest.raises(ValueError):
        await tools.create_test_order(make_api(Recorder(DEFAULT_ROUTES)), "2", 9)


def test_rate_limiter_sliding_window():
    limiter = tools.RateLimiter(per_minute=2)
    limiter.check(0.0)
    limiter.check(10.0)
    with pytest.raises(tools.RateLimitExceeded):
        limiter.check(30.0)
    limiter.check(60.5)                                   # first call left the window


def test_vn_number():
    assert tools.vn_number(1234.5) == "1.234,5"
    assert tools.vn_number(0.8) == "0,80"
    assert tools.vn_number(19_990_000) == "19.990.000"


# ---------------------------------------------------------------- through the MCP protocol

@pytest.fixture
def mocked_gateway(monkeypatch):
    rec = Recorder(DEFAULT_ROUTES)
    monkeypatch.setattr(main, "HTTP_TRANSPORT", httpx.MockTransport(rec))
    monkeypatch.setattr(main, "GATEWAY_URL", GW)
    monkeypatch.setattr(main, "PUBLIC_WEB_URL", WEB)
    monkeypatch.setattr(main, "limiter", tools.RateLimiter(per_minute=100))
    return rec


async def test_tools_list_annotations_and_widget():
    async with Client(main.build_server()) as client:
        listed = {t.name: t for t in (await client.list_tools()).tools}
        assert set(listed) == {"search_products", "get_product_co2", "compare_products", "explain_co2_method", "create_test_order"}
        assert listed["create_test_order"].annotations.read_only_hint is False
        assert all(listed[n].annotations.read_only_hint for n in listed if n != "create_test_order")
        meta = listed["search_products"].meta
        assert meta["openai/outputTemplate"] == "ui://widget/products.html"
        assert meta["ui"]["resourceUri"] == "ui://widget/products-app.html"
        mimes = {str(r.uri): r.mime_type for r in (await client.list_resources()).resources}
        assert mimes["ui://widget/products.html"] == "text/html+skybridge"
        assert mimes["ui://widget/products-app.html"] == "text/html;profile=mcp-app"


async def test_call_tool_over_protocol(mocked_gateway):
    async with Client(main.build_server()) as client:
        result = await client.call_tool("search_products", {"query": "laptop", "limit": 2})
        assert not result.is_error
        assert result.structured_content["count"] == 2
        assert "kg CO₂e" in result.content[0].text


async def test_rate_limit_over_protocol(mocked_gateway, monkeypatch):
    monkeypatch.setattr(main, "limiter", tools.RateLimiter(per_minute=1))
    async with Client(main.build_server()) as client:
        assert not (await client.call_tool("explain_co2_method", {})).is_error
        second = await client.call_tool("explain_co2_method", {})
        assert second.is_error and "mỗi phút" in second.content[0].text


async def test_gateway_down_is_tool_error(monkeypatch):
    monkeypatch.setattr(main, "HTTP_TRANSPORT", httpx.MockTransport(Recorder(fail=True)))
    monkeypatch.setattr(main, "limiter", tools.RateLimiter(per_minute=100))
    async with Client(main.build_server()) as client:
        result = await client.call_tool("get_product_co2", {"product_id": "5"})
        assert result.is_error and "Không gọi được" in result.content[0].text
