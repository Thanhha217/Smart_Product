import { describe, expect, it } from "vitest";
import { fold, matchTypes, splitMatch } from "./deviceMatch";

describe("fold", () => {
  it("drops accents and case", () => {
    expect(fold("Điện Thoại  ")).toBe("dien thoai");
    expect(fold("Máy tính bảng")).toBe("may tinh bang");
  });
});

describe("matchTypes", () => {
  it.each([
    ["lap", ["laptops"]],
    ["mac", ["laptops"]],
    ["macbook air 13", ["laptops"]],
    ["dien", ["smartphones"]],
    ["điện thoại", ["smartphones"]],
    ["tai", ["headphones"]],
    ["man hinh", ["monitors"]],
    ["ipad", ["tablets"]],
  ])("%s -> %j first", (text, first) => {
    expect(matchTypes(text).slice(0, first.length)).toEqual(first);
  });

  it("returns nothing for empty or unrelated text", () => {
    expect(matchTypes("")).toEqual([]);
    expect(matchTypes("zzzz")).toEqual([]);
  });

  it("can point to more than one type", () => {
    expect(matchTypes("galaxy")).toEqual(expect.arrayContaining(["smartphones", "tablets", "smartwatches"]));
  });
});

describe("splitMatch", () => {
  it("highlights ignoring accents and case", () => {
    expect(splitMatch("Điện thoại Samsung", "dien")).toEqual(["", "Điện", " thoại Samsung"]);
    expect(splitMatch("MacBook Air 13", "air")).toEqual(["MacBook ", "Air", " 13"]);
    expect(splitMatch("MacBook", "zz")).toBeNull();
  });
});
