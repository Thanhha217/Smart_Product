// Matching what a person types against device types, without accents and with common model names
// ("mac" -> laptops, "ip" -> phones and tablets, "tai nghe" -> headphones). Pure, unit-tested.

/** Lower case, accents removed, đ -> d, spaces collapsed. */
export function fold(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Words that point to a device type (search slug), folded. */
export const TYPE_WORDS = {
  laptops: ["laptop", "may tinh xach tay", "notebook", "macbook", "thinkpad", "vivobook", "zenbook", "ideapad", "elitebook", "inspiron", "latitude", "surface laptop"],
  smartphones: ["dien thoai", "phone", "smartphone", "iphone", "galaxy", "oppo", "xiaomi", "redmi", "vivo", "realme", "pixel"],
  tablets: ["may tinh bang", "tablet", "ipad", "galaxy tab", "idea tab", "matepad"],
  monitors: ["man hinh", "monitor", "display"],
  headphones: ["tai nghe", "headphone", "earphone", "earbuds", "airpods", "buds"],
  smartwatches: ["dong ho", "watch", "smartwatch", "apple watch", "galaxy watch"],
};

/**
 * Device types a typed text points to, best first. A type matches when one of its words starts with
 * the text (typing "lap", "dien"), or when the text contains one of its words ("macbook air").
 */
export function matchTypes(text) {
  const q = fold(text);
  if (!q) return [];
  const scored = [];
  for (const [slug, words] of Object.entries(TYPE_WORDS)) {
    let best = 0;
    for (const w of words) {
      if (w === q) best = Math.max(best, 3);
      else if (w.startsWith(q)) best = Math.max(best, 2);
      else if (q.split(" ").some((part) => part.length >= 2 && w.startsWith(part)) && q.length >= 2) best = Math.max(best, 1);
      else if (new RegExp(`(^| )${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(q)) best = Math.max(best, 2);
    }
    if (best) scored.push([slug, best]);
  }
  return scored.sort((a, b) => b[1] - a[1]).map(([slug]) => slug);
}

/** [before, match, after] for highlighting `text` inside `label`, ignoring case and accents; null when absent. */
export function splitMatch(label, text) {
  const q = fold(text);
  if (!q) return null;
  const chars = [...String(label)];
  const folded = chars.map((c) => fold(c) || c);        // one entry per visible character, so indices line up
  const joined = folded.join("");
  const at = joined.indexOf(q);
  if (at < 0) return null;
  let pos = 0, start = -1, end = -1;
  for (let i = 0; i < folded.length; i += 1) {
    if (start < 0 && pos >= at) start = i;
    pos += folded[i].length;
    if (pos >= at + q.length) { end = i + 1; break; }
  }
  if (start < 0 || end < 0) return null;
  return [chars.slice(0, start).join(""), chars.slice(start, end).join(""), chars.slice(end).join("")];
}
