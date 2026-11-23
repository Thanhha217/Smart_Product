// /method — follow one real product through the four steps:
// pick a product -> find the source -> see the calculation -> read the result.
//
// The example is a live catalogue row, not a figure typed into this file, and the walk-through
// is the same component the Overview and the product page use, so the three never disagree.
// The reference tables, assumptions and limits stay underneath, collapsed.
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { tri, useI18n } from "../i18n/LanguageContext";
import { METHOD, METHOD_EXTRA, NOT_IN_CATALOGUE, RESULT_SOURCE } from "../i18n/method";
import { explore } from "../i18n/explore";
import { api } from "../api/client";
import { normalizeList } from "../lib/data";
import { formatKg } from "../lib/format";
import { useRecent } from "../lib/recent";
import Co2Explainer from "./components/co2/Co2Explainer";
import LifecycleJourney from "./components/co2/LifecycleJourney";
import ProductThumb from "./components/common/ProductThumb";
import DeviceIcon from "./components/ui/DeviceIcon";
import { ErrorState, InlineSpinner } from "./components/common/States";

const STEPS = [
  { key: "pick", icon: "compare" },
  { key: "source", icon: "low_co2" },
  { key: "calc", icon: "energy_label" },
  { key: "result", icon: "recycle" },
];

function stepText(lang) {
  const L3 = tri(lang);
  return {
    pick: [L3("Chọn sản phẩm", "Pick a product", "Choisir un produit"),
           L3("Mỗi con số gắn với một sản phẩm cụ thể, không có số chung chung.",
              "Every figure belongs to one specific product; there is no generic number.",
              "Chaque chiffre appartient à un produit précis ; il n'y a pas de chiffre générique.")],
    source: [L3("Xác định nguồn", "Find the source", "Déterminer la source"),
             L3("Hệ thống thử 4 cách theo thứ tự và dừng ở cách đầu tiên ra được số.",
                "The system tries four methods in order and stops at the first that yields a number.",
                "Le système essaie quatre méthodes dans l'ordre et s'arrête à la première qui donne un chiffre.")],
    calc: [L3("Xem cách tính", "See the calculation", "Voir le calcul"),
           L3("Công thức, các giá trị đầu vào và phép thay số đều hiện ra.",
              "The formula, the values that went in and the substitution are all shown.",
              "La formule, les valeurs utilisées et la substitution sont toutes affichées.")],
    result: [L3("Hiểu kết quả", "Read the result", "Lire le résultat"),
             L3("Kèm phạm vi tính, điểm xanh trong cùng loại và giới hạn của cách tính.",
                "With its scope, the green score within the category and the limits of the method.",
                "Avec son périmètre, le score vert dans la catégorie et les limites de la méthode.")],
  };
}

