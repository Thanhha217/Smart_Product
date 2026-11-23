"""Reads product data from db-search. Nothing here computes CO2: the numbers are
the ones etl-worker stored (product.co2e_kg), so every page shows the same figure."""
from __future__ import annotations

import os
from typing import Any

import requests

DB_SEARCH_URL = os.environ.get("DB_SEARCH_URL", "http://smartproductfinder-db-search:8061")
TIMEOUT = float(os.environ.get("DB_SEARCH_TIMEOUT_S", "60"))


def card(item: dict[str, Any]) -> dict[str, Any]:
    """ProductCard of docs/demo/api-contract.md from a db-search item."""
    p = item.get("product") or {}
    rating = p.get("product_rating")
    return {
        "product_id": str(p.get("id")),
        "name": p.get("name"),
        "price_vnd": p.get("final_price"),
        "platform": item.get("platform_name"),
        "image_url": item.get("image_url"),
        "product_url": p.get("product_url"),
        "category": p.get("co2e_category"),
        "co2e_kg": p.get("co2e_kg"),
        "co2e_source": p.get("co2e_source") if p.get("co2e_kg") is not None else None,
        "co2e_confidence": p.get("co2e_confidence"),
        "green_score": p.get("green_score"),
        "rating": round(rating * 5, 1) if isinstance(rating, (int, float)) and rating >= 0 else None,
        "review_count": p.get("review_count"),
    }


def row(item: dict[str, Any]) -> dict[str, Any]:
    """The fields green.explain needs."""
    return dict(item.get("product") or {})


def search(query: str, limit: int = 32) -> list[dict]:
    r = requests.post(f"{DB_SEARCH_URL}/query", params={"q": query, "limit": limit}, json={}, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json().get("products", [])


def product(product_id: str) -> dict | None:
    r = requests.get(f"{DB_SEARCH_URL}/product/{product_id}", timeout=TIMEOUT)
    r.raise_for_status()
    data = r.json()
    return None if not data or "error" in data else data


def related(product_id: str, limit: int = 6) -> dict | None:
    r = requests.get(f"{DB_SEARCH_URL}/products/{product_id}/related", params={"limit": limit}, timeout=TIMEOUT)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return r.json()


def stats(category: str | None, product_id: str | None = None) -> dict | None:
    if not category:
        return None
    params = {"product_id": product_id} if product_id else {}
    r = requests.get(f"{DB_SEARCH_URL}/categories/{category}/stats", params=params, timeout=TIMEOUT)
    r.raise_for_status()
    data = r.json()
    return data if data.get("n") else None
