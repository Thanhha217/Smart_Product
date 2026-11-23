"""CO2 data APIs for the AI page, the compare page and the MCP server.

related_products   same reference category, greenest first, similar price first
category_stats     n, median, quartiles, min/max and "greener than X %" of one product

Only reads the numbers already stored by etl-worker (product.co2e_kg): nothing
is recomputed here, so every page shows the same figure (YC-5).
"""
from sqlmodel import Session, text

PRICE_BAND = 0.40           # "similar price" for related products
ALTERNATIVE_BAND = 0.15     # greener alternative: price within +-15 %


def _base(session, product_id):
    return session.exec(
        text("SELECT id, co2e_kg, co2e_category, final_price FROM product WHERE id = :id"),
        params={"id": product_id},
    ).mappings().first()


def related_product_ids(engine, product_id, limit=6):
    """(category, ids greenest-first, greener alternative id or None); None when the product is unknown."""
    with Session(engine) as session:
        base = _base(session, product_id)
        if base is None:
            return None
        category, price, kg = base["co2e_category"], base["final_price"] or 0, base["co2e_kg"]
        if not category:
            return category, [], None
        rows = session.exec(
            text("""
                SELECT id, co2e_kg, final_price FROM product
                WHERE co2e_category = :cat AND co2e_kg IS NOT NULL AND id <> :id AND final_price > 0
                ORDER BY co2e_kg ASC, final_price ASC
                LIMIT 400
            """),
            params={"cat": category, "id": product_id},
        ).mappings().all()

    def in_band(row, band):
        return price > 0 and abs((row["final_price"] or 0) - price) <= band * price

    near = [r for r in rows if in_band(r, PRICE_BAND)]
    far = [r for r in rows if not in_band(r, PRICE_BAND)]
    ids = [r["id"] for r in (near + far)[:limit]]
    alternative = None
    if kg is not None:
        greener = [r for r in rows if in_band(r, ALTERNATIVE_BAND) and r["co2e_kg"] < kg]
        if greener:
            alternative = greener[0]["id"]   # rows are sorted by CO2 ascending
    return category, ids, alternative


def category_stats(engine, category, product_id=None):
    with Session(engine) as session:
        row = session.exec(
            text("""
                SELECT count(*) AS n,
                       percentile_cont(0.5)  WITHIN GROUP (ORDER BY co2e_kg) AS median_kg,
                       percentile_cont(0.25) WITHIN GROUP (ORDER BY co2e_kg) AS p25,
                       percentile_cont(0.75) WITHIN GROUP (ORDER BY co2e_kg) AS p75,
                       min(co2e_kg) AS min, max(co2e_kg) AS max
                FROM product WHERE co2e_category = :cat AND co2e_kg IS NOT NULL
            """),
            params={"cat": category},
        ).mappings().first()
        stats = {k: (round(float(v), 2) if v is not None and k != "n" else v) for k, v in dict(row).items()}
        stats["category"] = category
        stats["product_kg"] = None
        stats["greener_than_pct"] = None
        if product_id is not None and stats["n"]:
            base = _base(session, product_id)
            if base is not None and base["co2e_kg"] is not None:
                higher = session.exec(
                    text("SELECT count(*) FROM product WHERE co2e_category = :cat AND co2e_kg > :kg"),
                    params={"cat": category, "kg": base["co2e_kg"]},
                ).one()[0]
                stats["product_kg"] = base["co2e_kg"]
                stats["greener_than_pct"] = round(100 * higher / stats["n"], 1)
    return stats


# Shop categories are noisy (a monitor arm filed as a monitor, a tablet as a phone): the
# dashboard only shows products whose name matches their CO2 category and is not an accessory.
CATEGORY_WORDS = {
    "laptop": ("laptop", "macbook", "notebook", "surface laptop"),
    "gaming_laptop": ("laptop", "gaming"),
    "computer_monitor": ("màn hình", "monitor"),
    "smartphone": ("điện thoại", "iphone", "smartphone"),
    "headphone": ("tai nghe", "headphone", "airpods", "earbuds", "buds"),
    "smartwatch": ("đồng hồ", "watch"),
    "tablet": ("máy tính bảng", "ipad", "tablet", " tab "),
    "desktop": ("máy tính để bàn", "pc ", "imac", "mac mini", "desktop", "all in one", "all-in-one"),
}
ACCESSORY_WORDS = ("giá treo", "giá đỡ", "chân đế", "ốp lưng", "bao da", "cáp ", "sạc", "miếng dán", "kính cường lực",
                   "adapter", "hub ", "túi ", "balo", "phụ kiện", "arm ", "dây đeo", "bút ", "bàn phím", "chuột")


