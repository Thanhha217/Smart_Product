// One order for product categories across the whole site, so Overview, CO₂ world, search
// filters and the compare page never list them differently.
//
// The order is by what people shop for, NOT by CO2: categories answer different needs, so
// ranking them against each other ("greener category") would be misleading.
export const CATEGORY_ORDER = [
  "laptop", "computer_monitor", "smartphone", "tablet", "smartwatch", "headphone",
  "desktop", "television", "speaker", "camera", "wearable", "earphone",
  "computer_peripheral", "pc_component", "networking", "gaming_console", "smart_home",
  "phone_accessory", "electric_fan", "lighting", "refrigerator", "other",
];

// The browse endpoint uses platform slugs (plural); CO2 stats use the model's own keys.
const ALIAS = {
  laptops: "laptop", monitors: "computer_monitor", smartphones: "smartphone", tablets: "tablet",
  smartwatches: "smartwatch", headphones: "headphone", earphones: "earphone", desktops: "desktop",
  televisions: "television", speakers: "speaker", cameras: "camera", wearables: "wearable",
};

// The reverse: the slug /api/search filters on, for a CO2 category key.
const SEARCH_SLUG = {
  laptop: "laptops", gaming_laptop: "laptops", computer_monitor: "monitors", smartphone: "smartphones",
  tablet: "tablets", smartwatch: "smartwatches", headphone: "headphones", earphone: "headphones",
};

/** Category value usable as ?category= on /api/search, or null when the catalogue has no such tab. */
export function searchCategory(category) {
  const c = String(category || "").trim().toLowerCase();
  if (!c) return null;
  if (SEARCH_SLUG[c]) return SEARCH_SLUG[c];
  return Object.values(SEARCH_SLUG).includes(c) ? c : null;
}

export function canonicalCategory(category) {
  const c = String(category || "").trim().toLowerCase();
  return ALIAS[c] || c;
}

const RANK = Object.fromEntries(CATEGORY_ORDER.map((c, i) => [c, i]));

/** Sort rows that carry a `category` field into the site order; unknown ones keep the tail. */
export function byCategoryOrder(rows, key = "category") {
  return [...(rows || [])].sort((a, b) => {
    const ra = RANK[canonicalCategory(a?.[key])] ?? CATEGORY_ORDER.length;
    const rb = RANK[canonicalCategory(b?.[key])] ?? CATEGORY_ORDER.length;
    return ra === rb ? String(a?.[key] || "").localeCompare(String(b?.[key] || "")) : ra - rb;
  });
}

export function categoryRank(category) {
  return RANK[canonicalCategory(category)] ?? CATEGORY_ORDER.length;
}
