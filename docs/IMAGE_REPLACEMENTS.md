# Product pictures: what is shown when a photo is missing

Most rows in the catalogue have no photo. The scrapers stored an image for 592 of the 14,356
listed products; the rest arrive with `image_url = null`. This note says what the site shows
instead, why it is safe, and what has to happen to replace it with the real thing.

## Coverage, measured on the live database (23 Nov 2026)

| Category | Listed | With a photo |
|---|---:|---:|
| `laptops` | 10,185 | 404 |
| `smartphones` | 739 | 169 |
| `headphones` | 1,855 | 19 |
| `monitors` | 1,243 | 0 |
| `tablets` | 52 | 0 |
| `smartwatches` | 131 | 0 |

Re-run the counts with:

```bash
for c in laptops monitors smartphones headphones tablets smartwatches; do
  curl -s "localhost:8000/api/search?category=$c&has_image=true&page_size=1" | python -c "import sys,json;print('$c', json.load(sys.stdin)['total'])"
done
```

## The order the UI follows

`frontend/src/pages/components/common/ProductThumb.jsx` with `frontend/src/lib/standInImage.js`:

1. **The product's own photo** (`image_url`). No label.
2. **A stand-in from a comparable product** — same category, **same brand**, closest price —
   drawn at 90 % opacity with a visible **“Ảnh minh họa / Illustrative photo”** label, and a
   tooltip naming the product the photo actually belongs to. A different brand is never used:
   an HP photo over a Masstel row would mislead more than an icon does.
3. **The category's device icon** (`frontend/src/pages/components/ui/DeviceIcon.jsx`), with the
   label “Chưa có ảnh sản phẩm”.

Step 2 asks db-search for one page of products of that brand and category that do have a photo
(`GET /api/search?category=…&brand=…&has_image=true`), keeps the one closest in price, and caches
the answer per (category, brand) for the session.

## Why this cannot corrupt the data

A stand-in exists only in the browser, and only after the product row has already been served.

- It is **never written back** to the database and never leaves the page.
- It is **never sent to OpenCLIP**. Image embeddings, neighbour similarity and every CO₂
  estimate are computed in `etl-worker` from the product's own image, long before the browser
  sees the row. A product without a photo is matched on its text only — exactly as before.
- Name, price, specifications and the CO₂ figure shown next to a stand-in are always the real
  product's own values. Only the picture is borrowed, and it says so.

The `has_image` filter added to db-search for this purpose is a display filter. It is not used
by the ranking pipeline, the ETL worker or the CO₂ estimator.

## To replace a stand-in with the real photo

The stand-ins are chosen at runtime, so there is no list of hard-coded substitutions to undo:
give a product a real `image_url` and it stops using one on the next page load.

1. Add the image to the `image` table for that `product_id`
   (`INSERT INTO image (product_id, image_url) VALUES (…)`), or re-run the scraper for the
   source page so the picture is captured with the row.
2. Nothing else has to change in the frontend.
3. To let the similarity model use the new picture too, re-run the CO₂ pass for that product
   (`cd backend/services/etl-worker && python -m tools.backfill --reset-co2`), because the
   embedding is built during ingestion.

Priority for filling gaps, by how much of the catalogue it covers: `laptops` (9,781 rows
without a photo), `headphones` (1,836), `monitors` (1,243), `smartphones` (570), `smartwatches`
(131), `tablets` (52).
