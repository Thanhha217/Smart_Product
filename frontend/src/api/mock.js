import { tri } from "../i18n/LanguageContext";
// Demo fixtures served when VITE_MOCK_API=1 (no backend needed).
// Shapes follow docs/demo/api-contract.md. Figures reuse the worked examples of the
// CO2 method document; green scores use the db-search category bounds.

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const clone = (x) => JSON.parse(JSON.stringify(x));

function greenScore(kg, [low, high]) {
  if (kg == null || kg <= 0) return null;
  const s = (5 * Math.log(high / kg)) / Math.log(high / low);
  return Math.round(Math.min(5, Math.max(0, s)) * 10) / 10;
}
const BOUNDS = { laptop: [60, 1000], computer_monitor: [50, 2000], air_conditioner: [1400, 25000] };

const IMG = (label) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='200'><rect width='100%' height='100%' fill='#E7ECEF'/><text x='50%' y='50%' font-family='sans-serif' font-size='22' fill='#1B5B7E' text-anchor='middle' dominant-baseline='middle'>${label}</text></svg>`
  )}`;

function card(p) {
  return { ...p, green_score: greenScore(p.co2e_kg, BOUNDS[p.category]) };
}

const PRODUCTS = {
  101: card({
    product_id: "101", name: "Apple MacBook Air 13 inch M2 8GB/256GB", price_vnd: 18990000, platform: "FPT Shop",
    image_url: IMG("MacBook Air M2"), product_url: "https://fptshop.com.vn/", category: "laptop",
    co2e_kg: 147, co2e_source: "manufacturer", co2e_confidence: 0.9, rating: 4.8, review_count: 312,
  }),
  102: card({
    product_id: "102", name: "Laptop Acer Aspire 5 A515 i5 15,6 inch", price_vnd: 14490000, platform: "Thế Giới Di Động",
    image_url: IMG("Acer Aspire 5"), product_url: "https://www.thegioididong.com/", category: "laptop",
    co2e_kg: 270, co2e_source: "category_model", co2e_confidence: 0.35, rating: 4.5, review_count: 87,
  }),
  103: card({
    product_id: "103", name: "Laptop Dell Latitude 5450 i5 14 inch", price_vnd: 19490000, platform: "Phong Vũ",
    image_url: IMG("Dell Latitude 5450"), product_url: "https://phongvu.vn/", category: "laptop",
    co2e_kg: 332.6, co2e_source: "neighbor_average", co2e_confidence: 0.5, rating: 4.6, review_count: 41,
  }),
  201: card({
    product_id: "201", name: "Màn hình Samsung Odyssey G5 27 inch 2K 165Hz", price_vnd: 6490000, platform: "CellphoneS",
    image_url: IMG("Samsung Odyssey G5"), product_url: "https://cellphones.com.vn/", category: "computer_monitor",
    co2e_kg: 544, co2e_source: "category_model", co2e_confidence: 0.35, rating: 4.7, review_count: 150,
  }),
  202: card({
    product_id: "202", name: "Màn hình Dell P2424H 23,8 inch IPS", price_vnd: 4290000, platform: "Phong Vũ",
    image_url: IMG("Dell P2424H"), product_url: "https://phongvu.vn/", category: "computer_monitor",
    co2e_kg: 410, co2e_source: "neighbor_average", co2e_confidence: 0.5, rating: 4.6, review_count: 64,
  }),
  301: card({
    product_id: "301", name: "Máy lạnh Daikin Inverter 1,5 HP FTKB35 (820 kWh/năm)", price_vnd: 11490000, platform: "Điện Máy Xanh",
    image_url: IMG("Daikin Inverter 1.5HP"), product_url: "https://www.dienmayxanh.com/", category: "air_conditioner",
    co2e_kg: 6297.2, co2e_source: "lifecycle_formula", co2e_confidence: 0.35, rating: 4.7, review_count: 520,
  }),
};

const REFERENCES = {
  101: [{ name: "Apple MacBook Air 13-inch M2, 256GB SSD", co2e_kg: 147, cosine: 1.0 }],
  103: [
    { name: "Dell Latitude 5440", co2e_kg: 290, cosine: 0.83 },
    { name: "Dell Latitude 5430", co2e_kg: 321, cosine: 0.81 },
    { name: "Dell Latitude 5420", co2e_kg: 312, cosine: 0.8 },
    { name: "Dell Latitude 5530", co2e_kg: 349, cosine: 0.74 },
    { name: "Dell Latitude 5540", co2e_kg: 391, cosine: 0.71 },
  ],
  202: [
    { name: "Dell P2423D", co2e_kg: 395, cosine: 0.78 },
    { name: "Dell P2422H", co2e_kg: 425, cosine: 0.76 },
  ],
};

