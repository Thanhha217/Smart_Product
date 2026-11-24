"""CarbonSense AI MCP server (B2): lets ChatGPT (or any MCP client) search
products, read their CO2 figures, compare them and create TEST orders.

Streamable HTTP, stateless, JSON responses, at  http://<host>:8100/mcp .
Run:  uvicorn main:app --host 0.0.0.0 --port 8100     (or: python main.py)

Environment:
  GATEWAY_URL             gateway base URL (default http://smartproductfinder-backend-gateway:8000)
  PUBLIC_WEB_URL          web base URL used in the links returned to the user (default http://localhost:5173)
  MCP_RATE_LIMIT_PER_MIN  max tool calls per minute for the whole server (default 30, 0 = off)
  MCP_TIMEOUT_S           timeout of each gateway call, capped at 15 s (default 15)
"""

from __future__ import annotations

import json
import logging
import os
import time
from collections.abc import Awaitable, Callable
from typing import Annotated, Any

import httpx
from mcp.server.apps import Apps
from mcp.server.mcpserver import MCPServer
from mcp.types import CallToolResult, TextContent, ToolAnnotations
from pydantic import Field
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

import tools
from widget import MCP_APP_URI, PRODUCTS_HTML, SKYBRIDGE_MIME, SKYBRIDGE_URI

GATEWAY_URL = os.environ.get("GATEWAY_URL", "http://smartproductfinder-backend-gateway:8000")
PUBLIC_WEB_URL = os.environ.get("PUBLIC_WEB_URL", "http://localhost:5173")
RATE_LIMIT_PER_MIN = int(os.environ.get("MCP_RATE_LIMIT_PER_MIN", "30"))
TIMEOUT_S = min(15.0, float(os.environ.get("MCP_TIMEOUT_S", "15")))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("mcp-server")

# Tests replace this with an httpx.MockTransport.
HTTP_TRANSPORT: httpx.AsyncBaseTransport | None = None
limiter = tools.RateLimiter(per_minute=RATE_LIMIT_PER_MIN)

INSTRUCTIONS = (
    "CarbonSense AI: so sánh sản phẩm điện tử / điện gia dụng trên các sàn Việt Nam theo nhu cầu và lượng CO₂ vòng đời. "
    "Luôn trích đúng số kg CO₂e và nhãn nguồn (số của hãng, trung bình sản phẩm giống, công thức, mức giữa của loại, theo giá) "
    "mà công cụ trả về, kèm đường link về trang web. Không tự tính hay đoán số CO₂. "
    "create_test_order chỉ tạo ĐƠN THỬ chờ người dùng xác nhận trên web; không có thanh toán thật."
)

READ_ONLY = ToolAnnotations(read_only_hint=True, destructive_hint=False, idempotent_hint=True, open_world_hint=False)
WRITE_TEST = ToolAnnotations(read_only_hint=False, destructive_hint=False, idempotent_hint=False, open_world_hint=False)


def _sanitize(args: dict[str, Any]) -> dict[str, Any]:
    """Log-safe copy: long strings cut, nothing but the tool's own arguments."""
    out = {}
    for key, value in args.items():
        if isinstance(value, str) and len(value) > 120:
            value = value[:120] + "…"
        out[key] = value
    return out


async def _run(name: str, args: dict[str, Any], fn: Callable[[tools.Api], Awaitable[tools.ToolOutput]]) -> CallToolResult:
    started = time.perf_counter()
    error = None
    try:
        limiter.check()
        async with httpx.AsyncClient(transport=HTTP_TRANSPORT, timeout=TIMEOUT_S) as client:
            output = await fn(tools.Api(GATEWAY_URL, PUBLIC_WEB_URL, client))
        return CallToolResult(content=[TextContent(type="text", text=output.text)], structured_content=output.structured)
    except (tools.GatewayError, tools.RateLimitExceeded, ValueError) as exc:
        error = str(exc)
        return CallToolResult(content=[TextContent(type="text", text=error)], is_error=True)
    except Exception as exc:  # never leak internals to the model
        error = f"{exc.__class__.__name__}"
        log.exception("tool %s crashed", name)
        return CallToolResult(content=[TextContent(type="text", text="Lỗi nội bộ của máy chủ MCP.")], is_error=True)
    finally:
        log.info(json.dumps({"tool": name, "args": _sanitize(args), "latency_ms": round((time.perf_counter() - started) * 1000),
                             "error": error}, ensure_ascii=False))


def _openai_meta(invoking: str, invoked: str) -> dict[str, Any]:
    return {
        "openai/outputTemplate": SKYBRIDGE_URI,
        "openai/toolInvocation/invoking": invoking,
        "openai/toolInvocation/invoked": invoked,
    }


