// "How is this CO₂ calculated?" in three steps, as in the design: find the inputs, combine them,
// read the result. Every number comes from the product's CO₂ payload (formula.steps, formula.detail,
// references) and the result is always the stored product.co2e_kg.
import { tri, useI18n } from "../../../i18n/LanguageContext";
import { formatKg, formatNum } from "../../../lib/format";
import DeviceIcon from "../ui/DeviceIcon";

const isNum = (x) => typeof x === "number" && Number.isFinite(x);

function StepHead({ n, title, sub, dark = false }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`font-display text-[38px] leading-none ${dark ? "text-[#7FA88C]" : "text-[#B9CDBD]"}`}>{String(n).padStart(2, "0")}</span>
      <div className="pt-1">
        <p className={`text-[16.5px] font-bold ${dark ? "text-white" : "text-[#1E2B22]"}`}>{title}</p>
        {sub && <p className={`text-[14px] ${dark ? "text-[#BFD8C6]" : "text-[#6B7468]"}`}>{sub}</p>}
      </div>
    </div>
  );
}

/** Dark green result column with the big figure. */
function ResultPanel({ n, title, sub, lead, kg, lang, L3, scope }) {
  return (
    <div className="relative overflow-hidden bg-[#1B4332] text-white p-5 sm:p-6 flex flex-col min-h-[260px]">
      <StepHead n={n} title={title} sub={sub} dark />
      <div className="mt-auto pt-6">
        {lead && <p className="font-display text-[26px] text-[#D7EBDD]">{lead}</p>}
        <p className="font-display text-[64px] sm:text-[72px] leading-none font-semibold">{formatKg(kg, lang)}</p>
        <p className="mt-1 text-[15px] text-[#D7EBDD]"><b className="text-white">kg CO₂e</b> · {scope}</p>
      </div>
      <svg className="pointer-events-none absolute -right-8 -bottom-10 w-48 h-48 opacity-15" viewBox="0 0 200 200" aria-hidden="true">
        <path d="M20 180 C 60 120, 140 160, 120 90 S 60 20, 180 30" fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** Horizontal bars of the inputs with a marker at the result. */
function InputBars({ rows, mark, lang, L3, caption }) {
  const max = Math.max(...rows.map((r) => r.kg), mark || 0) * 1.08 || 1;
  const at = (v) => `${(v / max) * 100}%`;
  return (
    <div className="mt-5">
      <div className="relative">
        <ul className="space-y-2.5">
          {rows.map((r, i) => (
            <li key={i} className="grid grid-cols-[78px_1fr_44px] items-center gap-3 text-[14.5px]" title={r.name || undefined}>
              <span className="text-[#55604F] truncate">{L3(`Mẫu ${i + 1}`, `Product ${i + 1}`, `Produit ${i + 1}`)}</span>
              <span className="relative h-3.5 rounded-full bg-[#EEF0EA]">
                <span className="absolute inset-y-0 left-0 rounded-full bg-[#3F8A5A]" style={{ width: at(r.kg) }} />
              </span>
              <b className="text-right text-[#1E2B22]">{formatKg(r.kg, lang)}</b>
            </li>
          ))}
        </ul>
        {isNum(mark) && (
          <div className="pointer-events-none absolute inset-y-0 grid grid-cols-[78px_1fr_44px] gap-3" style={{ left: 0, right: 0 }}>
            <span />
            <span className="relative">
              <span className="absolute -top-2 -bottom-2 w-[2px] bg-[#C26A1E]" style={{ left: at(mark) }} />
              <span className="absolute -bottom-9 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#1B4332] px-2.5 py-0.5 text-[12.5px] font-bold text-white"
                    style={{ left: at(mark) }}>
                {L3("TB", "Avg", "Moy.")} {formatKg(mark, lang)}
              </span>
            </span>
            <span />
          </div>
        )}
      </div>
      <p className="mt-12 text-[13px] text-[#7d8579]">{caption}</p>
    </div>
  );
}

/** Column addition: the numbers right-aligned, a "+" on the last line, the total under a rule. */
function ColumnSum({ values, total, lang, caption }) {
  return (
    <div className="mt-5 flex flex-col items-end font-display text-[26px] leading-[1.35] text-[#33403A] pr-2">
      {values.map((v, i) => (
        <span key={i} className="tabular-nums">
          {i === values.length - 1 && <span className="mr-5 text-[22px] text-[#2E7D4F]">+</span>}
          {formatKg(v, lang)}
        </span>
      ))}
      <span className="mt-1 self-stretch border-t-2 border-[#1E2B22] ml-10" aria-hidden="true" />
      <span className="mt-1 text-[32px] font-semibold text-[#1E2B22] tabular-nums">{formatKg(total, lang)}</span>
      <span className="mt-2 font-sans text-[13px] text-[#7d8579]">{caption}</span>
    </div>
  );
}

/** Three steps for one product, or null when the method has no three-step reading. */
export function threeSteps(co2, lang) {
  const L3 = tri(lang);
  const p = co2?.product;
  const method = co2?.formula?.method;
  const kg = p?.co2e_kg;
  if (!p || !isNum(kg)) return null;
  const steps = co2.formula?.steps || [];
  const refs = co2.references || [];
  const d = co2.formula?.detail || {};
  const cat = String(p.category || "").replace(/_/g, " ");

  if (method === "neighbor_average" || method === "llm_estimate") {
    const rows = steps.filter((s) => isNum(s.value_kg) && s.label_en !== "Average")
      .map((s, i) => ({ kg: s.value_kg, name: refs[i]?.name || null }));
    if (!rows.length) return null;
    const total = rows.reduce((a, r) => a + r.kg, 0);
    const n = rows.length;
    return {
      kind: "estimated", methodName: L3("Trung bình sản phẩm giống", "Average of similar products", "Moyenne de produits proches"),
      cols: [
        { title: L3("Tìm sản phẩm giống", "Find similar products", "Trouver les produits proches"),
          sub: L3(`${n} sản phẩm giống món này`, `${n} ${n === 1 ? "product" : "products"} like this one`, `${n} produit(s) comme celui-ci`),
          body: (lng) => <InputBars rows={rows} mark={kg} lang={lng} L3={L3} caption={L3("kg CO₂e mỗi sản phẩm, cả vòng đời", "kg CO₂e per product, whole life", "kg CO₂e par produit, cycle de vie")} /> },
        { title: L3("Cộng lại", "Add them up", "Les additionner"), sub: L3(`Tổng của cả ${n}`, `The total of all ${n}`, `Le total des ${n}`),
          body: (lng) => <ColumnSum values={rows.map((r) => r.kg)} total={total} lang={lng} caption={L3("kg CO₂e tổng cộng", "kg CO₂e in total", "kg CO₂e au total")} /> },
      ],
      result: { title: L3("Chia cho số sản phẩm", "Divide by the count", "Diviser par le nombre"),
                sub: L3("Tổng ÷ số sản phẩm", "Total ÷ number of products", "Total ÷ nombre de produits"),
                lead: `${formatKg(total, lang)} ÷ ${n} =` },
      list: rows,
    };
  }
  if (method === "manufacturer") {
    const ref = refs[0] || {};
    return {
      kind: "published", methodName: L3("Số của hãng", "Manufacturer figure", "Chiffre du fabricant"),
      cols: [
        { title: L3("Tìm báo cáo của hãng", "Find the maker's report", "Trouver le rapport du fabricant"),
          sub: L3("Báo cáo môi trường cho đúng mẫu", "The environmental report for this model", "Le rapport environnemental de ce modèle"),
          body: (lng) => <InputBars rows={[{ kg: isNum(ref.co2e_kg) ? ref.co2e_kg : kg, name: ref.name }]} lang={lng} L3={L3}
                                     caption={ref.name || ""} /> },
        { title: L3("Đối chiếu đúng mẫu", "Check it is this model", "Vérifier le modèle"),
          sub: L3("Tên sản phẩm khớp tên trong báo cáo", "The product name matches the report", "Le nom correspond au rapport"),
          body: () => <p className="mt-6 text-[16px] text-[#1F5D3A] font-semibold">✓ {L3("Khớp đúng mẫu, không cần ước tính", "Exact match, nothing to estimate", "Correspondance exacte, rien à estimer")}</p> },
      ],
      result: { title: L3("Dùng nguyên số của hãng", "Use the published figure", "Reprendre le chiffre publié"), sub: L3("Không có phép tính", "No arithmetic", "Aucun calcul"), lead: null },
      list: ref.name ? [{ kg: ref.co2e_kg, name: ref.name }] : [],
    };
  }
  if (method === "category_model") {
    const byBrand = Boolean(d.brand) && isNum(d.brand_median_kg);
    const M = byBrand ? d.brand_median_kg : d.category_median_kg;
    const sized = isNum(d.screen_inch) && isNum(d.ref_inch) && isNum(d.slope);
    const factor = sized ? (d.screen_inch / d.ref_inch) ** d.slope : null;
    if (!isNum(M)) return null;
    return {
      kind: "estimated", methodName: L3("Mức giữa của loại", "Category level", "Niveau de la catégorie"),
      cols: [
        { title: L3("Lấy mức giữa của loại", "Take the category median", "Prendre la médiane"),
          sub: byBrand ? L3(`Trung vị của ${d.brand}`, `Median of ${d.brand}`, `Médiane de ${d.brand}`)
                       : L3(`Trung vị của nhóm ${cat}`, `Median of ${cat}`, `Médiane de ${cat}`),
          body: (lng) => <InputBars rows={[{ kg: M }]} lang={lng} L3={L3}
                                     caption={isNum(d.n_refs) ? L3(`Từ ${formatNum(d.n_refs, lng, 0)} mẫu có số của hãng`, `From ${formatNum(d.n_refs, lng, 0)} models with a published figure`, `À partir de ${formatNum(d.n_refs, lng, 0)} modèles`) : ""} /> },
        { title: L3("Chỉnh theo cỡ màn hình", "Adjust for screen size", "Ajuster à la taille"),
          sub: sized ? `(${formatNum(d.screen_inch, lang, 1)} ÷ ${formatNum(d.ref_inch, lang, 1)})^${formatNum(d.slope, lang, 2)}`
                     : L3("Loại này không dùng cỡ màn hình", "Not used for this category", "Non utilisé pour cette catégorie"),
          body: () => <p className="mt-6 font-display text-[34px] text-[#1E2B22]">× {sized ? formatNum(factor, lang, 3) : "1"}</p> },
      ],
      result: { title: L3("Kết quả", "The result", "Le résultat"), sub: L3("M × hệ số", "M × factor", "M × facteur"),
                lead: sized ? `${formatKg(M, lang)} × ${formatNum(factor, lang, 3)} =` : null },
      list: [],
    };
  }
  return null;
}

export default function ThreeSteps({ co2, example = false }) {
  const { lang, t } = useI18n();
  const L3 = tri(lang);
  const p = co2?.product;
  const model = threeSteps(co2, lang);
  if (!p || !model) return null;
  const scope = t(`common.scope.${co2.formula?.method === "eeio_price" ? "cradle_to_shelf" : "cradle_to_grave"}`);

  return (
    <article className="rounded-[26px] bg-white border border-[#E8E4D8] shadow-[0_10px_30px_-18px_rgba(30,43,34,.35)] overflow-hidden">
      <header className="flex items-center gap-4 px-5 sm:px-7 py-5 border-b border-[#EFEBDF]">
        <span className="grid place-items-center w-14 h-14 rounded-2xl bg-[#EEF5EF] text-[#2E7D4F] shrink-0">
          <DeviceIcon name={p.category} size={28} />
        </span>
        <div className="min-w-0">
          <p className="text-[17px] font-bold text-[#1E2B22] leading-snug line-clamp-2">{p.name}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-[#6B7468]">
            {example && <span className="rounded-md bg-[#FBEFD3] px-2 py-0.5 text-[13px] font-semibold text-[#8A5A00]">{L3("Ví dụ minh họa", "Worked example", "Exemple")}</span>}
            <span className={`rounded-md px-2 py-0.5 text-[13px] font-semibold first-letter:uppercase ${model.kind === "published" ? "bg-[#DCEFE0] text-[#1F5D3A]" : "bg-[#EFEDE6] text-[#55604F]"}`}>
              {t(model.kind === "published" ? "common.co2Published" : "common.co2Estimated")}
            </span>
            <span>{model.methodName} · {scope}</span>
          </p>
        </div>
      </header>
      <div className="grid lg:grid-cols-[1.55fr_1fr_1.05fr]">
        {model.cols.map((c, i) => (
          <section key={i} className={`p-5 sm:p-6 ${i === 0 ? "lg:border-r border-b lg:border-b-0 border-[#EFEBDF]" : "border-b lg:border-b-0 border-[#EFEBDF]"}`}>
            <StepHead n={i + 1} title={c.title} sub={c.sub} />
            {c.body(lang)}
          </section>
        ))}
        <ResultPanel n={3} title={model.result.title} sub={model.result.sub} lead={model.result.lead} kg={p.co2e_kg} lang={lang} L3={L3} scope={scope} />
      </div>
    </article>
  );
}
