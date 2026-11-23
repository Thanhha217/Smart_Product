"""Test orders (B3): the AI may compare and put products in an order, but only a
person on the web confirms it.  No money moves, no card, no bank, no wallet.

    draft -> awaiting_confirmation -> confirmed_test
                                   \\-> cancelled

saved_co2e_kg = sum over lines of (category median - chosen product) x quantity.
"""
from __future__ import annotations

import os
import uuid
from typing import Any, Callable

from store import Store, now_iso

CHECKOUT_MODE = os.environ.get("CHECKOUT_MODE", "test")
CONFIRM_HEADER = "X-Confirm-Source"
CONFIRM_VALUE = "web-ui"
CREATORS = {"user", "assistant", "mcp"}
MAX_QTY = 10


class OrderError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


def require_test_mode() -> None:
    """Called at start-up: the service refuses to run with anything but test checkout."""
    if CHECKOUT_MODE != "test":
        raise RuntimeError(f"CHECKOUT_MODE must be 'test' (got {CHECKOUT_MODE!r}); real payments are out of scope")


def _event(order: dict, actor: str, action: str, detail: str | None = None) -> None:
    order["events"].append({"at": now_iso(), "actor": actor, "action": action, "detail": detail})


def create_order(store: Store, items: list[dict], created_by: str, get_card: Callable[[str], dict | None],
                 get_median: Callable[[str | None], float | None], note: str | None = None) -> dict[str, Any]:
    if created_by not in CREATORS:
        raise OrderError("invalid_creator", f"created_by must be one of {sorted(CREATORS)}")
    if not items:
        raise OrderError("empty_order", "An order needs at least one item")
    lines = []
    for raw in items[:20]:
        pid = str(raw.get("product_id", "")).strip()
        qty = int(raw.get("quantity") or 1)
        if not pid.isdigit() or not 1 <= qty <= MAX_QTY:
            raise OrderError("invalid_item", f"Invalid product_id or quantity (1-{MAX_QTY})")
        card = get_card(pid)
        if card is None:
            raise OrderError("product_not_found", f"Product {pid} not found", 404)
        lines.append({"product_id": pid, "name": card["name"], "quantity": qty,
                      "unit_price_vnd": card.get("price_vnd") or 0, "co2e_kg": card.get("co2e_kg"),
                      "category": card.get("category"), "image_url": card.get("image_url"),
                      "co2e_source": card.get("co2e_source")})

    total_vnd = sum(line["unit_price_vnd"] * line["quantity"] for line in lines)
    known = [line for line in lines if line["co2e_kg"] is not None]
    total_co2 = round(sum(line["co2e_kg"] * line["quantity"] for line in known), 2) if known else None
    baseline = saved = None
    medians = {line["category"]: get_median(line["category"]) for line in known}
    if known and all(medians[line["category"]] is not None for line in known):
        baseline = round(sum(medians[line["category"]] * line["quantity"] for line in known), 2)
        saved = round(baseline - total_co2, 2)

    order_id = str(uuid.uuid4())
    order = {"id": order_id, "mode": "test", "status": "draft", "created_by": created_by, "created_at": now_iso(),
             "confirmed_at": None, "items": lines, "total_vnd": total_vnd, "total_co2e_kg": total_co2,
             "baseline_co2e_kg": baseline, "saved_co2e_kg": saved, "note": (note or "")[:300],
             "confirm_url": f"/orders/{order_id}", "events": []}
    _event(order, created_by, "created", f"{len(lines)} item(s)")
    order["status"] = "awaiting_confirmation"
    _event(order, "system", "awaiting_confirmation")
    store.save_order(order)
    return order


def get_order(store: Store, order_id: str) -> dict:
    order = store.get_order(order_id)
    if order is None:
        raise OrderError("order_not_found", "Order not found", 404)
    return order


def confirm_order(store: Store, order_id: str, confirm_source: str | None) -> dict:
    if confirm_source != CONFIRM_VALUE:
        raise OrderError("confirmation_requires_web", "Only a person on the web page can confirm a test order", 403)
    order = get_order(store, order_id)
    if order["status"] != "awaiting_confirmation":
        raise OrderError("invalid_status", f"Order is {order['status']}", 409)
    order["status"] = "confirmed_test"
    order["confirmed_at"] = now_iso()
    _event(order, "user", "confirmed_test", "no payment taken (test mode)")
    store.save_order(order)
    return order


def cancel_order(store: Store, order_id: str, actor: str = "user") -> dict:
    order = get_order(store, order_id)
    if order["status"] not in ("draft", "awaiting_confirmation"):
        raise OrderError("invalid_status", f"Order is {order['status']}", 409)
    order["status"] = "cancelled"
    _event(order, actor if actor in CREATORS else "user", "cancelled")
    store.save_order(order)
    return order
