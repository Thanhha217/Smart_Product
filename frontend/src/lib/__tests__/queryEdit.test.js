import { describe, expect, it } from "vitest";
import { fold, foldKeep, removeFromQuery } from "../queryEdit";

describe("fold", () => {
  it("removes accents and đ, keeps indices aligned", () => {
    expect(fold("Điều hòa  Tiết kiệm")).toBe("dieu hoa tiet kiem");
    const raw = "Laptop Dell dưới 20 triệu";
    expect(foldKeep(raw)).toHaveLength(raw.length);
  });
});

describe("removeFromQuery", () => {
  it("removes a brand, keeping the rest as typed", () => {
    expect(removeFromQuery("Laptop Dell dưới 20 triệu", "brand", "Dell")).toBe("Laptop dưới 20 triệu");
  });
  it("removes a budget in Vietnamese, English and French", () => {
    expect(removeFromQuery("Laptop Dell dưới 20 triệu", "max_price", 20000000)).toBe("Laptop Dell");
    expect(removeFromQuery("laptop under 20m", "max_price", 20000000)).toBe("laptop");
    expect(removeFromQuery("casque moins de 2 millions", "max_price", 2000000)).toBe("casque");
    expect(removeFromQuery("phone over 5 triệu", "min_price", 5000000)).toBe("phone");
  });
  it("removes a category word", () => {
    expect(removeFromQuery("Laptop Dell dưới 20 triệu", "category", "laptops")).toBe("Dell dưới 20 triệu");
    expect(removeFromQuery("tai nghe sony", "category", "headphones")).toBe("sony");
  });
  it("matches whole words only and leaves the query unchanged when nothing matches", () => {
    expect(removeFromQuery("dellphone x", "brand", "dell")).toBe("dellphone x");
    expect(removeFromQuery("xyzabc", "brand", "Dell")).toBe("xyzabc");
    expect(removeFromQuery("", "term", "x")).toBe("");
  });
});
