// The CO2 figure of one product, written out so a shopper can check it:
// which method produced it, which values went in, the formula, the substitution and the result.
//
// Everything here is read from GET /api/products/{id}/co2 (formula.detail, formula.steps,
// references, lifecycle, green_score_formula). Nothing is recomputed and nothing is invented:
// when a term is not in the payload it is left out of the formula instead of being guessed.
import { formatKg, formatNum, formatPct } from "./format";
import { formatPrice } from "./data";
import { tri } from "../i18n/LanguageContext";

const isNum = (value) => typeof value === "number" && Number.isFinite(value);

/** A formula is a list of tokens; tokens carrying `v` are variables and get a colour. */
const t = (text) => ({ text });
const v = (text, key) => ({ text, v: key });
const sup = (text, key) => ({ text, v: key, sup: true });

export const VAR_TONES = ["green", "blue", "amber", "violet", "slate"];

/** Stable colour per variable key, in the order the variables appear. */
export function toneMap(inputs) {
  const map = {};
  (inputs || []).forEach((input, i) => { map[input.key] = VAR_TONES[i % VAR_TONES.length]; });
  return map;
}

// ---------------------------------------------------------------- the methods

function manufacturer(co2, L3, k) {
  const ref = (co2.references || [])[0] || {};
  const kg = isNum(ref.co2e_kg) ? ref.co2e_kg : co2.product?.co2e_kg;
  return {
    title: L3("Số của hãng", "Manufacturer figure", "Chiffre du fabricant"),
    why: L3("Hãng đã công bố báo cáo môi trường cho đúng mẫu này, nên không phải ước tính gì cả.",
            "The manufacturer published an environmental report for this exact model, so nothing is estimated.",
            "Le fabricant a publié un rapport environnemental pour ce modèle exact : rien n'est estimé."),
    symbolic: [t("CO₂ = "), v(L3("số hãng công bố", "published figure", "chiffre publié"), "pcf")],
    filled: null,                       // the published figure is the result itself
    inputs: [{
      key: "pcf", label: L3("Số hãng công bố", "Published figure", "Chiffre publié"),
      value: k(kg), unit: "kg CO₂e",
      note: ref.name ? L3(`Báo cáo cho ${ref.name}`, `Report for ${ref.name}`, `Rapport pour ${ref.name}`) : null,
    }],
    limits: L3("Phạm vi tính theo đúng báo cáo của hãng; cách đo giữa các hãng có thể khác nhau.",
               "The scope is the one in the manufacturer's report; methods differ between manufacturers.",
               "Le périmètre est celui du rapport du fabricant ; les méthodes diffèrent d'un fabricant à l'autre."),
  };
}

function neighbourAverage(co2, L3, k, n) {
  const steps = co2.formula?.steps || [];
  const refs = steps.filter((s) => isNum(s.value_kg) && s.label_en !== "Average");
  const detail = co2.formula?.detail || {};
  const count = refs.length;
  const threshold = isNum(detail.threshold) ? n(detail.threshold, 2) : null;
  return {
    title: L3("Trung bình sản phẩm giống", "Average of similar products", "Moyenne de produits similaires"),
    why: L3("Hãng chưa công bố số cho mẫu này, nên hệ thống lấy những sản phẩm giống nhất đã có số của hãng.",
            "No published figure for this model, so the system takes the most similar products that do have one.",
            "Pas de chiffre publié pour ce modèle : le système prend les produits les plus proches qui en ont un."),
    symbolic: [t("CO₂ = ( "), v("CO₂₁", "refs"), t(" + "), v("CO₂₂", "refs"), t(" + … + "), v("CO₂ₙ", "refs"), t(" ) ÷ "), v("n", "n")],
    filled: count
      ? [t("= ( "), ...refs.flatMap((r, i) => (i ? [t(" + "), v(k(r.value_kg), "refs")] : [v(k(r.value_kg), "refs")])),
         t(" ) ÷ "), v(String(count), "n")]
      : null,
    inputs: [
      { key: "refs", label: L3("CO₂ của từng mẫu giống", "CO₂ of each similar product", "CO₂ de chaque produit proche"),
        value: count ? refs.map((r) => k(r.value_kg)).join(" · ") : null, unit: "kg CO₂e",
        note: L3("Mỗi số do chính hãng của mẫu đó công bố.", "Each one published by its own manufacturer.",
                 "Chacun publié par son propre fabricant.") },
      { key: "n", label: L3("n — số mẫu lấy trung bình", "n — how many products are averaged", "n — nombre de produits moyennés"),
        value: count ? String(count) : null, unit: null,
        note: threshold
          ? L3(`Chỉ lấy mẫu có độ giống ≥ ${threshold}.`, `Only products with a similarity ≥ ${threshold}.`,
               `Uniquement les produits avec une similarité ≥ ${threshold}.`)
          : null },
    ],
    limits: L3("Là ước tính: sản phẩm trông giống và tên gần nhau vẫn có thể khác linh kiện bên trong.",
               "This is an estimate: products that look and read alike can still differ inside.",
               "C'est une estimation : des produits qui se ressemblent peuvent différer à l'intérieur."),
  };
}

