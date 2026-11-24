"""Tool logic of the CarbonSense AI MCP server.

Every tool only calls the gateway (docs/demo/api-contract.md); nothing here
computes CO2, so the numbers ChatGPT shows are the numbers stored in the
database and shown on the web.  Each function returns a ``ToolOutput``
(structured data + a short Vietnamese text that names the CO2 source and links
back to the web).  ``create_test_order`` stops at ``awaiting_confirmation``:
this module has no code path that calls the confirm endpoint.
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import quote

import httpx

SOURCE_LABELS_VI = {
    "manufacturer": "số của hãng",
    "neighbor_average": "trung bình sản phẩm giống",
    "lifecycle_formula": "công thức vòng đời (điện năng)",
    "category_model": "mức giữa của loại",
    "eeio_price": "ước tính thô theo giá bán (US EPA)",
    "llm_estimate": "AI ước lượng (thử nghiệm)",
}
NO_CO2_VI = "chưa có số CO₂"

METHOD_SUMMARY = {
    "principle": "Luôn ưu tiên số thật của hãng; AI chỉ tìm sản phẩm giống, không tự sinh số; không đủ căn cứ thì để trống.",
    "steps": [
        {"step": 1, "name": "manufacturer", "rule": "Tên sản phẩm chứa nguyên tên một mẫu (≥ 3 từ) → dùng số hãng công bố", "confidence": 0.9},
        {"step": 2, "name": "neighbor_average", "rule": "OpenCLIP so tên với 1.450 mẫu; lấy 5 mẫu giống nhất, bỏ mẫu ngoài [trung vị ÷ 8; × 8], giữ cosine ≥ 0,66 → trung bình", "confidence": 0.5},
        {"step": "3a", "name": "lifecycle_formula", "rule": "Đồ gia dụng: sản xuất + số năm × (kWh/năm × 0,681 + rò rỉ môi chất lạnh) + thải bỏ", "confidence": "0,25–0,35"},
        {"step": "3b", "name": "category_model", "rule": "Trung vị của loại (hoặc của hãng nếu ≥ 3 mẫu) × (inch ÷ inch chuẩn)^b; màn hình b = 0,81, laptop b = 0,53", "confidence": 0.35},
        {"step": "3c", "name": "eeio_price", "rule": "Giá ÷ 25.900 × (292,655 ÷ 336,940) × hệ số ngành US EPA (chỉ sản xuất + vận chuyển)", "confidence": 0.15},
        {"step": 4, "name": "none", "rule": "Không cách nào áp dụng được → để trống"},
    ],
    "green_score": "5 × ln(U ÷ CO₂) ÷ ln(U ÷ L), kẹp trong 0–5, so trong cùng loại (Kalisvaart 2025)",
    "ranking": "1 ÷ (60 + hạng nhu cầu) + 0,2 × 1 ÷ (60 + hạng CO₂); sản phẩm chưa có số nhận hạng CO₂ ở giữa (Vestrum 2026)",
    "grid_factor": "Lưới điện Việt Nam 0,681 kg CO₂e/kWh (2024)",
    "results": "Loại đã có mẫu: sai ~20 %, Spearman 0,95; mức giữa của loại sai ~21 % (chạy lại trong repo); 7.406/10.000 sản phẩm có số (74 %)",
}


class GatewayError(RuntimeError):
    """The gateway could not answer; the message is safe to show to the model."""


class RateLimitExceeded(RuntimeError):
    pass


@dataclass
class RateLimiter:
    """Sliding one-minute window shared by all callers (single-process demo server)."""

    per_minute: int
    window_s: float = 60.0
    _calls: deque = field(default_factory=deque)

    def check(self, now: float | None = None) -> None:
        now = time.monotonic() if now is None else now
        while self._calls and now - self._calls[0] >= self.window_s:
            self._calls.popleft()
        if self.per_minute > 0 and len(self._calls) >= self.per_minute:
            raise RateLimitExceeded(f"Quá {self.per_minute} lần gọi mỗi phút, thử lại sau ít giây.")
        self._calls.append(now)


@dataclass
class ToolOutput:
    structured: dict[str, Any]
    text: str


@dataclass
class Api:
    """Thin gateway client. ``client`` is injectable so tests can use httpx.MockTransport."""

    gateway_url: str
    public_web_url: str
    client: httpx.AsyncClient

    def web(self, path: str) -> str:
        return self.public_web_url.rstrip("/") + path

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        url = self.gateway_url.rstrip("/") + path
        try:
            response = await self.client.request(method, url, **kwargs)
        except httpx.HTTPError as error:
            raise GatewayError(f"Không gọi được hệ thống CarbonSense AI ({error.__class__.__name__}).") from error
        if response.status_code == 404:
            raise GatewayError("Không tìm thấy dữ liệu (404).")
        if response.status_code >= 400:
            raise GatewayError(f"Hệ thống CarbonSense AI trả lỗi HTTP {response.status_code}.")
        try:
            return response.json()
        except ValueError as error:
            raise GatewayError("Hệ thống trả về dữ liệu không đọc được.") from error

    async def get(self, path: str, **kwargs: Any) -> Any:
        return await self._request("GET", path, **kwargs)

    async def post(self, path: str, **kwargs: Any) -> Any:
        return await self._request("POST", path, **kwargs)


# ------------------------------------------------------------------ formatting

def vn_number(x: float | int | None, decimals: int | None = None) -> str:
    """Vietnamese style: 1234.5 -> '1.234,5'. Default: 1 decimal if >= 1, 2 if < 1, none for integers."""
    if x is None:
        return "–"
    if decimals is None:
        decimals = 0 if float(x).is_integer() and abs(x) >= 1 else (1 if abs(x) >= 1 else 2)
    text = f"{x:,.{decimals}f}"
    return text.replace(",", "\0").replace(".", ",").replace("\0", ".")


def source_label(source: str | None, co2e_kg: float | None) -> str:
    if co2e_kg is None:
        return NO_CO2_VI
    return SOURCE_LABELS_VI.get(source or "", source or "không rõ nguồn")


def co2_phrase(card: dict) -> str:
    if card.get("co2e_kg") is None:
        return NO_CO2_VI
    score = card.get("green_score")
    score_txt = f", điểm xanh {vn_number(score, 1)}/5" if score is not None else ""
    return f"{vn_number(card['co2e_kg'])} kg CO₂e ({card['source_label']}{score_txt})"


def _num(value: Any) -> float | None:
    try:
        return None if value is None else float(value)
    except (TypeError, ValueError):
        return None


def card_from_api(api: Api, raw: dict) -> dict:
    """Normalise a ProductCard (api-contract) or a /query item into the card the tools return."""
    if "product" in raw and isinstance(raw["product"], dict):       # /query item
        p = raw["product"]
        pid = str(p.get("id"))
        card = {
            "product_id": pid,
            "name": p.get("name"),
            "price_vnd": _num(p.get("final_price")),
            "platform": raw.get("platform_name"),
            "category": p.get("co2e_category") or raw.get("category_name"),
            "co2e_kg": _num(p.get("co2e_kg")),
            "co2e_source": p.get("co2e_source"),
            "co2e_confidence": _num(p.get("co2e_confidence")),
            "green_score": _num(p.get("green_score")),
            "shop_url": p.get("product_url"),
        }
    else:                                                            # ProductCard
        pid = str(raw.get("product_id"))
        card = {
            "product_id": pid,
            "name": raw.get("name"),
            "price_vnd": _num(raw.get("price_vnd")),
            "platform": raw.get("platform"),
            "category": raw.get("category"),
            "co2e_kg": _num(raw.get("co2e_kg")),
            "co2e_source": raw.get("co2e_source"),
            "co2e_confidence": _num(raw.get("co2e_confidence")),
            "green_score": _num(raw.get("green_score")),
            "shop_url": raw.get("product_url"),
        }
    if card["co2e_kg"] is None:
        card["green_score"] = None
    card["source_label"] = source_label(card["co2e_source"], card["co2e_kg"])
    card["url"] = api.web(f"/product/{quote(pid)}")
    return card


def _query_items(payload: Any) -> list[dict]:
    """Gateway /query answers {"products": {"products": [...]}}; accept the flat shape too."""
    items = payload.get("products", []) if isinstance(payload, dict) else []
    if isinstance(items, dict):
        items = items.get("products", [])
    return [i for i in items if isinstance(i, dict)]


def _category_matches(card: dict, category: str) -> bool:
    wanted = category.strip().lower().replace(" ", "_")
    have = (card.get("category") or "").lower()
    return bool(have) and (wanted in have or have in wanted or wanted.rstrip("s") == have.rstrip("s"))


# ------------------------------------------------------------------ tools

async def search_products(api: Api, query: str, category: str | None = None, max_price_vnd: float | None = None,
                          limit: int = 5, create_page: bool = False, lang: str = "vi") -> ToolOutput:
    query = (query or "").strip()
    if not query:
        raise ValueError("query không được để trống")
    limit = max(1, min(int(limit or 5), 10))
    payload = await api.post("/query", params={"q": query, "limit": 32}, json={})
    cards = [card_from_api(api, item) for item in _query_items(payload)]

    notes = []
    if max_price_vnd:
        cards = [c for c in cards if c["price_vnd"] is not None and c["price_vnd"] <= max_price_vnd]
    if category:
        matched = [c for c in cards if _category_matches(c, category)]
        if matched:
            cards = matched
        else:
            notes.append(f"Không lọc được theo loại '{category}', hiển thị theo câu tìm kiếm.")
    cards = cards[:limit]
    for rank, card in enumerate(cards, 1):
        card["rank"] = rank

    with_co2 = [c for c in cards if c["co2e_kg"] is not None]
    greenest = min(with_co2, key=lambda c: c["co2e_kg"]) if with_co2 else None
    structured: dict[str, Any] = {
        "query": query,
        "filters": {"category": category, "max_price_vnd": max_price_vnd},
        "count": len(cards),
        "products": cards,
        "greenest_product_id": greenest["product_id"] if greenest else None,
        "ranking": "Thứ tự của hệ thống: nhu cầu là chính, CO₂ phá thế hòa (weighted RRF).",
        "search_url": api.web(f"/search?q={quote(query)}"),
        "method_url": api.web("/method"),
        "notes": notes,
    }
    if create_page and cards:
        page = await api.post("/api/assistant", json={"message": query, "lang": lang, "parent_id": None})
        if isinstance(page, dict) and page.get("url"):
            structured["ai_page_url"] = api.web(page["url"])

    if not cards:
        text = f"Không tìm thấy sản phẩm phù hợp với '{query}'. Xem thêm: {structured['search_url']}"
        return ToolOutput(structured, text)
    lines = [f"{c['rank']}. {c['name']} – {vn_number(c['price_vnd'])} đ – {co2_phrase(c)} – {c['url']}" for c in cards]
    if greenest:
        lines.append(f"Ít CO₂ nhất trong danh sách: {greenest['name']} ({vn_number(greenest['co2e_kg'])} kg CO₂e, nguồn: {greenest['source_label']}).")
    if structured.get("ai_page_url"):
        lines.append(f"Trang phân tích do AI tạo: {structured['ai_page_url']}")
    lines.append(f"Cách tính CO₂: {structured['method_url']}")
    return ToolOutput(structured, "\n".join(notes + lines))


async def get_product_co2(api: Api, product_id: str) -> ToolOutput:
    pid = str(product_id).strip()
    if not pid:
        raise ValueError("product_id không được để trống")
    data = await api.get(f"/api/products/{quote(pid)}/co2")
    card = card_from_api(api, data.get("product") or {"product_id": pid})
    formula = data.get("formula") or {}
    lifecycle = data.get("lifecycle") or {}
    structured = {
        "product": card,
        "explanation_vi": data.get("explanation_vi"),
        "explanation_en": data.get("explanation_en"),
        "formula": formula,
        "lifecycle": lifecycle,
        "references": data.get("references") or [],
        "url": card["url"],
        "method_url": api.web("/method"),
    }
    lines = [f"{card['name']}: {co2_phrase(card)}."]
    if formula.get("expression"):
        lines.append(f"Cách tính ({formula.get('title_vi') or formula.get('method')}): {formula['expression']}")
        for step in formula.get("steps") or []:
            lines.append(f"  • {step.get('label_vi')}: {step.get('expr')}")
    stages = lifecycle.get("stages") or []
    if stages:
        parts = ", ".join(f"{s.get('label_vi')} {vn_number(s.get('kg'))} kg ({vn_number(s.get('pct'), 0)} %)" for s in stages)
        basis = " (tỷ lệ điển hình, giả định)" if lifecycle.get("basis") == "typical_share" else ""
        lines.append(f"Vòng đời{basis}: {parts}.")
    if card.get("co2e_confidence") is not None:
        lines.append(f"Độ tin cậy: {vn_number(card['co2e_confidence'], 2)}.")
    lines.append(f"Chi tiết: {card['url']}")
    return ToolOutput(structured, "\n".join(lines))


async def compare_products(api: Api, product_ids: list[str]) -> ToolOutput:
    ids = [str(i).strip() for i in (product_ids or []) if str(i).strip()]
    ids = list(dict.fromkeys(ids))
    if not 2 <= len(ids) <= 4:
        raise ValueError("Cần từ 2 đến 4 mã sản phẩm khác nhau")
    joined = ",".join(ids)
    data = await api.get("/api/compare", params={"ids": joined})
    cards = []
    for raw in data.get("products") or []:
        card = card_from_api(api, raw)
        card["annual_kwh"] = _num(raw.get("annual_kwh"))
        card["electricity_vnd_year"] = _num(raw.get("electricity_vnd_year"))
        cards.append(card)
    structured = {
        "products": cards,
        "rows": data.get("rows") or [],
        "best": data.get("best") or {},
        "conclusion": data.get("conclusion"),
        "compare_url": api.web(f"/compare?ids={quote(joined, safe=',')}"),
        "method_url": api.web("/method"),
    }
    names = {c["product_id"]: c["name"] for c in cards}
    lines = [f"- {c['name']}: {vn_number(c['price_vnd'])} đ, {co2_phrase(c)}" for c in cards]
    best_co2 = structured["best"].get("co2e_kg")
    if best_co2 in names:
        lines.append(f"Ít CO₂ nhất: {names[best_co2]}.")
    if structured["conclusion"]:
        lines.append(structured["conclusion"])
    lines.append(f"Bảng so sánh: {structured['compare_url']}")
    return ToolOutput(structured, "\n".join(lines))


async def explain_co2_method(api: Api) -> ToolOutput:
    try:
        data = await api.get("/api/method")
        source = "gateway"
    except GatewayError:
        data, source = METHOD_SUMMARY, "built_in"
    structured = {"method": data, "source": source, "method_url": api.web("/method")}
    if source == "built_in":
        steps = "\n".join(f"  {s['step']}. {s['name']}: {s['rule']}" for s in METHOD_SUMMARY["steps"])
        text = (f"{METHOD_SUMMARY['principle']}\nChuỗi tính (dừng ở bước đầu tiên ra số):\n{steps}\n"
                f"Điểm xanh: {METHOD_SUMMARY['green_score']}\nXếp hạng: {METHOD_SUMMARY['ranking']}\n"
                f"Kết quả: {METHOD_SUMMARY['results']}\nChi tiết: {structured['method_url']}")
    else:
        text = f"Phương pháp tính CO₂ của CarbonSense AI (chi tiết và ví dụ tính tay): {structured['method_url']}"
    return ToolOutput(structured, text)


async def create_test_order(api: Api, product_id: str, quantity: int = 1) -> ToolOutput:
    pid = str(product_id).strip()
    if not pid:
        raise ValueError("product_id không được để trống")
    quantity = int(quantity)
    if not 1 <= quantity <= 5:
        raise ValueError("Số lượng phải từ 1 đến 5")
    order = await api.post("/api/orders/test", json={
        "items": [{"product_id": pid, "quantity": quantity}],
        "created_by": "mcp",
        "note": "Tạo từ MCP (ChatGPT); chờ người dùng xác nhận trên web.",
    })
    order_id = str(order.get("id"))
    confirm_url = api.web(f"/orders/{quote(order_id)}")
    structured = {
        "order": order,
        "mode": "test",
        "status": order.get("status"),
        "confirm_url": confirm_url,
        "requires_user_confirmation": True,
        "payment": "none",
    }
    saved = order.get("saved_co2e_kg")
    saved_txt = f" Đơn này giảm khoảng {vn_number(saved)} kg CO₂e so với sản phẩm trung bình cùng loại." if saved else ""
    text = (f"Đã tạo ĐƠN THỬ {order_id} (chế độ test, trạng thái {order.get('status')}), "
            f"tổng {vn_number(order.get('total_vnd'))} đ, {vn_number(order.get('total_co2e_kg'))} kg CO₂e.{saved_txt}\n"
            f"Không có tiền thật nào được trừ. Người dùng phải tự bấm \"Xác nhận đặt hàng (thử)\" tại: {confirm_url}")
    return ToolOutput(structured, text)
