// @vitest-environment jsdom
// The six pages of "Inside the machine", built from the real demo data.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "../../../../i18n/LanguageContext";
import { teardownOf } from "../../../../lib/teardown";
import { buildPages } from "../TeardownBook";

const product = { product_id: "640", name: "Laptop Asus TUF Gaming A15 FA506NCG-HN329W",
                  price_vnd: 30990000, co2e_kg: 358.5, category: "laptop" };

const page = (i, id = "640", prod = product, lang = "en") => renderToStaticMarkup(
  <MemoryRouter><LanguageProvider>{buildPages({ product: prod, data: teardownOf(id), lang })[i]}</LanguageProvider></MemoryRouter>,
);

describe("buildPages", () => {
  it("makes exactly six pages", () => {
    expect(buildPages({ product, data: teardownOf("640"), lang: "en" })).toHaveLength(6);
  });

  it("opens on a cover with the machine, its price and its whole-life CO₂", () => {
    const html = page(0);
    expect(html).toContain("Asus");
    expect(html).toContain("TUF Gaming A15 FA506NCG-HN329W");
    expect(html).toContain("358.5 kg CO₂e");
  });

  it("puts the screen, the processor, the memory and the battery on their own pages", () => {
    expect(page(1)).toContain("144 Hz, Adaptive-Sync");
    expect(page(2)).toContain("AMD Ryzen 7 8845HS");
    expect(page(2)).toContain("GeForce RTX 3050 4 GB GDDR6");
    expect(page(3)).toContain("512 GB SSD M.2 NVMe");
    expect(page(4)).toContain("48 Wh");
    expect(page(4)).toContain("2,30 kg");
  });

  it("says in words when a figure is only published for the model family", () => {
    expect(page(4)).not.toContain("model family");          // ASUS 48 Wh is exact for this SKU
    expect(page(4, "718", { ...product, product_id: "718" })).toContain("model family");  // HP 68 Wh is not
  });

  it("translates the coded values rather than printing the code", () => {
    const hp = page(3, "718", { ...product, product_id: "718" });
    expect(hp).toContain("Soldered, not upgradeable");
    expect(hp).not.toContain("soldered<");
  });

  it("ends on the sources, and says plainly why there is no CO₂ per part", () => {
    const html = page(5);
    expect(html).toContain("asus.com");
    expect(html).toContain("phongvu.vn");
    expect(html).toContain("no manufacturer publishes such a number");
  });

  it("speaks Vietnamese and French too", () => {
    expect(page(1, "640", product, "vi")).toContain("Tần số quét");
    expect(page(1, "640", product, "fr")).toContain("Fréquence");
  });
});
