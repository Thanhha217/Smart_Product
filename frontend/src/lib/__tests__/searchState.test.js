import { describe, expect, it } from "vitest";
import { activeFilters, clearFilters, isActiveSearch, parseSearchParams, qualityOf, removeFilter, toApiParams, toSearchParams, updateState } from "../searchState";

describe("parseSearchParams", () => {
  it("reads q and the legacy query", () => {
    expect(parseSearchParams("q=laptop+dell").q).toBe("laptop dell");
    expect(parseSearchParams("query=tai%20nghe").q).toBe("tai nghe");
  });
  it("never keeps the strings null / undefined", () => {
    const s = parseSearchParams("q=null&brand=undefined&category=null");
    expect(s.q).toBe("");
    expect(s.brand).toBe("");
    expect(s.category).toBe("");
    expect(isActiveSearch(s)).toBe(false);
  });
  it("cleans prices, swaps an inverted range, validates sort / page / source", () => {
    const s = parseSearchParams("min_price=20000000&max_price=5000000&sort=bogus&page=-3&co2_source=magic");
    expect(s.min_price).toBe(5000000);
    expect(s.max_price).toBe(20000000);
    expect(s.sort).toBe("relevance");
    expect(s.page).toBe(1);
    expect(s.co2_source).toBe("");
  });
  it("reads booleans", () => {
    const s = parseSearchParams("has_co2=1&has_price=true&include_accessories=0");
    expect(s.has_co2).toBe(true);
    expect(s.has_price).toBe(true);
    expect(s.include_accessories).toBe(false);
  });
});

describe("round trip and updates", () => {
  it("URL -> state -> URL is stable and leaves defaults out", () => {
    const url = "q=laptop&brand=Dell&max_price=20000000&has_co2=1&sort=co2_asc&page=2";
    expect(toSearchParams(parseSearchParams(url)).toString()).toBe(url);
    expect(toSearchParams(parseSearchParams("sort=relevance&page=1")).toString()).toBe("");
  });
  it("changing a filter goes back to page 1, changing the page does not", () => {
    const s = parseSearchParams("q=x&page=3");
    expect(updateState(s, { brand: "Dell" }).page).toBe(1);
    expect(updateState(s, { page: 4 }).page).toBe(4);
  });
  it("chips: list, remove one, clear all (query and sort kept)", () => {
    const s = parseSearchParams("q=x&brand=Dell&min_price=1000&has_co2=1&sort=price_asc");
    expect(activeFilters(s).map((f) => f.key)).toEqual(["brand", "min_price", "has_co2"]);
    expect(removeFilter(s, "brand").brand).toBe("");
    expect(removeFilter(s, "min_price").min_price).toBeNull();
    expect(removeFilter(s, "has_co2").has_co2).toBe(false);
    const c = clearFilters(s);
    expect(activeFilters(c)).toEqual([]);
    expect(c.q).toBe("x");
    expect(c.sort).toBe("price_asc");
  });
  it("api params leave empty values undefined", () => {
    const a = toApiParams(parseSearchParams("q=x"), 24);
    expect(a).toMatchObject({ q: "x", sort: "relevance", page: 1, page_size: 24 });
    expect(a.brand).toBeUndefined();
    expect(a.has_co2).toBeUndefined();
  });
});

describe("qualityOf", () => {
  it("buckets confidence, null when missing", () => {
    expect(qualityOf(0.9)).toBe("high");
    expect(qualityOf(0.5)).toBe("medium");
    expect(qualityOf(0.15)).toBe("low");
    expect(qualityOf(null)).toBeNull();
    expect(qualityOf(undefined)).toBeNull();
  });
});