function categoryModel(co2, L3, k, n) {
  const d = co2.formula?.detail || {};
  const byBrand = Boolean(d.brand) && isNum(d.brand_median_kg);
  const median = byBrand ? d.brand_median_kg : d.category_median_kg;
  // the size factor exists only for the categories the model fits one for (laptops, monitors)
  const sized = isNum(d.screen_inch) && isNum(d.ref_inch) && isNum(d.slope);
  const sampleN = byBrand ? d.brand_n : d.n_refs;
  const inputs = [{
    key: "m",
    label: byBrand ? L3(`M — trung vị của ${d.brand}`, `M — median of ${d.brand}`, `M — médiane de ${d.brand}`)
                   : L3("M — trung vị của loại", "M — median of the category", "M — médiane de la catégorie"),
    value: isNum(median) ? k(median) : null, unit: "kg CO₂e",
    note: isNum(sampleN)
      ? L3(`Từ ${n(sampleN, 0)} mẫu có số của hãng.`, `From ${n(sampleN, 0)} models with a manufacturer figure.`,
           `À partir de ${n(sampleN, 0)} modèles avec chiffre fabricant.`)
      : null,
  }];
  if (sized) {
    inputs.push(
      { key: "s", label: L3("s — cỡ màn hình máy này", "s — this product's screen size", "s — taille d'écran de ce produit"),
        value: n(d.screen_inch, 1), unit: "inch", note: null },
      { key: "s0", label: L3("s₀ — cỡ chuẩn của loại", "s₀ — reference size of the category", "s₀ — taille de référence"),
        value: n(d.ref_inch, 1), unit: "inch", note: null },
      { key: "b", label: L3("b — độ dốc đo trên dữ liệu", "b — slope fitted on the data", "b — pente ajustée sur les données"),
        value: n(d.slope, 2), unit: null,
        note: L3("Màn hình to hơn thì CO₂ cao hơn, nhưng không theo tỉ lệ thẳng.",
                 "A bigger screen means more CO₂, but not in direct proportion.",
                 "Un écran plus grand émet plus de CO₂, mais pas proportionnellement.") },
    );
  }
  return {
    title: L3("Mức giữa của loại", "Category level", "Niveau de la catégorie"),
    why: sized
      ? L3("Không có mẫu nào đủ giống, nên hệ thống lấy mức giữa của loại rồi chỉnh theo cỡ màn hình.",
           "No product was similar enough, so the system takes the middle of the category and adjusts for screen size.",
           "Aucun produit assez proche : le système prend la médiane de la catégorie et l'ajuste à la taille d'écran.")
      : L3("Không có mẫu nào đủ giống, nên hệ thống lấy mức giữa của loại. Loại này không dùng cỡ màn hình.",
           "No product was similar enough, so the system takes the middle of the category. Screen size is not used here.",
           "Aucun produit assez proche : le système prend la médiane de la catégorie. La taille d'écran ne s'applique pas ici."),
    symbolic: sized
      ? [t("CO₂ = "), v("M", "m"), t(" × ( "), v("s", "s"), t(" ÷ "), v("s₀", "s0"), t(" )"), sup("b", "b")]
      : [t("CO₂ = "), v("M", "m")],
    filled: sized && isNum(median)
      ? [t("= "), v(k(median), "m"), t(" × ( "), v(n(d.screen_inch, 1), "s"), t(" ÷ "), v(n(d.ref_inch, 1), "s0"), t(" )"), sup(n(d.slope, 2), "b")]
      : null,
    inputs,
    limits: L3("Là ước tính cho cả nhóm: máy nhẹ hơn hay nặng hơn mức giữa đều nhận cùng một con số.",
               "An estimate for the whole group: products above and below the middle all get the same figure.",
               "Une estimation pour tout le groupe : les produits au-dessus comme en dessous reçoivent le même chiffre."),
  };
}

