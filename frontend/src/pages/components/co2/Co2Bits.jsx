import { useI18n } from "../../../i18n/LanguageContext";
import { formatKg, greenColor, greenBg, hasCo2 } from "../../../lib/format";

// "332,6 kg CO₂e" or "Chưa có số CO₂".
export function Co2Value({ kg, className = "" }) {
  const { t, lang } = useI18n();
  const text = formatKg(kg, lang);
  if (text === null) return <span className={`text-gray-500 ${className}`}>{t("co2.none")}</span>;
  return (
    <span className={className}>
      <span className="font-bold">{text}</span> kg CO₂e
    </span>
  );
}

// 0-5 green score pill; nothing when the product has no CO2 figure.
export function GreenBadge({ score, product, size = "sm" }) {
  const { t, lang } = useI18n();
  if (product && !hasCo2(product)) return null;
  if (score === null || score === undefined) return null;
  const pad = size === "lg" ? "px-3 py-1 text-base" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${pad}`}
      style={{ color: greenColor(score), backgroundColor: greenBg(score), border: `1px solid ${greenColor(score)}` }}
      title={t("co2.greenScoreHint")}
    >
      🍃 {t("co2.greenScore")} {formatKg(score, lang)}/5
    </span>
  );
}

export function SourceLabel({ source, confidence }) {
  const { t, lang } = useI18n();
  const key = `source.${source || "none"}`;
  const label = t(key) === key ? source : t(key);
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-primary-200 text-primary-900 rounded-full px-2 py-0.5">
      {label}
      {confidence !== null && confidence !== undefined && (
        <span className="text-gray-600">· {t("co2.confidence")} {formatKg(confidence, lang)}</span>
      )}
    </span>
  );
}

export function Skeleton({ className = "h-24" }) {
  return <div className={`animate-pulse bg-primary-200 rounded-2xl ${className}`} aria-hidden="true" />;
}

export function SectionCard({ title, children, className = "", right }) {
  return (
    <section className={`bg-white rounded-2xl p-4 md:p-5 shadow-sm flex flex-col gap-3 ${className}`}>
      {(title || right) && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {title && <h2 className="font-bold text-lg text-primary-900">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

// Always visible in checkout / orders; intentionally has no close button.
export function TestModeBanner() {
  const { t } = useI18n();
  return (
    <div role="alert" className="w-full bg-amber-400 text-amber-950 font-bold text-center rounded-xl px-4 py-2">
      ⚠ {t("checkout.testBanner")}
    </div>
  );
}
