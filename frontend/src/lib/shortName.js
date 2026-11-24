// A short product name for compact cards: "Laptop Macbook Air 13 inch M5 24GB/512GB 70W" -> "MacBook Air 13".
// Display only; the full name stays in the title attribute and on the product page.

// Category words the shops put in front of the name (Vietnamese and English)
const LEADING = [
  "máy tính xách tay", "máy tính bảng", "màn hình máy tính", "màn hình gaming", "màn hình di động", "màn hình", "điện thoại di động",
  "điện thoại", "đồng hồ thông minh", "đồng hồ", "tai nghe bluetooth", "tai nghe chụp tai", "tai nghe có dây",
  "tai nghe không dây", "tai nghe", "laptop gaming", "laptop", "gaming", "smartwatch", "tablet", "monitor",
  "true wireless", "bluetooth", "có dây", "chụp tai", "không dây",
];
const BRAND_CASE = { macbook: "MacBook", iphone: "iPhone", ipad: "iPad", aoc: "AOC", msi: "MSI", hp: "HP", lg: "LG", asus: "Asus" };

/** A token that starts the specs part of the name: sizes, memory, model codes, brackets, separators. */
function isSpec(tok, next, kept, hasCode) {
  // "27 inch" after a model code is a spec (AOC 27B36XE 27 inch); without one it names the model (MacBook Air 13 inch)
  if (/^\d+(\.\d+)?$/.test(tok) && /^(inch|in|"|”)$/i.test(next || "")) return hasCode;
  // a long hyphenated code once the name already reads well (MSI Modern 14 B11MOU-1027VN); MSI PRO MP275Q-E14 keeps it
  if (/^[A-Za-z0-9]+-[A-Za-z0-9-]+$/.test(tok) && /\d/.test(tok) && tok.length > 6) return kept >= 3;
  return /^[([{]/.test(tok)                       // (27 inch, WQHD...)
    || /^[-–|/,]$/.test(tok)                       // separators
    || /^(inch|in|"|”|''|wifi|wi-fi|lte|cellular)$/i.test(tok)
    || /^\d+(\.\d+)?("|”|inch)$/i.test(tok)        // 27", 13inch
    || /^\d+\s*(gb|tb|mb|mah|hz|w|mm)\b/i.test(tok) // 8GB, 512GB, 144Hz, 70W
    || /\d+gb\/\d+/i.test(tok)                     // 8GB/256GB
    || /^\d[gG]$/.test(tok)                         // 5G, 4G
    || /^[A-Z0-9]+\.[A-Z0-9.]+$/.test(tok) && /\d/.test(tok) // part numbers: UM.HS2SV.001
    || /^(core|ryzen|intel|amd|snapdragon|m[1-9])$/i.test(tok);
}

/** The configuration that tells look-alike cards apart: "8GB/128GB", "Ultra 5 225U, 16GB"; "" when there is none. */
export function variantOf(name) {
  const s = String(name || "");
  const inBrackets = s.match(/\(([^)]*)\)/);
  if (inBrackets && /\d/.test(inBrackets[1]) && /gb|tb|ultra|core|ryzen|r[3579]|m[1-9]|hz|inch/i.test(inBrackets[1])) {
    return inBrackets[1].split(",").slice(0, 2).map((x) => x.trim()).filter(Boolean).join(", ");
  }
  const mem = s.match(/\d+\s?GB\s?\/\s?\d+\s?(GB|TB)/i) || s.match(/\b\d+\s?(GB|TB)\b/i);
  if (mem) return mem[0].replace(/\s+/g, "");
  const mm = s.match(/\b\d{2}\s?mm\b/i);
  return mm ? mm[0].replace(/\s+/g, "") : "";
}

export function shortName(name, maxWords = 4) {
  let s = String(name || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const lower = s.toLowerCase();
  for (const lead of LEADING) {
    if (lower.startsWith(`${lead} `)) { s = s.slice(lead.length).trim(); break; }
  }
  // a second category word can follow ("Laptop Gaming MSI ...", "Tai nghe Bluetooth True Wireless ...")
  for (let i = 0; i < 2; i += 1) {
    const l2 = s.toLowerCase();
    const hit = LEADING.find((lead) => l2.startsWith(`${lead} `));
    if (hit) s = s.slice(hit.length).trim();
  }
  const out = [];
  const toks = s.split(" ");
  for (let i = 0; i < toks.length; i += 1) {
    const tok = toks[i];
    if (out.length && isSpec(tok, toks[i + 1], out.length, out.some((w) => /\d/.test(w)))) break;
    out.push(BRAND_CASE[tok.toLowerCase()] || tok);
    if (out.length >= maxWords) break;
  }
  const short = out.join(" ").replace(/[-–,]+$/, "").trim();
  return short || String(name).trim();
}
