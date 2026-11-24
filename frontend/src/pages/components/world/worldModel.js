// What-if simulation and local (instant) explanations for the CO2 world.
// Scenarios are computed RELATIVE to the stored lifecycle split, so the baseline
// scenario reproduces the stored numbers exactly (YC-5); only the deltas are modelled.
import { formatKg, formatNum } from "../../../lib/format";
import { derive, methodText, GRID_EF_VN, TREE_KG_PER_YEAR } from "../story/storyText";
import { tri } from "../../../i18n/LanguageContext";
import { lifecycle as readLifecycle } from "../../../lib/co2Formula";
import { stageShareLine, stageText } from "../../../lib/lifecycleText";

export const STAGES = ["materials", "materials_production", "transport", "use", "end_of_life"];

// Same values as backend green/data/stage_shares.json and green/co2_formula.py.
export const ORIGINS = {
  CN: { sea: 1800, road: 300, vi: "Trung Quốc", en: "China", fr: "Chine" },
  VN: { sea: 0, road: 500, vi: "Việt Nam", en: "Vietnam", fr: "Vietnam" },
  TH: { sea: 1100, road: 300, vi: "Thái Lan", en: "Thailand", fr: "Thaïlande" },
  MY: { sea: 1200, road: 300, vi: "Malaysia", en: "Malaysia", fr: "Malaisie" },
};
const FREIGHT = { sea: 0.016, road: 0.105, air: 0.6 };      // kg CO2e per tonne-km
export const GRIDS = { vn: GRID_EF_VN, solar: 0.048 };       // solar PV ~0.048 kg/kWh (IPCC AR5 median, approximate)
export const REFURBISHED_EMBODIED = 0.2;                     // reuse avoids ~80 % of manufacturing
const LIFETIME = {
  smartphone: 3, laptop: 4, gaming_laptop: 4, tablet: 4, desktop: 5, computer_monitor: 6, television: 8,
  air_conditioner: 10, refrigerator: 12, washing_machine: 10, smartwatch: 3, headphone: 3, speaker: 5,
};

function routeKg(mass, origin, mode) {
  const o = ORIGINS[origin] || ORIGINS.CN;
  const seaFactor = mode === "air" ? FREIGHT.air : FREIGHT.sea;
  return (mass / 1000) * (o.sea * seaFactor + o.road * FREIGHT.road);
}

export function baseline(d) {
  const stages = Object.fromEntries((d?.lifecycle?.stages || []).map((s) => [s.key, s.kg]));
  const route = d?.lifecycle?.route || {};
  const years = d?.lifecycle?.use_phase?.years || LIFETIME[d?.product?.category] || 4;
  return {
    ok: (d?.lifecycle?.stages || []).length > 0,
    // The map opens on the import journey -- a factory abroad, a ship, Vietnam -- because that is
    // the story the Overview is drawn to tell, and the scene never names a country ("Country of
    // manufacture"). The country the backend guessed from the brand is one tap away in What-if,
    // where a dozen brands (Samsung, LG, Panasonic...) are assembled in Vietnam and travel by road.
    origin: "CN",
    mode: "sea",
    grid: "vn",
    years,
    refurbished: false,
    mass: route.mass_kg || 2,
    stages: {
      materials_production: stages.materials_production ?? 0,
      transport: stages.transport ?? 0,
      use: stages.use ?? 0,
      end_of_life: stages.end_of_life ?? 0,
    },
    total: d?.product?.co2e_kg ?? null,
  };
}

/** Stage kg for a scenario {origin, mode, grid, years, refurbished}. */
export function simulate(base, sc) {
  if (!base.ok) return { stages: base.stages, total: base.total };
  const b = base.stages;
  const mode = sc.origin === "VN" ? "sea" : sc.mode;          // nothing to fly inside Vietnam
  const r0 = routeKg(base.mass, base.origin, base.mode);
  const r1 = routeKg(base.mass, sc.origin, mode);
  const stages = {
    materials_production: b.materials_production * (sc.refurbished ? REFURBISHED_EMBODIED : 1),
    transport: r0 > 0 ? b.transport * (r1 / r0) : b.transport,
    use: b.use * (sc.years / base.years) * (GRIDS[sc.grid] / GRIDS.vn),
    end_of_life: b.end_of_life,
  };
  const total = Object.values(stages).reduce((a, v) => a + v, 0);
  return { stages, total };
}

