"""Rebuild the search index and recompute CO2 for products already in Postgres.

Used after restoring a database dump (data/backups/*.dump) or after the CO2
method changed: the scraper -> Kafka path only processes NEW messages.

For every product with a price:
  1. CLIP text embedding of "name + description" (same text as data_transformer.generate_embeddings)
  2. CO2 with the current method (carbon_estimator.estimate_product_co2e, which also fills
     co2e_detail / co2e_breakdown)
  3. the embedding goes into a NEW FAISS text index, written over FAISS_INDEX_PATH at the end

Run inside the container:
    docker compose -f docker-compose.dev.yml exec backend-etl-worker python -m tools.backfill --reset-co2
Options: --limit N (first N products), --keep-co2 (only rebuild the index).
"""
from __future__ import annotations

import argparse
import time

import faiss
import numpy as np
from sqlmodel import Session, select, text

from data import create_db_and_tables, engine
from data.process.carbon_estimator import estimate_product_co2e
from data.process.data_loader import FAISS_IMAGE_INDEX_PATH, FAISS_INDEX_PATH, new_index
from data.process.data_transformer import encode_texts
from data.schemes.category import Category
from data.schemes.product import Product

BATCH = 64
CO2_COLUMNS = ("co2e_kg", "co2e_source", "co2e_confidence", "co2e_explanation", "co2e_explanation_vi",
               "co2e_category", "co2e_references", "co2e_detail", "co2e_breakdown")


def _text(p: Product) -> str:
    return f"{p.name or ''} {p.description or ''}".strip()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--reset-co2", action="store_true", help="clear stored CO2 first so the current method recomputes it")
    ap.add_argument("--keep-co2", action="store_true", help="only rebuild the index, keep CO2 as stored")
    args = ap.parse_args()

    create_db_and_tables()
    if args.reset_co2 and not args.keep_co2:
        with engine.begin() as conn:
            conn.execute(text("UPDATE product SET " + ", ".join(f"{c} = NULL" for c in CO2_COLUMNS)))
        print("CO2 columns cleared.", flush=True)

    with Session(engine) as session:
        slugs = {c.id: c.slug for c in session.exec(select(Category)).all()}
        query = select(Product.id).where(Product.final_price > 0).order_by(Product.id)
        ids = list(session.exec(query).all())
    if args.limit:
        ids = ids[: args.limit]
    print(f"{len(ids)} products to process.", flush=True)

    index = new_index()
    started, done, with_co2 = time.monotonic(), 0, 0
    sources: dict[str, int] = {}
    for start in range(0, len(ids), BATCH):
        batch_ids = ids[start:start + BATCH]
        with Session(engine) as session:
            products = session.exec(select(Product).where(Product.id.in_(batch_ids))).all()
            vectors = encode_texts([_text(p) for p in products])
            ok_ids, ok_vecs = [], []
            for product, vector in zip(products, vectors):
                if not vector:
                    continue
                if not args.keep_co2:
                    estimate_product_co2e(product, vector, slugs.get(product.category_id))
                    session.add(product)
                ok_ids.append(product.id)
                ok_vecs.append(vector)
                if product.co2e_kg is not None:
                    with_co2 += 1
                    sources[product.co2e_source] = sources.get(product.co2e_source, 0) + 1
            session.commit()
        if ok_vecs:
            arr = np.asarray(ok_vecs, dtype="float32")
            faiss.normalize_L2(arr)
            index.add_with_ids(arr, np.asarray(ok_ids, dtype=np.int64))
        done += len(batch_ids)
        rate = done / max(time.monotonic() - started, 1e-6)
        print(f"{done}/{len(ids)} ({rate:.1f}/s) with CO2: {with_co2} {sources}", flush=True)

    faiss.write_index(index, FAISS_INDEX_PATH)
    try:
        faiss.read_index(FAISS_IMAGE_INDEX_PATH)
    except Exception:
        faiss.write_index(new_index(), FAISS_IMAGE_INDEX_PATH)   # ranking-system opens both files
    print(f"Done: {index.ntotal} vectors in {FAISS_INDEX_PATH}; CO2 for {with_co2}/{done}; {sources}", flush=True)


if __name__ == "__main__":
    main()
