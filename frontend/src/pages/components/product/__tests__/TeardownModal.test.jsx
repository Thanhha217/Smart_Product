// @vitest-environment jsdom
// The pop-up itself: it only exists for the demo machines, it closes the way a dialog should,
// and it gives the page back its scroll and its focus when it goes.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "../../../../i18n/LanguageContext";
import { teardownOf } from "../../../../lib/teardown";
import TeardownModal from "../TeardownModal";
import FindCard from "../../find/FindCard";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// jsdom ships no matchMedia; Flipbook asks it whether there is room for a two-page spread.
let WIDE = false;   // Flipbook lays out two pages when there is room, one when there is not
window.matchMedia = (query) => ({
  matches: WIDE, media: query, onchange: null,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  dispatchEvent: () => false,
});

const asus = { product_id: "640", name: "Laptop Asus TUF Gaming A15 FA506NCG-HN329W",
               price_vnd: 30990000, co2e_kg: 358.5, co2e_source: "neighbor_average", category: "laptop" };
const plain = { ...asus, product_id: "99999", name: "Laptop Nobody Knows 15" };

let container;
let root;
const mount = (ui) => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<MemoryRouter><LanguageProvider>{ui}</LanguageProvider></MemoryRouter>));
};
const press = (key) => act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); });
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });

afterEach(() => { act(() => root.unmount()); container.remove(); document.body.style.overflow = ""; });

describe("TeardownModal", () => {
  it("closes on Escape", () => {
    const onClose = vi.fn();
    mount(<TeardownModal product={asus} data={teardownOf("640")} lang="en" onClose={onClose} />);
    press("Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the backdrop is clicked", () => {
    const onClose = vi.fn();
    mount(<TeardownModal product={asus} data={teardownOf("640")} lang="en" onClose={onClose} />);
    click(container.querySelector('button[aria-label="Close"]'));
    expect(onClose).toHaveBeenCalled();
  });

  it("holds the page still while it is open and lets it go afterwards", () => {
    mount(<TeardownModal product={asus} data={teardownOf("640")} lang="en" onClose={() => {}} />);
    expect(document.body.style.overflow).toBe("hidden");
    act(() => root.unmount());
    expect(document.body.style.overflow).not.toBe("hidden");
    // keep afterEach happy: remount something trivial to unmount again
    mount(<span />);
  });

  it("names itself for a screen reader", () => {
    mount(<TeardownModal product={asus} data={teardownOf("640")} lang="en" onClose={() => {}} />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toContain("TUF Gaming A15");
  });
});

describe("the button on a Find products card", () => {
  const openers = () => [...container.querySelectorAll("button")]
    .filter((b) => (b.getAttribute("aria-label") || "") === "Inside the machine");

  it("appears on a machine that has a teardown", () => {
    mount(<FindCard product={asus} />);
    expect(openers()).toHaveLength(1);
  });

  it("stays away from every other product", () => {
    mount(<FindCard product={plain} />);
    expect(openers()).toHaveLength(0);
  });

  it("opens the book on click", () => {
    mount(<FindCard product={asus} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    click(openers()[0]);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).toContain("FA506NCG-HN329W");
  });
});

// The first build put the book inside a flex column, where Flipbook's own `mx-auto` root beat
// `stretch` and collapsed to its spine -- on screens wide enough for a two-page spread only.
// jsdom does no layout, so it cannot measure the collapse; what it can do is walk the two-page
// branch at all, which the single-page stub never did.
describe("the two-page spread", () => {
  afterEach(() => { WIDE = false; });

  it("renders both pages of a spread without crashing", () => {
    WIDE = true;
    mount(<TeardownModal product={asus} data={teardownOf("640")} lang="en" onClose={() => {}} />);
    expect(container.textContent).toContain("Inside the machine");
    expect(container.textContent).toContain("The screen");          // page 2, beside the cover
    expect(container.textContent).toContain("144 Hz, Adaptive-Sync");
  });

  it("keeps the book in normal block flow, never as a flex child", () => {
    WIDE = true;
    mount(<TeardownModal product={asus} data={teardownOf("640")} lang="en" onClose={() => {}} />);
    const spine = container.querySelector('[class*="mx-auto"][class*="rounded-"]');
    expect(spine, "Flipbook root not found").not.toBeNull();
    // split on whitespace, not a regex: an escaped  once became a literal
    // backspace here and the assertion silently matched nothing.
    expect(spine.parentElement.className.split(" ")).not.toContain("flex");
  });
});

// Flipbook renders a SPREAD on a wide screen and rounds the index down to an even number, so
// controls that stepped by one left the same two pages on screen -- it read as "page 1 and 2
// are identical". The counter has to name the spread, and the buttons have to move by it.
describe("paging a two-page spread", () => {
  afterEach(() => { WIDE = false; });
  const next = () => [...container.querySelectorAll("button")]
    .find((b) => b.getAttribute("aria-label") === "Next page");
  const counter = () => container.querySelector('[aria-live="polite"]').textContent.trim();

  it("names the pair on screen, not a single page", () => {
    WIDE = true;
    mount(<TeardownModal product={asus} data={teardownOf("640")} lang="en" onClose={() => {}} />);
    expect(counter()).toBe("1–2 / 6");
  });

  it("moves two pages at a time, so every click changes what is on screen", () => {
    WIDE = true;
    mount(<TeardownModal product={asus} data={teardownOf("640")} lang="en" onClose={() => {}} />);
    click(next());
    expect(counter()).toBe("3–4 / 6");
    click(next());
    expect(counter()).toBe("5–6 / 6");
    expect(next().disabled).toBe(true);
  });

  it("still counts single pages on a narrow screen", () => {
    mount(<TeardownModal product={asus} data={teardownOf("640")} lang="en" onClose={() => {}} />);
    expect(counter()).toBe("1 / 6");
    click(next());
    expect(counter()).toBe("2 / 6");
  });
});
