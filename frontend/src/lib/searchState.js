// Search state lives in the URL (back button, reload and shared links restore it).
// Pure functions: unit-tested in lib/__tests__/searchState.test.js.

export const SORTS = ["relevance", "price_asc", "price_desc", "co2_asc", "co2_desc", "discount"];
export const CO2_SOURCES = ["manufacturer", "neighbor_average", "category_model", "lifecycle_formula", "eeio_price", "llm_estimate"];
export const PAGE_SIZE = 24;

const TEXT_KEYS = ["category", "brand", "platform", "co2_source"];
const BOOL_KEYS = ["has_co2", "has_price", "include_accessories"];

function cleanText(v) {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/\s+/g, " ").trim();
  return s.toLowerCase() === "null" || s.toLowerCase() === "undefined" ? "" : s;
}

function cleanNumber(v) {
  const s = cleanText(v).replace(/[^\d.]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** URLSearchParams | string -> state. Reads the legacy ?query= too. */
export function parseSearchParams(input) {
  const p = typeof input === "string" ? new URLSearchParams(input) : input;
  const state = { q: cleanText(p.get("q") ?? p.get("query")) };
  for (const k of TEXT_KEYS) state[k] = cleanText(p.get(k));
  if (state.co2_source && !CO2_SOURCES.includes(state.co2_source)) state.co2_source = "";
  state.min_price = cleanNumber(p.get("min_price"));
  state.max_price = cleanNumber(p.get("max_price"));
  if (state.min_price !== null && state.max_price !== null && state.min_price > state.max_price) {
    [state.min_price, state.max_price] = [state.max_price, state.min_price];
  }
  for (const k of BOOL_KEYS) state[k] = p.get(k) === "1" || p.get(k) === "true";
  const sort = cleanText(p.get("sort"));
  state.sort = SORTS.includes(sort) ? sort : "relevance";
  const page = parseInt(p.get("page") || "1", 10);
  state.page = Number.isFinite(page) && page > 0 ? page : 1;
  return state;
}

/** state -> URLSearchParams with defaults left out (clean, shareable URLs). */
export function toSearchParams(state) {
  const p = new URLSearchParams();
  if (state.q) p.set("q", state.q);
  for (const k of TEXT_KEYS) if (state[k]) p.set(k, state[k]);
  if (state.min_price) p.set("min_price", String(state.min_price));
  if (state.max_price) p.set("max_price", String(state.max_price));
  for (const k of BOOL_KEYS) if (state[k]) p.set(k, "1");
  if (state.sort && state.sort !== "relevance") p.set("sort", state.sort);
  if (state.page && state.page > 1) p.set("page", String(state.page));
  return p;
}

/** state -> api.search params. */
export function toApiParams(state, pageSize = PAGE_SIZE) {
  return {
    q: state.q || undefined,
    category: state.category || undefined,
    brand: state.brand || undefined,
    platform: state.platform || undefined,
    co2_source: state.co2_source || undefined,
    min_price: state.min_price ?? undefined,
    max_price: state.max_price ?? undefined,
    has_co2: state.has_co2 || undefined,
    has_price: state.has_price || undefined,
    include_accessories: state.include_accessories || undefined,
    sort: state.sort,
    page: state.page,
    page_size: pageSize,
  };
}

/** Change filters: any change other than the page itself goes back to page 1. */
export function updateState(state, patch) {
  const next = { ...state, ...patch };
  if (!("page" in patch)) next.page = 1;
  return next;
}

/** true when the user has typed a query or set any filter. */
export function isActiveSearch(state) {
  return Boolean(state.q || TEXT_KEYS.some((k) => state[k]) || state.min_price || state.max_price
    || state.has_co2 || state.has_price || state.include_accessories);
}

/** Active filters as removable chips: [{key, value}]. The query itself is not a chip. */
export function activeFilters(state) {
  const out = [];
  for (const k of TEXT_KEYS) if (state[k]) out.push({ key: k, value: state[k] });
  if (state.min_price) out.push({ key: "min_price", value: state.min_price });
  if (state.max_price) out.push({ key: "max_price", value: state.max_price });
  for (const k of BOOL_KEYS) if (state[k]) out.push({ key: k, value: true });
  return out;
}

export function removeFilter(state, key) {
  const patch = {};
  if (TEXT_KEYS.includes(key)) patch[key] = "";
  else if (BOOL_KEYS.includes(key)) patch[key] = false;
  else if (key === "min_price" || key === "max_price") patch[key] = null;
  return updateState(state, patch);
}

export function clearFilters(state) {
  return { ...parseSearchParams(""), q: state.q, sort: state.sort };
}

/** Data quality bucket from the internal confidence (method-based, not an accuracy). */
export function qualityOf(confidence) {
  if (confidence === null || confidence === undefined || Number.isNaN(Number(confidence))) return null;
  const c = Number(confidence);
  if (c >= 0.8) return "high";
  if (c >= 0.45) return "medium";
  return "low";
}
