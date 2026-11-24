// WebMCP: expose the site's tools to in-browser AI agents (navigator.modelContext,
// W3C Web Machine Learning CG proposal). Feature-detected: does nothing when the
// browser has no modelContext. Supports both registerTool() and provideContext({tools}).
import { api } from "./api/client";
import { addToCart } from "./lib/cart";
import { DEVICE_SLUGS, planPurchase } from "./lib/aiBuyer";
import { normalizeList } from "./lib/data";

let navigateFn = null;
export function setNavigator(fn) {
  navigateFn = fn;
}
function go(path) {
  if (navigateFn) navigateFn(path);
  else window.location.assign(path);
}

const text = (value) => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }] });
const site = () => window.location.origin;

const TOOLS = [
  {
    name: "search_products",
    description:
      "Search products sold on Vietnamese e-commerce sites. Results are ranked by relevance with lower lifecycle CO2 (kg CO2e) breaking ties; each result has price (VND), co2e_kg, green_score (0-5) and the source of the CO2 figure.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query, Vietnamese or English" },
        max_price_vnd: { type: "number", description: "Optional maximum price in VND" },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 8 },
      },
      required: ["query"],
    },
    annotations: { readOnlyHint: true },
    execute: async ({ query, max_price_vnd, limit = 8 }) => {
      let items = await api.searchProducts(query, Math.min(20, limit * 2));
      if (max_price_vnd) items = items.filter((p) => (p.price_vnd || 0) <= max_price_vnd);
      return text({ products: items.slice(0, limit).map((p) => ({ ...p, url: `${site()}/product/${p.product_id}` })) });
    },
  },
  {
    name: "get_product_co2",
    description: "CO2 footprint of one product: kg CO2e, method used, formula with the real numbers substituted, lifecycle stages and references.",
    inputSchema: { type: "object", properties: { product_id: { type: "string" } }, required: ["product_id"] },
    annotations: { readOnlyHint: true },
    execute: async ({ product_id }) => text({ ...(await api.getProductCo2(product_id)), url: `${site()}/product/${product_id}` }),
  },
  {
    name: "compare_products",
    description: "Compare 2-4 products side by side (price, CO2, green score, electricity) and open the comparison page.",
    inputSchema: {
      type: "object",
      properties: { product_ids: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 } },
      required: ["product_ids"],
    },
    execute: async ({ product_ids }) => {
      const ids = product_ids.slice(0, 4).map(String);
      const data = await api.compare(ids);
      go(`/compare?ids=${ids.join(",")}`);
      return text({ ...data, url: `${site()}/compare?ids=${ids.join(",")}` });
    },
  },
  {
    name: "ask_ai_page",
    description:
      "Ask the site's eco shopping assistant. It builds a full result page (recommendations, CO2 formula, lifecycle, charts, savings, sources) and opens it.",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string" }, lang: { type: "string", enum: ["en", "fr", "vi"], default: "en" } },
      required: ["message"],
    },
    execute: async ({ message, lang = "en" }) => {
      const res = await api.askAssistant({ message, lang });
      go(`/assistant/${res.id}`);
      return text({ id: res.id, url: `${site()}/assistant/${res.id}`, summary: res.page?.summary });
    },
  },
  {
    name: "add_to_test_cart",
    description:
      "Add a product to the TEST cart (simulated checkout, no real payment). The human must confirm the order on the checkout page; the agent cannot confirm it.",
    inputSchema: {
      type: "object",
      properties: { product_id: { type: "string" }, quantity: { type: "integer", minimum: 1, maximum: 10, default: 1 } },
      required: ["product_id"],
    },
    execute: async ({ product_id, quantity = 1 }) => {
      const info = await api.getProductCo2(product_id);
      addToCart(info.product, quantity);
      go("/cart");
      return text({ added: info.product?.name, quantity, url: `${site()}/cart`, note: "Test mode: the user confirms at /checkout." });
    },
  },
];

TOOLS.push({
  name: "buy_for_me",
  description:
    "Let the site's shopping agent buy for the user in TEST mode: it searches the catalogue (with a price and a CO2 figure), compares price and lifecycle CO2, optionally works out the CO2 avoided by reselling the user's old device, and prepares ONE test order. The order waits for the human to approve it on its page: the agent cannot confirm or pay, and no real payment ever happens.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "What to buy, e.g. 'macbook', 'tai nghe'" },
      category: { type: "string", enum: ["", ...DEVICE_SLUGS], description: "Optional device type" },
      priority: { type: "string", enum: ["co2", "price"], default: "co2" },
      max_price_vnd: { type: "number", description: "Optional budget in VND" },
      old_device_kg: { type: "number", description: "Optional lifecycle CO2 of the user's old device (kg CO2e)" },
      old_device_category: { type: "string", enum: ["laptop", "smartphone", "tablet", "computer_monitor", "smartwatch", "headphone"] },
    },
  },
  execute: async ({ query = "", category = "", priority = "co2", max_price_vnd, old_device_kg, old_device_category = "laptop" }) => {
    const r = await planPurchase(
      { query, category, priority, maxPrice: max_price_vnd ?? null, old: old_device_kg ? { name: "old device", kg: old_device_kg, category: old_device_category } : null },
      {
        search: async (p) => { const d = await api.search(p); return { ...d, items: normalizeList(d?.items) }; },
        getCo2: (id) => api.getProductCo2(id),
        createOrder: (b) => api.createTestOrder(b),
      },
    );
    if (r.status !== "awaiting_confirmation") return text({ status: "failed", step: r.failedAt, reason: r.reason });
    go(`/orders/${encodeURIComponent(r.order.id)}`);
    return text({
      status: "awaiting_confirmation",
      pick: { product_id: r.pick.product_id, name: r.pick.name, price_vnd: r.pick.price_vnd, co2e_kg: r.pick.co2e_kg, url: `${site()}/product/${r.pick.product_id}` },
      compared: r.shortlist.map((p) => ({ name: p.name, price_vnd: p.price_vnd, co2e_kg: p.co2e_kg })),
      trade_in_co2_avoided_kg: r.trade ? Math.round(r.trade.resaleCredit * 10) / 10 : null,
      order_url: `${site()}/orders/${r.order.id}`,
      note: "Test mode: the user reviews and confirms the order on its page; nothing is charged.",
    });
  },
});

export function initWebMCP() {
  const mc = typeof navigator !== "undefined" ? navigator.modelContext : undefined;
  if (!mc) return false;
  try {
    if (typeof mc.provideContext === "function") {
      mc.provideContext({ tools: TOOLS });
    } else if (typeof mc.registerTool === "function") {
      TOOLS.forEach((tool) => mc.registerTool(tool));
    } else {
      return false;
    }
    return true;
  } catch (e) {
    console.warn("WebMCP registration failed:", e);
    return false;
  }
}