def build_server() -> MCPServer:
    apps = Apps()
    apps.add_html_resource(MCP_APP_URI, PRODUCTS_HTML, name="products-widget", title="Sản phẩm và CO₂",
                           description="Thẻ sản phẩm: giá, kg CO₂e, điểm xanh 0–5, nguồn số", prefers_border=True)

    @apps.tool(
        resource_uri=MCP_APP_URI,
        meta=_openai_meta("Đang tìm sản phẩm…", "Đã tìm xong"),
        name="search_products",
        title="Tìm sản phẩm ít CO₂",
        description=("Tìm sản phẩm trên các sàn Việt Nam, đã xếp hạng theo nhu cầu và CO₂ (weighted RRF). "
                     "Trả về tên, giá, kg CO₂e, điểm xanh 0–5, nguồn số, độ tin cậy và link. "
                     "Đặt create_page=true để hệ thống tạo thêm một trang phân tích AI có link chia sẻ."),
        annotations=READ_ONLY,
    )
    async def search_products(
        query: Annotated[str, Field(description="Câu tìm kiếm, ví dụ 'laptop học tập' hoặc 'máy lạnh 1 HP inverter'")],
        category: Annotated[str | None, Field(description="Loại hàng (tùy chọn), ví dụ laptop, smartphone, air_conditioner")] = None,
        max_price_vnd: Annotated[float | None, Field(description="Giá tối đa (VND), ví dụ 20000000", ge=0)] = None,
        limit: Annotated[int, Field(description="Số kết quả, 1–10", ge=1, le=10)] = 5,
        create_page: Annotated[bool, Field(description="Tạo trang phân tích AI và trả link")] = False,
    ) -> CallToolResult:
        args = {"query": query, "category": category, "max_price_vnd": max_price_vnd, "limit": limit, "create_page": create_page}
        return await _run("search_products", args, lambda api: tools.search_products(api, query, category, max_price_vnd, limit, create_page))

    @apps.tool(
        resource_uri=MCP_APP_URI,
        meta=_openai_meta("Đang so sánh…", "Đã so sánh"),
        name="compare_products",
        title="So sánh sản phẩm",
        description="So sánh 2–4 sản phẩm: giá, CO₂, điểm xanh, nguồn số, độ tin cậy, điện năng; trả link trang /compare.",
        annotations=READ_ONLY,
    )
    async def compare_products(
        product_ids: Annotated[list[str], Field(description="2–4 mã sản phẩm (product_id) lấy từ search_products", min_length=2, max_length=4)],
    ) -> CallToolResult:
        return await _run("compare_products", {"product_ids": product_ids}, lambda api: tools.compare_products(api, product_ids))

    server = MCPServer(
        "smart-product-finder",
        title="CarbonSense AI – CO₂",
        instructions=INSTRUCTIONS,
        version="1.0.0",
        extensions=[apps],
    )

    @server.resource(SKYBRIDGE_URI, name="products-widget-chatgpt", title="Sản phẩm và CO₂ (ChatGPT)", mime_type=SKYBRIDGE_MIME)
    def products_widget() -> str:
        return PRODUCTS_HTML

    @server.tool(
        name="get_product_co2",
        title="CO₂ của một sản phẩm",
        description="Số CO₂ của một sản phẩm: nguồn, độ tin cậy, công thức đã thế số, các giai đoạn vòng đời, các mẫu đã dùng, link.",
        annotations=READ_ONLY,
    )
    async def get_product_co2(product_id: Annotated[str, Field(description="Mã sản phẩm (product_id)")]) -> CallToolResult:
        return await _run("get_product_co2", {"product_id": product_id}, lambda api: tools.get_product_co2(api, product_id))

    @server.tool(
        name="explain_co2_method",
        title="Phương pháp tính CO₂",
        description="Tóm tắt phương pháp tính CO₂ (chuỗi ưu tiên, công thức, độ chính xác) và link trang /method.",
        annotations=READ_ONLY,
    )
    async def explain_co2_method() -> CallToolResult:
        return await _run("explain_co2_method", {}, tools.explain_co2_method)

    @server.tool(
        name="create_test_order",
        title="Tạo đơn hàng THỬ",
        description=("Tạo một ĐƠN THỬ (chế độ test, không trừ tiền, không nhập thẻ) ở trạng thái chờ xác nhận. "
                     "Người dùng phải tự bấm xác nhận trên web qua link trả về; công cụ này không thể xác nhận hay thanh toán."),
        annotations=WRITE_TEST,
    )
    async def create_test_order(
        product_id: Annotated[str, Field(description="Mã sản phẩm (product_id)")],
        quantity: Annotated[int, Field(description="Số lượng, 1–5", ge=1, le=5)] = 1,
    ) -> CallToolResult:
        return await _run("create_test_order", {"product_id": product_id, "quantity": quantity},
                          lambda api: tools.create_test_order(api, product_id, quantity))

    @server.custom_route("/healthz", methods=["GET"])
    async def healthz(request: Request) -> JSONResponse:
        return JSONResponse({"status": "ok", "gateway_url": GATEWAY_URL})

    return server


mcp_server = build_server()
app = mcp_server.streamable_http_app(streamable_http_path="/mcp", stateless_http=True, json_response=True, host="0.0.0.0")
# MCP Inspector in a browser needs CORS; ChatGPT calls server to server.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
                   allow_headers=["*"], expose_headers=["Mcp-Session-Id", "Mcp-Protocol-Version"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8100")))
