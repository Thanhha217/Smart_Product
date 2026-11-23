// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { addToCompare, clearCompare, COMPARE_MAX, getCompare, removeFromCompare, setCompareIds } from "../compare";

const p = (id) => ({ product_id: id, name: `P${id}` });

describe("compare store", () => {
  beforeEach(() => { localStorage.clear(); });
  it("adds up to 4, refuses duplicates and a 5th", () => {
    expect(COMPARE_MAX).toBe(4);
    for (const id of [1, 2, 3, 4]) expect(addToCompare(p(id))).toBe("added");
    expect(addToCompare(p(2))).toBe("duplicate");
    expect(addToCompare(p(5))).toBe("full");
    expect(getCompare().map((x) => x.product_id)).toEqual(["1", "2", "3", "4"]);
  });
  it("refuses invalid products", () => {
    expect(addToCompare({ name: "no id" })).toBe("invalid");
    expect(addToCompare(null)).toBe("invalid");
  });
  it("removes, replaces and clears", () => {
    addToCompare(p(1));
    addToCompare(p(2));
    removeFromCompare(1);
    expect(getCompare().map((x) => x.product_id)).toEqual(["2"]);
    setCompareIds([p(7), p(8), p(9), p(10), p(11)]);
    expect(getCompare()).toHaveLength(4);
    clearCompare();
    expect(getCompare()).toEqual([]);
  });
  it("survives a corrupted store", () => {
    localStorage.setItem("spf.compare", "{not json");
    expect(getCompare()).toEqual([]);
  });
});
