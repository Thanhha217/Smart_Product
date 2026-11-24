// Where a product card opens. The default is the product page; the CO2 world's picker
// overrides it so choosing a product lands straight on that product's Overview.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "../../../../i18n/LanguageContext";
import ProductCard from "../ProductCard";

const product = {
  product_id: "3247", name: "Laptop MSI Modern 14 C13M-607VN", platform: "CellPhones",
  price_vnd: 14490000, co2e_kg: 231.8, co2e_source: "neighbor_average", green_score: 2.6, category: "laptop",
};

const render = (props) => renderToStaticMarkup(
  <MemoryRouter><LanguageProvider><ProductCard product={product} {...props} /></LanguageProvider></MemoryRouter>,
);

describe("ProductCard", () => {
  it("opens the product page by default", () => {
    const html = render({});
    expect(html).toContain('href="/product/3247"');
    expect(html).not.toContain('href="/world/3247"');
  });

  it("opens wherever `to` points, so the world's picker returns to the Overview", () => {
    const html = render({ to: "/world/3247" });
    expect(html).toContain('href="/world/3247"');
    expect(html).not.toContain('href="/product/3247"');
  });
});