export function isBaseline(base, sc) {
  return sc.origin === base.origin && sc.mode === base.mode && sc.grid === base.grid
    && Number(sc.years) === Number(base.years) && !sc.refurbished;
}

// ------------------------------------------------------------------ instant explanations

const k = (x, lang) => formatKg(x, lang) ?? "—";
const n = (x, lang, dg = 0) => formatNum(x, lang, dg);

/** Name of an origin country in the current language. */
export function originName(code, lang) {
  const o = ORIGINS[code || "CN"];
  return o ? (o[lang] ?? o.en) : code;
}

/** Local explanation of a topic from the real numbers, shown before (or instead of) the AI answer. */
export function presetExplain(topic, d, sim, sc, lang) {
  const x = derive(d);
  const st = x.stages;
  const p = d?.product || {};
  const origin = originName(sc?.origin, lang);
  const T = tri(lang);
  const label = (s) => (lang === "vi" ? s.label_vi : s.label_en);
  const pct = (key) => (st[key] ? n(st[key].pct, lang, 1) : "—");
  // how big a stage is, worded by what the data actually supports
  const lc = readLifecycle(d?.lifecycle);
  const sizeOf = (key) => {
    const part = lc.parts.find((x) => x.key === key);
    const line = stageShareLine(key, {
      measured: lc.measured,
      kgText: lc.measured && sim?.stages?.[key] !== undefined ? k(sim.stages[key], lang) : null,
      pctText: part ? `${n(part.pct, lang, 0)}%` : null,
    }, lang);
    return line ? `${line.charAt(0).toUpperCase()}${line.slice(1)}.` : "";
  };
  /** what it is, why it emits, what you can do — the three questions, in one answer */
  const threeQ = (key) => {
    const txt = stageText(key, lang, d?.lifecycle?.route);
    if (!txt) return null;
    return { title: txt.name, answer: `${txt.what} ${txt.why} ${sizeOf(key)}`.trim(), bullets: [txt.todo] };
  };
  const out = {
    co2e_total: {
      title: T("Tổng CO₂ cả vòng đời", "Lifecycle CO₂ total", "CO₂ total du cycle de vie"),
      answer: x.kg === null ? T("Sản phẩm chưa có số CO₂ đủ tin cậy nên hệ thống để trống thay vì đoán.", "No reliable CO₂ figure yet, so the system leaves it empty instead of guessing.",
                                "Pas encore de chiffre CO₂ fiable : le système laisse vide plutôt que de deviner.")
        : T(`${p.name} gây ra khoảng ${k(x.kg, lang)} kg CO₂e từ lúc khai thác nguyên liệu đến khi thải bỏ. Con số này tính theo cách: ${methodText(d?.formula?.method, lang)}.`,
            `${p.name} causes about ${k(x.kg, lang)} kg CO₂e from raw materials to disposal, computed with ${methodText(d?.formula?.method, lang)}.`,
            `${p.name} émet environ ${k(x.kg, lang)} kg CO₂e, des matières premières à la mise au rebut, calculé avec : ${methodText(d?.formula?.method, lang)}.`),
      bullets: x.kg === null ? [] : [
        T(`Tương đương ${n(x.trees, lang, 1)} cây xanh hấp thụ trong 1 năm.`, `Equal to ${n(x.trees, lang, 1)} trees absorbing for a year.`, `Autant que ce qu'absorbent ${n(x.trees, lang, 1)} arbres en un an.`),
        T(`Tương đương ${n(x.carKm, lang)} km chạy ô tô xăng.`, `Equal to ${n(x.carKm, lang)} km by petrol car.`, `Autant que ${n(x.carKm, lang)} km en voiture essence.`),
      ],
    },
    green_score: {
      title: T("Điểm xanh 0–5", "Green score 0–5", "Score vert 0–5"),
      answer: p.green_score === null || p.green_score === undefined ? T("Chưa có số CO₂ nên chưa có điểm xanh.", "No CO₂ figure, so no green score.", "Pas de chiffre CO₂, donc pas de score vert.")
        : T(`Điểm ${n(p.green_score, lang, 1)}/5 so với các sản phẩm cùng loại: 5 là ít CO₂ nhất trong khoảng hợp lý của loại, 0 là nhiều nhất. Công thức: 5 × ln(U ÷ CO₂) ÷ ln(U ÷ L).`,
            `${n(p.green_score, lang, 1)}/5 within its category: 5 is the lowest CO₂ in the plausible range, 0 the highest. Formula: 5 × ln(U ÷ CO₂) ÷ ln(U ÷ L).`,
            `${n(p.green_score, lang, 1)}/5 dans sa catégorie : 5 = le moins de CO₂ dans la plage plausible, 0 = le plus. Formule : 5 × ln(U ÷ CO₂) ÷ ln(U ÷ L).`),
      bullets: [],
    },
    confidence: {
      title: T("Độ tin cậy của con số", "How reliable is the number", "Fiabilité du chiffre"),
      answer: T(`Độ tin cậy ${n((d?.formula?.confidence || 0) * 100, lang)}%: số của hãng đúng mẫu là 90%, trung bình mẫu giống 50%, mức điển hình của loại 35%, theo giá bán 15%. Nguồn càng gần báo cáo của hãng thì càng tin được.`,
          `Confidence ${n((d?.formula?.confidence || 0) * 100, lang)}%: exact manufacturer figure 90%, similar-product average 50%, category level 35%, price-based 15%.`,
          `Fiabilité ${n((d?.formula?.confidence || 0) * 100, lang)} % : chiffre exact du fabricant 90 %, moyenne de produits similaires 50 %, niveau de catégorie 35 %, d'après le prix 15 %.`),
      bullets: [],
    },
    materials: {
      title: T("Khai thác nguyên liệu", "Raw materials", "Matières premières"),
      answer: T("Kim loại (đồng, nhôm, vàng, đất hiếm), nhựa và kính phải được khai thác và tinh chế trước khi làm linh kiện. Phần này được tính chung vào chặng sản xuất.",
                "Metals (copper, aluminium, gold, rare earths), plastics and glass are mined and refined before parts are made. This is counted inside production.",
                "Métaux (cuivre, aluminium, or, terres rares), plastiques et verre sont extraits et raffinés avant la fabrication des pièces. Cette part est comptée dans la fabrication."),
      bullets: [stageText("materials_production", lang, d?.lifecycle?.route).todo],
    },
    factory: threeQ("materials_production"),
    transport: {
      ...threeQ("transport"),
      bullets: [
        T("Nơi sản xuất và quãng đường là giả định theo hãng.", "Origin and distance are assumed from the brand.",
          "L'origine et la distance sont supposées d'après la marque."),
        stageText("transport", lang, d?.lifecycle?.route).todo,
      ],
    },
    use: threeQ("use"),
    grid: {
      title: T("Lưới điện Việt Nam", "Vietnam's grid", "Le réseau vietnamien"),
      answer: T(`Mỗi kWh điện lưới Việt Nam phát thải khoảng ${n(GRID_EF_VN, lang, 3)} kg CO₂e (năm 2024) vì còn nhiều nhiệt điện than. Điện mặt trời chỉ khoảng ${n(GRIDS.solar, lang, 3)} kg/kWh (số xấp xỉ).`,
                `Each kWh on Vietnam's grid emits about ${n(GRID_EF_VN, lang, 3)} kg CO₂e (2024) because of coal. Solar is only about ${n(GRIDS.solar, lang, 3)} kg/kWh (approximate).`,
                `Chaque kWh du réseau vietnamien émet environ ${n(GRID_EF_VN, lang, 3)} kg CO₂e (2024) à cause du charbon. Le solaire n'émet qu'environ ${n(GRIDS.solar, lang, 3)} kg/kWh (approximatif).`),
      bullets: [],
    },
    end_of_life: threeQ("end_of_life"),
    formula: {
      title: T("Công thức đã dùng", "The formula used", "La formule utilisée"),
      answer: T(`Hệ thống thử 4 cách theo thứ tự và dừng ở cách đầu tiên ra số: trùng đúng mẫu của hãng → trung bình mẫu giống (≥ 66%) → công thức / mức của loại / theo giá → để trống. Sản phẩm này dùng: ${methodText(d?.formula?.method, lang)}.`,
                `Four methods in order, stopping at the first that gives a number: exact model → similar products (≥ 66%) → formula / category / price → empty. This product uses: ${methodText(d?.formula?.method, lang)}.`,
                `Quatre méthodes dans l'ordre, arrêt à la première qui donne un chiffre : modèle exact → produits similaires (≥ 66 %) → formule / catégorie / prix → vide. Ce produit utilise : ${methodText(d?.formula?.method, lang)}.`),
      bullets: (d?.formula?.steps || []).slice(-3).map((s) => `${label(s)}: ${s.expr}`),
    },
    category: {
      title: T("So với sản phẩm cùng loại", "Compared with its category", "Face à sa catégorie"),
      answer: d?.stats?.greener_than_pct !== null && d?.stats?.greener_than_pct !== undefined
        ? T(`Xanh hơn ${n(d.stats.greener_than_pct, lang)}% trong ${n(d.stats.n, lang)} sản phẩm cùng loại; mức giữa của loại là ${k(d.stats.median_kg, lang)} kg.`,
            `Greener than ${n(d.stats.greener_than_pct, lang)}% of ${n(d.stats.n, lang)} products of its type; median ${k(d.stats.median_kg, lang)} kg.`,
            `Plus vert que ${n(d.stats.greener_than_pct, lang)} % des ${n(d.stats.n, lang)} produits du même type ; médiane ${k(d.stats.median_kg, lang)} kg.`)
        : T("Chưa đủ dữ liệu thống kê cho loại này.", "Not enough data for this category.", "Pas assez de données pour cette catégorie."),
      bullets: [],
    },
    greener_alternative: {
      title: T("Món xanh hơn", "Greener alternative", "Alternative plus verte"),
      answer: d?.related?.greener_alternative
        ? T(`${d.related.greener_alternative.name}: ${k(d.related.greener_alternative.co2e_kg, lang)} kg CO₂e, giá tương đương.`,
            `${d.related.greener_alternative.name}: ${k(d.related.greener_alternative.co2e_kg, lang)} kg CO₂e at a similar price.`,
            `${d.related.greener_alternative.name} : ${k(d.related.greener_alternative.co2e_kg, lang)} kg CO₂e, à prix proche.`)
        : T("Chưa tìm thấy món xanh hơn ở mức giá tương đương.", "No greener product at a similar price found.", "Aucun produit plus vert trouvé à prix proche."),
      bullets: [],
    },
    wefe: {
      title: T("Nước – Năng lượng – Lương thực – Hệ sinh thái", "Water – Energy – Food – Ecosystems", "Eau – Énergie – Alimentation – Écosystèmes"),
      answer: T(`Một lựa chọn mua sắm chạm tới cả bốn: điện năng (~${n(x.kwhLife, lang)} kWh trong vòng đời), nước làm mát nhà máy nhiệt điện, đất canh tác khi rác điện tử bị vứt sai, và cây xanh cần để hấp thụ CO₂ (${n(x.trees, lang, 1)} cây trong 1 năm).`,
                `One purchase touches all four: power (~${n(x.kwhLife, lang)} kWh over its life), cooling water for thermal plants, farmland when e-waste is dumped, and trees to absorb the CO₂ (${n(x.trees, lang, 1)} for a year).`,
                `Un achat touche les quatre : l'électricité (~${n(x.kwhLife, lang)} kWh sur sa vie), l'eau de refroidissement des centrales, les terres agricoles quand les déchets électroniques sont abandonnés, et les arbres pour absorber le CO₂ (${n(x.trees, lang, 1)} pendant un an).`),
      bullets: [],
    },
    what_if: {
      title: T("Kịch bản mô phỏng", "What-if scenario", "Scénario « et si »"),
      answer: T(`Với lựa chọn hiện tại, tổng là ${k(sim?.total, lang)} kg CO₂e so với số chính thức ${k(x.kg, lang)} kg. Đây là mô phỏng để so sánh, số chính thức không đổi.`,
                `With these choices the total is ${k(sim?.total, lang)} kg CO₂e against the official ${k(x.kg, lang)} kg. A simulation for comparison; the official number does not change.`,
                `Avec ces choix, le total est de ${k(sim?.total, lang)} kg CO₂e contre ${k(x.kg, lang)} kg officiellement. Une simulation pour comparer : le chiffre officiel ne change pas.`),
      bullets: [],
    },
  };
  const item = out[topic] || out.co2e_total;
  const ups = FOLLOW_UPS[topic];
  return { ...item, topic, follow_ups: ups ? (ups[lang] ?? ups.en) : [] };
}