const FORMULAS = {
  101: {
    method: "manufacturer", title_vi: "Số của hãng (trùng đúng mẫu)", title_en: "Manufacturer figure (exact model)",
    expression: "CO₂ = số hãng công bố cho đúng mẫu",
    steps: [{ label_vi: "Báo cáo môi trường Apple MacBook Air M2 (06/2022)", label_en: "Apple MacBook Air M2 environmental report (06/2022)", expr: "147 kg", value_kg: 147 }],
    result_kg: 147, confidence: 0.9, complete: true,
  },
  102: {
    method: "category_model", title_vi: "Mức giữa của loại", title_en: "Category model",
    expression: "CO₂ = trung vị hãng × (inch ÷ 14)^0,53",
    steps: [
      { label_vi: "Trung vị 25 laptop Acer", label_en: "Median of 25 Acer laptops", expr: "255 kg", value_kg: 255 },
      { label_vi: "Hệ số cỡ màn hình", label_en: "Screen-size factor", expr: "(15,6 ÷ 14)^0,53 = 1,059", value_kg: null },
      { label_vi: "Kết quả", label_en: "Result", expr: "255 × 1,059 = 270 kg", value_kg: 270 },
    ],
    result_kg: 270, confidence: 0.35, complete: true,
  },
  103: {
    method: "neighbor_average", title_vi: "Trung bình mẫu giống", title_en: "Average of similar products",
    expression: "CO₂ = trung bình các mẫu có cosine ≥ 0,66",
    steps: [
      { label_vi: "5 mẫu Dell Latitude giống nhất", label_en: "5 most similar Dell Latitude models", expr: "290 + 321 + 312 + 349 + 391 = 1.663 kg", value_kg: 1663 },
      { label_vi: "Lọc bất thường (trung vị 321 → giữ 40,1–2.568 kg)", label_en: "Outlier filter (median 321 → keep 40.1–2,568 kg)", expr: "giữ 5/5", value_kg: null },
      { label_vi: "Trung bình", label_en: "Average", expr: "1.663 ÷ 5 = 332,6 kg", value_kg: 332.6 },
    ],
    result_kg: 332.6, confidence: 0.5, complete: true,
  },
  201: {
    method: "category_model", title_vi: "Mức giữa của loại", title_en: "Category model",
    expression: "CO₂ = trung vị loại × (inch ÷ 23,8)^0,81",
    steps: [
      { label_vi: "Trung vị 330 màn hình (Samsung chưa đủ 3 mẫu)", label_en: "Median of 330 monitors (fewer than 3 Samsung models)", expr: "491,5 kg", value_kg: 491.5 },
      { label_vi: "Hệ số cỡ màn hình", label_en: "Screen-size factor", expr: "(27 ÷ 23,8)^0,81 = 1,108", value_kg: null },
      { label_vi: "Kết quả", label_en: "Result", expr: "491,5 × 1,108 = 544 kg", value_kg: 544 },
    ],
    result_kg: 544, confidence: 0.35, complete: true,
  },
  202: {
    method: "neighbor_average", title_vi: "Trung bình mẫu giống", title_en: "Average of similar products",
    expression: "CO₂ = trung bình các mẫu có cosine ≥ 0,66",
    steps: [{ label_vi: "2 mẫu Dell P-series", label_en: "2 Dell P-series models", expr: "(395 + 425) ÷ 2 = 410 kg", value_kg: 410 }],
    result_kg: 410, confidence: 0.5, complete: true,
  },
  301: {
    method: "lifecycle_formula", title_vi: "Công thức vòng đời theo điện", title_en: "Electricity-based lifecycle formula",
    expression: "CO₂ = sản xuất + năm × (kWh/năm × 0,681 + rò ga) + thải bỏ",
    steps: [
      { label_vi: "Sản xuất (300 kg/HP × 1,5 HP)", label_en: "Manufacturing (300 kg/HP × 1.5 HP)", expr: "300 × 1,5 = 450 kg", value_kg: 450 },
      { label_vi: "Điện 10 năm, nhãn 820 kWh/năm", label_en: "Electricity over 10 years, label 820 kWh/year", expr: "10 × 820 × 0,681 = 5.584,2 kg", value_kg: 5584.2 },
      { label_vi: "Rò ga R32 10 năm", label_en: "R32 refrigerant leakage, 10 years", expr: "10 × 0,6 × 675 × 3% = 121,5 kg", value_kg: 121.5 },
      { label_vi: "Thải bỏ", label_en: "End of life", expr: "20 + 0,6 × 675 × 30% = 141,5 kg", value_kg: 141.5 },
      { label_vi: "Tổng", label_en: "Total", expr: "450 + 5.584,2 + 121,5 + 141,5 = 6.297,2 kg", value_kg: 6297.2 },
    ],
    result_kg: 6297.2, confidence: 0.35, complete: true,
  },
};

