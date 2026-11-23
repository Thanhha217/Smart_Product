// Shared states for every data area: idle, loading, empty, error, partial.
// One look across the app; the text always says what happened and what to do next.
import Icon from "../ui/Icon";
import { useI18n } from "../../../i18n/LanguageContext";

export function EmptyState({ icon = "search", title, body, children, compact = false }) {
  return (
    <div role="status" className={`rounded-2xl border border-dashed border-[#d9d4c4] bg-white/70 text-center ${compact ? "p-5" : "p-8 md:p-10"}`}>
      <span className="mx-auto mb-3 grid place-items-center w-12 h-12 rounded-full bg-[#eef4ec] text-[#2E7D4F]"><Icon name={icon} size={24} /></span>
      {title && <h3 className="text-lg font-semibold text-[#1E2B22]">{title}</h3>}
      {body && <p className="mt-1 text-[15px] text-[#4b5563] max-w-xl mx-auto">{body}</p>}
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function ErrorState({ title, body, onRetry, compact = false }) {
  const { t } = useI18n();
  return (
    <div role="alert" className={`rounded-2xl border border-[#f1c8c4] bg-[#fdf3f2] ${compact ? "p-4" : "p-6"} flex flex-col sm:flex-row sm:items-center gap-3`}>
      <span className="grid place-items-center w-10 h-10 rounded-full bg-white text-[#b42318] shrink-0"><Icon name="alert" size={20} /></span>
      <div className="flex-1">
        <p className="font-semibold text-[#7a271a]">{title || t("common.error.title")}</p>
        <p className="text-[15px] text-[#7a271a]/90">{body || t("common.error.body")}</p>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary self-start sm:self-auto">{t("common.retry")}</button>
      )}
    </div>
  );
}

export function LoadingGrid({ count = 6, label }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-live="polite" aria-label={label || t("common.loading")}>
      <span className="sr-only">{label || t("common.loading")}</span>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white border border-[#ebe6d8] p-4 animate-pulse">
            <div className="h-36 rounded-xl bg-[#efece2]" />
            <div className="mt-3 h-4 w-3/4 rounded bg-[#efece2]" />
            <div className="mt-2 h-4 w-1/2 rounded bg-[#efece2]" />
            <div className="mt-4 h-8 w-2/3 rounded bg-[#efece2]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function InlineSpinner({ label }) {
  return (
    <span className="inline-flex items-center gap-2 text-[15px] text-[#4b5563]" role="status">
      <span className="w-4 h-4 rounded-full border-2 border-[#2E7D4F] border-t-transparent animate-spin" aria-hidden="true" />
      {label}
    </span>
  );
}

/** "Sample data" ribbon, shown whenever the app runs on fixtures (VITE_MOCK_API=1). */
export function SampleDataNote() {
  const { t } = useI18n();
  return <p className="text-[13.5px] text-[#92400e] bg-[#fef3c7] rounded-lg px-3 py-1.5 inline-block">{t("common.sampleData")}</p>;
}
