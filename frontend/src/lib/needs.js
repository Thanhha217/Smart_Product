// The quick choices behind "Tìm thiết bị phù hợp với bạn": device, purpose, budget, priority.
//
// A selection becomes two things:
//  - a sentence for Ask AI, written with the words the backend's query parser knows in all
//    three languages (category words, "dưới 20 triệu" / "under 20 million" / "moins de 20 millions");
//  - plain search parameters for /search, so the same choice can skip the AI entirely.
import { tri } from "../i18n/LanguageContext";

/** value -> {label per language, query word per language, search params} */
export const NEED_GROUPS = [
  {
    key: "device",
    title: { vi: "Loại thiết bị", en: "Device", fr: "Appareil" },
    options: [
      { value: "laptop", label: { vi: "Laptop", en: "Laptop", fr: "Ordinateur portable" }, word: { vi: "laptop", en: "laptop", fr: "laptop" }, params: { category: "laptops" } },
      { value: "computer_monitor", label: { vi: "Màn hình", en: "Monitor", fr: "Écran" }, word: { vi: "màn hình", en: "monitor", fr: "monitor" }, params: { category: "monitors" } },
      { value: "smartphone", label: { vi: "Điện thoại", en: "Phone", fr: "Téléphone" }, word: { vi: "điện thoại", en: "smartphone", fr: "smartphone" }, params: { category: "smartphones" } },
      { value: "tablet", label: { vi: "Máy tính bảng", en: "Tablet", fr: "Tablette" }, word: { vi: "máy tính bảng", en: "tablet", fr: "tablet" }, params: { category: "tablets" } },
      { value: "smartwatch", label: { vi: "Đồng hồ", en: "Smartwatch", fr: "Montre" }, word: { vi: "đồng hồ thông minh", en: "smartwatch", fr: "smartwatch" }, params: { category: "smartwatches" } },
      { value: "headphone", label: { vi: "Tai nghe", en: "Headphones", fr: "Casque" }, word: { vi: "tai nghe", en: "headphones", fr: "headphones" }, params: { category: "headphones" } },
    ],
  },
  {
    key: "purpose",
    title: { vi: "Dùng để làm gì", en: "What for", fr: "Pour quoi faire" },
    options: [
      { value: "study", label: { vi: "Học tập, văn phòng", en: "Study and office", fr: "Études et bureau" }, word: { vi: "học tập văn phòng", en: "for study and office work", fr: "pour les études et le bureau" } },
      { value: "gaming", label: { vi: "Chơi game, đồ họa", en: "Gaming and graphics", fr: "Jeux et graphisme" }, word: { vi: "chơi game đồ họa", en: "for gaming and graphics", fr: "pour le jeu et le graphisme" } },
      { value: "travel", label: { vi: "Mang đi nhiều", en: "Carrying around", fr: "À emporter" }, word: { vi: "nhẹ mang đi nhiều", en: "light and portable", fr: "léger et portable" } },
      { value: "home", label: { vi: "Dùng ở nhà", en: "At home", fr: "À la maison" }, word: { vi: "dùng ở nhà", en: "for home use", fr: "pour la maison" } },
    ],
  },
  {
    key: "budget",
    title: { vi: "Ngân sách", en: "Budget", fr: "Budget" },
    options: [
      { value: "10", label: { vi: "Dưới 10 triệu", en: "Under 10 million ₫", fr: "Moins de 10 millions ₫" }, word: { vi: "dưới 10 triệu", en: "under 10 million", fr: "moins de 10 millions" }, params: { max_price: "10000000" } },
      { value: "20", label: { vi: "Dưới 20 triệu", en: "Under 20 million ₫", fr: "Moins de 20 millions ₫" }, word: { vi: "dưới 20 triệu", en: "under 20 million", fr: "moins de 20 millions" }, params: { max_price: "20000000" } },
      { value: "30", label: { vi: "Dưới 30 triệu", en: "Under 30 million ₫", fr: "Moins de 30 millions ₫" }, word: { vi: "dưới 30 triệu", en: "under 30 million", fr: "moins de 30 millions" }, params: { max_price: "30000000" } },
      { value: "50", label: { vi: "Dưới 50 triệu", en: "Under 50 million ₫", fr: "Moins de 50 millions ₫" }, word: { vi: "dưới 50 triệu", en: "under 50 million", fr: "moins de 50 millions" }, params: { max_price: "50000000" } },
    ],
  },
  {
    key: "priority",
    title: { vi: "Ưu tiên", en: "Priority", fr: "Priorité" },
    options: [
      { value: "co2", label: { vi: "CO₂ thấp", en: "Low CO₂", fr: "CO₂ bas" }, word: { vi: "ít CO₂", en: "with low CO₂", fr: "à faible CO₂" }, params: { sort: "co2_asc", has_co2: "true" } },
      { value: "price", label: { vi: "Giá rẻ", en: "Low price", fr: "Prix bas" }, word: { vi: "giá rẻ", en: "cheap", fr: "pas cher" }, params: { sort: "price_asc" } },
      { value: "published", label: { vi: "Có số của hãng", en: "Manufacturer figure", fr: "Chiffre du fabricant" }, word: { vi: "có số CO₂ của hãng", en: "with a published CO₂ figure", fr: "avec un chiffre CO₂ publié" }, params: { co2_source: "manufacturer" } },
    ],
  },
];

const GROUP = Object.fromEntries(NEED_GROUPS.map((g) => [g.key, g]));

export function optionOf(groupKey, value) {
  return GROUP[groupKey]?.options.find((o) => o.value === value) || null;
}

export function groupTitle(groupKey, lang) {
  const g = GROUP[groupKey];
  return g ? (g.title[lang] || g.title.en) : groupKey;
}

export function optionLabel(groupKey, value, lang) {
  const o = optionOf(groupKey, value);
  return o ? (o.label[lang] || o.label.en) : value;
}

/** A sentence Ask AI can parse, built from the chips the visitor picked. */
export function composeQuery(selection, lang = "en", free = "") {
  const L3 = tri(lang);
  const word = (key) => {
    const o = optionOf(key, selection?.[key]);
    return o ? (o.word[lang] || o.word.en) : null;
  };
  const parts = [word("device"), word("purpose"), word("budget"), word("priority")].filter(Boolean);
  if (!parts.length) return free.trim();
  const head = L3("Tìm ", "Find a ", "Trouver un ");
  return [`${head}${parts.join(" ")}`.replace(/\s+/g, " ").trim(), free.trim()].filter(Boolean).join(". ");
}

/** The same selection as plain /search parameters, for people who do not want the AI. */
export function toSearchParams(selection, free = "") {
  const params = {};
  for (const key of ["device", "budget", "priority"]) {
    const o = optionOf(key, selection?.[key]);
    if (o?.params) Object.assign(params, o.params);
  }
  const q = String(free || "").trim();
  if (q) params.q = q;
  return params;
}

/** Chips describing what was understood, each removable. */
export function selectionChips(selection, lang) {
  return Object.entries(selection || {})
    .filter(([, value]) => value)
    .map(([key, value]) => ({ key, value, group: groupTitle(key, lang), label: optionLabel(key, value, lang) }));
}