function shares(total, s, basis = "typical_share") {
  const keys = [
    ["materials_production", "Nguyên liệu & sản xuất", "Materials & production"],
    ["transport", "Vận chuyển về Việt Nam", "Transport to Vietnam"],
    ["use", "Sử dụng tại Việt Nam", "Use in Vietnam"],
    ["end_of_life", "Thải bỏ / tái chế", "End of life"],
  ];
  return keys.map(([key, vi, en]) => ({
    key, label_vi: vi, label_en: en, kg: Math.round(total * s[key] * 10) / 10, pct: Math.round(s[key] * 1000) / 10, basis,
  }));
}

const CHINA = { origin_vi: "Trung Quốc", origin_en: "China", destination: "Việt Nam", distance_km: 2600, mode: "sea", assumed: true };
const LAPTOP_SHARE = { materials_production: 0.79, transport: 0.04, use: 0.16, end_of_life: 0.01 };
const MONITOR_SHARE = { materials_production: 0.55, transport: 0.03, use: 0.41, end_of_life: 0.01 };
const NOTE_TYPICAL_VI = "Tỷ lệ giai đoạn là mức điển hình của loại (giả định) vì hãng không tách theo giai đoạn cho mẫu này.";
const NOTE_TYPICAL_EN = "Stage shares are typical for the category (assumption): the manufacturer does not split this model by stage.";

const LIFECYCLES = {
  101: { basis: "typical_share", total_kg: 147, stages: shares(147, LAPTOP_SHARE), route: CHINA,
    use_phase: { years: 4, kwh_year: 30, grid_ef: 0.681 }, note_vi: NOTE_TYPICAL_VI, note_en: NOTE_TYPICAL_EN },
  102: { basis: "typical_share", total_kg: 270, stages: shares(270, LAPTOP_SHARE), route: CHINA,
    use_phase: { years: 4, kwh_year: 30, grid_ef: 0.681 }, note_vi: NOTE_TYPICAL_VI, note_en: NOTE_TYPICAL_EN },
  103: { basis: "typical_share", total_kg: 332.6, stages: shares(332.6, LAPTOP_SHARE), route: CHINA,
    use_phase: { years: 4, kwh_year: 30, grid_ef: 0.681 }, note_vi: NOTE_TYPICAL_VI, note_en: NOTE_TYPICAL_EN },
  201: { basis: "typical_share", total_kg: 544, stages: shares(544, MONITOR_SHARE),
    route: { ...CHINA, origin_vi: "Việt Nam (Bắc Ninh)", origin_en: "Vietnam (Bac Ninh)", distance_km: 1700, mode: "road" },
    use_phase: { years: 6, kwh_year: 45, grid_ef: 0.681 }, note_vi: NOTE_TYPICAL_VI, note_en: NOTE_TYPICAL_EN },
  202: { basis: "none", total_kg: 410, stages: [], route: null, use_phase: null,
    note_vi: "Hãng không tách theo giai đoạn; chỉ có tổng vòng đời.", note_en: "The manufacturer does not split by stage; only the lifecycle total is known." },
  301: {
    basis: "formula", total_kg: 6297.2,
    stages: [
      { key: "materials_production", label_vi: "Nguyên liệu & sản xuất", label_en: "Materials & production", kg: 435.3, pct: 6.9, basis: "formula" },
      { key: "transport", label_vi: "Vận chuyển về Việt Nam", label_en: "Transport to Vietnam", kg: 14.7, pct: 0.2, basis: "formula" },
      { key: "use", label_vi: "Sử dụng tại Việt Nam (điện + rò ga)", label_en: "Use in Vietnam (electricity + leakage)", kg: 5705.7, pct: 90.6, basis: "formula" },
      { key: "end_of_life", label_vi: "Thải bỏ / tái chế", label_en: "End of life", kg: 141.5, pct: 2.2, basis: "formula" },
    ],
    route: { origin_vi: "Thái Lan", origin_en: "Thailand", destination: "Việt Nam", distance_km: 1100, mode: "road", assumed: true },
    use_phase: { years: 10, kwh_year: 820, grid_ef: 0.681 },
    note_vi: "Phần sử dụng tính theo nhãn năng lượng 820 kWh/năm và lưới điện Việt Nam 0,681 kg CO₂e/kWh (2024).",
    note_en: "Use phase from the 820 kWh/year energy label and the 2024 Vietnamese grid factor 0.681 kg CO₂e/kWh.",
  },
};

