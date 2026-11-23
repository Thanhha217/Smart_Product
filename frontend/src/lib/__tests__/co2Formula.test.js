import { describe, expect, it } from "vitest";
import { co2Explanation, greenEquation, lifecycle, toneMap } from "../co2Formula";

const text = (tokens) => (tokens || []).map((tk) => tk.text).join("");

const neighbour = {
  product: { product_id: "1", name: "Laptop X", co2e_kg: 155, co2e_confidence: 0.5, category: "laptop" },
  formula: {
    method: "neighbor_average",
    detail: { threshold: 0.66, n: 2 },
    steps: [
      { label_en: "Asus C423 (cosine 0.688)", value_kg: 113 },
      { label_en: "HP 14 (cosine 0.682)", value_kg: 197 },
      { label_en: "Average", value_kg: 155 },
    ],
  },
  references: [{ name: "Asus C423", co2e_kg: 113, cosine: 0.688, url: "https://x/y.pdf" }],
};

describe("co2Explanation", () => {
  it("writes the neighbour average with every reference and the stored total", () => {
    const ex = co2Explanation(neighbour, "en");
    expect(text(ex.filled)).toBe("= ( 113 + 197 ) ÷ 2");
    expect(ex.resultKg).toBe(155);
    expect(ex.kind).toBe("estimated");
    expect(ex.inputs.map((i) => i.key)).toEqual(["refs", "n"]);
    expect(ex.inputs[1].value).toBe("2");
    expect(ex.sources[0].url).toBe("https://x/y.pdf");
  });

  it("marks a manufacturer figure as published and does not invent arithmetic", () => {
    const ex = co2Explanation({
      product: { product_id: "2", co2e_kg: 64 },
      formula: { method: "manufacturer", detail: { reference: "iPhone 13" }, steps: [{ label_en: "Reference: iPhone 13", value_kg: 64 }] },
      references: [{ name: "Apple iPhone 13 128GB", co2e_kg: 64, cosine: 1 }],
    }, "en");
    expect(ex.kind).toBe("published");
    expect(ex.filled).toBeNull();
    expect(ex.inputs[0].value).toBe("64");
  });

  it("drops the screen-size factor for categories the model does not fit one for", () => {
    const base = { product: { product_id: "3", co2e_kg: 66.2 }, references: [] };
    const flat = co2Explanation({ ...base, formula: { method: "category_model",
      detail: { category: "smartphone", n_refs: 100, category_median_kg: 66.2, screen_inch: null, slope: null, ref_inch: null } } }, "en");
    expect(text(flat.symbolic)).toBe("CO₂ = M");
    expect(flat.filled).toBeNull();
    expect(flat.inputs.map((i) => i.key)).toEqual(["m"]);

    const sized = co2Explanation({ ...base, formula: { method: "category_model",
      detail: { category: "laptop", n_refs: 467, category_median_kg: 255.5, screen_inch: 15.6, ref_inch: 14, slope: 0.53 } } }, "fr");
    expect(text(sized.symbolic)).toBe("CO₂ = M × ( s ÷ s₀ )b");
    expect(text(sized.filled)).toBe("= 255,5 × ( 15,6 ÷ 14 )0,53");
    expect(sized.inputs.map((i) => i.key)).toEqual(["m", "s", "s0", "b"]);
  });

  it("gives nothing when the product has no figure", () => {
    expect(co2Explanation({ ...neighbour, product: { co2e_kg: null } })).toBeNull();
    expect(co2Explanation({ product: { co2e_kg: 10 }, formula: { method: "none" } })).toBeNull();
    expect(co2Explanation(null)).toBeNull();
  });

  it("gives every variable its own colour", () => {
    const ex = co2Explanation(neighbour, "en");
    const tones = toneMap(ex.inputs);
    expect(tones.refs).not.toBe(tones.n);
  });
});

describe("lifecycle", () => {
  it("keeps the basis so pages can tell a split from an illustration", () => {
    const shared = lifecycle({ basis: "typical_share", stages: [
      { key: "use", kg: 49.4, pct: 19 }, { key: "materials_production", kg: 195.2, pct: 75 }, { key: "transport", kg: null, pct: null },
    ] });
    expect(shared.measured).toBe(false);
    expect(shared.parts.map((p) => p.key)).toEqual(["materials_production", "use"]);
    expect(lifecycle({ basis: "formula", stages: [{ key: "use", kg: 1, pct: 100 }] }).measured).toBe(true);
    expect(lifecycle(null).basis).toBe("none");
  });
});

describe("greenEquation", () => {
  it("fills L, U and the product figure", () => {
    const g = greenEquation({ low: 60, high: 1000, co2e_kg: 260.2, score: 2.4 }, "en");
    expect(text(g.filled)).toBe("= 5 × ln( 1,000 ÷ 260.2 ) ÷ ln( 1,000 ÷ 60 )");
    expect(greenEquation({ low: 60, high: 1000, co2e_kg: null, score: null })).toBeNull();
  });
});
