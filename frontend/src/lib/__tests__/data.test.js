import { describe, expect, it } from "vitest";
import { co2Kind, co2Scope, formatCo2, formatDate, formatPrice, isMissing, normalizeList, normalizeProduct, num, price, text } from "../data";

describe("missing values", () => {
  it("treats null-like values as missing, zero as a value", () => {
    for (const v of [null, undefined, NaN, Infinity, "", " ", "null", "undefined", "NaN"]) expect(isMissing(v)).toBe(true);
    expect(isMissing(0)).toBe(false);
    expect(num(0)).toBe(0);
    expect(num("12.5")).toBe(12.5);
    expect(num("abc")).toBeNull();
  });
  it("a price of 0 or less means no price", () => {
    expect(price(0)).toBeNull();
    expect(price(-1)).toBeNull();
    expect(price(15990000)).toBe(15990000);
    expect(formatPrice(0)).toBeNull();
    expect(formatPrice(15990000, "en")).toBe("15,990,000 ₫");
  });
  it("text never returns [object Object]", () => {
    expect(text({ a: 1 })).toBeNull();
    expect(text(["x"])).toBeNull();
    expect(text("  Dell  ")).toBe("Dell");
  });
  it("formats CO2 and dates, null when missing", () => {
    expect(formatCo2(null)).toBeNull();
    expect(formatCo2(250, "en")).toContain("kg CO₂e");
    expect(formatDate("not a date")).toBeNull();
    expect(formatDate("2026-01-02T10:00:00Z", "en")).toMatch(/2026/);
  });
});

describe("normalizeProduct", () => {
  it("drops products without id or name", () => {
    expect(normalizeProduct(null)).toBeNull();
    expect(normalizeProduct({ product_id: 1 })).toBeNull();
    expect(normalizeProduct({ name: "x" })).toBeNull();
    expect(normalizeList([{ product_id: 1, name: "A" }, { name: "no id" }, null])).toHaveLength(1);
  });
  it("reads the legacy nested shape and cleans values", () => {
    const p = normalizeProduct({
      product: { product_id: 7, name: "Dell XPS", final_price: 0, product_rating: 0.9, co2e_kg: "300", co2e_source: "manufacturer" },
      platform_name: "Tiki",
    });
    expect(p.product_id).toBe("7");
    expect(p.price_vnd).toBeNull();
    expect(p.rating).toBe(4.5);
    expect(p.co2e_kg).toBe(300);
    expect(p.platform).toBe("Tiki");
  });
  it("no CO2 means no source, score or scope", () => {
    const p = normalizeProduct({ product_id: 1, name: "A", co2e_source: "eeio_price", green_score: 3 });
    expect(p.co2e_source).toBeNull();
    expect(p.green_score).toBeNull();
    expect(co2Scope(p)).toBeNull();
    expect(co2Kind(p)).toBeNull();
  });
  it("only a discount over the current price shows an original price", () => {
    expect(normalizeProduct({ product_id: 1, name: "A", price_vnd: 100, original_price_vnd: 90 }).original_price_vnd).toBeNull();
    expect(normalizeProduct({ product_id: 1, name: "A", price_vnd: 100, original_price_vnd: 120 }).original_price_vnd).toBe(120);
  });
  it("scope and kind of a figure", () => {
    expect(co2Scope({ co2e_kg: 10, co2e_source: "eeio_price" })).toBe("cradle_to_shelf");
    expect(co2Scope({ co2e_kg: 10, co2e_source: "manufacturer" })).toBe("cradle_to_grave");
    expect(co2Kind({ co2e_kg: 10, co2e_source: "manufacturer" })).toBe("published");
    expect(co2Kind({ co2e_kg: 10, co2e_source: "neighbor_average" })).toBe("estimated");
  });
});
