// The CO2 formula of one product, written out term by term in the visitor's language.
// Every number comes from GET /api/products/{id}/co2 (formula.detail / formula.steps / lifecycle /
// green_score_formula); the result shown is always product.co2e_kg, never recomputed here.
import { formatKg, formatNum } from "./format";
import { tri } from "../i18n/LanguageContext";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** Formula of the method that produced the stored total: symbolic form, the same with values, terms. */
export function methodEquation(formula, product, lang = "en") {
  const L3 = tri(lang);
  const k = (v) => formatKg(v, lang);
  const n = (v, d = 2) => formatNum(v, lang, d);
  const method = formula?.method;
  const total = product?.co2e_kg;
  if (!method || method === "none" || !isNum(total)) return null;
  const detail = formula.detail || {};
  const steps = Array.isArray(formula.steps) ? formula.steps : [];
  const base = { method, resultKg: total, terms: [] };

  if (method === "manufacturer") {
    const v = steps[0]?.value_kg;
    return {
      ...base,
      symbolic: L3("CO₂ = số hãng công bố cho đúng mẫu này", "CO₂ = figure the manufacturer published for this exact model",
                   "CO₂ = chiffre publié par le fabricant pour ce modèle exact"),
      filled: null,          // the published figure is the result itself
      terms: isNum(v) ? [{ label: steps[0]?.label_en?.replace(/^Reference: /, "") || "", kg: v }] : [],
      short: L3("báo cáo của hãng", "manufacturer report", "rapport du fabricant"),
      note: L3("Số đo thật trong báo cáo môi trường của hãng.", "A measured figure from the manufacturer's environmental report.",
               "Un chiffre mesuré, tiré du rapport environnemental du fabricant."),
    };
  }
  if (method === "neighbor_average" || method === "llm_estimate") {
    const refs = steps.filter((s) => isNum(s.value_kg) && s.label_en !== "Average");
    const terms = refs.map((s) => ({ label: (s.label_en || "").replace(/\s*\(cosine [^)]*\)$/, ""), kg: s.value_kg }));
    const thr = isNum(detail.threshold) ? n(detail.threshold) : n(0.66);
    return {
      ...base,
      terms,
      symbolic: L3("CO₂ = (CO₂₁ + CO₂₂ + … + CO₂ₙ) ÷ n", "CO₂ = (CO₂₁ + CO₂₂ + … + CO₂ₙ) ÷ n", "CO₂ = (CO₂₁ + CO₂₂ + … + CO₂ₙ) ÷ n"),
      filled: terms.length ? `(${terms.map((t) => k(t.kg)).join(" + ")}) ÷ ${terms.length}` : null,
      short: L3(`trung bình ${terms.length} mẫu giống`, `average of ${terms.length} similar products`, `moyenne de ${terms.length} produits proches`),
      note: L3(`${terms.length} sản phẩm giống nhất (độ giống ≥ ${thr}) có số CO₂ do hãng công bố.`,
               `${terms.length} most similar products (similarity ≥ ${thr}) with a manufacturer CO₂ figure.`,
               `${terms.length} produits les plus proches (similarité ≥ ${thr}) avec un chiffre CO₂ du fabricant.`),
    };
  }
  if (method === "category_model") {
    const med = isNum(detail.brand_median_kg) && detail.brand ? detail.brand_median_kg : detail.category_median_kg;
    const sized = isNum(detail.screen_inch) && isNum(detail.ref_inch) && isNum(detail.slope);
    const who = detail.brand && isNum(detail.brand_median_kg) ? detail.brand : L3("loại", "category", "catégorie");
    return {
      ...base,
      symbolic: L3("CO₂ = trung vị × (inch ÷ inch chuẩn)^b", "CO₂ = median × (inch ÷ reference inch)^b",
                   "CO₂ = médiane × (pouces ÷ pouces de référence)^b"),
      filled: isNum(med) ? (sized ? `${k(med)} × (${n(detail.screen_inch, 1)} ÷ ${n(detail.ref_inch, 1)})^${n(detail.slope)}` : `${k(med)}`) : null,
      terms: isNum(med) ? [{ label: L3(`Trung vị ${who}`, `Median of ${who}`, `Médiane ${who}`), kg: med }] : [],
      short: L3("trung vị của loại, chỉnh theo cỡ", "category median, size-adjusted", "médiane de catégorie, ajustée"),
      note: L3("Mức giữa của các mẫu cùng loại có số của hãng, chỉnh theo cỡ màn hình.",
               "Middle value of same-type models with manufacturer figures, adjusted for screen size.",
               "Valeur médiane des modèles du même type avec chiffre fabricant, ajustée à la taille d'écran."),
    };
  }
  if (method === "lifecycle_formula" && isNum(detail.embodied_kg)) {
    const life = detail.lifetime_years, kwh = detail.annual_kwh, ef = detail.ef_grid, refr = detail.refrigerant_kg_per_year || 0;
    return {
      ...base,
      symbolic: L3("CO₂ = E_sx + L × (kWh/năm × EF_VN + rò rỉ ga) + E_thải bỏ", "CO₂ = E_prod + L × (kWh/yr × EF_VN + leakage) + E_eol",
                   "CO₂ = E_fab + L × (kWh/an × EF_VN + fuites) + E_fin"),
      filled: [life, kwh, ef].every(isNum)
        ? `${k(detail.embodied_kg)} + ${n(life, 0)} × (${n(kwh, 0)} × ${n(ef, 3)} + ${n(refr)}) + ${k(detail.eol_kg ?? 0)}` : null,
      short: L3("công thức vòng đời", "lifecycle formula", "formule de cycle de vie"),
      note: L3("Điện tiêu thụ nhân hệ số lưới điện Việt Nam.", "Electricity used times the Vietnamese grid factor.",
               "Électricité consommée multipliée par le facteur du réseau vietnamien."),
    };
  }
  if (method === "eeio_price" && isNum(detail.usd2022)) {
    return {
      ...base,
      symbolic: L3("CO₂ = giá (USD 2022) × hệ số ngành", "CO₂ = price (2022 USD) × industry factor", "CO₂ = prix (USD 2022) × facteur sectoriel"),
      filled: isNum(detail.factor) ? `${n(detail.usd2022)} USD × ${n(detail.factor, 3)}` : null,
      short: L3("theo giá bán", "price based", "d'après le prix"),
      note: L3("Chỉ tính sản xuất và giao hàng, phạm vi hẹp hơn cả vòng đời.", "Covers production and delivery only, a narrower scope than the whole life.",
               "Couvre seulement la production et la livraison, un périmètre plus étroit que la vie entière."),
    };
  }
  return { ...base, symbolic: formula.expression || null, filled: null, note: null };
}

/** Lifecycle split: total = production + transport + use + end of life, each with its share. */
export function lifecycleParts(lifecycle) {
  const stages = Array.isArray(lifecycle?.stages) ? lifecycle.stages : [];
  const order = ["materials_production", "transport", "use", "end_of_life"];
  return order
    .map((key) => stages.find((s) => s.key === key))
    .filter((s) => s && isNum(s.kg))
    .map((s) => ({ key: s.key, kg: s.kg, pct: isNum(s.pct) ? s.pct : null }));
}

/** 5 × ln(U ÷ c) ÷ ln(U ÷ L) with the product's values. */
export function greenEquation(g, lang = "en") {
  if (!g || ![g.low, g.high, g.co2e_kg, g.score].every(isNum)) return null;
  const k = (v) => formatNum(v, lang, 1);
  return {
    symbolic: "5 × ln(U ÷ CO₂) ÷ ln(U ÷ L)",
    filled: `5 × ln(${k(g.high)} ÷ ${k(g.co2e_kg)}) ÷ ln(${k(g.high)} ÷ ${k(g.low)})`,
    score: g.score,
    low: g.low,
    high: g.high,
  };
}
