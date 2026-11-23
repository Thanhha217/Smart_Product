import { describe, expect, it } from "vitest";
import { composeQuery, optionLabel, selectionChips, toSearchParams } from "../needs";

describe("composeQuery", () => {
  it("writes a question the backend's own parser understands", () => {
    const sel = { device: "laptop", purpose: "study", budget: "20", priority: "co2" };
    expect(composeQuery(sel, "vi")).toBe("Tìm laptop học tập văn phòng dưới 20 triệu ít CO₂");
    expect(composeQuery(sel, "en")).toBe("Find a laptop for study and office work under 20 million with low CO₂");
    expect(composeQuery(sel, "fr")).toContain("moins de 20 millions");
  });

  it("keeps what the visitor typed, and works with nothing picked", () => {
    expect(composeQuery({ device: "laptop" }, "en", "16 GB of RAM")).toBe("Find a laptop. 16 GB of RAM");
    expect(composeQuery({}, "en", "  a quiet keyboard ")).toBe("a quiet keyboard");
    expect(composeQuery({}, "en", "")).toBe("");
  });
});

describe("toSearchParams", () => {
  it("turns the same choice into plain search filters", () => {
    expect(toSearchParams({ device: "laptop", budget: "20", priority: "co2" }))
      .toEqual({ category: "laptops", max_price: "20000000", sort: "co2_asc", has_co2: "true" });
    // "what for" has no filter of its own: it only steers the AI
    expect(toSearchParams({ purpose: "gaming" })).toEqual({});
    expect(toSearchParams({}, "iPhone")).toEqual({ q: "iPhone" });
  });
});

describe("selectionChips", () => {
  it("names each chip so it can be shown back and removed", () => {
    const chips = selectionChips({ device: "smartphone", budget: null, priority: "price" }, "en");
    expect(chips.map((c) => c.key)).toEqual(["device", "priority"]);
    expect(chips[0]).toMatchObject({ group: "Device", label: "Phone" });
    expect(optionLabel("budget", "10", "vi")).toBe("Dưới 10 triệu");
  });
});
