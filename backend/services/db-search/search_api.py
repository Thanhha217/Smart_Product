"""Product search for the web: real filters, honest empty results, explicit understanding.

GET /search?q=&category=&brand=&platform=&min_price=&max_price=&has_co2=&co2_source=&sort=&page=&page_size=

* q is parsed (search_query.parse_query): category / brand / budget / low-CO2 intent written in
  the text become filters and are returned in `understood`; the rest must ALL appear in the
  product name (accent- and case-insensitive, Postgres unaccent).
* A category the catalogue does not carry is returned in `unsupported` with zero items:
  it is never swapped for another category.
* Missing data stays missing: a price of 0 in the database means "no price" (price_vnd = null,
  sorted last), a missing CO2 is null and sorted last for both CO2 directions.
* Facets count the products matching every other active filter. When nothing matches,
  `relaxations` tell how many products each removable condition would bring back; the
  page offers them, it never drops a condition by itself.
"""
from __future__ import annotations

import json
import re
from typing import Any

from sqlmodel import Session, text

from green_score import green_score, parse_references
from product_specs import brand_of, condition_of, specs_of
from search_query import BRAND_ALIASES, CATEGORY_WORDS, fold, parse_query

SORTS = {
    "relevance": None,
    "price_asc": "NULLIF(p.final_price, 0) ASC NULLS LAST, p.id",
    "price_desc": "NULLIF(p.final_price, 0) DESC NULLS LAST, p.id",
    "co2_asc": "p.co2e_kg ASC NULLS LAST, NULLIF(p.final_price, 0) ASC NULLS LAST, p.id",
    "co2_desc": "p.co2e_kg DESC NULLS LAST, p.id",
    "discount": "CASE WHEN p.original_price > p.final_price AND p.final_price > 0 "
                "THEN (p.original_price - p.final_price) / p.original_price END DESC NULLS LAST, p.id",
}
CO2_SOURCES = ("manufacturer", "neighbor_average", "category_model", "lifecycle_formula", "eeio_price", "llm_estimate")
MAX_PAGE_SIZE = 48
# Shops file accessories under the device category (a screen protector under laptops), so the
# CO2 computed for the category does not apply to them. Product titles start with the item type.
ACCESSORY_RE = (r"^(dan man hinh|mieng dan|op lung|bao da|cap |sac |cu sac|adapter|hub |tui |balo|ba lo|phu kien|"
                r"day deo|but |ban phim|chuot|de tan nhiet|lot chuot|gia treo|gia do|chan de|kinh cuong luc|"
                r"bo chuyen|dock|bao ve|tham chuot|loa |pin du phong|the nho|usb |ram |o cung|ssd |hdd |pin |linh kien|"
                r"quat tan nhiet|ban di |gia de|webcam|tay cam|micro )")


def _brand_regex(brand: str) -> str:
    """Name regex for a brand, including product lines that never say the brand (iPhone -> Apple)."""
    words = BRAND_ALIASES.get(brand, (fold(brand),))
    alternation = "|".join(re.escape(w) for w in words)
    return r"(^|[^a-z0-9])(" + alternation + r")([^a-z0-9]|$)"


def _conditions(f: dict) -> tuple[list[str], dict]:
    where = ["p.name IS NOT NULL", "btrim(p.name) <> ''"]
    params: dict[str, Any] = {}
    if f.get("category"):
        where.append("c.slug = :category")
        params["category"] = f["category"]
    if f.get("brand"):
        where.append("unaccent(lower(p.name)) ~ :brand_re")
        params["brand_re"] = _brand_regex(f["brand"])
    if f.get("platform"):
        where.append("pl.name = :platform")
        params["platform"] = f["platform"]
    if f.get("min_price") is not None:
        where.append("p.final_price > 0 AND p.final_price >= :min_price")
        params["min_price"] = f["min_price"]
    if f.get("max_price") is not None:
        where.append("p.final_price > 0 AND p.final_price <= :max_price")
        params["max_price"] = f["max_price"]
    if f.get("has_price"):
        where.append("p.final_price > 0")
    if f.get("has_co2"):
        where.append("p.co2e_kg IS NOT NULL")
    if f.get("co2_source"):
        where.append("p.co2e_source = :co2_source")
        params["co2_source"] = f["co2_source"]
    if not f.get("include_accessories"):
        where.append("unaccent(lower(btrim(p.name))) !~ :acc_re")
        params["acc_re"] = ACCESSORY_RE
    for i, term in enumerate(f.get("terms") or []):
        where.append(f"unaccent(lower(p.name)) LIKE :t{i}")
        params[f"t{i}"] = f"%{term}%"
    return where, params


