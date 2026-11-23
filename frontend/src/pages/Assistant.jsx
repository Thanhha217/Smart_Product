import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LOCALES, useI18n } from "../i18n/LanguageContext";
import { explore } from "../i18n/explore";
import { api, MOCK_API } from "../api/client";
import { addHistory, getHistory } from "../lib/storage";
import VoiceInput from "./components/assistant/VoiceInput";
import { PageSkeleton } from "./components/assistant/PageRenderer";
import { ErrorState, InlineSpinner, SampleDataNote } from "./components/common/States";
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
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(LOCALES[lang], { dateStyle: "medium", timeStyle: "short" });
}

// /assistant — ask by text or voice; the answer is a full page at /assistant/:id.
export default function Assistant() {
  const { lang } = useI18n();
  const X = explore(lang);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [message, setMessage] = useState(params.get("q") || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);       // null | "error" | "timeout"
  const [history, setHistory] = useState(() => dedupe(getHistory()));
  const autoSent = useRef(false);
  const inFlight = useRef(false);
  const box = useRef(null);

  const ask = async (text) => {
    const q = (text ?? message).trim();
    if (!q || inFlight.current) return;        // empty, or a request is already running: no duplicate
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
    try { localStorage.removeItem(HISTORY_KEY); } catch { /* storage blocked: list just empties */ }
    setHistory([]);
  };

  useEffect(() => {
    if (params.get("go") === "1" && params.get("q") && !autoSent.current) {
      autoSent.current = true;
      ask(params.get("q"));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once: auto-send a question passed as ?q=...&go=1

  const empty = !message.trim();

  return (
    <main className="page-wrap py-6 flex flex-col gap-6">
      <header>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="page-title">{X.askTitle}</h1>
          {MOCK_API && <SampleDataNote />}
        </div>
        <p className="page-lead">{X.askLead}</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 max-w-3xl">
          {X.canDo.map((c) => (
            <li key={c} className="flex items-start gap-2 text-[15px] text-[#374151]">
              <span className="text-[#2E7D4F] mt-0.5"><Icon name="check" size={17} /></span>{c}
            </li>
          ))}
        </ul>
      </header>

      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex flex-col gap-3" aria-busy={loading}>
        <label htmlFor="ask" className="text-[15px] font-semibold text-[#1E2B22]">{X.askLabel}</label>
        <textarea
          id="ask" ref={box}
          className="bg-white border border-[#E7E2D4] shadow-sm rounded-2xl p-4 min-h-28 text-[16px] outline-[#2E7D4F] focus:outline-2"
          placeholder={X.askPh}
          value={message}
          aria-describedby="ask-hint"
          onChange={(e) => { setMessage(e.target.value); if (error) setError(null); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); }
          }}
        />
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <p id="ask-hint" className="text-[14px] text-[#4b5563]">
            {loading ? <InlineSpinner label={X.askPending} /> : empty ? X.askDisabledEmpty : ""}
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            <VoiceInput disabled={loading} onTranscript={(text) => setMessage((m) => (m ? `${m} ${text}` : text))} />
            <button type="submit" disabled={loading || empty} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    title={empty ? X.askDisabledEmpty : undefined}>
              {X.askBtn}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <ErrorState title={X.askTitle} body={error === "timeout" ? X.askTimeout : X.askError} onRetry={() => ask()} />
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-semibold text-[#374151]">{X.examplesTitle}</h2>
        <div className="flex flex-wrap gap-2">
          {X.examples.map((ex) => (
            <button key={ex} type="button" disabled={loading} className="chip disabled:opacity-50"
                    onClick={() => { setMessage(ex); setError(null); box.current?.focus(); }}>
              {ex}
            </button>
          ))}
        </div>
      </section>

      {loading && <PageSkeleton />}

      {!loading && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-[#374151]">{X.historyTitle}</h2>
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
