// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { addToCart, cartTotals, clearCart, getCart, replaceInCart, setQuantity } from "../cart";

const item = (product, quantity = 1) => ({ product, quantity });

describe("cartTotals", () => {
  it("adds prices and whole-life CO2 only", () => {
    const t = cartTotals([
      item({ product_id: "1", price_vnd: 100, co2e_kg: 10, co2e_source: "manufacturer" }, 2),
      item({ product_id: "2", price_vnd: 50, co2e_kg: 5, co2e_source: "eeio_price" }),
    ]);
    expect(t.vnd).toBe(250);
    expect(t.co2).toBe(20);
    expect(t.otherScope).toBe(1);
    expect(t.units).toBe(3);
    expect(t.complete).toBe(true);
  });
  it("never counts a missing price as 0 silently", () => {
    const t = cartTotals([item({ product_id: "1", price_vnd: null, co2e_kg: null }), item({ product_id: "2", price_vnd: 100 })]);
    expect(t.vnd).toBe(100);
    expect(t.missingPrice).toBe(1);
    expect(t.missing).toBe(2);
    expect(t.complete).toBe(false);
  });
  it("empty cart", () => {
    expect(cartTotals([])).toMatchObject({ vnd: 0, co2: 0, units: 0, complete: true });
  });
});

describe("cart store", () => {
  beforeEach(() => { localStorage.clear(); });
  it("adds, merges, changes quantity, removes", () => {
    addToCart({ product_id: 1, name: "A", price_vnd: 10 });
    addToCart({ product_id: 1, name: "A", price_vnd: 10 });
    expect(getCart()).toHaveLength(1);
    expect(getCart()[0].quantity).toBe(2);
    setQuantity("1", 5);
    expect(getCart()[0].quantity).toBe(5);
    setQuantity("1", 0);
    expect(getCart()).toHaveLength(0);
  });
  it("ignores products without id or name", () => {
    addToCart({ name: "no id" });
    expect(getCart()).toHaveLength(0);
  });
  it("swaps an item and keeps its quantity", () => {
    addToCart({ product_id: 1, name: "A" }, 3);
    replaceInCart("1", { product_id: "2", name: "B" });
    expect(getCart()[0]).toMatchObject({ quantity: 3, product: { product_id: "2" } });
    clearCart();
    expect(getCart()).toEqual([]);
  });
});
