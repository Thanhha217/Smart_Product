// Which compared product to recommend, and by how much, from the figures already on the page.
// Only differences and percentages of displayed values: no product's CO₂ is ever recomputed.
// The caller decides whether the products compare at all (same category, same CO₂ scope).
const isNum = (x) => typeof x === "number" && Number.isFinite(x);

/** true when `value` is the single best of at least two different values (by `better`). */
function uniqueBest(values, value, better) {
  const vals = values.filter(isNum);
  if (!isNum(value) || vals.length < 2) return false;
  const best = vals.reduce((a, b) => (better(b, a) ? b : a));
  const allSame = vals.every((v) => v === vals[0]);
  return !allSame && value === best && vals.filter((v) => v === best).length === 1;
}

/**
 * @param products  normalized products ({product_id, co2e_kg, price_vnd, green_score, ...})
 * @param median    category median CO₂ in kg, or null
 * @returns null when fewer than two products have a CO₂ figure; otherwise
 *   { best, runner, co2: {diff, pct}, price: {diff, pct} | null, cat: {diff, pct, median} | null,
 *     badges: {lowestCo2, cheapest, greenest} }
 *   co2.diff = runner − best (≥ 0, kg saved); price.diff = best − runner (negative = cheaper);
 *   cat.diff = best − median (negative = below the median). Percentages are of the value compared with.
 */
export function recommend(products, median = null) {
  const withCo2 = (products || []).filter((p) => isNum(p?.co2e_kg));
  if (withCo2.length < 2) return null;
  const price = (p) => (isNum(p.price_vnd) && p.price_vnd > 0 ? p.price_vnd : Infinity);
  const green = (p) => (isNum(p.green_score) ? p.green_score : -Infinity);
  const sorted = [...withCo2].sort((a, b) => a.co2e_kg - b.co2e_kg || price(a) - price(b) || green(b) - green(a));
  const [best, runner] = sorted;

  const co2Diff = runner.co2e_kg - best.co2e_kg;
  const out = {
    best,
    runner,
    co2: { diff: co2Diff, pct: runner.co2e_kg > 0 ? (co2Diff / runner.co2e_kg) * 100 : 0 },
    price: null,
    cat: null,
    badges: {
      lowestCo2: co2Diff > 0,
      cheapest: uniqueBest(products.map((p) => (isNum(p.price_vnd) && p.price_vnd > 0 ? p.price_vnd : null)), best.price_vnd, (a, b) => a < b),
      greenest: uniqueBest(products.map((p) => p.green_score), best.green_score, (a, b) => a > b),
    },
  };
  if (isNum(best.price_vnd) && best.price_vnd > 0 && isNum(runner.price_vnd) && runner.price_vnd > 0) {
    const diff = best.price_vnd - runner.price_vnd;
    out.price = { diff, pct: (Math.abs(diff) / runner.price_vnd) * 100 };
  }
  if (isNum(median) && median > 0) {
    const diff = best.co2e_kg - median;
    out.cat = { diff, pct: (Math.abs(diff) / median) * 100, median };
  }
  return out;
}

/** Position (0–100 %) of a value on a bar that ends a little past the largest value shown. */
export function barScale(values) {
  const max = Math.max(...values.filter(isNum), 0);
  return max > 0 ? max * 1.08 : 1;
}
