// The demo teardown data is quoted from named sources, so the shape it promises is worth locking:
// every machine carries its sources, every line carries a key and a value, and nothing claims a
// CO2 figure per part.
import { describe, expect, it } from "vitest";
import { TEARDOWN, hasTeardown, teardownOf } from "../teardown";

const IDS = ["718", "823", "287", "640", "660"];

describe("teardown data", () => {
  it("covers the five demo machines, one per brand", () => {
    expect(Object.keys(TEARDOWN).sort()).toEqual([...IDS].sort());
    expect(Object.values(TEARDOWN).map((t) => t.brand).sort())
      .toEqual(["Acer", "Asus", "Dell", "HP", "Lenovo"]);
  });

  it("gives every machine a named, linked source", () => {
    for (const [id, t] of Object.entries(TEARDOWN)) {
      expect(t.sources.length, id).toBeGreaterThan(0);
      for (const s of t.sources) {
        expect(s.label, id).toBeTruthy();
        expect(s.url, id).toMatch(/^https:\/\//);
      }
    }
  });

  it("writes every line as {k, v}, and marks only family-level ones as approximate", () => {
    for (const [id, t] of Object.entries(TEARDOWN)) {
      for (const section of ["screen", "cpu", "memory", "power"]) {
        expect(t[section].length, `${id}.${section}`).toBeGreaterThan(0);
        for (const row of t[section]) {
          expect(typeof row.k, `${id}.${section}`).toBe("string");
          expect(String(row.v).length, `${id}.${section}.${row.k}`).toBeGreaterThan(0);
          if ("approx" in row) expect(row.approx, `${id}.${section}.${row.k}`).toBe(true);
        }
      }
    }
  });

  it("never carries a CO₂ figure: no manufacturer publishes one per part", () => {
    expect(JSON.stringify(TEARDOWN)).not.toMatch(/co2|kg CO/i);
  });

  it("answers only for the machines it actually has", () => {
    expect(hasTeardown(640)).toBe(true);
    expect(hasTeardown("640")).toBe(true);
    expect(hasTeardown(99999)).toBe(false);
    expect(teardownOf(99999)).toBeNull();
    expect(teardownOf(640).brand).toBe("Asus");
  });

  it("keeps the ASUS battery exact and the HP one family-level, as the sources do", () => {
    const asus = TEARDOWN["640"].power.find((r) => r.k === "battery");
    const hp = TEARDOWN["718"].power.find((r) => r.k === "battery");
    expect(asus.approx).toBeUndefined();   // asus.com lists 48 Wh for FA506NCG itself
    expect(hp.approx).toBe(true);          // HP publishes 68 Wh for the 14-fs0000 family
  });
});
