// "Inside the machine": what each of five demo laptops is actually made of.
//
// DEMO DATA, five products only. Every line was looked up on 24 Nov 2026 and is quoted from the
// source listed under `sources`; nothing here is generated or guessed. A field carrying
// `approx: true` was published for the model FAMILY, not for this exact SKU -- the book prints a
// "theo dòng máy" note next to it so a reader is never told more certainty than the source gives.
//
// Deliberately NOT here: a CO2 figure per component. No manufacturer publishes one, and the
// project's own lifecycle split (green/lifecycle.py) stops at the four stages. Inventing a
// per-part number would be an estimate of an estimate of an estimate -- see docs/co2-setup.md.
//
// The product ids are rows of the demo database (dump of 03 Aug 2026); they are the five laptops
// that have a real photo, a price and a CO2 figure, one per brand.

const PV = "Phong Vũ";

export const TEARDOWN = {
  // ---------------------------------------------------------------- HP
  718: {
    brand: "HP",
    model: "OmniBook 7 14-fs0042TU (C1MP3PA)",
    screen: [
      { k: "size", v: '14"' },
      { k: "panel", v: "IPS" },
      { k: "resolution", v: "1920 × 1200 (WUXGA)" },
      { k: "gamut", v: "62,5 % sRGB" },
      { k: "touch", v: "no" },
    ],
    cpu: [
      { k: "model", v: "Intel Core 5 210H" },
      { k: "cores", v: "8 / 12" },
      { k: "clock", v: "2,2 – 4,8 GHz" },
      { k: "cache", v: "12 MB" },
    ],
    memory: [
      { k: "ram", v: "24 GB LPDDR5 5200 MHz" },
      { k: "upgrade", v: "soldered" },
      { k: "storage", v: "512 GB SSD M.2 NVMe" },
    ],
    power: [
      { k: "battery", v: "68 Wh · 4 cell Li-ion polymer", approx: true },
      { k: "weight", v: "từ 1,41 kg", approx: true },
      { k: "os", v: "Windows 11 Home + Office 2024 + Microsoft 365 Basic 1 năm" },
    ],
    sources: [
      { label: `${PV} — trang sản phẩm`, url: "https://phongvu.vn/laptop-hp-omnibook-7-14-fs0042tu-c1mp3pa--s260407627" },
      { label: "HP — thông số dòng OmniBook 7 14-fs0000", url: "https://support.hp.com/ca-en/document/ish_12298654-12298698-16" },
    ],
  },

  // ---------------------------------------------------------------- Dell
  823: {
    brand: "Dell",
    model: "Pro 14 Essential PV14250 (PV14250-120U-16512W)",
    screen: [
      { k: "size", v: '14"' },
      { k: "panel", v: "IPS" },
      { k: "resolution", v: "1920 × 1200 (WUXGA)" },
      { k: "refresh", v: "60 Hz" },
      { k: "touch", v: "no" },
    ],
    cpu: [
      { k: "model", v: "Intel Core 5 120U" },
      { k: "cores", v: "10 / 12" },
      { k: "clock", v: "1,4 – 5,0 GHz" },
      { k: "cache", v: "12 MB" },
    ],
    memory: [
      { k: "ram", v: "1 × 16 GB DDR5 5200 MHz" },
      { k: "upgrade", v: "max32" },
      { k: "storage", v: "512 GB SSD M.2 NVMe" },
    ],
    power: [
      { k: "battery", v: "54 Wh · 4 cell (bản 3 cell: 41 Wh)", approx: true },
      { k: "weight", v: "1,65 kg vỏ nhôm · 1,69 kg vỏ nhựa", approx: true },
      { k: "chassis", v: "PC+ABS, hoặc PC+ABS kết hợp nhôm", approx: true },
      { k: "size_mm", v: "314 × 226 mm", approx: true },
      { k: "os", v: "Windows 11 Home SL" },
    ],
    sources: [
      { label: `${PV} — trang sản phẩm`, url: "https://phongvu.vn/laptop-dell-pro-14-essential-pv14250-pv14250-120u-16512w--s260507152" },
      { label: "Dell — Owner's Manual PV14250, mục Dimensions and weight", url: "https://www.dell.com/support/manuals/en-us/dell-pro-pv14250-laptop/dell-pro-pv14250-laptop_om/dimensions-and-weight" },
    ],
  },

  // ---------------------------------------------------------------- Lenovo
  287: {
    brand: "Lenovo",
    model: "IdeaPad Slim 5 14AGP11 (83S1003GVN)",
    screen: [
      { k: "size", v: '14"' },
      { k: "panel", v: "OLED" },
      { k: "resolution", v: "1920 × 1200 (WUXGA)" },
      { k: "refresh", v: "60 Hz" },
      { k: "gamut", v: "100 % DCI-P3" },
      { k: "touch", v: "no" },
    ],
    cpu: [
      { k: "model", v: "AMD Ryzen AI 7 445" },
      { k: "cores", v: "6 / 12" },
      { k: "clock", v: "2,0 – 4,6 GHz" },
      { k: "cache", v: "8 MB" },
      { k: "npu", v: "AMD XDNA, tới 50 TOPS" },
    ],
    memory: [
      { k: "ram", v: "2 × 16 GB DDR5 5600 MHz" },
      { k: "upgrade", v: "max32" },
      { k: "storage", v: "1 TB SSD M.2 NVMe" },
    ],
    power: [
      { k: "battery", v: "50 Wh hoặc 60 Wh tuỳ cấu hình", approx: true },
      { k: "weight", v: "bản OLED từ 1,34 – 1,37 kg", approx: true },
      { k: "chassis", v: "Nhôm (nắp và đáy)", approx: true },
      { k: "os", v: "Windows 11 Home SL" },
    ],
    sources: [
      { label: `${PV} — trang sản phẩm`, url: "https://phongvu.vn/laptop-lenovo-ideapad-slim-5-14agp11-83s1003gvn--s260404927" },
      { label: "Lenovo PSREF — IdeaPad Slim 5 14AGP11", url: "https://psref.lenovo.com/Product/IdeaPad/IdeaPad_Slim_5_14AGP11" },
    ],
  },

  // ---------------------------------------------------------------- Asus
  640: {
    brand: "Asus",
    model: "TUF Gaming A15 FA506NCG-HN329W",
    screen: [
      { k: "size", v: '15,6"' },
      { k: "panel", v: "IPS" },
      { k: "resolution", v: "1920 × 1080 (Full HD)" },
      { k: "refresh", v: "144 Hz, Adaptive-Sync" },
      { k: "gamut", v: "62,5 % sRGB" },
      { k: "touch", v: "no" },
    ],
    cpu: [
      { k: "model", v: "AMD Ryzen 7 8845HS" },
      { k: "cores", v: "8 / 16" },
      { k: "clock", v: "3,8 – 5,1 GHz" },
      { k: "cache", v: "16 MB" },
      { k: "gpu", v: "GeForce RTX 3050 4 GB GDDR6" },
      { k: "npu", v: "AMD XDNA 16 TOPS (tổng 142 AI TOPS)" },
    ],
    memory: [
      { k: "ram", v: "1 × 16 GB DDR5 5600 MHz" },
      { k: "upgrade", v: "max64" },
      { k: "storage", v: "512 GB SSD M.2 NVMe" },
    ],
    power: [
      { k: "battery", v: "48 Wh" },
      { k: "weight", v: "2,30 kg" },
      { k: "os", v: "Windows 11 Home" },
    ],
    sources: [
      { label: `${PV} — trang sản phẩm`, url: "https://phongvu.vn/laptop-asus-tuf-gaming-a15-fa506ncg-hn329w--s260407198" },
      { label: "ASUS — TUF Gaming A15 tech spec", url: "https://www.asus.com/us/laptops/for-gaming/tuf-gaming/asus-tuf-gaming-a15/techspec/" },
    ],
  },

  // ---------------------------------------------------------------- Acer
  660: {
    brand: "Acer",
    model: "Predator Helios Neo 16 PHN16-I31-74MN",
    screen: [
      { k: "size", v: '16"' },
      { k: "panel", v: "IPS, Acer ComfyView" },
      { k: "resolution", v: "1920 × 1200 (WUXGA)" },
      { k: "refresh", v: "180 Hz" },
      { k: "gamut", v: "100 % sRGB" },
      { k: "touch", v: "no" },
    ],
    cpu: [
      { k: "model", v: "Intel Core i7-14650HX" },
      { k: "cores", v: "16 / 24" },
      { k: "clock", v: "2,2 – 5,2 GHz" },
      { k: "cache", v: "30 MB" },
      { k: "gpu", v: "GeForce RTX 5050 8 GB GDDR7, 440 AI TOPS" },
    ],
    memory: [
      { k: "ram", v: "2 × 16 GB DDR5 5600 MHz" },
      { k: "upgrade", v: "max96" },
      { k: "storage", v: "512 GB SSD M.2 NVMe" },
    ],
    power: [
      { k: "battery", v: "90 Wh", approx: true },
      { k: "weight", v: "khoảng 2,5 kg", approx: true },
      { k: "os", v: "Windows 11 Home SL" },
    ],
    sources: [
      { label: `${PV} — trang sản phẩm`, url: "https://phongvu.vn/laptop-acer-predator-helios-neo-phn16-i31-74mn--s260407211" },
      { label: "Acer Store — Predator Helios Neo 16 PHN16-I31", url: "https://store.acer.com/en-in/acer-predator-helios-neo-16-gaming-laptop-intel-core-i7-14650hx-windows-11-home-ms-office-nvidia-geforce-rtx-5070-with-12gb-gddr7-vram-16gb-ram-1tb-ssd-16-inch-40-64-cm-180hz-display-rgb-backlit-keyboard-abyssal-black-phn16-i31-2-5-kg" },
    ],
  },
};

/** The teardown of one product, or null when it is not one of the five demo machines. */
export function teardownOf(productId) {
  return TEARDOWN[String(productId)] || null;
}

export function hasTeardown(productId) {
  return Boolean(TEARDOWN[String(productId)]);
}
