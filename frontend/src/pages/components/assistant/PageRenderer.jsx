import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { tri, useI18n } from "../../../i18n/LanguageContext";
import { explore } from "../../../i18n/explore";
import { formatPrice } from "../../../lib/data";
import { EmptyState } from "../common/States";
import { addToCart } from "../../../lib/cart";
import { SECTION_COMPONENTS } from "./sections/Sections";
import { Skeleton } from "../co2/Co2Bits";
import VoiceInput from "./VoiceInput";

// Renders a hydrated page spec: every number already comes from the database.
export default function PageRenderer({ page, onFollowUp, followUpLoading }) {
  const { t, lang } = useI18n();
  const products = page.products || {};
  const recIds = page.sections?.find((s) => s.type === "recommendations")?.product_ids || Object.keys(products);
  const bestId = recIds[0];

  return (
    <div className="flex flex-col gap-4">
      <WarningsBanner warnings={page.warnings} />
      <section className="bg-green-50 border border-green-200 rounded-2xl p-4 md:p-5 flex flex-col gap-2">
        <p className="text-xs text-gray-500">{t("page.question")}: “{page.query}”</p>
        <h1 className="text-xl md:text-2xl font-bold text-green-900">{t("page.answer")}</h1>
        <p className="whitespace-pre-line text-base md:text-lg">{page.summary || t("page.noSummary")}</p>
        <p className="text-xs text-gray-500">{t("assistant.disclaimer")}</p>
      </section>

      <PlanPanel plan={page.plan} onAsk={onFollowUp} busy={followUpLoading} />

      {Object.keys(products).length === 0 && (
        <EmptyState title={explore(lang).noResultsTitle} body={explore(lang).noResultsBody}>
          {page.plan?.search_query && (
            <Link className="btn-secondary" to={`/search?q=${encodeURIComponent(page.plan.search_query)}`}>{explore(lang).linkSearch}</Link>
          )}
          <Link className="btn-secondary" to="/assistant">{t("page.back")}</Link>
        </EmptyState>
      )}

      {Object.keys(products).length > 0 && <ActionBar recIds={recIds} best={products[bestId]} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(page.sections || []).map((section, i) => {
          const Component = SECTION_COMPONENTS[section.type];
          if (!Component) return null;
          const wide = ["recommendations", "related", "sources", "lifecycle", "why_low_co2"].includes(section.type);
          return (
            <div key={`${section.type}-${i}`} className={wide ? "lg:col-span-2" : ""}>
              <Component section={section} products={products} />
            </div>
          );
        })}
      </div>

      <FollowUpBox onSubmit={onFollowUp} loading={followUpLoading} />
      {page.meta && (
        <p className="text-xs text-gray-400 text-right">
          {t("page.meta", { model: page.meta.model || "–", ms: page.meta.latency_ms ?? "–", fails: page.meta.number_check_failures ?? 0 })}
        </p>
      )}
    </div>
  );
}

/**
 * What the site understood, as chips the visitor can correct. Removing the budget re-asks the
 * same question without it; "Sửa yêu cầu" goes back to the form with the text already there.
 * Everything shown here comes from page.plan, which the backend built from the question.
 */