def looks_like(name, category):
    low = f" {(name or '').lower()} "
    if any(w in low for w in ACCESSORY_WORDS):
        return False
    words = CATEGORY_WORDS.get(category)
    return True if words is None else any(w in low for w in words)


def overview(engine, suggestion_categories=4, sample=20):
    """Counts, per-category spread, source mix, greenest product per category and a few
    'switch to a greener product' suggestions, for the dashboard. Priced products only."""
    with Session(engine) as session:
        q = lambda sql, **p: session.exec(text(sql), params=p).mappings().all()  # noqa: E731
        totals = q("SELECT count(*) AS total, count(co2e_kg) AS with_co2 FROM product WHERE final_price > 0")[0]
        refs = q("SELECT count(*) AS n FROM carbonreference")[0]["n"]
        by_category = q("""
            SELECT co2e_category AS category, count(*) AS n,
                   percentile_cont(0.5)  WITHIN GROUP (ORDER BY co2e_kg) AS median_kg,
                   percentile_cont(0.25) WITHIN GROUP (ORDER BY co2e_kg) AS p25,
                   percentile_cont(0.75) WITHIN GROUP (ORDER BY co2e_kg) AS p75,
                   min(co2e_kg) AS min_kg, max(co2e_kg) AS max_kg
            FROM product WHERE final_price > 0 AND co2e_kg IS NOT NULL AND co2e_category IS NOT NULL
            GROUP BY co2e_category ORDER BY count(*) DESC""")
        by_source = q("""SELECT COALESCE(co2e_source, 'none') AS source, count(*) AS n FROM product
                         WHERE final_price > 0 GROUP BY 1 ORDER BY 2 DESC""")
        platforms = q("""SELECT platform.name AS name, count(*) AS n FROM product JOIN platform ON platform.id = product.platform_id
                         WHERE final_price > 0 GROUP BY 1 ORDER BY 2 DESC""")
        ranked = q("""SELECT co2e_category AS category, id, name FROM (
                        SELECT co2e_category, id, name, row_number() OVER (PARTITION BY co2e_category ORDER BY co2e_kg, final_price) AS r
                        FROM product WHERE final_price > 0 AND co2e_kg IS NOT NULL AND co2e_category IS NOT NULL) t
                      WHERE r <= 40 ORDER BY co2e_category, r""")
        greenest, seen = [], set()
        for r in ranked:
            if r["category"] not in seen and looks_like(r["name"], r["category"]):
                seen.add(r["category"])
                greenest.append(r)
        candidates = {}
        for row in by_category[:suggestion_categories]:
            candidates[row["category"]] = [r["id"] for r in q(
                """SELECT id, name FROM product WHERE co2e_category = :cat AND final_price > 0 AND co2e_kg >= :p75
                   ORDER BY co2e_kg DESC LIMIT :n""", cat=row["category"], p75=row["p75"], n=sample * 3)
                if looks_like(r["name"], row["category"])][:sample]
        kg_by_id = {}
    suggestions = []
    for category, ids in candidates.items():
        best = None
        for pid in ids:
            result = related_product_ids(engine, pid, 1)
            if not result or result[2] is None:
                continue
            with Session(engine) as session:
                rows = session.exec(text("SELECT id, co2e_kg, name FROM product WHERE id IN (:a, :b)"),
                                    params={"a": pid, "b": result[2]}).mappings().all()
            if not all(looks_like(r["name"], category) for r in rows):
                continue
            kg_by_id.update({r["id"]: r["co2e_kg"] for r in rows})
            saved = kg_by_id[pid] - kg_by_id[result[2]]
            if best is None or saved > best[2]:
                best = (pid, result[2], saved)
        if best:
            suggestions.append({"category": category, "from_id": best[0], "to_id": best[1], "saved_kg": round(best[2], 1)})
    num = lambda v: round(float(v), 2) if v is not None else None  # noqa: E731
    return {
        "total_products": totals["total"], "with_co2": totals["with_co2"], "references": refs, "grid_ef": 0.681,
        "by_category": [{**{k: num(v) if k not in ("category", "n") else v for k, v in dict(r).items()}} for r in by_category],
        "by_source": [dict(r) for r in by_source], "platforms": [dict(r) for r in platforms],
        "greenest_ids": [{"category": r["category"], "id": r["id"]} for r in greenest],
        "suggestions": suggestions,
    }