const EXPLANATIONS = {
  101: ["Số CO₂ do hãng công bố cho đúng mẫu Apple MacBook Air 13-inch M2.", "Manufacturer-published figure for Apple MacBook Air 13-inch M2."],
  102: ["Ước tính theo mức CO₂ điển hình của laptop (mức riêng của Acer, màn hình 15,6 inch).", "Estimated from the typical footprint of Acer laptops, adjusted for a 15.6\" screen."],
  103: ["Trung bình của 5 sản phẩm tương tự có số CO₂ do hãng công bố.", "Average of 5 similar products whose manufacturers published their carbon footprint."],
  201: ["Ước tính theo mức CO₂ điển hình của màn hình máy tính (trung vị 330 sản phẩm, màn hình 27 inch).", "Typical monitor footprint (median of 330 products), adjusted for a 27\" screen."],
  202: ["Trung bình của 2 sản phẩm tương tự có số CO₂ do hãng công bố.", "Average of 2 similar products with manufacturer figures."],
  301: ["Ước tính theo vòng đời: sản xuất 450 kg + điện 820 kWh/năm trong 10 năm với lưới điện Việt Nam (0,681) + rò ga + thải bỏ.", "Lifecycle estimate: manufacturing 450 kg + 820 kWh/year over 10 years on the Vietnamese grid (0.681) + leakage + end of life."],
};

const STATS = {
  laptop: { category: "laptop", n: 412, median_kg: 300.1, p25: 248.0, p75: 361.5, min: 82.0, max: 905.0 },
  computer_monitor: { category: "computer_monitor", n: 188, median_kg: 491.5, p25: 402.0, p75: 610.0, min: 160.0, max: 1520.0 },
  air_conditioner: { category: "air_conditioner", n: 96, median_kg: 7450.0, p25: 6400.0, p75: 9100.0, min: 4300.0, max: 14800.0 },
};
const GREENER_PCT = { 101: 92.5, 102: 61.0, 103: 33.2, 201: 41.0, 202: 72.3, 301: 81.4 };

const product = (id) => {
  const p = PRODUCTS[id];
  if (!p) throw Object.assign(new Error("Product not found"), { status: 404, code: "not_found" });
  return clone(p);
};

export async function getProductCo2(id) {
  await delay();
  const p = product(id);
  const [vi, en] = EXPLANATIONS[id] || ["", ""];
  return {
    product: p, explanation_vi: vi, explanation_en: en, references: clone(REFERENCES[id] || []),
    formula: clone(FORMULAS[id]), lifecycle: clone(LIFECYCLES[id]),
  };
}

export async function getRelated(id) {
  await delay();
  const p = product(id);
  const items = Object.values(PRODUCTS)
    .filter((x) => x.category === p.category && x.product_id !== p.product_id)
    .sort((a, b) => a.co2e_kg - b.co2e_kg)
    .map(clone);
  const greener = items.find((x) => x.co2e_kg < p.co2e_kg && Math.abs(x.price_vnd - p.price_vnd) <= 0.15 * p.price_vnd) || null;
  return { product_id: p.product_id, category: p.category, items, greener_alternative: greener };
}

export async function getCategoryStats(cat, productId) {
  await delay();
  const s = clone(STATS[cat] || { category: cat, n: 0, median_kg: null, p25: null, p75: null, min: null, max: null });
  if (productId && PRODUCTS[productId]) {
    s.product_kg = PRODUCTS[productId].co2e_kg;
    s.greener_than_pct = GREENER_PCT[productId] ?? null;
  }
  return s;
}

const ELECTRICITY_VND = 2700;
const ANNUAL_KWH = { 101: 30, 102: 30, 103: 30, 201: 45, 202: 40, 301: 820 };

