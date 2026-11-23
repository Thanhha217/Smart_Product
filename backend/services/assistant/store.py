"""Persistence for AI pages (B1) and test orders (B3).

Postgres (tables assistant_page, test_order, test_order_item, test_order_event)
when POSTGRES_URL is set, otherwise an in-memory store (tests, quick demos).
Only technical data is kept: the question, the page JSON, timings, order lines.
No personal data, no payment data.
"""
from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from typing import Any, Protocol



def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Store(Protocol):
    def save_page(self, page: dict[str, Any]) -> None: ...
    def get_page(self, page_id: str) -> dict[str, Any] | None: ...
    def save_order(self, order: dict[str, Any]) -> None: ...
    def get_order(self, order_id: str) -> dict[str, Any] | None: ...


class MemoryStore:
    def __init__(self) -> None:
        self._pages: dict[str, dict] = {}
        self._orders: dict[str, dict] = {}
        self._lock = threading.Lock()

    def save_page(self, page):
        with self._lock:
            self._pages[page["id"]] = json.loads(json.dumps(page))

    def get_page(self, page_id):
        page = self._pages.get(page_id)
        return json.loads(json.dumps(page)) if page else None

    def save_order(self, order):
        with self._lock:
            self._orders[order["id"]] = json.loads(json.dumps(order))

    def get_order(self, order_id):
        order = self._orders.get(order_id)
        return json.loads(json.dumps(order)) if order else None


def _tables():
    """SQLAlchemy is imported only when Postgres is used."""
    from sqlalchemy import Column, DateTime, Float, Integer, MetaData, String, Table, Text

    _meta = MetaData()
    assistant_page = Table(
        "assistant_page", _meta,
        Column("id", String(36), primary_key=True),
        Column("created_at", DateTime(timezone=True)),
        Column("query", Text), Column("lang", String(8)), Column("parent_id", String(36)),
        Column("page_spec", Text), Column("product_ids", Text), Column("model", String(64)),
        Column("latency_ms", Integer), Column("number_check_failures", Integer),
    )
    test_order = Table(
        "test_order", _meta,
        Column("id", String(36), primary_key=True),
        Column("created_at", DateTime(timezone=True)), Column("status", String(32)), Column("mode", String(8)),
        Column("total_vnd", Float), Column("total_co2e_kg", Float), Column("baseline_co2e_kg", Float),
        Column("saved_co2e_kg", Float), Column("created_by", String(16)),
        Column("confirmed_at", DateTime(timezone=True)), Column("payload", Text),
    )
    test_order_item = Table(
        "test_order_item", _meta,
        Column("id", Integer, primary_key=True, autoincrement=True),
        Column("order_id", String(36), index=True), Column("product_id", String(32)), Column("quantity", Integer),
        Column("unit_price_vnd", Float), Column("co2e_kg", Float),
    )
    test_order_event = Table(
        "test_order_event", _meta,
        Column("id", Integer, primary_key=True, autoincrement=True),
        Column("order_id", String(36), index=True), Column("at", DateTime(timezone=True)),
        Column("actor", String(16)), Column("action", String(32)), Column("detail", Text),
    )
    return _meta, assistant_page, test_order, test_order_item, test_order_event


def _dt(value: str | None):
    return datetime.fromisoformat(value) if value else None


class SqlStore:
    def __init__(self, url: str) -> None:
        from sqlalchemy import create_engine

        meta, self.page_t, self.order_t, self.item_t, self.event_t = _tables()
        if url.startswith("postgresql://"):   # SQLAlchemy 2.1 would pick psycopg 3; the image ships psycopg2
            url = "postgresql+psycopg2://" + url[len("postgresql://"):]
        self.engine = create_engine(url, pool_pre_ping=True)
        meta.create_all(self.engine)

    def save_page(self, page):
        from sqlalchemy import insert

        assistant_page = self.page_t
        meta = page.get("meta", {})
        with self.engine.begin() as conn:
            conn.execute(insert(assistant_page).values(
                id=page["id"], created_at=_dt(page["created_at"]), query=page["query"], lang=page["lang"],
                parent_id=page.get("parent_id"), page_spec=json.dumps(page, ensure_ascii=False),
                product_ids=json.dumps(list(page.get("products", {}))), model=meta.get("model"),
                latency_ms=meta.get("latency_ms"), number_check_failures=meta.get("number_check_failures"),
            ))

    def get_page(self, page_id):
        from sqlalchemy import select

        assistant_page = self.page_t
        with self.engine.connect() as conn:
            row = conn.execute(select(assistant_page.c.page_spec).where(assistant_page.c.id == page_id)).first()
        return json.loads(row[0]) if row else None

    def save_order(self, order):
        from sqlalchemy import insert, select, update

        test_order, test_order_item, test_order_event = self.order_t, self.item_t, self.event_t
        payload = json.dumps(order, ensure_ascii=False)
        values = dict(status=order["status"], mode=order["mode"], total_vnd=order["total_vnd"],
                      total_co2e_kg=order["total_co2e_kg"], baseline_co2e_kg=order.get("baseline_co2e_kg"),
                      saved_co2e_kg=order.get("saved_co2e_kg"), created_by=order["created_by"],
                      confirmed_at=_dt(order.get("confirmed_at")), payload=payload)
        with self.engine.begin() as conn:
            exists = conn.execute(select(test_order.c.id).where(test_order.c.id == order["id"])).first()
            if exists:
                conn.execute(update(test_order).where(test_order.c.id == order["id"]).values(**values))
                known = conn.execute(select(test_order_event.c.id).where(test_order_event.c.order_id == order["id"])).all()
                new_events = order["events"][len(known):]
            else:
                conn.execute(insert(test_order).values(id=order["id"], created_at=_dt(order["created_at"]), **values))
                for item in order["items"]:
                    conn.execute(insert(test_order_item).values(
                        order_id=order["id"], product_id=item["product_id"], quantity=item["quantity"],
                        unit_price_vnd=item["unit_price_vnd"], co2e_kg=item["co2e_kg"]))
                new_events = order["events"]
            for e in new_events:
                conn.execute(insert(test_order_event).values(order_id=order["id"], at=_dt(e["at"]), actor=e["actor"],
                                                             action=e["action"], detail=e.get("detail")))

    def get_order(self, order_id):
        from sqlalchemy import select

        test_order = self.order_t
        with self.engine.connect() as conn:
            row = conn.execute(select(test_order.c.payload).where(test_order.c.id == order_id)).first()
        return json.loads(row[0]) if row else None


def make_store() -> Store:
    url = os.environ.get("POSTGRES_URL")
    if url:
        try:
            return SqlStore(url)
        except Exception as error:  # the demo must still run without the database
            print(f"assistant: database unavailable ({error.__class__.__name__}), using memory store", flush=True)
    return MemoryStore()
