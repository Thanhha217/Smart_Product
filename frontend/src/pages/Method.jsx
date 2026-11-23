import { Link } from "react-router-dom";
import { useI18n } from "../i18n/LanguageContext";
import { METHOD } from "../i18n/method";
import { SectionCard } from "./components/co2/Co2Bits";

// /method — static, bilingual explanation of the CO2 method.
export default function Method() {
  const { lang, t } = useI18n();
  const m = METHOD[lang] || METHOD.en;
  return (
    <main className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-4">
      <h1 className="text-2xl md:text-3xl font-bold text-primary-500">{m.title}</h1>
      <p className="text-gray-700">{m.intro}</p>

      <SectionCard title={m.chainTitle}>
        <ol className="flex flex-col md:flex-row md:items-stretch gap-2">
          {m.chain.map((step, i) => (
            <li key={step.key} className="flex md:flex-col items-center gap-2 md:flex-1">
              <div className={`flex-1 w-full rounded-xl p-3 text-center ${step.key === "none" ? "bg-gray-100" : "bg-green-50 border border-green-200"}`}>
                <p className="font-bold">{step.label}</p>
                <p className="text-xs text-gray-600">{step.sub}</p>
              </div>
              {i < m.chain.length - 1 && <span className="text-2xl text-gray-400 md:hidden" aria-hidden="true">↓</span>}
            </li>
          ))}
        </ol>
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {m.methods.map((x) => (
          <SectionCard key={x.key} title={x.name} right={<span className="text-xs font-mono bg-primary-200 rounded-full px-2 py-0.5">{x.label}</span>}>
            <p className="text-sm"><span className="font-semibold">{t("method.when")}:</span> {x.when}</p>
            <p className="font-mono text-sm bg-primary-100 rounded-xl px-3 py-2">{x.formula}</p>
            <p className="text-sm"><span className="font-semibold">{t("method.example")}:</span> {x.example}</p>
            <p className="text-sm text-green-800"><span className="font-semibold">{t("method.accuracy")}:</span> {x.accuracy}</p>
          </SectionCard>
        ))}
      </div>

      <SectionCard title={m.useTitle}>
        <p className="font-mono text-sm bg-primary-100 rounded-xl px-3 py-2">{m.greenScore}</p>
        <p className="font-mono text-sm bg-primary-100 rounded-xl px-3 py-2">{m.rrf}</p>
        <p className="text-sm text-gray-600">{m.rrfNote}</p>
        <p className="text-sm text-gray-600">{m.gridNote}</p>
      </SectionCard>

      <SectionCard title={m.resultsTitle}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left bg-primary-100">
                {m.resultsHead.map((h) => (
                  <th key={h} className="px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.results.map((row) => (
                <tr key={row[0]} className="border-t border-primary-100 align-top">
                  {row.map((c, i) => (
                    <td key={i} className={`px-3 py-2 ${i === 0 ? "font-semibold" : ""}`}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title={m.limitsTitle}>
        <ul className="list-disc pl-5 text-sm flex flex-col gap-1">
          {m.limits.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </SectionCard>

      <Link to="/assistant" className="self-start bg-primary-500 text-white rounded-2xl px-5 py-2 font-semibold">
        {t("nav.assistant")} →
      </Link>
    </main>
  );
}