function Details({ title, children }) {
  return (
    <details className="group rounded-2xl border border-[#EFEBDF] bg-white">
      <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-3 font-semibold text-[16.5px] text-[#1E2B22]">
        {title}<span aria-hidden="true" className="text-[#6b7280] transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="px-5 pb-5 flex flex-col gap-3">{children}</div>
    </details>
  );
}

/** Pick which real product the page walks through. */
function ProductPicker({ options, current, onPick, lang }) {
  const L3 = tri(lang);
  if (!options.length) return null;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={L3("Chọn sản phẩm làm ví dụ", "Choose the example product", "Choisir le produit exemple")}>
      {options.map((p) => {
        const on = p.product_id === current;
        return (
          <button key={p.product_id} type="button" onClick={() => onPick(p.product_id)} aria-pressed={on}
                  className={`flex items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition max-w-[260px] ${
                    on ? "border-[#2E7D4F] bg-[#F7FBF6] shadow-sm" : "border-[#EFEBDF] bg-white hover:border-[#2E7D4F]"}`}>
            <ProductThumb product={p} size={36} standIn={false} />
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-[#1E2B22] line-clamp-1">{p.name}</span>
              <span className="block text-[13px] text-[#6B7468]">
                {p.co2e_kg !== null ? `${formatKg(p.co2e_kg, lang)} kg CO₂e` : L3("chưa có số", "no figure", "pas de chiffre")}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function Method() {
  const { lang, t } = useI18n();
  const L3 = tri(lang);
  const m = METHOD[lang] || METHOD.en;
  const x = METHOD_EXTRA[lang] || METHOD_EXTRA.en;
  const X = explore(lang);
  const S = useMemo(() => stepText(lang), [lang]);
  const recent = useRecent();
  const [params, setParams] = useSearchParams();

  const [options, setOptions] = useState([]);
  const [chosen, setChosen] = useState(params.get("product") || null);
  const [co2, setCo2] = useState(null);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState(0);

  // the choices: what the visitor just looked at, plus the greenest product of each category
  useEffect(() => {
    let alive = true;
    api.getOverview()
      .then((o) => {
        if (!alive) return;
        const fromData = normalizeList((o?.greenest || []).map((g) => g.product));
        const all = [...recent.slice(0, 2), ...fromData];
        const seen = new Set();
        setOptions(all.filter((p) => p && !seen.has(p.product_id) && seen.add(p.product_id)).slice(0, 5));
      })
      .catch(() => alive && setOptions(recent.slice(0, 3)));
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!chosen && options.length) setChosen(options[0].product_id);
  }, [options, chosen]);

  useEffect(() => {
    let alive = true;
    if (!chosen) return undefined;
    setCo2(null); setFailed(false);
    api.getProductCo2(chosen)
      .then((d) => alive && setCo2(d))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [chosen]);

  const pick = (id) => {
    setChosen(id);
    const next = new URLSearchParams(params);
    next.set("product", id);
    setParams(next, { replace: true });
    setStep(1);
  };

  const method = co2?.formula?.method;

  return (
    <main className="page-wrap py-6 flex flex-col gap-6 max-w-5xl">
      <header>
        <h1 className="page-title">{m.title}</h1>
        <p className="page-lead">
          {L3("Con số CO₂ cho biết sản phẩm này gây ra bao nhiêu khí nhà kính, từ lúc đào nguyên liệu đến khi thải bỏ. Trang này đi theo một sản phẩm thật để bạn thấy con số đó ở đâu ra.",
              "A CO₂ figure says how much greenhouse gas a product causes, from mining the materials to throwing it away. This page follows one real product so you can see where its figure comes from.",
              "Un chiffre CO₂ dit combien de gaz à effet de serre un produit provoque, de l'extraction des matières à la mise au rebut. Cette page suit un produit réel pour montrer d'où vient ce chiffre.")}
        </p>
      </header>

      {/* the four steps, as a rail you can jump around in */}
      <nav aria-label={L3("Các bước", "The steps", "Les étapes")} className="grid gap-2 sm:grid-cols-4">
        {STEPS.map((s, i) => {
          const [title, sub] = S[s.key];
          const on = i === step;
          return (
            <button key={s.key} type="button" onClick={() => setStep(i)} aria-current={on ? "step" : undefined}
                    className={`text-left rounded-2xl border px-3 py-2.5 transition ${on ? "border-[#2E7D4F] bg-[#F7FBF6] shadow-sm" : "border-[#EFEBDF] bg-white hover:border-[#2E7D4F]"}`}>
              <span className="flex items-center gap-2">
                <span className={`grid place-items-center w-8 h-8 rounded-xl shrink-0 ${on ? "bg-[#1F5D3A] text-white" : "bg-[#F1EEE4] text-[#55604F]"}`}>
                  <DeviceIcon name={s.icon} size={18} tint={false} />
                </span>
                <span className="text-[15px] font-bold text-[#1E2B22]">{i + 1}. {title}</span>
              </span>
              <span className="mt-1 block text-[13.5px] leading-snug text-[#6B7468]">{sub}</span>
            </button>
          );
        })}
      </nav>

      <section className="rounded-3xl bg-[#F7FBF6] border border-[#DCEBD9] p-4 sm:p-5">
        <h2 className="text-[19px] font-bold text-[#1E2B22]">{S.pick[0]}</h2>
        <p className="text-[15px] text-[#6B7468]">
          {L3("Những sản phẩm dưới đây lấy từ dữ liệu thật. Bấm một món để xem con số của nó.",
              "These products come from the live catalogue. Tap one to follow its figure.",
              "Ces produits viennent du catalogue réel. Touchez-en un pour suivre son chiffre.")}
        </p>
        <div className="mt-3">
          {options.length === 0
            ? <InlineSpinner label={L3("Đang tải sản phẩm", "Loading products", "Chargement des produits")} />
            : <ProductPicker options={options} current={chosen} onPick={pick} lang={lang} />}
        </div>
      </section>

      {failed && <ErrorState body={X.errorBody} onRetry={() => setChosen((c) => c)} />}

      {co2 && (
        <>
          {step >= 1 && (
            <section>
              <h2 className="text-[20px] font-bold text-[#1E2B22]">2. {S.source[0]}</h2>
              <p className="text-[15.5px] text-[#55604F]">{S.source[1]}</p>
              <ol className="mt-3 grid gap-2 sm:grid-cols-4">
                {m.chain.map((c, i) => {
                  const on = c.key === method || (method === "llm_estimate" && c.key === "neighbor_average");
                  return (
                    <li key={c.key} className={`rounded-2xl border px-3 py-2.5 ${on ? "border-[#2E7D4F] bg-[#E4F1E6]" : "border-[#EFEBDF] bg-white"}`}>
                      <p className="text-[13px] font-bold text-[#6B7468]">{i + 1}</p>
                      <p className={`text-[15.5px] font-bold ${on ? "text-[#1F5D3A]" : "text-[#1E2B22]"}`}>{c.label}</p>
                      <p className="text-[13.5px] leading-snug text-[#6B7468]">{c.sub}</p>
                      {on && <p className="mt-1 text-[12.5px] font-semibold text-[#1F5D3A]">
                        ← {L3("sản phẩm này dừng ở đây", "this product stops here", "ce produit s'arrête ici")}</p>}
                    </li>
                  );
                })}
              </ol>
              <p className="mt-2 text-[13.5px] text-[#6B7468]">{x.confidenceNote}</p>
            </section>
          )}

          {step >= 2 && (
            <section>
              <h2 className="text-[20px] font-bold text-[#1E2B22]">3. {S.calc[0]}</h2>
              <p className="text-[15.5px] text-[#55604F]">{S.calc[1]}</p>
              <div className="mt-3"><Co2Explainer co2={co2} open /></div>
            </section>
          )}

          {step >= 3 && (
            <section>
              <h2 className="text-[20px] font-bold text-[#1E2B22]">4. {S.result[0]}</h2>
              <p className="text-[15.5px] text-[#55604F]">{S.result[1]}</p>
              <div className="mt-3"><LifecycleJourney lifecycle={co2.lifecycle} /></div>
            </section>
          )}

          {step < 3 && (
            <button type="button" onClick={() => setStep(step + 1)} className="btn-primary self-start">
              {L3("Bước tiếp theo", "Next step", "Étape suivante")}: {S[STEPS[step + 1].key][0]} →
            </button>
          )}
        </>
      )}

      <section aria-labelledby="basics">
        <h2 id="basics" className="text-[20px] font-bold text-[#1E2B22]">{x.basicTitle}</h2>
        <dl className="mt-3 grid gap-3 md:grid-cols-2">
          {x.basics.map(([q, a]) => (
            <div key={q} className="rounded-2xl bg-white border border-[#EFEBDF] p-4">
              <dt className="font-semibold text-[16.5px] text-[#1E2B22]">{q}</dt>
              <dd className="mt-1 text-[15.5px] leading-relaxed text-[#374151]">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="tech" className="flex flex-col gap-3">
        <div>
          <h2 id="tech" className="text-[20px] font-bold text-[#1E2B22]">{x.techTitle}</h2>
          <p className="text-[15.5px] text-[#55604F]">{x.techLead}</p>
        </div>

        {m.methods.map((mm) => (
          <Details key={mm.key} title={
            <span className="flex flex-wrap items-center gap-2">
              {mm.name}
              <span className="text-[13px] font-mono bg-[#eef4ec] rounded-full px-2 py-0.5">{mm.label}</span>
              {NOT_IN_CATALOGUE.includes(mm.key) && (
                <span className="text-[12.5px] text-[#8A5A00] bg-[#FBEFD3] rounded-full px-2 py-0.5">{x.notUsed}</span>
              )}
            </span>}>
            <p className="text-[15px]"><span className="font-semibold">{t("method.when")}:</span> {mm.when}</p>
            <p className="font-mono text-[14px] bg-[#f6f3ea] rounded-xl px-3 py-2 overflow-x-auto">{mm.formula}</p>
            <p className="text-[15px]"><span className="font-semibold">{t("method.example")}:</span> {mm.example}</p>
            <p className="text-[13.5px] text-[#6b7280]">{x.exampleNote}</p>
            <p className="text-[15px] text-green-800"><span className="font-semibold">{t("method.accuracy")}:</span> {mm.accuracy}</p>
          </Details>
        ))}

        <Details title={m.useTitle}>
          <p className="font-mono text-[14px] bg-[#f6f3ea] rounded-xl px-3 py-2 overflow-x-auto">{m.greenScore}</p>
          <p className="font-mono text-[14px] bg-[#f6f3ea] rounded-xl px-3 py-2 overflow-x-auto">{m.rrf}</p>
          <p className="text-[15px] text-gray-600">{m.rrfNote}</p>
          <p className="text-[15px] text-gray-600">{m.gridNote}</p>
        </Details>

        <Details title={m.resultsTitle}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[14.5px]">
              <thead>
                <tr className="text-left bg-[#f6f3ea]">
                  {[...m.resultsHead, x.sourceCol].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {m.results.map((row, r) => (
                  <tr key={row[0]} className="border-t border-[#efece2] align-top">
                    {row.map((c, i) => <td key={i} className={`px-3 py-2 ${i === 0 ? "font-semibold" : ""}`}>{c}</td>)}
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[13px] ${RESULT_SOURCE[r] === "repo" ? "bg-[#dcefe0] text-[#1F5D3A]" : "bg-[#f3f4f6] text-[#4b5563]"}`}>
                        {RESULT_SOURCE[r] === "repo" ? x.fromRepo : x.fromDoc}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Details>

        <Details title={m.limitsTitle}>
          <ul className="list-disc pl-5 text-[15px] flex flex-col gap-1">
            {m.limits.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </Details>
      </section>

      <p className="flex flex-wrap gap-3">
        <Link to={chosen ? `/world/${chosen}` : "/world"} className="btn-primary">{X.eyebrow}</Link>
        <Link to="/search" className="btn-secondary">{X.linkSearch}</Link>
        <Link to="/assistant" className="btn-secondary">{X.askTitle}</Link>
      </p>
    </main>
  );
}