export async function compare(ids) {
  await delay();
  const list = ids.slice(0, 4).filter((id) => PRODUCTS[id]).map((id) => ({
    ...product(id),
    formula: clone(FORMULAS[id]),
    lifecycle: clone(LIFECYCLES[id]),
    annual_kwh: ANNUAL_KWH[id] ?? null,
    electricity_vnd_year: ANNUAL_KWH[id] ? ANNUAL_KWH[id] * ELECTRICITY_VND : null,
  }));
  const rows = ["price_vnd", "co2e_kg", "green_score", "co2e_source", "co2e_confidence", "annual_kwh", "electricity_vnd_year"];
  const lowerBetter = { price_vnd: true, co2e_kg: true, annual_kwh: true, electricity_vnd_year: true, green_score: false, co2e_confidence: false };
  const best = {};
  for (const row of Object.keys(lowerBetter)) {
    const withVal = list.filter((p) => p[row] !== null && p[row] !== undefined);
    if (!withVal.length) continue;
    withVal.sort((a, b) => (lowerBetter[row] ? a[row] - b[row] : b[row] - a[row]));
    best[row] = withVal[0].product_id;
  }
  const greenest = list.find((p) => p.product_id === best.co2e_kg);
  const cheapest = list.find((p) => p.product_id === best.price_vnd);
  let conclusion = "";
  if (greenest && cheapest) {
    conclusion = greenest === cheapest
      ? `${greenest.name} vừa rẻ nhất vừa ít CO₂ nhất (${greenest.co2e_kg} kg CO₂e).`
      : `${greenest.name} ít CO₂ nhất (${greenest.co2e_kg} kg CO₂e); ${cheapest.name} rẻ nhất.`;
  }
  return { products: list, rows, best, conclusion };
}

export async function searchProducts(q) {
  await delay(200);
  const words = (q || "").toLowerCase().split(/\s+/).filter(Boolean);
  return Object.values(PRODUCTS)
    .filter((p) => !words.length || words.some((w) => p.name.toLowerCase().includes(w)))
    .map(clone);
}

// ------------------------------------------------------------------ AI page

function co2BarSpec(ids) {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: "container", height: 220,
    data: { values: ids.map((id) => ({ name: PRODUCTS[id].name, co2e_kg: PRODUCTS[id].co2e_kg, green_score: PRODUCTS[id].green_score })) },
    mark: { type: "bar", cornerRadiusEnd: 4 },
    encoding: {
      y: { field: "name", type: "nominal", sort: "x", title: null, axis: { labelLimit: 180 } },
      x: { field: "co2e_kg", type: "quantitative", title: "kg CO₂e" },
      color: { field: "green_score", type: "quantitative", title: "Điểm xanh", scale: { domain: [0, 5], range: ["#b91c1c", "#d97706", "#15803d"] } },
      tooltip: [{ field: "name" }, { field: "co2e_kg", title: "kg CO₂e" }, { field: "green_score", title: "Điểm xanh" }],
    },
  };
}

function priceVsCo2Spec(ids) {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: "container", height: 220,
    data: { values: ids.map((id) => ({ name: PRODUCTS[id].name, price_vnd: PRODUCTS[id].price_vnd, co2e_kg: PRODUCTS[id].co2e_kg, green_score: PRODUCTS[id].green_score })) },
    mark: { type: "circle", size: 160 },
    encoding: {
      x: { field: "price_vnd", type: "quantitative", title: "Giá (₫)", scale: { zero: false } },
      y: { field: "co2e_kg", type: "quantitative", title: "kg CO₂e", scale: { zero: false } },
      color: { field: "green_score", type: "quantitative", title: "Điểm xanh", scale: { domain: [0, 5], range: ["#b91c1c", "#d97706", "#15803d"] } },
      tooltip: [{ field: "name" }, { field: "price_vnd", title: "Giá" }, { field: "co2e_kg", title: "kg CO₂e" }],
    },
  };
}

function lifecycleStackSpec(ids) {
  const values = [];
  for (const id of ids) {
    for (const s of LIFECYCLES[id].stages) values.push({ name: PRODUCTS[id].name, stage: s.label_vi, kg: s.kg });
  }
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: "container", height: 200, data: { values },
    mark: "bar",
    encoding: {
      y: { field: "name", type: "nominal", title: null, axis: { labelLimit: 180 } },
      x: { field: "kg", type: "quantitative", title: "kg CO₂e", stack: "zero" },
      color: { field: "stage", type: "nominal", title: "Giai đoạn" },
      tooltip: [{ field: "name" }, { field: "stage" }, { field: "kg", title: "kg CO₂e" }],
    },
  };
}