FROM = """FROM product p
          JOIN category c ON c.id = p.category_id
          JOIN platform pl ON pl.id = p.platform_id"""


def _count(session, f: dict) -> int:
    where, params = _conditions(f)
    return session.exec(text(f"SELECT count(*) {FROM} WHERE {' AND '.join(where)}"), params=params).one()[0]


def _facet(session, f: dict, column: str, drop: str) -> list[dict]:
    where, params = _conditions({**f, drop: None})
    rows = session.exec(text(f"SELECT {column} AS v, count(*) AS n {FROM} WHERE {' AND '.join(where)} "
                             f"GROUP BY 1 ORDER BY 2 DESC LIMIT 20"), params=params).mappings().all()
    return [{"value": r["v"], "count": r["n"]} for r in rows if r["v"] is not None]


def _brand_facet(session, f: dict) -> list[dict]:
    where, params = _conditions({**f, "brand": None})
    names = session.exec(text(f"SELECT p.name {FROM} WHERE {' AND '.join(where)} LIMIT 6000"), params=params).all()
    counts: dict[str, int] = {}
    for (name,) in names:
        b = brand_of(name)
        if b:
            counts[b] = counts.get(b, 0) + 1
    return [{"value": b, "count": n} for b, n in sorted(counts.items(), key=lambda kv: -kv[1])[:20]]


def is_accessory(name: str | None) -> bool:
    return bool(re.match(ACCESSORY_RE, fold(name).strip() + " "))


def card(row: dict) -> dict:
    price = row["final_price"] if row["final_price"] and row["final_price"] > 0 else None
    original = row["original_price"] if row["original_price"] and price and row["original_price"] > price else None
    rating = row["product_rating"]
    category = row["category"]
    return {
        "product_id": str(row["id"]),
        "name": row["name"].strip(),
        "brand": brand_of(row["name"]),
        "category": category,                      # taxonomy slug (laptops, monitors...)
        "co2_category": row["co2e_category"],      # reference category used for the green score
        "condition": condition_of(row["name"]),
        "accessory": is_accessory(row["name"]),
        "specs": specs_of(row["name"], category),
        "price_vnd": price,
        "original_price_vnd": original,
        "discount_pct": round(100 * (original - price) / original) if original else None,
        "platform": row["platform"],
        "product_url": row["product_url"],
        "image_url": row["image_url"] or None,
        "rating": round(rating * 5, 1) if rating is not None and rating >= 0 else None,
        "review_count": row["review_count"] if row["review_count"] else 0,
        "co2e_kg": row["co2e_kg"],
        "co2e_source": row["co2e_source"] if row["co2e_kg"] is not None else None,
        "co2e_confidence": row["co2e_confidence"] if row["co2e_kg"] is not None else None,
        "co2e_scope": "cradle_to_grave" if row["co2e_kg"] is not None and row["co2e_source"] != "eeio_price"
                      else ("cradle_to_shelf" if row["co2e_kg"] is not None else None),
        "co2e_reference_count": len(parse_references(row["co2e_references"])) if row["co2e_kg"] is not None else 0,
        "green_score": green_score(row["co2e_kg"], row["co2e_category"]),
    }


