// @vitest-environment jsdom
// The zoomable isometric view: the drawing is clickable, picking a zone shows that zone's rows,
// and the level the camera reports changes what the drawing says -- not just how big it is.
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { LanguageProvider } from "../../../../i18n/LanguageContext";
import { teardownOf } from "../../../../lib/teardown";
import IsoMachine, { ISO_W, iso } from "../IsoMachine";
import MachineExplorer from "../MachineExplorer";
import { HOTSPOTS } from "../PhotoMachine";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {},
                              addListener() {}, removeListener() {}, dispatchEvent: () => false });
// jsdom ships neither of these; the camera watches its element and reads its box.
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const data = teardownOf("660");
const rows = (list) => <ul>{list.map((r) => <li key={r.k}>{r.k}: {r.v}</li>)}</ul>;

let container;
let root;
const mount = (ui) => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<LanguageProvider>{ui}</LanguageProvider>));
};
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
afterEach(() => { if (!root) return; act(() => root.unmount()); container.remove(); root = null; });

describe("iso projection", () => {
  it("puts the whole machine inside the drawing area", () => {
    // the eight corners of the laptop's bounding box, 357 × 276 × 250 mm
    const corners = [];
    for (const x of [0, 357]) for (const y of [0, 276]) for (const z of [0, 250]) corners.push(iso(x, y, z));
    for (const [px, py] of corners) {
      expect(px).toBeGreaterThanOrEqual(0);
      expect(px).toBeLessThanOrEqual(ISO_W);
      expect(py).toBeGreaterThanOrEqual(0);
    }
  });

  it("lifts z up the page and spreads x and y apart", () => {
    const [, lowY] = iso(0, 0, 0);
    const [, highY] = iso(0, 0, 100);
    expect(highY).toBeLessThan(lowY);                    // +z goes up
    expect(iso(100, 0, 0)[0]).toBeGreaterThan(iso(0, 0, 0)[0]);   // +x goes right
    expect(iso(0, 100, 0)[0]).toBeLessThan(iso(0, 0, 0)[0]);      // +y goes left
  });
});

describe("MachineExplorer", () => {
  const zone = (part) => container.querySelector(`[data-part="${part}"]`);

  it("draws the two zones a visitor can pick", () => {
    mount(<MachineExplorer data={data} lang="en" renderRows={rows} />);
    expect(zone("screen")).not.toBeNull();
    expect(zone("base")).not.toBeNull();
  });

  it("invites a tap before anything is picked", () => {
    mount(<MachineExplorer data={data} lang="en" renderRows={rows} />);
    expect(container.textContent).toContain("Tap a part");
  });

  it("shows the screen's own rows when the screen is picked", () => {
    mount(<MachineExplorer data={data} lang="en" renderRows={rows} />);
    click(zone("screen"));
    expect(container.textContent).toContain("180 Hz");
    expect(container.textContent).toContain("100 % sRGB");
    expect(container.textContent).not.toContain("i7-14650HX");   // that belongs to the body
  });

  it("shows the processor, memory and battery rows when the body is picked", () => {
    mount(<MachineExplorer data={data} lang="en" renderRows={rows} />);
    click(zone("base"));
    expect(container.textContent).toContain("i7-14650HX");
    expect(container.textContent).toContain("2 × 16 GB DDR5 5600 MHz");
    expect(container.textContent).toContain("90 Wh");
  });

  it("marks the picked zone so the drawing shows what is selected", () => {
    mount(<MachineExplorer data={data} lang="en" renderRows={rows} />);
    expect(zone("screen").getAttribute("data-on")).toBe("0");
    click(zone("screen"));
    expect(zone("screen").getAttribute("data-on")).toBe("1");
    expect(zone("base").getAttribute("data-on")).toBe("0");
  });
});