function laptopPage(id, message, lang, parentId) {
  const ids = ["101", "102", "103"];
  const products = Object.fromEntries(ids.map((i) => [i, clone(PRODUCTS[i])]));
  const stats = { ...clone(STATS.laptop), product_kg: 147, greener_than_pct: 92.5 };
  return {
    version: 1, id, lang, query: message, parent_id: parentId, created_at: new Date().toISOString(),
    plan: { search_query: "laptop học tập dưới 20 triệu", category_slug: "laptops", budget_max_vnd: 20000000 },
    summary:
      "Gợi ý Apple MacBook Air 13 inch M2 (18.990.000 ₫): vòng đời chỉ 147 kg CO₂e, thấp hơn 153,1 kg so với laptop trung vị cùng loại (300,1 kg), và đây là số do hãng công bố cho đúng mẫu. Nếu cần rẻ hơn, Acer Aspire 5 (14.490.000 ₫) phát thải 270 kg CO₂e.",
    products,
    sections: [
      { type: "recommendations", product_ids: ids, reasons: {
        101: "Ít CO₂ nhất (147 kg), số của hãng, pin lâu và nhẹ cho việc học.",
        102: "Rẻ nhất trong nhóm, CO₂ 270 kg vẫn dưới mức trung vị của loại.",
        103: "Bền, bàn phím tốt; CO₂ 332,6 kg là trung bình của 5 mẫu Latitude giống nhất.",
      } },
      { type: "formula", product_id: "101", formula: clone(FORMULAS[101]) },
      { type: "lifecycle", product_id: "101", lifecycle: clone(LIFECYCLES[101]) },
      { type: "chart", chart: "co2_bar", title: "CO₂ vòng đời của các ứng viên", spec: co2BarSpec(ids) },
      { type: "chart", chart: "price_vs_co2", title: "Giá và CO₂: góc dưới bên trái là vừa rẻ vừa xanh", spec: priceVsCo2Spec(ids) },
      { type: "category_stats", category: "laptop", product_id: "101", stats },
      { type: "savings", best_id: "101", baseline: "category_median", baseline_kg: 300.1, lifecycle_kg_saved: 153.1,
        horizons: [{ months: 6, kg: 19.1, kwh: null, vnd: null }, { months: 12, kg: 38.3, kwh: null, vnd: null }], trees_year: 7.0 },
      { type: "why_low_co2", bullets: [
        "MacBook Air M2 phát thải 147 kg CO₂e, chỉ bằng 44% so với Dell Latitude 5450 (332,6 kg).",
        "Thấp hơn mức trung vị của 412 laptop cùng loại (300,1 kg) là 153,1 kg CO₂e.",
        "Xanh hơn 92,5% laptop cùng loại trong cơ sở dữ liệu.",
        "Khoản giảm này tương đương lượng CO₂ khoảng 7 cây xanh hấp thụ trong một năm.",
      ] },
      { type: "chart", chart: "lifecycle_stack", title: "CO₂ theo giai đoạn vòng đời", spec: lifecycleStackSpec(ids) },
      { type: "related", product_id: "101", items: [clone(PRODUCTS[102]), clone(PRODUCTS[103])], greener_alternative: null },
      { type: "sources", items: ids.map((i) => ({
        product_id: i, source: PRODUCTS[i].co2e_source, confidence: PRODUCTS[i].co2e_confidence, references: clone(REFERENCES[i] || []),
        limitations_vi: PRODUCTS[i].co2e_source === "manufacturer"
          ? "Số của hãng tính phần sử dụng theo lưới điện nước ngoài, có thể thấp hơn thực tế ở Việt Nam."
          : PRODUCTS[i].co2e_source === "category_model"
          ? "Mức giữa của loại: sai số trung vị khoảng 18–20% với laptop."
          : "Trung bình mẫu giống: sai số khoảng 20% với loại đã có mẫu.",
        limitations_en: "See the CO₂ method page for the accuracy of each source.",
      })) },
    ],
    warnings: [],
    meta: { model: "mock", latency_ms: 420, number_check_failures: 0 },
  };
}

const pages = new Map();
const uuid = () =>
  (globalThis.crypto?.randomUUID?.() || `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`);

export async function askAssistant({ message, lang, parent_id }) {
  await delay(900);
  const id = uuid();
  const page = laptopPage(id, message, lang, parent_id);
  if (parent_id) page.warnings = [];
  pages.set(id, page);
  return { id, url: `/assistant/${id}`, page: clone(page) };
}

export async function getAssistantPage(id) {
  await delay();
  if (!pages.has(id)) pages.set(id, laptopPage(id, "laptop dưới 20 triệu ít CO₂", "vi", null));
  return { id, url: `/assistant/${id}`, page: clone(pages.get(id)) };
}

// ------------------------------------------------------------------ test orders

const ORDERS_KEY = "spf.mock.orders";
function loadOrders() {
  try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || "{}"); } catch { return {}; }
}
function saveOrders(o) {
  try { localStorage.setItem(ORDERS_KEY, JSON.stringify(o)); } catch { /* ignore */ }
}

