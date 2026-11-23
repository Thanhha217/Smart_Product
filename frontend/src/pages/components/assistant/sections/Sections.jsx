// One component per section type of the AI page spec (docs/demo/api-contract.md).
import { useI18n } from "../../../../i18n/LanguageContext";
import { formatKg, formatNum, formatVnd } from "../../../../lib/format";
import ChartView from "../ChartView";
import ProductCard from "../../co2/ProductCard";
import FormulaCard from "../../co2/FormulaCard";
import LifecycleDiagram from "../../co2/LifecycleDiagram";
import { SectionCard, SourceLabel } from "../../co2/Co2Bits";

export function RecommendationCards({ section, products }) {
  const { t } = useI18n();
  const ids = section.product_ids || [];
  return (
    <SectionCard title={`⭐ ${t("page.recommendations")}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ids.map((id, i) => (
          <ProductCard key={id} product={products[id]} reason={section.reasons?.[id]} highlight={i === 0} />
        ))}
      </div>
    </SectionCard>
  );
}

export function FormulaSection({ section, products }) {
  return <FormulaCard formula={section.formula} productName={products[section.product_id]?.name} />;
}

export function LifecycleSection({ section, products }) {
  return <LifecycleDiagram lifecycle={section.lifecycle} productName={products[section.product_id]?.name} />;
}

export function Co2Chart({ section }) {
  const { t } = useI18n();
  if (!section.spec) return null;
  return (
    <div className="flex flex-col gap-1">
      <ChartView title={section.title || t(`chart.${section.chart}`)} spec={section.spec} />
      <p className="text-xs text-gray-500 px-2">{t("chart.sourceNote")}</p>
    </div>
  );
}

export function CategoryStats({ section, products }) {
  const { t, lang } = useI18n();
  const s = section.stats;
  if (!s || !s.n) return null;
  const range = s.max - s.min;
  const pos = s.product_kg != null && range > 0 ? Math.min(100, Math.max(0, ((s.product_kg - s.min) / range) * 100)) : null;
  const medPos = range > 0 ? ((s.median_kg - s.min) / range) * 100 : 50;
  const name = products[section.product_id]?.name;
  return (
    <SectionCard title={`📊 ${t("stats.title", { category: t(`cat.${s.category}`) === `cat.${s.category}` ? s.category : t(`cat.${s.category}`) })}`}>
      {s.greener_than_pct != null && (
        <p className="text-lg">
          {t("stats.greenerThan", { name: name || "", pct: formatNum(s.greener_than_pct, lang) })}
        </p>
      )}
      <div className="relative h-8 mt-2">
        <div className="absolute top-3 left-0 right-0 h-2 rounded-full" style={{ background: "linear-gradient(90deg,#15803d,#d97706,#b91c1c)" }} />
        <div className="absolute top-1 h-6 w-0.5 bg-gray-700" style={{ left: `${medPos}%` }} title={t("stats.median")} />
        {pos !== null && (
          <div className="absolute -top-1 -translate-x-1/2 text-xl" style={{ left: `${pos}%` }} title={name}>📍</div>
        )}
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <Stat label={t("stats.n")} value={formatNum(s.n, lang, 0)} />
        <Stat label={t("stats.median")} value={`${formatKg(s.median_kg, lang)} kg`} />
        <Stat label={t("stats.iqr")} value={`${formatKg(s.p25, lang)}–${formatKg(s.p75, lang)} kg`} />
        <Stat label={t("stats.range")} value={`${formatKg(s.min, lang)}–${formatKg(s.max, lang)} kg`} />
      </dl>
    </SectionCard>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-primary-100 rounded-xl p-2">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}

export function SavingsPanel({ section, products }) {
  const { t, lang } = useI18n();
  const best = products[section.best_id];
  return (
    <SectionCard title={`💚 ${t("savings.title")}`}>
      <p>
        {t("savings.intro", {
          name: best?.name || "",
          baseline: formatKg(section.baseline_kg, lang) ?? "–",
        })}
      </p>
      <p className="text-3xl font-black text-green-700">
        {formatKg(section.lifecycle_kg_saved, lang)} kg CO₂e <span className="text-base font-normal text-gray-600">{t("savings.less")} {t("savings.lifecycle")}</span>
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1 pr-3">{t("savings.horizon")}</th>
              <th className="py-1 pr-3">kg CO₂e</th>
              <th className="py-1 pr-3">kWh</th>
              <th className="py-1">{t("savings.money")}</th>
            </tr>
          </thead>
          <tbody>
            {section.horizons?.map((h) => (
              <tr key={h.months} className="border-t border-primary-100">
                <td className="py-1 pr-3">{t("savings.months", { n: h.months })}</td>
                <td className="py-1 pr-3 font-semibold">{formatKg(h.kg, lang) ?? "–"}</td>
                <td className="py-1 pr-3">{h.kwh != null ? formatNum(h.kwh, lang) : "–"}</td>
                <td className="py-1">{h.vnd != null ? formatVnd(h.vnd, lang) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {section.trees_year != null && (
        <p className="text-sm">🌳 {t("savings.trees", { n: formatNum(section.trees_year, lang) })}</p>
      )}
      {section.horizons?.every((h) => h.kwh == null) && <p className="text-xs text-gray-500">{t("savings.noKwh")}</p>}
    </SectionCard>
  );
}

export function WhyList({ section }) {
  const { t } = useI18n();
  if (!section.bullets?.length) return null;
  return (
    <SectionCard title={`🌱 ${t("why.title")}`}>
      <ul className="list-disc pl-5 flex flex-col gap-1">
        {section.bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    </SectionCard>
  );
}

export function RelatedProducts({ section }) {
  const { t } = useI18n();
  const items = section.items || [];
  if (!items.length && !section.greener_alternative) return null;
  return (
    <SectionCard title={`🔁 ${t("related.title")}`}>
      {section.greener_alternative && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-green-700">{t("related.greener")}</p>
          <ProductCard product={section.greener_alternative} highlight compact />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((p) => (
          <ProductCard key={p.product_id} product={p} compact />
        ))}
      </div>
    </SectionCard>
  );
}

export function SourcesPanel({ section, products }) {
  const { t, lang } = useI18n();
  return (
    <SectionCard title={`📚 ${t("sources.title")}`}>
      <ul className="flex flex-col gap-3">
        {section.items?.map((it) => (
          <li key={it.product_id} className="border-b border-primary-100 pb-2 flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm">{products[it.product_id]?.name || it.product_id}</span>
              <SourceLabel source={it.source} confidence={it.confidence} />
            </div>
            {it.references?.length > 0 && (
              <ul className="text-xs text-gray-600 pl-3">
                {it.references.map((r, i) => (
                  <li key={i}>
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline">{r.name}</a>
                    ) : (
                      r.name
                    )}{" "}
                    — {formatKg(r.co2e_kg, lang)} kg
                    {r.cosine != null && r.cosine < 1 ? ` · ${t("co2.similarity")} ${formatNum(r.cosine, lang, 2)}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {(lang === "vi" ? it.limitations_vi : it.limitations_en) && (
              <p className="text-xs text-amber-800">⚠ {lang === "vi" ? it.limitations_vi : it.limitations_en}</p>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

export const SECTION_COMPONENTS = {
  recommendations: RecommendationCards,
  formula: FormulaSection,
  lifecycle: LifecycleSection,
  chart: Co2Chart,
  category_stats: CategoryStats,
  savings: SavingsPanel,
  why_low_co2: WhyList,
  related: RelatedProducts,
  sources: SourcesPanel,
};
