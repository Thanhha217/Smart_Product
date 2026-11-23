import { describe, expect, it } from "vitest";
import { greenEquation, lifecycleParts, methodEquation } from "../co2Formula";

const neighbour = {
  method: "neighbor_average",
  detail: { threshold: 0.66, n: 2 },
  steps: [
    { label_en: "Asus C423 (cosine 0.688)", value_kg: 113 },
    { label_en: "HP 14 (cosine 0.682)", value_kg: 197 },
    { label_en: "Average", value_kg: 155 },
  ],
};

describe("methodEquation", () => {
  it("writes the neighbour average with every term and the stored total", () => {
    const eq = methodEquation(neighbour, { co2e_kg: 155 }, "en");
    expect(eq.filled).toBe("(113 + 197) ÷ 2");
    expect(eq.terms.map((t) => t.label)).toEqual(["Asus C423", "HP 14"]);
    expect(eq.resultKg).toBe(155);
    expect(eq.note).toContain("0.66");
  });

  it("formats numbers in the visitor's language", () => {
    const eq = methodEquation({ method: "category_model", detail: { category_median_kg: 255.5, screen_inch: 15.6, ref_inch: 14, slope: 0.53 } },
      { co2e_kg: 270 }, "fr");
    expect(eq.filled).toBe("255,5 × (15,6 ÷ 14)^0,53");
  });

  it("gives nothing when there is no figure", () => {
    expect(methodEquation(neighbour, { co2e_kg: null })).toBeNull();
    expect(methodEquation({ method: "none" }, { co2e_kg: 10 })).toBeNull();
  });
});

describe("lifecycleParts", () => {
  it("keeps the stored stages in lifecycle order", () => {
    const parts = lifecycleParts({ stages: [
      { key: "use", kg: 49.4, pct: 19 }, { key: "materials_production", kg: 195.2, pct: 75 }, { key: "transport", kg: null },
    ] });
    expect(parts.map((p) => p.key)).toEqual(["materials_production", "use"]);
  });
});

describe("greenEquation", () => {
  it("fills L, U and the product figure", () => {
    const g = greenEquation({ low: 60, high: 1000, co2e_kg: 260.2, score: 2.4 }, "en");
    expect(g.filled).toBe("5 × ln(1,000 ÷ 260.2) ÷ ln(1,000 ÷ 60)");
    expect(greenEquation({ low: 60, high: 1000, co2e_kg: null, score: null })).toBeNull();
  });
});
