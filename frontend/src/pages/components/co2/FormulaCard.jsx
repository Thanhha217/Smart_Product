import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../../../i18n/LanguageContext";
import { formatKg } from "../../../lib/format";
import { SectionCard } from "./Co2Bits";

// The formula of the method actually used, with the real numbers substituted step by step.
export default function FormulaCard({ formula, productName, defaultOpen = false }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  if (!formula) return null;
  const title = lang === "vi" ? formula.title_vi : formula.title_en;
  const noFigure = formula.method === "none" || formula.result_kg === null || formula.result_kg === undefined;

  return (
    <SectionCard
      title={`🧮 ${t("formula.title")}`}
      right={<Link to="/method" className="text-sm text-primary-500 hover:underline">{t("formula.methodLink")}</Link>}
    >
      {productName && <p className="text-sm text-gray-600">{productName}</p>}
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="bg-secondary-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{title}</span>
        {formula.confidence !== null && formula.confidence !== undefined && (
          <span className="text-xs text-gray-600">{t("co2.confidence")} {formatKg(formula.confidence, lang)}</span>
        )}
      </div>
      {formula.expression && (
        <p className="font-mono text-sm md:text-base bg-primary-100 rounded-xl px-3 py-2 overflow-x-auto">{formula.expression}</p>
      )}
      <p className="text-2xl font-black text-green-700">
        {noFigure ? t("co2.none") : `= ${formatKg(formula.result_kg, lang)} kg CO₂e`}
      </p>
      {formula.complete === false && <p className="text-xs text-amber-700">{t("formula.incomplete")}</p>}
      {formula.steps?.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="self-start text-sm font-semibold text-primary-500 hover:underline"
          >
            {open ? t("formula.hide") : t("formula.show")}
          </button>
          {open && (
            <ol className="flex flex-col gap-2">
              {formula.steps.map((s, i) => (
                <li key={i} className="flex flex-col md:flex-row md:justify-between gap-1 border-b border-primary-100 pb-2">
                  <span className="text-sm text-gray-700">
                    {i + 1}. {lang === "vi" ? s.label_vi : s.label_en}
                  </span>
                  <span className="font-mono text-sm font-semibold">{s.expr}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </SectionCard>
  );
}
