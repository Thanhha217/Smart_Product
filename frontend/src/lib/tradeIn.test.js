import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultSecondLife, LIFETIME, PRODUCTION_SHARE, REUSE_EMBODIED, tradeIn } from "./tradeIn";

const backend = (p) => resolve(__dirname, "../../../backend/services/etl-worker/green", p);

describe("trade-in constants match the backend", () => {
  it("reuse keeps 20 % of manufacturing, as in co2_formula.py", () => {
    const src = readFileSync(backend("co2_formula.py"), "utf8");
    expect(Number(src.match(/^REFURBISHED_EMBODIED\s*=\s*([\d.]+)/m)[1])).toBe(REUSE_EMBODIED);
  });

  it("production shares are the ones in stage_shares.json", () => {
    const shares = JSON.parse(readFileSync(backend("data/stage_shares.json"), "utf8")).shares;
    for (const [cat, share] of Object.entries(PRODUCTION_SHARE)) expect(shares[cat].materials_production).toBe(share);
  });

  it("service lives are the ones in CategoryParams", () => {
    const src = readFileSync(backend("co2_formula.py"), "utf8");
    const life = (key) => Number(src.match(new RegExp(`"${key}":\\s*CategoryParams\\(([\\d.]+)`))[1]);
    expect(LIFETIME.laptop).toBe(life("laptops"));
    expect(LIFETIME.smartphone).toBe(life("smartphones"));
    expect(LIFETIME.tablet).toBe(life("tablets"));
    expect(LIFETIME.computer_monitor).toBe(life("monitors"));
    expect(LIFETIME.smartwatch).toBe(life("smartwatches"));
  });
});

describe("tradeIn", () => {
  // MacBook Air 13 (145 kg, production stage 108.75 kg from the API) against an old laptop at the category median
  const base = { newKg: 145, newProductionKg: 108.75, newCategory: "laptop", old: { kg: 277.2, category: "laptop", action: "resell", years: 2 } };

  it("works out every option", () => {
    const r = tradeIn(base);
    expect(r.refurbSaving).toBeCloseTo(87, 6);                       // 108.75 × (1 − 0.2)
    expect(r.refurb.kg).toBeCloseTo(58, 6);
    expect(r.refurb.pct).toBeCloseTo(60, 6);
    expect(r.embOld).toBeCloseTo(207.9, 6);                          // 277.2 × 0.75
    expect(r.resaleCredit).toBeCloseTo(83.16, 6);                    // 207.9 × 0.8 × 2 ÷ 4
    expect(r.tradeIn.kg).toBeCloseTo(61.84, 6);
    expect(r.both.kg).toBeCloseTo(-25.16, 6);                        // more avoided than emitted
    expect(r.both.saved).toBeCloseTo(170.16, 6);
    expect(r.best).toBe("both");
  });

  it("recycling claims no extra CO₂", () => {
    const r = tradeIn({ ...base, old: { ...base.old, action: "recycle" } });
    expect(r.resaleCredit).toBe(0);
    expect(r.tradeIn.kg).toBe(145);
    expect(r.best).toBe("refurb");
  });

  it("a second life cannot be longer than the service life", () => {
    expect(tradeIn({ ...base, old: { ...base.old, years: 9 } }).years).toBe(4);
    expect(tradeIn({ ...base, old: { ...base.old, years: -1 } }).resaleCredit).toBe(0);
  });

  it("falls back to the category share when the API gives no stage split", () => {
    expect(tradeIn({ ...base, newProductionKg: null }).prodNew).toBeCloseTo(108.75, 6);
  });

  it("needs a new device figure", () => {
    expect(tradeIn({ ...base, newKg: null })).toBeNull();
  });

  it("defaults to half the service life", () => {
    expect(defaultSecondLife("laptop")).toBe(2);
    expect(defaultSecondLife("smartphone")).toBe(2);
    expect(defaultSecondLife("computer_monitor")).toBe(3);
  });
});

describe("number input", () => {
  it("reads both decimal marks and thousands marks", async () => {
    const { toNum } = await import("../pages/TradeIn.jsx");
    expect(toNum("277,2")).toBe(277.2);
    expect(toNum("277.2")).toBe(277.2);
    expect(toNum("1.234,5")).toBe(1234.5);
    expect(toNum("1,234.5")).toBe(1234.5);
    expect(toNum("1.200")).toBe(1200);
    expect(toNum("")).toBeNull();
    expect(toNum("abc")).toBeNull();
  });
});
