// The scenario the Overview opens on, and what the What-if panel does to it.
import { describe, expect, it } from "vitest";
import { baseline, isBaseline, simulate } from "../worldModel";

// a Samsung phone: the backend guessed Vietnam from the brand, so its stored transport
// figure (1.9 kg) was computed for a road trip, not a sea crossing
const madeInVietnam = {
  product: { category: "smartphone", co2e_kg: 72.4 },
  lifecycle: {
    route: { origin_code: "VN", mode: "road", mass_kg: 0.3, sea_km: 0, road_km: 600 },
    stages: [
      { key: "materials_production", kg: 57.9 },
      { key: "transport", kg: 1.9 },
      { key: "use", kg: 11.6 },
      { key: "end_of_life", kg: 0.72 },
    ],
  },
};

describe("baseline", () => {
  it("opens on the import journey — factory abroad, by sea — whatever the brand suggests", () => {
    const b = baseline(madeInVietnam);
    expect(b.origin).toBe("CN");
    expect(b.mode).toBe("sea");
  });

  it("still reads the real mass and stages from the payload", () => {
    const b = baseline(madeInVietnam);
    expect(b.mass).toBe(0.3);
    expect(b.stages.transport).toBe(1.9);
    expect(b.total).toBe(72.4);
  });
});

describe("simulate", () => {
  it("shows the stored figures untouched while nothing has been changed", () => {
    const b = baseline(madeInVietnam);
    const s = simulate(b, { ...b });
    expect(s.stages.transport).toBe(1.9);          // not re-derived: the official number stands
    expect(s.total).toBeCloseTo(72.12, 1);         // sum of the stored stages
    expect(isBaseline(b, { ...b })).toBe(true);
  });

  it("scales transport only once the visitor moves the origin themselves", () => {
    const b = baseline(madeInVietnam);
    const s = simulate(b, { ...b, origin: "VN" });
    expect(s.stages.transport).toBeLessThan(1.9);  // no sea leg inside Vietnam
    expect(isBaseline(b, { ...b, origin: "VN" })).toBe(false);
  });
});
