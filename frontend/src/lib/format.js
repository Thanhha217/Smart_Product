// Shared number / CO2 formatting and the 0-5 green-score colour scale.

const LOCALES = { en: "en-US", fr: "fr-FR", vi: "vi-VN" };

// fr-FR groups thousands with U+202F (narrow no-break space), which the UI font draws with zero width
// ("41745" instead of "41 745"); use a normal no-break space instead.
export function intlNumber(locale, options, value) {
  return new Intl.NumberFormat(locale, options).format(value).replace(/\u202f/g, "\u00a0");
}

// kg CO2e: 1 decimal when >= 1 kg, 2 decimals below; null -> null (caller shows "no CO2 figure").
export function formatKg(value, lang = "en") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  const digits = Math.abs(n) >= 1 ? 1 : 2;
  return intlNumber(LOCALES[lang] || LOCALES.en, { maximumFractionDigits: digits }, n);
}

export function formatVnd(value, lang = "en") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "–";
  return `${intlNumber(LOCALES[lang] || LOCALES.en, { maximumFractionDigits: 0 }, Number(value))} ₫`;
}

export function formatNum(value, lang = "en", digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "–";
  return intlNumber(LOCALES[lang] || LOCALES.en, { maximumFractionDigits: digits }, Number(value));
}

export function formatPct(value, lang = "en") {
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