export async function createTestOrder({ items, created_by, note }) {
  await delay();
  const id = uuid();
  const lines = items.map(({ product_id, quantity }) => {
    const p = PRODUCTS[product_id] || { name: `#${product_id}`, price_vnd: 0, co2e_kg: null, category: null };
    return { product_id: String(product_id), name: p.name, quantity, unit_price_vnd: p.price_vnd, co2e_kg: p.co2e_kg, category: p.category };
  });
  const total_vnd = lines.reduce((s, l) => s + l.unit_price_vnd * l.quantity, 0);
  const total_co2e_kg = lines.reduce((s, l) => s + (l.co2e_kg || 0) * l.quantity, 0);
  const baseline = lines.reduce((s, l) => s + ((STATS[l.category]?.median_kg ?? l.co2e_kg) || 0) * l.quantity, 0);
  const now = new Date().toISOString();
  const order = {
    id, mode: "test", status: "awaiting_confirmation", created_by, created_at: now, confirmed_at: null, note: note || null,
    items: lines, total_vnd, total_co2e_kg: Math.round(total_co2e_kg * 10) / 10,
    baseline_co2e_kg: Math.round(baseline * 10) / 10, saved_co2e_kg: Math.round((baseline - total_co2e_kg) * 10) / 10,
    confirm_url: `/orders/${id}`, events: [{ at: now, actor: created_by, action: "created" }],
  };
  const all = loadOrders();
  all[id] = order;
  saveOrders(all);
  return clone(order);
}

function orderOr404(id) {
  const all = loadOrders();
  if (!all[id]) throw Object.assign(new Error("Order not found"), { status: 404, code: "not_found" });
  return all;
}

export async function getTestOrder(id) {
  await delay();
  return clone(orderOr404(id)[id]);
}

export async function confirmTestOrder(id) {
  await delay();
  const all = orderOr404(id);
  const o = all[id];
  if (o.status === "awaiting_confirmation") {
    o.status = "confirmed_test";
    o.confirmed_at = new Date().toISOString();
    o.events.push({ at: o.confirmed_at, actor: "user", action: "confirmed" });
    saveOrders(all);
  }
  return clone(o);
}

export async function cancelTestOrder(id) {
  await delay();
  const all = orderOr404(id);
  const o = all[id];
  if (o.status === "awaiting_confirmation") {
    o.status = "cancelled";
    o.events.push({ at: new Date().toISOString(), actor: "user", action: "cancelled" });
    saveOrders(all);
  }
  return clone(o);
}

export async function getMethod() {
  await delay(100);
  return { url: "/method", steps: ["manufacturer", "neighbor_average", "lifecycle_formula", "category_model", "eeio_price", "none"] };
}


// ------------------------------------------------------------------ explain (mock)

export async function explain({ product_id, topic, question, lang, scenario }) {
  await delay(700);
  const p = product(product_id);
  const T = tri(lang);
  const loc = { en: "en-US", fr: "fr-FR", vi: "vi-VN" }[lang] || "en-US";
  const kg = new Intl.NumberFormat(loc, { maximumFractionDigits: 1 }).format(p.co2e_kg);
  const total = scenario?.total_kg ? new Intl.NumberFormat(loc, { maximumFractionDigits: 1 }).format(scenario.total_kg) : null;
  return {
    topic, title: null,
    answer: question
      ? T(`Về câu hỏi "${question}": ${p.name} có tổng khoảng ${kg} kg CO₂e; phần giải thích chi tiết dùng đúng các số trên màn hình.`, `About "${question}": ${p.name} totals about ${kg} kg CO₂e; the detailed explanation uses the figures on screen.`, `À propos de « ${question} » : ${p.name} totalise environ ${kg} kg CO₂e ; l'explication détaillée utilise les chiffres à l'écran.`)
      : topic === "what_if" && total
        ? T(`Theo kịch bản bạn chọn, tổng là ${total} kg CO₂e, còn số chính thức vẫn là ${kg} kg.`, `In your scenario the total is ${total} kg CO₂e; the official figure stays ${kg} kg.`, `Dans votre scénario, le total est de ${total} kg CO₂e ; le chiffre officiel reste ${kg} kg.`)
        : T(`(Dữ liệu mẫu) ${p.name}: tổng ${kg} kg CO₂e. Bấm các chặng khác để xem từng phần.`, `(Sample data) ${p.name}: ${kg} kg CO₂e in total. Tap other stages to see each part.`, `(Données d'exemple) ${p.name} : ${kg} kg CO₂e au total. Touchez les autres étapes pour voir chaque part.`),
    bullets: [],
    follow_ups: T(["Phần nào lớn nhất?", "Làm sao giảm CO₂?"], ["Which part is largest?", "How to reduce CO₂?"], ["Quelle part est la plus grande ?", "Comment réduire le CO₂ ?"]),
    facts: { co2e_kg: p.co2e_kg },
    model: "rule-based (mock)", cached: false, number_check_failures: 0,
  };
}


