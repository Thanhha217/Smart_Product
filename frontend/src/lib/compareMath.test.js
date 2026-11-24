import { describe, expect, it } from "vitest";
import { barScale, recommend } from "./compareMath";

const air13 = { product_id: "1", name: "MacBook Air 13", co2e_kg: 145, price_vnd: 39_990_000, green_score: 3.6 };
const air15 = { product_id: "2", name: "MacBook Air 15", co2e_kg: 155, price_vnd: 45_690_000, green_score: 3.5 };

describe("recommend", () => {
  it("reproduces the design's figures", () => {
    const r = recommend([air15, air13], 277.2);
    expect(r.best.name).toBe("MacBook Air 13");
    expect(r.runner.name).toBe("MacBook Air 15");
    expect(r.co2.diff).toBe(10);
    expect(r.co2.pct).toBeCloseTo(6.45, 2);          // shown as 6,5 %
    expect(r.price.diff).toBe(-5_700_000);
    expect(r.price.pct).toBeCloseTo(12.48, 2);       // shown as 12,5 %
    expect(r.cat.diff).toBeCloseTo(-132.2, 6);
    expect(r.cat.pct).toBeCloseTo(47.69, 2);         // shown as 47,7 %
    expect(r.badges).toEqual({ lowestCo2: true, cheapest: true, greenest: true });
  });

  it("compares with the closest alternative when there are more than two", () => {
    const r = recommend([{ ...air15, product_id: "3", co2e_kg: 300 }, air15, air13], null);
    expect(r.runner.product_id).toBe("2");
    expect(r.cat).toBeNull();
  });

  it("says so when the lower-CO₂ product costs more", () => {
    const r = recommend([{ ...air13, price_vnd: 50_000_000 }, air15]);
    expect(r.price.diff).toBe(4_310_000);
    expect(r.badges.cheapest).toBe(false);
  });

  it("breaks a CO₂ tie by price and claims no CO₂ win", () => {
    const r = recommend([{ ...air15, co2e_kg: 145 }, air13]);
    expect(r.best.product_id).toBe("1");
    expect(r.co2.diff).toBe(0);
    expect(r.badges.lowestCo2).toBe(false);
  });

  it("ignores products without a CO₂ figure and needs two with one", () => {
    expect(recommend([air13, { ...air15, co2e_kg: null }])).toBeNull();
    expect(recommend([air13])).toBeNull();
  });

  it("does not compare prices when one is missing", () => {
    expect(recommend([air13, { ...air15, price_vnd: null }]).price).toBeNull();
  });
});

describe("barScale", () => {
  it("ends a little past the largest value", () => {
    expect(barScale([145, 155, 277.2])).toBeCloseTo(299.4, 1);
    expect(barScale([null])).toBe(1);
  });
});
