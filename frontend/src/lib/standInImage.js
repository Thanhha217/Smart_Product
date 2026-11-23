// A picture for products whose own photo is missing (592 of 14,356 rows have one).
//
// Order, as docs/IMAGE_REPLACEMENTS.md describes it:
//   1. the product's own photo;
//   2. a photo of a comparable product — SAME category, SAME brand, nearest price — shown with
//      an "Ảnh minh họa" label so nobody reads it as this exact model;
//   3. the category's device icon.
//
// This is display only. The stand-in never touches product data, never reaches OpenCLIP and
// never takes part in similarity or CO2 estimation: it is fetched in the browser, after the
// product row has already been served.
import { api } from "../api/client";
import { searchCategory } from "./categories";

const cache = new Map();          // "category|brand" -> {url, name, price} | null
const inFlight = new Map();
const MAX_GROUPS = 40;            // one session will not hold more than this

const keyOf = (product) => `${searchCategory(product?.category) || ""}|${(product?.brand || "").toLowerCase()}`;

/** A comparable product with a photo, or null when the catalogue has none. */
export async function findStandIn(product) {
  const slug = searchCategory(product?.category);
  if (!slug) return null;              // no browsable category: the device icon is the honest answer
  const key = keyOf(product);
  if (cache.has(key)) return cache.get(key);
  if (inFlight.has(key)) return inFlight.get(key);

  // same brand is required: a photo of another brand's product would mislead more than it helps,
  // so a product whose brand has no photo keeps its device icon.
  if (!product.brand) { cache.set(key, null); return null; }
  const params = { category: slug, brand: product.brand, has_image: "true", has_price: "true", page_size: 12 };
  const task = api.search(params)
    .then((res) => pick(res?.items || [], product))
    .catch(() => null)
    .then((hit) => {
      if (cache.size > MAX_GROUPS) cache.clear();
      cache.set(key, hit);
      inFlight.delete(key);
      return hit;
    });
  inFlight.set(key, task);
  return task;
}

/** Closest price wins, so a stand-in looks like the same kind of product, not a different class. */
function pick(items, product) {
  const usable = items.filter((i) => i.image_url && i.product_id !== product.product_id);
  if (!usable.length) return null;
  const target = Number(product.price_vnd) || null;
  const best = target
    ? usable.reduce((a, b) => (Math.abs((Number(b.price_vnd) || 0) - target) < Math.abs((Number(a.price_vnd) || 0) - target) ? b : a))
    : usable[0];
  return { url: best.image_url, name: best.name, product_id: best.product_id, price_vnd: best.price_vnd };
}