describe("semantic zoom", () => {
  const head = { screen: '16" · 180 Hz', cpu: "Intel Core i7-14650HX", power: "90 Wh" };
  const labels = { aria: "x", screen: "Screen", board: "Board", body: "Body" };
  const draw = (level) => {
    mount(<IsoMachine level={level} focus={null} head={head} labels={labels} onPick={() => {}} />);
    return container.textContent;
  };

  it("names the zones at level 1 and nothing more", () => {
    const text = draw(1);
    expect(text).toContain("Screen");
    expect(text).not.toContain("180 Hz");
  });

  it("adds each zone's headline figure from level 2", () => {
    const text = draw(2);
    expect(text).toContain("Screen");
    expect(text).toContain("180 Hz");
    expect(text).toContain("90 Wh");
  });
});

// The real photograph the catalogue already stores, with hotspots laid over it. The picture is
// the shop's own shot (product.image_url) -- the same one the cards show, not a new download.
const withPhoto = { product_id: "660", image_url: "https://example.test/acer.jpg" };

describe("the real photo", () => {
  const zone = (part) => container.querySelector(`[data-part="${part}"]`);

  it("is what a product with a photo opens on", () => {
    mount(<MachineExplorer data={data} product={withPhoto} lang="en" renderRows={rows} />);
    const img = container.querySelector("image");
    expect(img).not.toBeNull();
    expect(img.getAttribute("href")).toBe("https://example.test/acer.jpg");
  });

  it("falls back to the drawing when the catalogue has no photo", () => {
    mount(<MachineExplorer data={data} product={{ product_id: "660" }} lang="en" renderRows={rows} />);
    expect(container.querySelector("image")).toBeNull();
    expect(zone("base")).not.toBeNull();        // the drawn machine, with its own zones
  });

  it("splits the photo into display, keyboard deck and chassis", () => {
    mount(<MachineExplorer data={data} product={withPhoto} lang="en" renderRows={rows} />);
    for (const h of HOTSPOTS) expect(zone(h.part), h.part).not.toBeNull();
  });

  it("reads the keyboard deck as the processor and memory", () => {
    mount(<MachineExplorer data={data} product={withPhoto} lang="en" renderRows={rows} />);
    click(zone("deck"));
    expect(container.textContent).toContain("i7-14650HX");
    expect(container.textContent).toContain("2 × 16 GB DDR5 5600 MHz");
    expect(container.textContent).not.toContain("90 Wh");    // the battery belongs to the chassis
  });

  it("reads the chassis as the battery", () => {
    mount(<MachineExplorer data={data} product={withPhoto} lang="en" renderRows={rows} />);
    click(zone("body"));
    expect(container.textContent).toContain("90 Wh");
    expect(container.textContent).not.toContain("i7-14650HX");
  });

  it("keeps every hotspot inside the picture", () => {
    for (const h of HOTSPOTS) {
      const [l, t, r, b] = h.box;
      expect(l, h.part).toBeGreaterThanOrEqual(0);
      expect(t, h.part).toBeGreaterThanOrEqual(0);
      expect(r, h.part).toBeLessThanOrEqual(1);
      expect(b, h.part).toBeLessThanOrEqual(1);
      expect(r, h.part).toBeGreaterThan(l);
      expect(b, h.part).toBeGreaterThan(t);
    }
  });
});

// Labels used to be placed by a fixed offset, so a long one ran off the edge and was clipped.
// Every box now has to land inside the drawing, in every language and at both zoom levels.
describe("labels stay inside the frame", () => {
  const withPhoto = { product_id: "660", image_url: "https://example.test/acer.jpg" };
  const boxes = () => [...container.querySelectorAll("g rect")].map((r) => ({
    x: Number(r.getAttribute("x")), y: Number(r.getAttribute("y")),
    w: Number(r.getAttribute("width")), h: Number(r.getAttribute("height")),
  }));

  for (const lang of ["en", "vi", "fr"]) {
    it(`fits every label in ${lang}`, () => {
      mount(<MachineExplorer data={data} product={withPhoto} lang={lang} renderRows={rows} />);
      const found = boxes();
      expect(found.length).toBeGreaterThan(0);
      for (const b of found) {
        expect(b.x, `${lang} left`).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w, `${lang} right`).toBeLessThanOrEqual(ISO_W);
        expect(b.y, `${lang} top`).toBeGreaterThanOrEqual(0);
      }
    });
  }
});
