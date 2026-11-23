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
