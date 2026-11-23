// Remove one understood condition (brand, budget, category word, free term) from the typed
// query, so a chip for something the backend read from the text can be removed honestly.
// Accent- and case-insensitive; the rest of the text is kept as typed.

/** Lower case, accents removed, đ -> d, ONE character per input character (indices stay aligned). */
export function foldKeep(raw) {
  let out = "";
  for (const ch of String(raw || "")) {
    let c = ch.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (c === "đ") c = "d";
    out += c.length === 1 ? c : ch.length === 1 ? (c[0] || " ") : c.slice(0, ch.length);
  }
  return out;
}

export function fold(raw) {
  return foldKeep(raw).replace(/\s+/g, " ").trim();
}

const CATEGORY_WORDS = {
  laptops: ["may tinh xach tay", "ordinateur portable", "laptops", "laptop", "notebook", "portable"],
  monitors: ["man hinh", "monitors", "monitor", "ecrans", "ecran"],
  smartphones: ["dien thoai", "smartphones", "smartphone", "telephone", "mobile", "phone"],
  headphones: ["tai nghe", "headphones", "headphone", "earbuds", "earphone", "ecouteurs", "casque"],
  smartwatches: ["dong ho thong minh", "montre connectee", "smartwatches", "smartwatch", "dong ho", "montre", "watch"],
  tablets: ["may tinh bang", "tablettes", "tablette", "tablets", "tablet"],
};
const NUM = "\\d+(?:[.,]\\d+)?";
const UNIT = "\\s*(?:trieu|tr|millions|million|m|k|nghin|ngan|vnd|dong|d)?";
const BUDGET_MAX = new RegExp(`(?:duoi|toi da|khong qua|under|below|less than|max|moins de|sous|<)\\s*${NUM}${UNIT}(?![a-z0-9])`);
const BUDGET_MIN = new RegExp(`(?:tren|it nhat|over|above|more than|min|plus de|>)\\s*${NUM}${UNIT}(?![a-z0-9])`);
const BUDGET_RANGE = new RegExp(`(?:tu|from|de|entre)?\\s*${NUM}${UNIT}\\s*(?:-|den|to|a|et)\\s*${NUM}${UNIT}(?![a-z0-9])`);

function cutRange(raw, start, end) {
  return (raw.slice(0, start) + " " + raw.slice(end)).replace(/\s+/g, " ").trim();
}

function removePhrase(raw, phrase) {
  const folded = foldKeep(raw);
  const re = new RegExp(`(^|[^a-z0-9])(${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![a-z0-9])`);
  const m = re.exec(folded);
  if (!m) return null;
  const start = m.index + m[1].length;
  return cutRange(raw, start, start + m[2].length);
}

/**
 * kind: "brand" | "term" | "category" | "max_price" | "min_price"; value: the understood value.
 * Returns the new query, or the same query when nothing matched.
 */
export function removeFromQuery(q, kind, value) {
  const raw = String(q || "");
  if (kind === "brand" || kind === "term") {
    return removePhrase(raw, fold(value)) ?? raw;
  }
  if (kind === "category") {
    for (const w of CATEGORY_WORDS[value] || []) {
      const out = removePhrase(raw, w);
      if (out !== null) return out;
    }
    return raw;
  }
  if (kind === "max_price" || kind === "min_price") {
    const folded = foldKeep(raw);
    for (const re of [BUDGET_RANGE, kind === "max_price" ? BUDGET_MAX : BUDGET_MIN]) {
      const m = re.exec(folded);
      if (m && /\d/.test(m[0])) return cutRange(raw, m.index, m.index + m[0].length);
    }
    return raw;
  }
  return raw;
}
