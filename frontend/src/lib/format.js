// Shared number / CO2 formatting and the 0-5 green-score colour scale.

const LOCALES = { vi: "vi-VN", en: "en-US" };

// kg CO2e: 1 decimal when >= 1 kg, 2 decimals below; null -> null (caller shows "no CO2 figure").
export function formatKg(value, lang = "vi") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  const digits = Math.abs(n) >= 1 ? 1 : 2;
  return new Intl.NumberFormat(LOCALES[lang] || LOCALES.vi, { maximumFractionDigits: digits }).format(n);
}

export function formatVnd(value, lang = "vi") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "–";
  return `${new Intl.NumberFormat(LOCALES[lang] || LOCALES.vi, { maximumFractionDigits: 0 }).format(Number(value))} ₫`;
}

export function formatNum(value, lang = "vi", digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "–";
  return new Intl.NumberFormat(LOCALES[lang] || LOCALES.vi, { maximumFractionDigits: digits }).format(Number(value));
}

export function formatPct(value, lang = "vi") {
  if (value === null || value === undefined) return "–";
  return `${formatNum(value, lang, 1)}%`;
}

// Red (0) -> amber -> green (5). Same scale for cards, charts and tables.
export function greenColor(score) {
  if (score === null || score === undefined) return "#9ca3af";
  const s = Math.max(0, Math.min(5, Number(score)));
  const hue = Math.round((s / 5) * 120);
  return `hsl(${hue}, 70%, 40%)`;
}

export function greenBg(score) {
  if (score === null || score === undefined) return "#f3f4f6";
  const s = Math.max(0, Math.min(5, Number(score)));
  return `hsl(${Math.round((s / 5) * 120)}, 70%, 94%)`;
}

export function hasCo2(product) {
  return product && product.co2e_kg !== null && product.co2e_kg !== undefined;
}