function eeioPrice(co2, L3, k, n, lang) {
  const d = co2.formula?.detail || {};
  return {
    title: L3("Theo giá bán", "Based on the price", "D'après le prix"),
    why: L3("Không có số của hãng và không đủ mẫu giống, nên hệ thống ước tính từ giá bán.",
            "No manufacturer figure and no close enough products, so the system estimates from the price.",
            "Ni chiffre fabricant ni produits assez proches : le système estime d'après le prix."),
    symbolic: [t("CO₂ = "), v(L3("giá (USD 2022)", "price (2022 USD)", "prix (USD 2022)"), "usd"), t(" × "),
               v(L3("hệ số ngành", "industry factor", "facteur sectoriel"), "factor")],
    filled: isNum(d.usd2022) && isNum(d.factor)
      ? [t("= "), v(n(d.usd2022, 2), "usd"), t(" × "), v(n(d.factor, 3), "factor")] : null,
    inputs: [
      { key: "usd", label: L3("Giá quy về USD năm 2022", "Price converted to 2022 USD", "Prix converti en USD 2022"),
        value: isNum(d.usd2022) ? n(d.usd2022, 2) : null, unit: "USD",
        note: isNum(d.price_vnd)
          ? L3(`Giá bán ${formatPrice(d.price_vnd, lang)}`, `List price ${formatPrice(d.price_vnd, lang)}`,
               `Prix affiché ${formatPrice(d.price_vnd, lang)}`)
          : null },
      { key: "factor", label: L3("Hệ số ngành (US EPA)", "Industry factor (US EPA)", "Facteur sectoriel (US EPA)"),
        value: isNum(d.factor) ? n(d.factor, 3) : null, unit: "kg CO₂e / USD", note: d.title || d.naics || null },
    ],
    limits: L3("Chỉ tính sản xuất và giao hàng, hẹp hơn cả vòng đời; bán đắt hơn sẽ ra số cao hơn.",
               "Covers production and delivery only, narrower than the whole life; a higher price gives a higher figure.",
               "Couvre seulement production et livraison ; un prix plus élevé donne un chiffre plus élevé."),
  };
}

function lifecycleFormula(co2, L3, k, n) {
  const d = co2.formula?.detail || {};
  const leak = isNum(d.refrigerant_kg_per_year) ? d.refrigerant_kg_per_year : 0;
  const perYear = L3("năm", "yr", "an");
  return {
    title: L3("Công thức vòng đời", "Lifecycle formula", "Formule de cycle de vie"),
    why: L3("Loại này dùng nhiều điện, nên CO₂ cộng từ sản xuất, điện lúc dùng và thải bỏ.",
            "This kind of appliance uses a lot of power, so CO₂ adds up production, electricity in use and disposal.",
            "Cet appareil consomme beaucoup : le CO₂ additionne fabrication, électricité à l'usage et fin de vie."),
    symbolic: [t("CO₂ = "), v("E_sx", "emb"), t(" + "), v("L", "life"), t(" × ( "), v(`kWh/${perYear}`, "kwh"),
               t(" × "), v("EF", "ef"), t(" ) + "), v("E_thải", "eol")],
    filled: [d.embodied_kg, d.lifetime_years, d.annual_kwh, d.ef_grid].every(isNum)
      ? [t("= "), v(k(d.embodied_kg), "emb"), t(" + "), v(n(d.lifetime_years, 0), "life"), t(" × ( "),
         v(n(d.annual_kwh, 0), "kwh"), t(" × "), v(n(d.ef_grid, 3), "ef"), t(" ) + "), v(k(d.eol_kg ?? 0), "eol")]
      : null,
    inputs: [
      { key: "emb", label: L3("E_sx — sản xuất", "E_prod — manufacturing", "E_fab — fabrication"),
        value: isNum(d.embodied_kg) ? k(d.embodied_kg) : null, unit: "kg CO₂e", note: null },
      { key: "life", label: L3("L — số năm dùng", "L — years of use", "L — années d'usage"),
        value: isNum(d.lifetime_years) ? n(d.lifetime_years, 0) : null, unit: L3("năm", "years", "ans"), note: null },
      { key: "kwh", label: L3("Điện mỗi năm", "Electricity per year", "Électricité par an"),
        value: isNum(d.annual_kwh) ? n(d.annual_kwh, 0) : null, unit: "kWh",
        note: { label: L3("theo nhãn năng lượng", "from the energy label", "d'après l'étiquette énergie"),
                rated_power: L3("theo công suất ghi trên máy", "from the rated power", "d'après la puissance indiquée"),
                category_default: L3("mức điển hình của loại", "typical for the category", "typique de la catégorie"),
              }[d.kwh_source] || null },
      { key: "ef", label: L3("EF — lưới điện Việt Nam", "EF — Vietnam power grid", "EF — réseau vietnamien"),
        value: isNum(d.ef_grid) ? n(d.ef_grid, 3) : null, unit: "kg CO₂e / kWh", note: null },
      { key: "eol", label: L3("E_thải — thải bỏ", "E_eol — end of life", "E_fin — fin de vie"),
        value: isNum(d.eol_kg) ? k(d.eol_kg) : null, unit: "kg CO₂e",
        note: leak ? L3(`Gồm rò rỉ ga ${n(leak, 2)} kg/năm.`, `Includes ${n(leak, 2)} kg/yr of refrigerant leakage.`,
                        `Inclut ${n(leak, 2)} kg/an de fuite de fluide.`) : null },
    ],
    limits: L3("Phần điện dựa trên số năm dùng và mức tiêu thụ giả định; dùng nhiều hay ít sẽ khác.",
               "The electricity part assumes a lifetime and a consumption level; heavy or light use changes it.",
               "La part électricité suppose une durée de vie et une consommation ; l'usage réel change le résultat."),
  };
}

