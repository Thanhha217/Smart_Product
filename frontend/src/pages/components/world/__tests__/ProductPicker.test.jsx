// @vitest-environment jsdom
// The "Change product" picker searches in place. This drives the real component in jsdom:
// open it, type, let the debounce fire, and check it asked the API the right question and
// offered the answer without leaving the page.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "../../../../i18n/LanguageContext";

// React needs this before act() drives a real root in jsdom
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const search = vi.fn();
vi.mock("../../../../api/client", () => ({ api: { search: (...a) => search(...a) }, MOCK_API: false }));

const { default: ProductPicker } = await import("../ProductPicker");

let container;
let root;

const mount = (ui) => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(ui));
};

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });

const type = (input, value) => act(() => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
});

beforeEach(() => {
  search.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("ProductPicker", () => {
  it("searches in place and offers what it found", async () => {
    search.mockResolvedValue({ items: [
      { product_id: "7081", name: "Laptop Dell Inspiron 15 3520", platform: "CellPhones", co2e_kg: 375.2 },
      { product_id: "929", name: "Laptop Dell Inspiron 15 3520 6R6NK", platform: "CellPhones", co2e_kg: 375.2 },
    ] });
    mount(<MemoryRouter><LanguageProvider><ProductPicker lang="en" currentId="3247" /></LanguageProvider></MemoryRouter>);

    click(container.querySelector("button"));
    const input = container.querySelector("input");
    expect(input).toBeTruthy();

    type(input, "dell");
    await act(async () => { vi.advanceTimersByTime(350); });

    expect(search).toHaveBeenCalledTimes(1);
    const [params] = search.mock.calls[0];
    expect(params.q).toBe("dell");
    expect(params.has_co2).toBe(true);        // the Overview cannot draw a world without a figure
    expect(container.textContent).toContain("Laptop Dell Inspiron 15 3520");
    expect(container.textContent).toContain("375.2 kg");
  });

  it("waits for a pause in typing instead of asking on every letter", async () => {
    search.mockResolvedValue({ items: [] });
    mount(<MemoryRouter><LanguageProvider><ProductPicker lang="en" currentId="1" /></LanguageProvider></MemoryRouter>);
    click(container.querySelector("button"));
    const input = container.querySelector("input");

    type(input, "de");
    await act(async () => { vi.advanceTimersByTime(100); });
    type(input, "del");
    await act(async () => { vi.advanceTimersByTime(100); });
    type(input, "dell");
    await act(async () => { vi.advanceTimersByTime(350); });

    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0][0].q).toBe("dell");
  });

  it("asks nothing for a single letter", async () => {
    mount(<MemoryRouter><LanguageProvider><ProductPicker lang="en" currentId="1" /></LanguageProvider></MemoryRouter>);
    click(container.querySelector("button"));
    type(container.querySelector("input"), "d");
    await act(async () => { vi.advanceTimersByTime(600); });
    expect(search).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Type at least 2 letters");
  });

  it("never offers the product already open", async () => {
    search.mockResolvedValue({ items: [
      { product_id: "3247", name: "The one already shown", co2e_kg: 231.8 },
      { product_id: "7081", name: "A different laptop", co2e_kg: 375.2 },
    ] });
    mount(<MemoryRouter><LanguageProvider><ProductPicker lang="en" currentId="3247" /></LanguageProvider></MemoryRouter>);
    click(container.querySelector("button"));
    type(container.querySelector("input"), "laptop");
    await act(async () => { vi.advanceTimersByTime(350); });

    expect(container.textContent).toContain("A different laptop");
    expect(container.textContent).not.toContain("The one already shown");
  });
});
