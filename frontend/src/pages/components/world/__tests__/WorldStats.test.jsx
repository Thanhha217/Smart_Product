// The five Overview tiles read from the real payload shape of GET /api/products/{id}/co2
// plus the category stats, so a change to either is caught here rather than on the page.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "../../../../i18n/LanguageContext";
import { lifecycle as readLifecycle } from "../../../../lib/co2Formula";
import WorldStats, { GoFurther } from "../WorldStats";

// laptop 3247 as the gateway returns it, trimmed to what the tiles read
const payload = {
  product: { product_id: "3247", name: "Laptop MSI Modern 14 C13M-607VN", category: "laptop",
             co2e_kg: 231.8, co2e_source: "neighbor_average", green_score: 2.6 },
  formula: { method: "neighbor_average", confidence: 0.5 },
  lifecycle: { basis: "typical_share", stages: [
    { key: "materials_production", kg: 173.85, pct: 75.0 },
    { key: "transport", kg: 11.59, pct: 5.0 },
    { key: "use", kg: 44.04, pct: 19.0 },
    { key: "end_of_life", kg: 2.32, pct: 1.0 },
  ] },
  stats: { n: 18162, median_kg: 276.2, min: 113.0, max: 485.0, product_kg: 231.8, greener_than_pct: 80.3 },
};
const STAGES = { materials_production: "Production", transport: "Transport", use: "Use", end_of_life: "End of life" };

const render = (co2) => renderToStaticMarkup(
  <MemoryRouter>
    <LanguageProvider>
      <WorldStats d={co2} lc={readLifecycle(co2.lifecycle)} lang="en" t={(k) => k} stages={STAGES} />
    </LanguageProvider>
  </MemoryRouter>,
);

describe("WorldStats", () => {
  it("shows the figure, the gap to the median, the score, the heaviest stage and the confidence", () => {
    const html = render(payload);
    expect(html).toContain("231.8");                 // whole-life CO2
    expect(html).toContain("−16%");                  // (231.8 - 276.2) / 276.2
    expect(html).toContain("276.2 kg");              // the median it is compared against
    expect(html).toContain("2.6");                   // green score
    expect(html).toContain("Production");            // biggest source: 75 % of the total
    expect(html).toContain("75% of the total");
    expect(html).toContain("50%");                   // confidence
    expect(html).not.toContain("Lowest of");         // it is not the lowest of its category
  });

  it("calls out a product that is the lowest of its whole category", () => {
    const html = render({ ...payload, product: { ...payload.product, co2e_kg: 113 },
                          stats: { ...payload.stats, product_kg: 113 } });
    expect(html).toContain("Lowest of 18,162");
    expect(html).toContain("−59%");
  });

  it("leaves a tile empty rather than inventing a number", () => {
    const html = render({ product: { product_id: "9" }, formula: {}, lifecycle: null, stats: null });
    expect(html).toContain("No figure");
    expect(html).toContain("Nothing to compare with");
  });
});

describe("GoFurther", () => {
  it("links to the book, the method, the catalogue and the assistant", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter><LanguageProvider><GoFurther productId="3247" lang="en" listed={55393} /></LanguageProvider></MemoryRouter>,
    );
    expect(html).toContain('href="/story/3247"');
    expect(html).toContain('href="/method?product=3247"');
    expect(html).toContain("55,393 products from Vietnamese stores");
    expect(html).toContain('href="/assistant"');
  });
});
