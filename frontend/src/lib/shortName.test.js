import { describe, expect, it } from "vitest";
import { shortName, variantOf } from "./shortName";

describe("shortName", () => {
  it.each([
    ["Laptop Macbook Air 13 inch M5 24GB/512GB 70W", "MacBook Air 13"],
    ["Laptop MacBook Air 15 inch M5 24GB/512GB 70W", "MacBook Air 15"],
    ["Laptop MSI Modern 14 B11MOU-1027VN - Đã kích hoạt", "MSI Modern 14"],
    ["Máy tính bảng Lenovo Idea Tab 5G 11 inch 8GB/256GB (Xám)", "Lenovo Idea Tab"],
    ["Màn hình AOC 27B36XE 27 inch", "AOC 27B36XE"],
    ["Điện thoại Samsung Galaxy A17 4GB/128GB", "Samsung Galaxy A17"],
    ["Màn hình Gaming MSI PRO MP275Q-E14 (27 inch, WQHD, IPS, 144Hz, 4ms)", "MSI PRO MP275Q-E14"],
    ["Tai nghe Bluetooth True Wireless Rezo K50", "Rezo K50"],
  ])("%s -> %s", (full, short) => {
    expect(shortName(full)).toBe(short);
  });

  it("keeps something readable when nothing is left", () => {
    expect(shortName("Laptop")).toBe("Laptop");
    expect(shortName("")).toBe("");
  });
});

describe("shortName edge cases from the catalogue", () => {
  it.each([
    ["Màn hình di động Asus ZenScreen MB166CR 15.6 inch - Cũ Đẹp", "Asus ZenScreen MB166CR"],
    ["Màn hình Acer SA272U G0 UM.HS2SV.001 27 inch (2K/ IPS/ 120Hz/ 1ms (MPRT)", "Acer SA272U G0"],
    ["Apple Watch Ultra 3 GPS + Cellular 49mm viền Titanium dây Milan", "Apple Watch Ultra 3"],
  ])("%s -> %s", (full, short) => {
    expect(shortName(full)).toBe(short);
  });
});

describe("variantOf", () => {
  it.each([
    ["Điện thoại Samsung Galaxy A18 8GB/128GB", "8GB/128GB"],
    ["Laptop HP EliteBook 6 G1i 13 - BQ9L8PT (Ultra 5 225U, 16GB, 512GB, WUXGA)", "Ultra 5 225U, 16GB"],
    ["Apple Watch Series 11 GPS 5G 46mm Vỏ Titanium", "46mm"],
    ["Màn hình AOC 27B1H 27 inch", ""],
    ["Laptop MacBook Air 13 inch M4 24GB/512GB", "M4 · 24GB/512GB"],
    ["Laptop Macbook Air 13 inch M5 24GB/512GB 70W", "M5 · 24GB/512GB"],
  ])("%s -> %s", (full, v) => {
    expect(variantOf(full)).toBe(v);
  });
});
