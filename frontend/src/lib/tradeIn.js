// Trade-in maths: how much CO₂ an old device's second life and a refurbished purchase avoid.
// Same rules as the rest of the project (docs/research/co2-formula.md §3.3–3.4):
//   - a reused or refurbished device carries REUSE_EMBODIED (20 %) of the manufacturing emissions;
//   - manufacturing emissions are spread evenly over the category's service life L.
// The constants mirror the backend; lib/tradeIn.test.js checks them against the source files.
const isNum = (x) => typeof x === "number" && Number.isFinite(x);

/** etl-worker green/co2_formula.py: REFURBISHED_EMBODIED — reuse avoids ~80 % of manufacturing. */
export const REUSE_EMBODIED = 0.2;

/** Share of "materials & production" in the lifecycle (etl-worker green/data/stage_shares.json). */
export const PRODUCTION_SHARE = { laptop: 0.75, smartphone: 0.8, tablet: 0.8, computer_monitor: 0.4, smartwatch: 0.85, headphone: 0.85 };

/** Service life L in years (etl-worker green/co2_formula.py CategoryParams, as in the CO₂ world). */
export const LIFETIME = { laptop: 4, smartphone: 3, tablet: 4, computer_monitor: 6, smartwatch: 3, headphone: 3 };

/** Search category slug -> CO₂ reference category. */
export const CAT_OF_SLUG = { laptops: "laptop", smartphones: "smartphone", tablets: "tablet", monitors: "computer_monitor", smartwatches: "smartwatch", headphones: "headphone" };

/** Default second life: half the category's service life, rounded up (laptop 2 of 4 years). */
export function defaultSecondLife(category) {
  return Math.ceil((LIFETIME[category] || 4) / 2);
}

/**
 * @param newKg            lifecycle CO₂ of the device to buy (kg)
 * @param newProductionKg  its "materials & production" stage in kg (from the API); falls back to share × total
 * @param newCategory      CO₂ category of the new device (for the fallback share)
 * @param old              { kg, category, action: "resell" | "recycle", years } — years the next owner keeps using it
 * @returns null when the inputs are not usable, otherwise every figure the page shows
 */
export function tradeIn({ newKg, newProductionKg = null, newCategory = null, old }) {
  if (!isNum(newKg) || newKg <= 0) return null;
  const prodNew = isNum(newProductionKg) && newProductionKg >= 0 ? newProductionKg : newKg * (PRODUCTION_SHARE[newCategory] ?? 0.75);
  const refurbSaving = prodNew * (1 - REUSE_EMBODIED);

  const oldKg = isNum(old?.kg) && old.kg > 0 ? old.kg : 0;
  const share = PRODUCTION_SHARE[old?.category] ?? 0.75;
  const L = LIFETIME[old?.category] ?? 4;
  const years = Math.max(0, Math.min(L, isNum(old?.years) ? old.years : defaultSecondLife(old?.category)));
  const embOld = oldKg * share;
  const resaleCredit = old?.action === "resell" ? embOld * (1 - REUSE_EMBODIED) * (years / L) : 0;

  const pct = (saved) => (saved / newKg) * 100;
  const options = {
    buyNew: { kg: newKg, saved: 0, pct: 0 },
    tradeIn: { kg: newKg - resaleCredit, saved: resaleCredit, pct: pct(resaleCredit) },
    refurb: { kg: newKg - refurbSaving, saved: refurbSaving, pct: pct(refurbSaving) },
    both: { kg: newKg - refurbSaving - resaleCredit, saved: refurbSaving + resaleCredit, pct: pct(refurbSaving + resaleCredit) },
  };
  const best = Object.entries(options).reduce((a, b) => (b[1].saved > a[1].saved ? b : a))[0];
  return { ...options, best, prodNew, refurbSaving, embOld, share, L, years, resaleCredit, oldKg };
}
