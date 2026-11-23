// /assistant — say what you need, in words or in four taps. The answer is a full page
// at /assistant/:id. The chips are shown back before sending, so the visitor can correct
// what the site understood instead of guessing why the results look wrong.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LOCALES, tri, useI18n } from "../i18n/LanguageContext";
import { explore } from "../i18n/explore";
import { api, MOCK_API } from "../api/client";
import { addHistory, getHistory } from "../lib/storage";
import { composeQuery, toSearchParams } from "../lib/needs";
import { useRecent } from "../lib/recent";
import VoiceInput from "./components/assistant/VoiceInput";
import NeedPicker, { NeedChips } from "./components/assistant/NeedPicker";
import { PageSkeleton } from "./components/assistant/PageRenderer";
import { ErrorState, InlineSpinner, SampleDataNote } from "./components/common/States";
import ProductThumb from "./components/common/ProductThumb";
import Icon from "./components/ui/Icon";

const HISTORY_KEY = "spf.assistant.history";   // same key as lib/storage.js

/** Newest first, one row per distinct question (case and spacing ignored). */
function dedupe(list) {
  const seen = new Set();
  return list.filter((h) => {
    const k = String(h?.query || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!k || !h.id || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function when(at, lang) {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(LOCALES[lang], { dateStyle: "medium", timeStyle: "short" });
}

export default function Assistant() {
  const { lang } = useI18n();
  const L3 = tri(lang);
  const X = explore(lang);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [free, setFree] = useState(params.get("q") || "");
  const [selection, setSelection] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);       // null | "error" | "timeout"
  const [history, setHistory] = useState(() => dedupe(getHistory()));
  const recent = useRecent();
  const autoSent = useRef(false);
  const inFlight = useRef(false);
  const box = useRef(null);

  const sentence = composeQuery(selection, lang, free);
  const ready = Boolean(sentence.trim());

  const ask = async (text) => {
    const q = (text ?? sentence).trim();
    if (!q || inFlight.current) return;        // empty, or a request is already running
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await api.askAssistant({ message: q, lang });
      if (!res?.id) throw new Error("no page id");
      addHistory({ id: res.id, query: q });
      setHistory(dedupe(getHistory()));
      navigate(`/assistant/${res.id}`, { state: { page: res.page } });
    } catch (err) {
      setError(err?.code === "timeout" ? "timeout" : "error");   // the question stays in the box
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  const clearHistory = () => {
    try { localStorage.removeItem(HISTORY_KEY); } catch { /* storage blocked: the list just empties */ }
    setHistory([]);
  };

  useEffect(() => {
    if (params.get("go") === "1" && params.get("q") && !autoSent.current) {
      autoSent.current = true;
      ask(params.get("q"));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once, for ?q=...&go=1

  const change = (key, value) => { setSelection((s) => ({ ...s, [key]: value })); if (error) setError(null); };

  return (
    <main className="page-wrap py-6 flex flex-col gap-6 max-w-5xl">
      <header>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="page-title">{L3("Tìm thiết bị phù hợp với bạn", "Find the device that fits you", "Trouvez l'appareil qui vous convient")}</h1>
          {MOCK_API && <SampleDataNote />}
        </div>
        <p className="page-lead">
          {L3("Nói nhu cầu, ngân sách và điều bạn quan tâm. Hệ thống tìm trong dữ liệu thật rồi giải thích vì sao nên cân nhắc từng món.",
              "Tell it what you need, what you can spend and what matters to you. It searches the real catalogue and explains why each product is worth considering.",
              "Dites votre besoin, votre budget et ce qui compte pour vous. Le site cherche dans le vrai catalogue et explique pourquoi chaque produit mérite attention.")}
        </p>
      </header>

      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="rounded-3xl bg-white border border-[#E7E2D4] shadow-sm p-4 sm:p-5 flex flex-col gap-4" aria-busy={loading}>
        <div>
          <label htmlFor="ask" className="block text-[15.5px] font-semibold text-[#1E2B22] mb-2">
            {L3("1. Mô tả bằng lời (không bắt buộc)", "1. Say it in your own words (optional)", "1. Dites-le avec vos mots (facultatif)")}
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-4 text-[#6B7468]"><Icon name="sparkles" size={20} /></span>
              <textarea id="ask" ref={box} rows={2}
                        className="w-full rounded-2xl border border-[#E7E2D4] bg-[#FBFAF5] pl-11 pr-3 py-3 text-[16.5px] outline-[#2E7D4F] focus:outline-2"
                        placeholder={X.askPh} value={free}
                        onChange={(e) => { setFree(e.target.value); if (error) setError(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }} />
            </div>
            <VoiceInput disabled={loading} onTranscript={(text) => setFree((m) => (m ? `${m} ${text}` : text))} />
          </div>
        </div>

        <div>
          <p className="text-[15.5px] font-semibold text-[#1E2B22] mb-2">
            {L3("2. Hoặc chọn nhanh", "2. Or pick in a few taps", "2. Ou choisissez en quelques clics")}
          </p>
          <NeedPicker selection={selection} onChange={change} lang={lang} />
        </div>

        {ready && (
          <div className="rounded-2xl bg-[#F7FBF6] border border-[#DCEBD9] p-3 space-y-2">
            <NeedChips selection={selection} lang={lang} onRemove={(k) => change(k, null)} />
            <p className="text-[14.5px] text-[#55604F]">
              {L3("Câu sẽ gửi: ", "The question that will be sent: ", "La question envoyée : ")}
              <i className="text-[#1E2B22]">{sentence}</i>
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14.5px] text-[#55604F]">
            {loading ? <InlineSpinner label={X.askPending} /> : !ready ? X.askDisabledEmpty : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {ready && (
              <Link to={`/search?${new URLSearchParams(toSearchParams(selection, free)).toString()}`} className="btn-secondary">
                {L3("Tự xem danh sách", "Just show the products", "Voir simplement les produits")}
              </Link>
            )}
            <button type="submit" disabled={loading || !ready} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
              {X.askBtn}
            </button>
          </div>
        </div>
      </form>

      {error && <ErrorState title={X.askTitle} body={error === "timeout" ? X.askTimeout : X.askError} onRetry={() => ask()} />}

      <section className="flex flex-col gap-2">
        <h2 className="text-[15.5px] font-semibold text-[#374151]">{X.examplesTitle}</h2>
        <div className="flex flex-wrap gap-2">
          {X.examples.map((ex) => (
            <button key={ex} type="button" disabled={loading} className="chip disabled:opacity-50"
                    onClick={() => { setFree(ex); setSelection({}); setError(null); box.current?.focus(); }}>
              {ex}
            </button>
          ))}
        </div>
      </section>

      {loading && <PageSkeleton />}

      {!loading && recent.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[15.5px] font-semibold text-[#374151]">
            {L3("Bạn vừa xem", "You looked at these", "Vous venez de voir")}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {recent.slice(0, 4).map((p) => (
              <li key={p.product_id}>
                <Link to={`/product/${p.product_id}`} className="flex items-center gap-3 rounded-2xl bg-white border border-[#EFEBDF] p-2.5 hover:border-[#2E7D4F]">
                  <ProductThumb product={p} size={44} />
                  <span className="min-w-0 flex-1 text-[15px] font-medium text-[#1E2B22] line-clamp-2">{p.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15.5px] font-semibold text-[#374151]">{X.historyTitle}</h2>
            {history.length > 0 && (
              <button type="button" onClick={clearHistory} className="text-[14px] text-[#1F5D3A] underline">{X.historyClear}</button>
            )}
          </div>
          {history.length === 0
            ? <p className="text-[15px] text-[#6b7280]">{X.historyEmpty}</p>
            : (
              <ul className="bg-white rounded-2xl border border-[#ebe6d8] divide-y divide-[#efece2]">
                {history.map((h) => (
                  <li key={h.id}>
                    <Link to={`/assistant/${h.id}`} className="flex justify-between gap-3 px-4 py-2.5 hover:bg-[#f6f3ea]">
                      <span className="line-clamp-1 text-[15px]">{h.query}</span>
                      <span className="text-[13.5px] text-[#6b7280] whitespace-nowrap">{when(h.at, lang)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
        </section>
      )}
    </main>
  );
}