function PlanPanel({ plan, onAsk, busy }) {
  const { lang } = useI18n();
  const L3 = tri(lang);
  const X = explore(lang);
  if (!plan || (!plan.search_query && !plan.category_slug)) return null;
  const slug = plan.category_slug;
  const cat = slug ? (X.categories[slug] || X.unsupportedNames?.[slug] || slug.replace(/_/g, " ")) : null;
  const budget = plan.budget_max_vnd ? formatPrice(plan.budget_max_vnd, lang) : null;
  const chips = [
    plan.search_query && { key: "q", label: X.plan.search, value: plan.search_query },
    cat && { key: "category", label: X.plan.category, value: cat },
    { key: "budget", label: X.plan.budget, value: budget || X.plan.none, removable: Boolean(budget) },
  ].filter(Boolean);

  return (
    <section aria-labelledby="plan-title" className="rounded-2xl border border-[#DCEBD9] bg-[#F7FBF6] p-4">
      <h2 id="plan-title" className="text-[15.5px] font-semibold text-[#1E2B22]">
        {L3("Tôi hiểu bạn đang cần:", "What I understood:", "Ce que j'ai compris :")}
      </h2>
      <dl className="mt-2 flex flex-wrap gap-2">
        {chips.map((c) => (
          <div key={c.key} className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#CFE6D5] pl-3 pr-1.5 py-1 text-[14.5px]">
            <dt className="text-[#55604F]">{c.label}:</dt>
            <dd className="font-semibold text-[#1F5D3A]">{c.value}</dd>
            {c.removable && (
              <button type="button" disabled={busy} onClick={() => onAsk?.(plan.search_query)}
                      className="grid place-items-center w-5 h-5 rounded-full hover:bg-[#E4F1E6] disabled:opacity-40"
                      aria-label={L3("Hỏi lại, bỏ ngân sách", "Ask again without the budget", "Redemander sans le budget")}>×</button>
            )}
          </div>
        ))}
      </dl>
      <p className="mt-2 flex flex-wrap items-center gap-3 text-[14px]">
        <Link className="font-semibold text-[#1F5D3A] underline" to={`/assistant?q=${encodeURIComponent(plan.search_query || "")}`}>
          {L3("Sửa yêu cầu", "Change the request", "Modifier la demande")}
        </Link>
        {plan.search_query && (
          <Link className="font-semibold text-[#1F5D3A] underline" to={`/search?q=${encodeURIComponent(plan.search_query)}`}>{X.linkSearch}</Link>
        )}
      </p>
      <p className="mt-1.5 text-[13.5px] text-[#6b7280]">{X.planSource}</p>
    </section>
  );
}

export function WarningsBanner({ warnings }) {
  const { t } = useI18n();
  if (!warnings?.length) return null;
  return (
    <div role="status" className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl px-4 py-2 text-sm">
      {warnings.map((w) => {
        const key = `warning.${w}`;
        return <p key={w}>⚠ {t(key) === key ? w : t(key)}</p>;
      })}
    </div>
  );
}

function ActionBar({ recIds, best }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [added, setAdded] = useState(false);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("action.copyPrompt"), window.location.href);
    }
  };
  const btn = "rounded-xl px-3 py-2 text-sm font-semibold bg-white shadow-sm hover:bg-primary-500 hover:text-white";
  return (
    <nav className="flex flex-wrap gap-2" aria-label={t("action.label")}>
      <button type="button" className={btn} onClick={() => document.getElementById("follow-up")?.focus()}>
        💬 {t("action.followUp")}
      </button>
      {recIds.length >= 2 && (
        <button type="button" className={btn} onClick={() => navigate(`/compare?ids=${recIds.slice(0, 4).join(",")}`)}>
          ⚖️ {t("action.compare")}
        </button>
      )}
      {best && (
        <Link className={btn} to={`/product/${best.product_id}`}>
          🔎 {t("action.details")}
        </Link>
      )}
      {best && (
        <button
          type="button"
          className={btn}
          onClick={() => {
            addToCart(best, 1);
            setAdded(true);
          }}
        >
          🛒 {added ? t("cart.added") : t("cart.addTest")}
        </button>
      )}
      <button type="button" className={btn} onClick={share}>
        🔗 {copied ? t("action.copied") : t("action.share")}
      </button>
    </nav>
  );
}

function FollowUpBox({ onSubmit, loading }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() || loading) return;
    const ok = await onSubmit?.(text.trim());
    if (ok) setText("");      // on failure the text stays for a retry
  };
  return (
    <form onSubmit={submit} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-2">
      <label htmlFor="follow-up" className="font-semibold">{t("page.followUp")}</label>
      <div className="flex flex-col md:flex-row gap-2">
        <input
          id="follow-up"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("page.followUpPlaceholder")}
          className="flex-1 bg-white border border-[#E7E2D4] rounded-xl px-3 py-2 text-[16px]"
        />
        <div className="flex flex-wrap gap-2 items-center">
          <VoiceInput disabled={loading} onTranscript={(v) => setText((m) => (m ? `${m} ${v}` : v))} />
          <button type="submit" disabled={loading || !text.trim()} className="btn-primary disabled:opacity-50">
            {loading ? t("page.updating") : t("assistant.submit")}
          </button>
        </div>
      </div>
    </form>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-28" />
      <Skeleton className="h-10 w-2/3" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
