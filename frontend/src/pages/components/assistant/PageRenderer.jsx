import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useI18n } from "../../../i18n/LanguageContext";
import { addToCart } from "../../../lib/cart";
import { SECTION_COMPONENTS } from "./sections/Sections";
import { Skeleton } from "../co2/Co2Bits";
import VoiceInput from "./VoiceInput";

// Renders a hydrated page spec: every number already comes from the database.
export default function PageRenderer({ page, onFollowUp, followUpLoading }) {
  const { t } = useI18n();
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

      <ActionBar recIds={recIds} best={products[bestId]} />

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
  const submit = (e) => {
    e.preventDefault();
    if (!text.trim() || loading) return;
    onSubmit?.(text.trim());
    setText("");
  };
  return (
    <form onSubmit={submit} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-2">
      <label htmlFor="follow-up" className="font-semibold">{t("page.followUp")}</label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          id="follow-up"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("page.followUpPlaceholder")}
          className="flex-1 bg-primary-200 rounded-xl px-3 py-2"
        />
        <div className="flex gap-2">
          <VoiceInput disabled={loading} onTranscript={(v) => setText((m) => (m ? `${m} ${v}` : v))} />
          <button type="submit" disabled={loading || !text.trim()} className="bg-primary-500 text-white rounded-xl px-4 py-2 font-semibold disabled:opacity-50">
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
