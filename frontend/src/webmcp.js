// WebMCP: expose the site's tools to in-browser AI agents (navigator.modelContext,
// W3C Web Machine Learning CG proposal). Feature-detected: does nothing when the
// browser has no modelContext. Supports both registerTool() and provideContext({tools}).
import { api } from "./api/client";
import { addToCart } from "./lib/cart";

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
      properties: { message: { type: "string" }, lang: { type: "string", enum: ["vi", "en"], default: "vi" } },
      required: ["message"],
    },
    execute: async ({ message, lang = "vi" }) => {
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