def search(engine, q: str | None = None, category: str | None = None, brand: str | None = None,
           platform: str | None = None, min_price: float | None = None, max_price: float | None = None,
           has_co2: bool = False, has_price: bool = False, co2_source: str | None = None, sort: str = "relevance",
           page: int = 1, page_size: int = 24, include_accessories: bool = False) -> dict:
    parsed = parse_query(q)
    understood = {"category": parsed.category, "brand": parsed.brand, "min_price": parsed.min_price,
                  "max_price": parsed.max_price, "eco": parsed.eco, "terms": parsed.terms}
    f = {
        "category": category or parsed.category, "brand": brand or parsed.brand, "platform": platform,
        "min_price": min_price if min_price is not None else parsed.min_price,
        "max_price": max_price if max_price is not None else parsed.max_price,
        "has_co2": has_co2, "has_price": has_price,
        "co2_source": co2_source if co2_source in CO2_SOURCES else None, "terms": parsed.terms,
        "include_accessories": include_accessories,
    }
    if sort not in SORTS:
        sort = "relevance"
    effective_sort = "co2_asc" if sort == "relevance" and parsed.eco else sort
    page = max(1, page)
    page_size = max(1, min(page_size, MAX_PAGE_SIZE))
    result: dict[str, Any] = {
        "query": parsed.raw, "understood": understood, "unsupported": parsed.unsupported,
        "filters": {k: v for k, v in f.items() if k != "terms" and v not in (None, False)},
        "sort": sort, "effective_sort": effective_sort, "page": page, "page_size": page_size,
        "total": 0, "items": [], "facets": {}, "relaxations": [],
    }
    if parsed.unsupported:
        return result

    with Session(engine) as session:
        where, params = _conditions(f)
        total = session.exec(text(f"SELECT count(*) {FROM} WHERE {' AND '.join(where)}"), params=params).one()[0]
        order = SORTS[effective_sort]
        if order is None:   # relevance
            phrase = fold(" ".join(parsed.terms))
            params["phrase"] = f"%{phrase}%"
            order = ("CASE WHEN :phrase <> '%%' AND unaccent(lower(p.name)) LIKE :phrase THEN 0 ELSE 1 END, "
                     "CASE WHEN p.final_price > 0 THEN 0 ELSE 1 END, "
                     "CASE WHEN p.co2e_kg IS NOT NULL THEN 0 ELSE 1 END, "
                     "p.review_count DESC NULLS LAST, length(p.name), p.id")
        rows = session.exec(text(f"""
            SELECT p.id, p.name, p.product_url, p.final_price, p.original_price, p.product_rating, p.review_count,
                   p.co2e_kg, p.co2e_source, p.co2e_confidence, p.co2e_category, p.co2e_references,
                   c.slug AS category, pl.name AS platform, img.image_url
            {FROM}
            LEFT JOIN LATERAL (SELECT image_url FROM image WHERE image.product_id = p.id ORDER BY image.id LIMIT 1) img ON true
            WHERE {' AND '.join(where)}
            ORDER BY {order}
            LIMIT :limit OFFSET :offset"""), params={**params, "limit": page_size, "offset": (page - 1) * page_size}).mappings().all()
        result["total"] = total
        result["items"] = [card(dict(r)) for r in rows]
        result["facets"] = {
            "category": _facet(session, f, "c.slug", "category"),
            "platform": _facet(session, f, "pl.name", "platform"),
            "co2_source": _facet(session, f, "p.co2e_source", "co2_source"),
            "brand": _brand_facet(session, f),
            "has_price": _count(session, {**f, "has_price": True}),
            "has_co2": _count(session, {**f, "has_co2": True}),
            "accessories_hidden": 0 if include_accessories else _count(session, {**f, "include_accessories": True}) - total,
        }
        if total == 0:
            options = []
            for key in ("brand", "max_price", "min_price", "category", "platform", "co2_source", "has_co2", "has_price"):
                if f.get(key) not in (None, False):
                    n = _count(session, {**f, key: None if key not in ("has_co2", "has_price") else False})
                    if n:
                        options.append({"drop": key, "value": f[key], "count": n})
            for term in parsed.terms:
                n = _count(session, {**f, "terms": [t for t in parsed.terms if t != term]})
                if n:
                    options.append({"drop": "term", "value": term, "count": n})
            result["relaxations"] = sorted(options, key=lambda o: -o["count"])[:5]
    return result


def categories(engine) -> list[dict]:
    """Every taxonomy category with real counts, CO2 coverage and spread (for explore pages)."""
    with Session(engine) as session:
        rows = session.exec(text(f"""
            SELECT c.slug AS category, count(*) AS products,
                   count(*) FILTER (WHERE p.final_price > 0) AS priced,
                   count(p.co2e_kg) AS with_co2,
                   count(*) FILTER (WHERE p.co2e_source = 'manufacturer') AS manufacturer,
                   percentile_cont(0.5) WITHIN GROUP (ORDER BY p.co2e_kg) AS median_kg,
                   min(p.co2e_kg) AS min_kg, max(p.co2e_kg) AS max_kg,
                   min(NULLIF(p.final_price, 0)) AS min_price, max(NULLIF(p.final_price, 0)) AS max_price
            {FROM} WHERE p.name IS NOT NULL GROUP BY c.slug ORDER BY count(*) DESC""")).mappings().all()
    out = []
    for r in rows:
        if r["category"] not in CATEGORY_WORDS:
            continue
        d = dict(r)
        for k in ("median_kg", "min_kg", "max_kg", "min_price", "max_price"):
            d[k] = round(float(d[k]), 2) if d[k] is not None else None
        out.append(d)
    return out


def to_json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False)
