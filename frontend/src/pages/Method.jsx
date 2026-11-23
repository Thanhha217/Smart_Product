import { Link } from "react-router-dom";
import { useI18n } from "../i18n/LanguageContext";
import { METHOD, METHOD_EXTRA, NOT_IN_CATALOGUE, RESULT_SOURCE } from "../i18n/method";
import { explore } from "../i18n/explore";

function Details({ title, children, open = false }) {
  return (
    <details className="group rounded-2xl border border-[#ebe6d8] bg-white" open={open}>
      <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-3 font-semibold text-[17px] text-[#1E2B22]">
        {title}<span aria-hidden="true" className="text-[#6b7280] transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="px-5 pb-5 flex flex-col gap-3">{children}</div>
    </details>
  );
}

// /method — level 1: plain answers; level 2: formulas, tests and limits (collapsed).
export default function Method() {
  const { lang, t } = useI18n();
  const m = METHOD[lang] || METHOD.en;
  const x = METHOD_EXTRA[lang] || METHOD_EXTRA.en;
  const X = explore(lang);
  return (
    <main className="page-wrap py-6 flex flex-col gap-6 max-w-5xl">
      <header>
        <h1 className="page-title">{m.title}</h1>
        <p className="page-lead">{m.intro}</p>
      </header>

      <section aria-labelledby="basics">
        <h2 id="basics" className="text-[22px] font-bold text-[#173F28]">{x.basicTitle}</h2>
        <dl className="mt-3 grid gap-3 md:grid-cols-2">
          {x.basics.map(([q, a]) => (
            <div key={q} className="rounded-2xl bg-white border border-[#ebe6d8] p-4">
              <dt className="font-semibold text-[16.5px] text-[#1E2B22]">{q}</dt>
              <dd className="mt-1 text-[15.5px] leading-relaxed text-[#374151]">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="tech" className="flex flex-col gap-3">
        <div>
          <h2 id="tech" className="text-[22px] font-bold text-[#173F28]">{x.techTitle}</h2>
          <p className="text-[15.5px] text-[#4b5563]">{x.techLead}</p>
        </div>

        <Details title={m.chainTitle}>
          <ol className="flex flex-col md:flex-row md:items-stretch gap-2">
            {m.chain.map((step, i) => (
              <li key={step.key} className="flex md:flex-col items-center gap-2 md:flex-1">
                <div className={`flex-1 w-full rounded-xl p-3 text-center ${step.key === "none" ? "bg-gray-100" : "bg-green-50 border border-green-200"}`}>
                  <p className="font-bold">{step.label}</p>
                  <p className="text-[14px] text-gray-600">{step.sub}</p>
                </div>
                {i < m.chain.length - 1 && <span className="text-2xl text-gray-400 md:hidden" aria-hidden="true">↓</span>}
              </li>
            ))}
          </ol>
          <p className="text-[14px] text-[#4b5563]">{x.confidenceNote}</p>
        </Details>

        {m.methods.map((mm) => (
          <Details key={mm.key} title={<span className="flex flex-wrap items-center gap-2">{mm.name}<span className="text-[13px] font-mono bg-[#eef4ec] rounded-full px-2 py-0.5">{mm.label}</span></span>}>
            {NOT_IN_CATALOGUE.includes(mm.key) && <p className="text-[14px] text-[#92400e] bg-[#fef3c7] rounded-lg px-3 py-1.5 self-start">{x.notUsed}</p>}
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
        <Link to="/world" className="btn-primary">{X.eyebrow}</Link>
        <Link to="/search" className="btn-secondary">{X.linkSearch}</Link>
        <Link to="/assistant" className="btn-secondary">{X.askTitle}</Link>
      </p>
    </main>
  );
}