// ------------------------------------------------------------------ dashboard (api-overview.md)
const asItem = (p) => ({ platform_name: p.platform, image_url: p.image_url, product: {
  id: Number(p.product_id), name: p.name, final_price: p.price_vnd, product_url: p.product_url, co2e_kg: p.co2e_kg,
  co2e_source: p.co2e_source, co2e_confidence: p.co2e_confidence, co2e_category: p.category, green_score: p.green_score,
  product_rating: (p.rating || 0) / 5, review_count: p.review_count } });

export async function getOverview() {
  await delay();
  return {
    total_products: 7515, with_co2: 7515, references: 1450, grid_ef: 0.681,
    by_category: [
      { category: "laptop", n: 4716, median_kg: 277.2, p25: 240, p75: 316.2, min_kg: 113, max_kg: 485 },
      { category: "headphone", n: 1055, median_kg: 7.1, p25: 6.8, p75: 11, min_kg: 3.2, max_kg: 28 },
      { category: "computer_monitor", n: 902, median_kg: 494.8, p25: 359.4, p75: 511.5, min_kg: 225.9, max_kg: 997.1 },
      { category: "smartphone", n: 536, median_kg: 64.5, p25: 58, p75: 72, min_kg: 30.1, max_kg: 120 },
      { category: "smartwatch", n: 124, median_kg: 24.5, p25: 11, p75: 24.5, min_kg: 8.1, max_kg: 40 },
      { category: "tablet", n: 35, median_kg: 104.2, p25: 98.5, p75: 110, min_kg: 60, max_kg: 140 },
    ],
    by_source: [{ source: "neighbor_average", n: 4419 }, { source: "category_model", n: 2905 }, { source: "manufacturer", n: 191 }],
    platforms: [{ name: "CellPhones", n: 6012 }, { name: "Điện Máy Xanh", n: 1121 }, { name: "Phong Vu", n: 236 }, { name: "FPT Shop", n: 146 }],
    greenest: Object.values(PRODUCTS).filter((p) => p.product_id !== "103").map((p) => ({ category: p.category, item: asItem(p) })),
    suggestions: [
      { category: "computer_monitor", from: asItem(PRODUCTS[201]), to: asItem(PRODUCTS[202]), saved_kg: 134 },
      { category: "laptop", from: asItem(PRODUCTS[103]), to: asItem(PRODUCTS[101]), saved_kg: 185.6 },
    ],
    updated_at: new Date().toISOString(),
  };
}

export async function getHealth() {
  await delay();
  const s = (key, name, latency, detail) => ({ key, name, status: "online", latency_ms: latency, detail });
  return { services: [
    s("db-search", "Cơ sở dữ liệu & tìm kiếm", 12, "7.515 sản phẩm"), s("ranking", "Xếp hạng CatBoost + RRF", 18),
    s("clip", "OpenCLIP (so độ giống)", 9), s("assistant", "AI giải thích", 7, "rule-based"),
    s("mcp", "MCP cho ChatGPT", 11), { key: "etl", name: "ETL + tính CO₂", status: "offline", detail: "mock" },
  ], checked_at: new Date().toISOString() };
}


// ---- offline demo of GET /api/search and /api/categories (sample data, never shown as live)
export async function search(params = {}) {
  await delay();
  const q = String(params.q || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  let items = Object.values(PRODUCTS).map(clone);
  if (q) items = items.filter((p) => p.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").includes(q));
  if (params.max_price) items = items.filter((p) => p.price_vnd && p.price_vnd <= Number(params.max_price));
  if (params.min_price) items = items.filter((p) => p.price_vnd && p.price_vnd >= Number(params.min_price));
  if (params.sort === "co2_asc") items.sort((a, b) => (a.co2e_kg ?? Infinity) - (b.co2e_kg ?? Infinity));
  if (params.sort === "price_asc") items.sort((a, b) => (a.price_vnd ?? Infinity) - (b.price_vnd ?? Infinity));
  return { query: params.q || "", understood: { terms: q ? q.split(" ") : [] }, unsupported: null, filters: {}, sort: params.sort || "relevance",
           effective_sort: params.sort || "relevance", page: 1, page_size: items.length, total: items.length, items,
           facets: { category: [], brand: [], platform: [], co2_source: [], has_price: items.length, has_co2: items.length, accessories_hidden: 0 },
           relaxations: [], sample: true };
}

export async function getCategories() {
  await delay();
  return { categories: [], sample: true };
}