const BUILDERS = {
  manufacturer, neighbor_average: neighbourAverage, llm_estimate: neighbourAverage,
  category_model: categoryModel, eeio_price: eeioPrice, lifecycle_formula: lifecycleFormula,
};

/**
 * One explanation object for a product's CO2 payload, or null when the product has no figure.
 * {method, kind, resultKg, scopeKey, confidence, title, why, symbolic, filled, inputs, sources, limits}
 */
export function co2Explanation(co2, lang = "en") {
  const L3 = tri(lang);
  const product = co2?.product;
  const method = co2?.formula?.method;
  const kg = product?.co2e_kg;
  if (!product || !isNum(kg) || !method || method === "none") return null;
  const build = BUILDERS[method];
  if (!build) return null;
  const k = (x) => formatKg(x, lang);
  const n = (x, digits = 1) => formatNum(x, lang, digits);
  const out = build(co2, L3, k, n, lang);
  return {
    method,
    kind: method === "manufacturer" ? "published" : "estimated",
    resultKg: kg,
    scopeKey: method === "eeio_price" ? "cradle_to_shelf" : "cradle_to_grave",
    confidence: isNum(product.co2e_confidence) ? product.co2e_confidence : null,
    sources: (co2.references || []).map((r) => ({ name: r.name, kg: r.co2e_kg, cosine: r.cosine, url: r.url, source: r.source })),
    ...out,
    inputs: (out.inputs || []).filter((i) => i.value !== null && i.value !== undefined && i.value !== ""),
  };
}

/** 5 × ln(U ÷ c) ÷ ln(U ÷ L), with this product's values. */
export function greenEquation(g, lang = "en") {
  if (!g || ![g.low, g.high, g.co2e_kg, g.score].every(isNum)) return null;
  const n = (x) => formatNum(x, lang, 1);
  return {
    symbolic: [t("5 × ln( "), v("U", "u"), t(" ÷ CO₂ ) ÷ ln( "), v("U", "u"), t(" ÷ "), v("L", "l"), t(" )")],
    filled: [t("= 5 × ln( "), v(n(g.high), "u"), t(" ÷ "), t(n(g.co2e_kg)), t(" ) ÷ ln( "), v(n(g.high), "u"),
             t(" ÷ "), v(n(g.low), "l"), t(" )")],
    score: g.score, low: g.low, high: g.high,
  };
}

/**
 * The lifecycle split, with its basis kept:
 *  - "formula": the stages were really computed for this product;
 *  - "typical_share": the stored figure is a single total and the shares are typical for the
 *    category, so pages must show them as an illustration, not as this product's measurements.
 */
export function lifecycle(lc) {
  const order = ["materials_production", "transport", "use", "end_of_life"];
  const stages = Array.isArray(lc?.stages) ? lc.stages : [];
  const parts = order
    .map((key) => stages.find((s) => s.key === key))
    .filter((s) => s && isNum(s.pct))
    .map((s) => ({ key: s.key, kg: isNum(s.kg) ? s.kg : null, pct: s.pct }));
  return { basis: lc?.basis || "none", measured: lc?.basis === "formula", parts, route: lc?.route || null };
}

/** "75%" for a stage label; null when the share is missing. */
export function stagePct(part, lang) {
  return part && isNum(part.pct) ? formatPct(part.pct, lang).replace(/[,.]0$/, "") : null;
}
