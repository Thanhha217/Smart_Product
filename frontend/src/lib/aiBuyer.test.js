import { describe, expect, it, vi } from "vitest";
import { planPurchase } from "./aiBuyer";

const air13 = { product_id: "55565", name: "MacBook Air 13", co2e_kg: 145, price_vnd: 39_990_000, co2_category: "laptop" };
const air15 = { product_id: "54620", name: "MacBook Air 15", co2e_kg: 155, price_vnd: 45_690_000, co2_category: "laptop" };
const noPrice = { product_id: "1", name: "No price", co2e_kg: 100, price_vnd: null };

function deps(items = [air13, air15, noPrice]) {
  return {
    search: vi.fn(async () => ({ total: items.length, items })),
    getCo2: vi.fn(async () => ({ lifecycle: { stages: [{ key: "materials_production", kg: 108.75 }] } })),
    createOrder: vi.fn(async (body) => ({ id: "ord-1", status: "awaiting_confirmation", body })),
  };
}

describe("planPurchase", () => {
  it("runs every step and stops at the person's approval", async () => {
    const d = deps();
    const steps = [];
    const r = await planPurchase({ query: "macbook", category: "laptops", priority: "co2", maxPrice: 50_000_000,
      old: { name: "Laptop", kg: 277.2, category: "laptop" } }, d, (s, st) => steps.push(`${s}:${st}`));
    expect(r.status).toBe("awaiting_confirmation");
    expect(steps).toEqual(["search:running", "search:done", "compare:running", "compare:done", "tradein:running", "tradein:done",
      "order:running", "order:done", "approve:running"]);
    expect(d.search).toHaveBeenCalledWith(expect.objectContaining({ q: "macbook", category: "laptops", max_price: 50_000_000, sort: "co2_asc", has_price: true, has_co2: true }));
    expect(r.pick.product_id).toBe("55565");
    expect(r.shortlist.map((p) => p.product_id)).toEqual(["55565", "54620"]);      // the product without a price is left out
    expect(r.rec.co2.diff).toBe(10);
    expect(r.trade.resaleCredit).toBeCloseTo(83.16, 6);                           // same figure as the trade-in page
  });

  it("creates the order as the assistant and never confirms it", async () => {
    const d = deps();
    await planPurchase({ query: "", category: "", priority: "co2", maxPrice: null, old: null }, d);
    expect(d.createOrder).toHaveBeenCalledTimes(1);
    expect(d.createOrder.mock.calls[0][0]).toMatchObject({ items: [{ product_id: "55565", quantity: 1 }], created_by: "assistant" });
    expect(Object.keys(d)).not.toContain("confirmOrder");
  });

  it("sorts by price when price comes first", async () => {
    const d = deps();
    await planPurchase({ priority: "price" }, d);
    expect(d.search.mock.calls[0][0].sort).toBe("price_asc");
  });

  it("skips the trade-in step without an old device", async () => {
    const steps = [];
    await planPurchase({ priority: "co2" }, deps(), (s, st) => steps.push(`${s}:${st}`));
    expect(steps).toContain("tradein:skipped");
  });

  it("stops and says why when nothing matches", async () => {
    const d = deps([]);
    const r = await planPurchase({ query: "xyz", priority: "co2" }, d);
    expect(r).toMatchObject({ status: "failed", failedAt: "search", reason: "none" });
    expect(d.createOrder).not.toHaveBeenCalled();
  });

  it("stops when the order service fails", async () => {
    const d = deps();
    d.createOrder.mockRejectedValueOnce(new Error("down"));
    const r = await planPurchase({ priority: "co2" }, d);
    expect(r).toMatchObject({ status: "failed", failedAt: "order" });
  });
});
