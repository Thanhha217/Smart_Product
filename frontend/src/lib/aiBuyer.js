// "AI buys it for you" (test mode): find -> compare price and CO₂ -> trade-in saving -> test order ->
// wait for the person. The agent never confirms or pays: the order stops at "awaiting_confirmation"
// and only the button on /orders/:id confirms it (the order service enforces this too).
// Used by the cart page and by the WebMCP tool, so both run the same steps on the same data.
import { recommend } from "./compareMath";
import { CAT_OF_SLUG, defaultSecondLife, tradeIn } from "./tradeIn";

const isNum = (x) => typeof x === "number" && Number.isFinite(x);

export const DEVICE_SLUGS = ["laptops", "smartphones", "tablets", "monitors", "headphones"];
export const BUDGETS = [null, 10_000_000, 20_000_000, 30_000_000, 50_000_000];
export const STEPS = ["search", "compare", "tradein", "order", "approve"];

/**
 * @param request  { query, category (search slug or ""), priority: "co2" | "price", maxPrice (VND or null),
 *                   old: { name, kg, category (CO₂ category) } | null }
 * @param deps     { search(params), getCo2(id), createOrder({items, created_by, note}) } — the API calls
 * @param onStep   (step, state, detail) — "running" | "done" | "skipped" | "failed"
 * @returns { status: "awaiting_confirmation" | "failed", failedAt?, reason?, shortlist, pick, rec, trade, order }
 */
export async function planPurchase(request, deps, onStep = () => {}) {
  const out = { shortlist: [], pick: null, rec: null, trade: null, order: null };
  const fail = (step, reason) => { onStep(step, "failed", { reason }); return { ...out, status: "failed", failedAt: step, reason }; };

  // 1. find: real catalogue rows with a price and a CO₂ figure, ordered by the priority
  onStep("search", "running");
  const params = {
    q: request.query?.trim() || undefined,
    category: request.category || undefined,
    max_price: isNum(request.maxPrice) ? request.maxPrice : undefined,
    has_price: true,
    has_co2: true,
    sort: request.priority === "price" ? "price_asc" : "co2_asc",
    page_size: 8,
  };
  let found;
  try {
    found = await deps.search(params);
  } catch {
    return fail("search", "unavailable");
  }
  const items = (found?.items || []).filter((p) => isNum(p.co2e_kg) && isNum(p.price_vnd) && p.price_vnd > 0);
  if (!items.length) return fail("search", "none");
  onStep("search", "done", { total: found.total ?? items.length, understood: found.understood || null });

  // 2. compare price and CO₂ of the best few; the first one is the pick (the search already sorted by the priority)
  onStep("compare", "running");
  out.shortlist = items.slice(0, 3);
  out.pick = out.shortlist[0];
  out.rec = out.shortlist.length >= 2 ? recommend(out.shortlist, null) : null;
  onStep("compare", "done", { shortlist: out.shortlist, pick: out.pick });

  // 3. trade-in: what reselling the old device avoids (same rules as /trade-in)
  if (request.old && isNum(request.old.kg) && request.old.kg > 0) {
    onStep("tradein", "running");
    let prodKg = null;
    try {
      const co2 = await deps.getCo2(out.pick.product_id);
      prodKg = (co2?.lifecycle?.stages || []).find((s) => s.key === "materials_production")?.kg ?? null;
    } catch { /* the category share is used instead */ }
    const oldCat = request.old.category;
    out.trade = tradeIn({
      newKg: out.pick.co2e_kg, newProductionKg: prodKg, newCategory: out.pick.co2_category || CAT_OF_SLUG[request.category],
      old: { kg: request.old.kg, category: oldCat, action: "resell", years: defaultSecondLife(oldCat) },
    });
    onStep("tradein", "done", { trade: out.trade, old: request.old });
  } else {
    onStep("tradein", "skipped");
  }

  // 4. a TEST order for the pick, created by the assistant; it cannot confirm it
  onStep("order", "running");
  try {
    out.order = await deps.createOrder({
      items: [{ product_id: String(out.pick.product_id), quantity: 1 }],
      created_by: "assistant",
      note: request.query?.trim() ? `AI mua giúp: ${request.query.trim()}`.slice(0, 200) : "AI mua giúp",
    });
  } catch {
    return fail("order", "order_failed");
  }
  if (!out.order?.id) return fail("order", "order_failed");
  onStep("order", "done", { order: out.order });

  // 5. the person approves (or not) on the order page
  onStep("approve", "running", { order: out.order });
  return { ...out, status: "awaiting_confirmation" };
}
