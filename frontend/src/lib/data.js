// One place that decides what the UI shows for every value, so no page ever prints
// null / undefined / NaN / [object Object]. "Missing" and "zero" are different things:
// a price of 0 from the shops means "no price", a CO2 of 0 would be a real value.
import { formatKg, formatNum, intlNumber } from "./format";

const LOCALES = { en: "en-US", fr: "fr-FR", vi: "vi-VN" };

/** true for null, undefined, NaN, "", "null", "undefined" (strings the API should never send). */
export function isMissing(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "number") return Number.isNaN(v) || !Number.isFinite(v);
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "" || s === "null" || s === "undefined" || s === "nan";
  }
  return false;
}

/** A finite number or null. Strings like "12.5" are accepted. */
export function num(v) {
  if (isMissing(v)) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** A price in VND or null: the shops store a missing price as 0 or a negative value. */
export function price(v) {
  const n = num(v);
  return n !== null && n > 0 ? n : null;
}

/** Plain text or null (never "[object Object]"). */
export function text(v) {
  if (isMissing(v) || typeof v === "object") return null;
  const s = String(v).trim();
  return s || null;
}

export function formatPrice(v, lang = "en") {
  const p = price(v);
  return p === null ? null : `${intlNumber(LOCALES[lang] || LOCALES.en, { maximumFractionDigits: 0 }, p)} ₫`;
}

export function formatCo2(v, lang = "en") {
  const n = num(v);
  return n === null ? null : `${formatKg(n, lang)} kg CO₂e`;
}

export function formatDate(v, lang = "en", withTime = false) {
  if (isMissing(v)) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(LOCALES[lang] || LOCALES.en, withTime
    ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(d);
}

export function formatCount(v, lang = "en") {
  const n = num(v);
  return n === null ? null : formatNum(n, lang, 0);
}

/** CO2 scope of a stored figure: everything is cradle-to-grave except the price/EEIO estimate. */
export function co2Scope(product) {
  if (num(product?.co2e_kg) === null) return null;
  return product?.co2e_scope || (product?.co2e_source === "eeio_price" ? "cradle_to_shelf" : "cradle_to_grave");
}

/** "published" (manufacturer report for this model) vs "estimated" (everything else). */
export function co2Kind(product) {
  if (num(product?.co2e_kg) === null) return null;
  return product?.co2e_source === "manufacturer" ? "published" : "estimated";
}

/**
 * Normalise any product shape the APIs return (search card, legacy /query item, compare row,
 * assistant card) into one card. Returns null when the product has no usable id or name,
 * so no "null" card or broken link is ever rendered.
 */
export function normalizeProduct(raw) {
  if (!raw || typeof raw !== "object") return null;
  const p = raw.product && typeof raw.product === "object" ? raw.product : raw;
  const id = text(raw.product_id ?? p.product_id ?? p.id);
  const name = text(raw.name ?? p.name);
  if (!id || !name) return null;
  const rating = num(raw.rating ?? p.rating);
  const legacyRating = num(p.product_rating);
  const co2 = num(raw.co2e_kg ?? p.co2e_kg);
  const priceVnd = price(raw.price_vnd ?? p.price_vnd ?? p.final_price);
  const original = price(raw.original_price_vnd ?? p.original_price ?? p.original_price_vnd);
  return {
    product_id: id,
    name,
    brand: text(raw.brand ?? p.brand),
    category: text(raw.category ?? p.category ?? p.co2e_category),
    co2_category: text(raw.co2_category ?? p.co2e_category ?? raw.category),
    condition: text(raw.condition ?? p.condition),
    accessory: Boolean(raw.accessory ?? p.accessory),
    specs: Array.isArray(raw.specs ?? p.specs) ? (raw.specs ?? p.specs).filter((s) => s && text(s.key) && text(s.value)) : [],
    price_vnd: priceVnd,
    original_price_vnd: original && priceVnd && original > priceVnd ? original : null,
    discount_pct: num(raw.discount_pct ?? p.discount_pct),
    platform: text(raw.platform ?? raw.platform_name ?? p.platform),
    product_url: text(raw.product_url ?? p.product_url),
    image_url: text(raw.image_url ?? p.image_url),
    rating: rating !== null && rating >= 0 ? rating : legacyRating !== null && legacyRating >= 0 ? Math.round(legacyRating * 50) / 10 : null,
    review_count: num(raw.review_count ?? p.review_count),
    co2e_kg: co2,
    co2e_source: co2 === null ? null : text(raw.co2e_source ?? p.co2e_source),
    co2e_confidence: co2 === null ? null : num(raw.co2e_confidence ?? p.co2e_confidence),
    co2e_scope: co2 === null ? null : text(raw.co2e_scope ?? p.co2e_scope),
    green_score: co2 === null ? null : num(raw.green_score ?? p.green_score),
  };
}

export function normalizeList(list) {
  return (Array.isArray(list) ? list : []).map(normalizeProduct).filter(Boolean);
}
