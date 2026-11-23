// Top-left card of the CO2 world: the product, its total, and the CO2 formula written out
// with this product's own numbers (method -> total, then the green score).
import { Link } from "react-router-dom";
import { tri } from "../../../i18n/LanguageContext";
import { formatKg, formatNum, greenColor } from "../../../lib/format";
import { co2Kind } from "../../../lib/data";
import { greenEquation, methodEquation } from "../../../lib/co2Formula";

/** Number line: each similar product as a dot, the average (= stored total) as the marker. */
function NeighbourStrip({ terms, total, lang }) {
  const values = [...terms.map((t) => t.kg), total];
  const lo = Math.min(...values) * 0.9, hi = Math.max(...values) * 1.05;
  const x = (v) => 8 + ((v - lo) / (hi - lo || 1)) * 284;
  return (
    <svg viewBox="0 0 300 40" className="w-full h-8" role="img"
         aria-label={terms.map((t) => `${t.label} ${formatKg(t.kg, lang)} kg`).join(", ")}>
      <line x1="8" x2="292" y1="16" y2="16" stroke="#d1d5db" strokeWidth="2" />
      {terms.map((t, i) => (
        <g key={i}>
          <title>{`${t.label}: ${formatKg(t.kg, lang)} kg`}</title>
          <circle cx={x(t.kg)} cy="16" r="6" fill="#8fbf9f" stroke="#fff" strokeWidth="2" />
        </g>
      ))}
      <line x1={x(total)} x2={x(total)} y1="4" y2="28" stroke="#1F5D3A" strokeWidth="3" />
      <text x={Math.min(262, Math.max(30, x(total)))} y="39" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1F5D3A">
        ⌀ {formatKg(total, lang)} kg
      </text>
    </svg>
  );
}

function Line({ n, title, sub, tip, symbolic, filled, result, children }) {
  return (
    <div className="rounded-2xl bg-[#F3F8F1] border border-[#DCEBD9] px-3 py-1.5" title={tip || undefined}>
      <p className="text-[13px] font-bold text-[#2E7D4F]">
        <span className="inline-grid place-items-center w-5 h-5 mr-1.5 rounded-full bg-[#1F5D3A] text-white text-[11.5px]">{n}</span>
        <span className="uppercase tracking-wide">{title}</span>{sub && <span className="font-medium text-[#4b5563]"> · {sub}</span>}
      </p>
      {symbolic && <p className="mt-0.5 font-mono text-[13.5px] text-[#374151]">{symbolic}</p>}
      {(filled || result) && (
        <p className="font-mono text-[14px] tracking-tight text-[#16324a] break-words">
          {filled ? <>= {filled} </> : null}<b className="text-[#1F5D3A]">= {result}</b>
        </p>
      )}
      {children}
    </div>
  );
}

export default function FormulaHud({ d, lang, T, t, onTopic, onFormula, compact = false }) {
  const L3 = tri(lang);
  const p = d.product;
  const eq = methodEquation(d.formula, p, lang);
  const g = greenEquation(d.green_score_formula, lang);
  const kind = co2Kind(p);
  return (
    <div className="rounded-3xl bg-white/95 backdrop-blur shadow-xl border border-white p-3 md:p-4">
      <p className="text-[13px] uppercase tracking-widest text-emerald-700 font-semibold">🌏 {L3("Thế giới CO₂ của sản phẩm", "The product's CO₂ world", "Le monde CO₂ du produit")}</p>
      <h1 className="font-extrabold text-[#16324a] leading-tight text-lg md:text-xl line-clamp-2">{p.name}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" data-explain="co2e_total" onClick={() => onTopic("co2e_total")}
                className="rounded-full px-3.5 py-1.5 text-[16px] font-bold bg-emerald-600 text-white hover:shadow">
          {p.co2e_kg !== null ? `${formatKg(p.co2e_kg, lang)} kg CO₂e` : L3("Chưa có số CO₂", "No CO₂ figure", "Pas de chiffre CO₂")}
        </button>
        {p.green_score !== null && p.green_score !== undefined && (
          <button type="button" data-explain="green_score" onClick={() => onTopic("green_score")}
                  className="rounded-full px-3.5 py-1.5 text-[15px] font-semibold text-white hover:shadow" style={{ background: greenColor(p.green_score) }}>
            {T.greenScore} {formatNum(p.green_score, lang, 1)}/5
          </button>
        )}
        {p.co2e_kg !== null && (
          <span className={`rounded-full px-2 py-0.5 text-[12.5px] ${kind === "published" ? "bg-[#dcefe0] text-[#1F5D3A]" : "bg-[#f3f4f6] text-[#4b5563]"}`}>
            {t(kind === "published" ? "common.co2Published" : "common.co2Estimated")}
          </span>
        )}
      </div>

      {eq && compact && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[15px] font-extrabold text-[#16324a]">🧮 {L3("Xem công thức CO₂", "Show the CO₂ formula", "Voir la formule CO₂")}</summary>
          <Formula eq={eq} g={g} lang={lang} T={T} L3={L3} onFormula={onFormula} />
        </details>
      )}
      {eq && !compact && <Formula eq={eq} g={g} lang={lang} T={T} L3={L3} onFormula={onFormula} />}
    </div>
  );
}

function Formula({ eq, g, lang, T, L3, onFormula }) {
  return (
        <section className="mt-2 space-y-1.5" aria-label={L3("Công thức CO₂", "CO₂ formula", "Formule CO₂")}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-extrabold text-[#16324a]">🧮 {L3("Công thức CO₂", "CO₂ formula", "Formule CO₂")}</h2>
            <span className="flex gap-2 text-[13.5px] font-semibold whitespace-nowrap">
              <button type="button" data-explain="formula" onClick={onFormula} className="text-sky-700 underline">
                {L3("Từng bước", "Step by step", "Pas à pas")} ›
              </button>
              <Link to="/method" className="text-sky-700 underline">{T.method}</Link>
            </span>
          </div>
          <Line n={1} title={L3("Tổng CO₂ cả vòng đời", "Whole-life CO₂", "CO₂ sur toute la vie")}
                sub={eq.short} tip={eq.note} symbolic={eq.symbolic} filled={eq.filled} result={`${formatKg(eq.resultKg, lang)} kg`}>
            {eq.terms.length > 1 && <NeighbourStrip terms={eq.terms} total={eq.resultKg} lang={lang} />}
          </Line>
          {g && (
            <Line n={2} title={L3("Điểm xanh (0–5)", "Green score (0–5)", "Score vert (0–5)")}
                  sub={`L–U = ${formatNum(g.low, lang, 0)}–${formatNum(g.high, lang, 0)} kg`}
                  tip={L3("L, U: khoảng hợp lý của loại. Càng gần 5 càng xanh.", "L, U: the plausible range of the category. Closer to 5 is greener.", "L, U : plage plausible de la catégorie. Plus proche de 5 = plus sobre.")}
                  symbolic={g.symbolic} filled={g.filled} result={`${formatNum(g.score, lang, 1)}/5`} />
          )}
        </section>
  );
}
