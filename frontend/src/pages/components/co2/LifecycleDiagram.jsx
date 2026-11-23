import { useI18n } from "../../../i18n/LanguageContext";
import { formatKg, formatNum } from "../../../lib/format";
import { SectionCard } from "./Co2Bits";

const STAGE_COLORS = {
  materials_production: "#1B5B7E",
  transport: "#329AD2",
  use: "#d97706",
  end_of_life: "#7AA725",
};

// From the factory to the user: 5 steps with kg + % and a stacked bar.
export default function LifecycleDiagram({ lifecycle, productName }) {
  const { t, lang } = useI18n();
  if (!lifecycle) return null;
  const stage = (key) => lifecycle.stages?.find((s) => s.key === key);
  const route = lifecycle.route;
  const assumed = lifecycle.basis === "typical_share" || route?.assumed;
  const note = lang === "vi" ? lifecycle.note_vi : lifecycle.note_en;

  if (lifecycle.basis === "none" || !lifecycle.stages?.length) {
    return (
      <SectionCard title={`🌍 ${t("lifecycle.title")}`}>
        {productName && <p className="text-sm text-gray-600">{productName}</p>}
        <p className="text-2xl font-black text-green-700">
          {formatKg(lifecycle.total_kg, lang) !== null ? `${formatKg(lifecycle.total_kg, lang)} kg CO₂e` : t("co2.none")}
        </p>
        <p className="text-sm text-gray-600">{t("lifecycle.noSplit")}</p>
        {note && <p className="text-xs text-gray-500">{note}</p>}
      </SectionCard>
    );
  }

  const origin = route ? (lang === "vi" ? route.origin_vi : route.origin_en) : null;
  const prod = stage("materials_production");
  const steps = [
    { key: "materials", icon: "⛏️", title: t("lifecycle.materials"), sub: t("lifecycle.includedInProduction"), s: null },
    { key: "materials_production", icon: "🏭", title: t("lifecycle.production"), sub: origin ? t("lifecycle.madeIn", { origin }) : null, s: prod },
    {
      key: "transport", icon: route?.mode === "air" ? "✈️" : route?.mode === "road" ? "🚚" : "🚢",
      title: t("lifecycle.transport"),
      sub: route ? `${formatNum(route.distance_km, lang, 0)} km · ${t(`lifecycle.mode.${route.mode}`)}` : null,
      s: stage("transport"),
    },
    {
      key: "use", icon: "🔌", title: t("lifecycle.use"),
      sub: lifecycle.use_phase
        ? t("lifecycle.useDetail", {
            years: formatNum(lifecycle.use_phase.years, lang),
            kwh: formatNum(lifecycle.use_phase.kwh_year, lang),
            ef: formatNum(lifecycle.use_phase.grid_ef, lang, 3),
          })
        : null,
      s: stage("use"),
    },
    { key: "end_of_life", icon: "♻️", title: t("lifecycle.eol"), sub: null, s: stage("end_of_life") },
  ];

  return (
    <SectionCard
      title={`🌍 ${t("lifecycle.title")}`}
      right={assumed && <span className="text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">{t("lifecycle.assumed")}</span>}
    >
      {productName && <p className="text-sm text-gray-600">{productName}</p>}
      <ol className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {steps.map((step, i) => (
          <li key={step.key} className="relative bg-primary-100 rounded-xl p-3 flex sm:flex-col gap-2 items-start">
            <span className="text-2xl" aria-hidden="true">{step.icon}</span>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">{i + 1}</span>
              <span className="font-semibold text-sm">{step.title}</span>
              {step.sub && <span className="text-xs text-gray-600">{step.sub}</span>}
              {step.s && (
                <span className="text-sm font-bold mt-1" style={{ color: STAGE_COLORS[step.s.key] }}>
                  {formatKg(step.s.kg, lang)} kg · {formatNum(step.s.pct, lang)}%
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className="flex h-5 w-full rounded-full overflow-hidden bg-gray-100" role="img" aria-label={t("lifecycle.barLabel")}>
        {lifecycle.stages.map((s) => (
          <div
            key={s.key}
            style={{ width: `${Math.max(0, s.pct)}%`, backgroundColor: STAGE_COLORS[s.key] || "#9ca3af" }}
            title={`${lang === "vi" ? s.label_vi : s.label_en}: ${formatKg(s.kg, lang)} kg (${formatNum(s.pct, lang)}%)`}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {lifecycle.stages.map((s) => (
          <li key={s.key} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: STAGE_COLORS[s.key] || "#9ca3af" }} />
            {lang === "vi" ? s.label_vi : s.label_en}
          </li>
        ))}
      </ul>
      <p className="text-sm">
        {t("lifecycle.total")}: <span className="font-bold">{formatKg(lifecycle.total_kg, lang)} kg CO₂e</span>
      </p>
      {note && <p className="text-xs text-gray-500">{note}</p>}
    </SectionCard>
  );
}