const FOLLOW_UPS = {
  co2e_total: { vi: ["Phần nào lớn nhất?", "Làm sao giảm con số này?"], en: ["Which part is the largest?", "How can I reduce it?"], fr: ["Quelle part est la plus grande ?", "Comment réduire ce chiffre ?"] },
  factory: { vi: ["Vì sao sản xuất chiếm nhiều CO₂?", "Máy tân trang giảm được bao nhiêu?"], en: ["Why is manufacturing so large?", "How much does refurbished save?"], fr: ["Pourquoi la fabrication pèse-t-elle autant ?", "Combien économise le reconditionné ?"] },
  transport: { vi: ["Nếu đi máy bay thì sao?", "Sản xuất ở Việt Nam có tốt hơn?"], en: ["What if it flew?", "Is made in Vietnam better?"], fr: ["Et s'il voyageait en avion ?", "Fabriqué au Vietnam, c'est mieux ?"] },
  use: { vi: ["Dùng điện mặt trời thì giảm bao nhiêu?", "Dùng lâu hơn có lợi không?"], en: ["How much does solar save?", "Is using it longer better?"], fr: ["Combien fait gagner le solaire ?", "L'utiliser plus longtemps, c'est mieux ?"] },
  grid: { vi: ["Vì sao điện Việt Nam nhiều CO₂?", "Điện mặt trời áp mái giúp gì?"], en: ["Why is Vietnam's power carbon-heavy?", "What does rooftop solar change?"], fr: ["Pourquoi l'électricité vietnamienne émet-elle tant ?", "Que change le solaire en toiture ?"] },
  end_of_life: { vi: ["Tái chế điện tử ở đâu?", "Rác điện tử gây hại gì?"], en: ["Where to recycle e-waste?", "What harm does e-waste do?"], fr: ["Où recycler l'électronique ?", "Quels dégâts font les déchets électroniques ?"] },
  formula: { vi: ["Vì sao không để AI đoán số?", "Ngưỡng 66% là gì?"], en: ["Why not let AI guess?", "What is the 66% threshold?"], fr: ["Pourquoi ne pas laisser l'IA deviner ?", "C'est quoi le seuil de 66 % ?"] },
  what_if: { vi: ["Lựa chọn nào giảm nhiều nhất?", "Vì sao máy bay tăng mạnh?"], en: ["Which choice cuts the most?", "Why does flying add so much?"], fr: ["Quel choix réduit le plus ?", "Pourquoi l'avion ajoute-t-il autant ?"] },
};

export const TREE_KG = TREE_KG_PER_YEAR;
