// Single entry point for every backend call (docs/demo/api-contract.md).
// Set VITE_MOCK_API=1 to serve fixtures from ./mock.js instead (demo without backend).
import { GATEWAY_URL } from "../pages/utils/consts";
import * as mock from "./mock";

export const MOCK_API = import.meta.env.VITE_MOCK_API === "1";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || code || `HTTP ${status}`);
    this.status = status;
    this.code = code;
  }
}

async function request(method, path, { body, headers, timeoutMs = 60000, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // a caller's signal (e.g. a newer search replacing this one) cancels the request too
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  try {
    const res = await fetch(`${GATEWAY_URL}${path}`, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const err = data?.error || {};
      const detail = typeof data?.detail === "string" ? data.detail : undefined;
      throw new ApiError(res.status, err.code || "http_error", err.message || detail);
    }
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e.name === "AbortError") {
      if (signal?.aborted) throw new ApiError(0, "cancelled", "Request cancelled");
      throw new ApiError(0, "timeout", "Request timed out");
    }
    throw new ApiError(0, "network", e.message);
  } finally {
    clearTimeout(timer);
  }
}

// Legacy db-search item ({product, platform_name, image_url, ...}) -> ProductCard.
export function toProductCard(item) {
  if (!item) return null;
  if (item.product_id !== undefined) return item;
  const p = item.product || {};
  const rating = p.product_rating;
  return {
    product_id: String(p.id),
    name: p.name,
    price_vnd: p.final_price,
    platform: item.platform_name,
    image_url: item.image_url,
    product_url: p.product_url,
    category: p.co2e_category || null,
    co2e_kg: p.co2e_kg ?? null,
    co2e_source: p.co2e_source ?? null,
    co2e_confidence: p.co2e_confidence ?? null,
    green_score: p.green_score ?? null,
    rating: rating != null ? Math.round((rating <= 1 ? rating * 5 : rating) * 10) / 10 : null,
    review_count: p.review_count ?? null,
  };
}

// The overview may carry full db-search items or only ids; give the page ProductCards (or ids to fetch).
function normaliseOverview(d) {
  if (!d) return d;
  const greenest = (d.greenest || []).map((g) => ({ category: g.category, product: toProductCard(g.item || g.product || g) }));
  const greenestIds = (d.greenest_ids || []).map((g) => ({ category: g.category, id: String(g.id) }));
  const suggestions = (d.suggestions || []).map((s) => ({
    category: s.category, saved_kg: s.saved_kg,
    from: s.from ? toProductCard(s.from) : null, to: s.to ? toProductCard(s.to) : null,
    from_id: s.from_id != null ? String(s.from_id) : null, to_id: s.to_id != null ? String(s.to_id) : null,
  }));
  return { ...d, greenest, greenest_ids: greenestIds, suggestions };
}

const ids = (list) => list.map(String).filter(Boolean).join(",");

export const api = {
  getProductCo2: (id) => (MOCK_API ? mock.getProductCo2(id) : request("GET", `/api/products/${encodeURIComponent(id)}/co2`)),
  getRelated: (id, limit = 6) =>
    MOCK_API
      ? mock.getRelated(id)
      : request("GET", `/api/products/${encodeURIComponent(id)}/related?limit=${limit}`).then((r) => ({
          ...r,
          // db-search answers with its raw items; the pages expect ProductCard.
          items: (r.items || []).map(toProductCard).filter(Boolean),
          greener_alternative: toProductCard(r.greener_alternative),
        })),
  getCategoryStats: (cat, productId) =>
    MOCK_API
      ? mock.getCategoryStats(cat, productId)
      : request(
          "GET",
          `/api/categories/${encodeURIComponent(cat)}/stats${productId ? `?product_id=${encodeURIComponent(productId)}` : ""}`
        ),
  /** Comparison table in the page language (GET /api/compare?ids=&lang=). */
  compareTable: (list, lang = "en") => (MOCK_API ? mock.compare(list)
    : request("GET", `/api/compare?ids=${encodeURIComponent(ids(list))}&lang=${encodeURIComponent(lang)}`, { timeoutMs: 30000 })),
  compare: (list) => (MOCK_API ? mock.compare(list) : request("GET", `/api/compare?ids=${encodeURIComponent(ids(list))}`)),
  askAssistant: ({ message, lang, parent_id = null }) =>
    MOCK_API
      ? mock.askAssistant({ message, lang, parent_id })
      : request("POST", "/api/assistant", { body: { message, lang, parent_id }, timeoutMs: 120000 }),
  getAssistantPage: (id) => (MOCK_API ? mock.getAssistantPage(id) : request("GET", `/api/assistant/${encodeURIComponent(id)}`)),
  createTestOrder: ({ items, created_by = "user", note }) =>
    MOCK_API
      ? mock.createTestOrder({ items, created_by, note })
      : request("POST", "/api/orders/test", { body: { items, created_by, note } }),
  getTestOrder: (id) => (MOCK_API ? mock.getTestOrder(id) : request("GET", `/api/orders/test/${encodeURIComponent(id)}`)),
  // Only the web UI confirms orders: the header marks the human click.
  confirmTestOrder: (id) =>
    MOCK_API
      ? mock.confirmTestOrder(id)
      : request("POST", `/api/orders/test/${encodeURIComponent(id)}/confirm`, {
          body: {},
          headers: { "X-Confirm-Source": "web-ui" },
        }),
  cancelTestOrder: (id) =>
    MOCK_API ? mock.cancelTestOrder(id) : request("POST", `/api/orders/test/${encodeURIComponent(id)}/cancel`, { body: {} }),
  getMethod: () => (MOCK_API ? mock.getMethod() : request("GET", "/api/method")),
  // "Chọn đâu hỏi đó": AI explanation of one part of a product's CO2 (docs/demo/api-explain.md)
  explain: ({ product_id, topic, question = null, lang = "en", scenario = null }) =>
    MOCK_API
      ? mock.explain({ product_id, topic, question, lang, scenario })
      : request("POST", "/api/explain", { body: { product_id: String(product_id), topic, question, lang, scenario }, timeoutMs: 45000 }),
  // Dashboard numbers (docs/demo/api-overview.md). Items are normalised to ProductCard.
  getOverview: async () => {
    const data = MOCK_API ? await mock.getOverview() : await request("GET", "/api/overview", { timeoutMs: 45000 });
    return normaliseOverview(data);
  },
  getHealth: () => (MOCK_API ? mock.getHealth() : request("GET", "/api/health", { timeoutMs: 15000 })),
  // Existing search endpoint (gateway wraps db-search's {"products": [...]} once more).
  /** Filtered search (GET /api/search). params: q, category, brand, platform, min_price, max_price,
   *  has_co2, has_price, co2_source, sort, page, page_size, include_accessories. */
  search: (params = {}, { signal } = {}) => {
    if (MOCK_API) return mock.search(params);
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === undefined || v === "" || v === false) continue;
      qs.set(k, String(v));
    }
    return request("GET", `/api/search?${qs.toString()}`, { signal, timeoutMs: 30000 });
  },
  getCategories: () => (MOCK_API ? mock.getCategories() : request("GET", "/api/categories", { timeoutMs: 20000 })),
  searchProducts: async (q, limit = 12) => {
    if (MOCK_API) return mock.searchProducts(q, limit);
    const data = await request("POST", `/query?q=${encodeURIComponent(q)}&limit=${limit}`, { body: {} });
    const list = Array.isArray(data?.products) ? data.products : data?.products?.products || [];
    return list.map(toProductCard).filter(Boolean);
  },
};
