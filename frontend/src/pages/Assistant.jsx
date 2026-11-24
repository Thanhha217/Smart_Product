// /assistant — say what you need, in words or in four taps. The answer is a full page
// at /assistant/:id. The chips are shown back before sending, so the visitor can correct
// what the site understood instead of guessing why the results look wrong.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LOCALES, tri, useI18n } from "../i18n/LanguageContext";
import { explore } from "../i18n/explore";
import { api, MOCK_API } from "../api/client";
import { addHistory, getHistory } from "../lib/storage";
import { composeQuery, NEED_GROUPS, toSearchParams } from "../lib/needs";
import { useRecent } from "../lib/recent";
import VoiceInput from "./components/assistant/VoiceInput";
import WhatFits from "./components/assistant/WhatFits";
import DeviceIcon from "./components/ui/DeviceIcon";
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
  // the design opens with a worked request so "What fits" shows real products at once; every tap can undo it
  const [selection, setSelection] = useState(() => (params.get("q") ? {} : { device: "laptop", purpose: "study", budget: "20", priority: "co2" }));
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

  const groups = Object.fromEntries(NEED_GROUPS.map((g) => [g.key, g]));
  const title = (k) => (k === "priority" ? L3("Điều quan trọng nhất", "What matters most", "Ce qui compte le plus") : groups[k].title[lang] || groups[k].title.en);
  const label = (o) => o.label[lang] || o.label.en;
  const chip = (on) => `rounded-full border px-3.5 py-1.5 text-[14px] font-medium transition ${on ? "bg-[#1B4D31] border-[#1B4D31] text-white" : "bg-white border-[#E1DCCD] text-[#1E2B22] hover:border-[#2E7D4F]"}`;
  const Step = ({ n, k }) => (
    <p className="flex items-center gap-2 text-[14.5px] font-semibold text-[#1E2B22]">
      <span className="grid place-items-center w-5 h-5 rounded-full bg-[#1B4332] text-[11.5px] font-bold text-white">{n}</span>{title(k)}
    </p>
  );
  const chipGroup = (k) => (
    <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={title(k)}>
      {groups[k].options.map((o) => {
        const on = selection[k] === o.value;
        return <button key={o.value} type="button" aria-pressed={on} className={chip(on)} onClick={() => change(k, on ? null : o.value)}>{label(o)}</button>;
      })}
    </div>
  );
  const examples3 = X.examples.slice(0, 3);

  return (
    <main className="page-wrap py-7 flex flex-col gap-7 max-w-[1040px]">
      <header>
        <p className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.14em] text-[#2E7D4F]">
          <Icon name="sparkles" size={15} />{L3("Hỏi AI", "Ask AI", "Demander à l'IA")}
          {MOCK_API && <span className="ml-2 normal-case tracking-normal font-normal"><SampleDataNote /></span>}
        </p>
        <h1 className="mt-1 font-display text-[38px] sm:text-[48px] font-semibold leading-[1.06] text-[#1E2B22]">
          {L3("Tìm thiết bị phù hợp với bạn", "Find the device that fits you", "Trouvez l'appareil qui vous convient")}
        </h1>
        <p className="mt-2 max-w-2xl text-[16.5px] leading-relaxed text-[#55604F]">
          {L3("Nói nhu cầu, ngân sách và điều bạn quan tâm. Hệ thống tìm trong dữ liệu thật rồi giải thích vì sao nên cân nhắc từng món.",
              "Tell it what you need, what you can spend and what matters to you. It searches the real catalogue and explains why each product is worth considering.",
              "Dites votre besoin, votre budget et ce qui compte pour vous. Le site cherche dans le vrai catalogue et explique pourquoi chaque produit mérite attention.")}
        </p>
      </header>

      <form onSubmit={(e) => { e.preventDefault(); ask(); }} aria-busy={loading}
            className="overflow-hidden rounded-[26px] bg-white border border-[#E6E2D6] shadow-[0_6px_24px_rgba(30,43,34,0.07)]">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 p-4 sm:p-5">
          <span className="hidden sm:grid place-items-center w-10 h-10 shrink-0 rounded-xl bg-[#EEF3EC] text-[#2E7D4F]"><Icon name="sparkles" size={19} /></span>
          <div className="min-w-0 flex-1">
            <label htmlFor="ask" className="block text-[13.5px] font-medium text-[#55604F]">{L3("Nói bằng lời của bạn", "Say it in your own words", "Dites-le avec vos mots")}</label>
            <textarea id="ask" ref={box} rows={2}
                      className="mt-1 w-full resize-none bg-transparent font-display text-[20px] sm:text-[22px] leading-snug text-[#1E2B22] placeholder:text-[#9AA096] focus:outline-none"
                      placeholder={X.askPh} value={free}
                      onChange={(e) => { setFree(e.target.value); if (error) setError(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }} />
          </div>
          <div className="shrink-0"><VoiceInput disabled={loading} onTranscript={(text) => setFree((m) => (m ? `${m} ${text}` : text))} /></div>
        </div>

        <div className="flex items-center gap-3 px-5 text-[13px] text-[#6B7468]" aria-hidden="true">
          <span className="h-px flex-1 bg-[#ECE8DC]" />{L3("hoặc chọn nhanh vài lần chạm", "or build it in a few taps", "ou composez-la en quelques clics")}<span className="h-px flex-1 bg-[#ECE8DC]" />
        </div>

        <div className="grid gap-3 p-4 sm:p-5 md:grid-cols-2">
          <div className="rounded-[20px] bg-[#FAF9F4] border border-[#EEEBE0] p-4">
            <Step n={1} k="device" />
            <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label={title("device")}>
              {groups.device.options.map((o) => {
                const on = selection.device === o.value;
                return (
                  <button key={o.value} type="button" aria-pressed={on} onClick={() => change("device", on ? null : o.value)}
                          className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-[13.5px] font-medium transition ${on ? "bg-[#1B4332] border-[#1B4332] text-white" : "bg-white border-[#E1DCCD] text-[#1E2B22] hover:border-[#2E7D4F]"}`}>
                    <DeviceIcon name={o.value} size={22} tint={false} />{label(o)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-[20px] bg-[#FAF9F4] border border-[#EEEBE0] p-4 flex flex-col gap-4">
            <div><Step n={2} k="purpose" />{chipGroup("purpose")}</div>
            <div><Step n={3} k="budget" />{chipGroup("budget")}</div>
            <div><Step n={4} k="priority" />{chipGroup("priority")}</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-[#1B4332] px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-white/65">{L3("Yêu cầu của bạn", "Your request", "Votre demande")}</p>
            <p className="mt-0.5 font-display text-[18px] sm:text-[20px] leading-snug text-white">
              {loading ? <span className="text-white/80">{X.askPending}</span>
                : ready ? sentence
                : <span className="text-white/60">{X.askDisabledEmpty}</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ready && (
              <Link to={`/search?${new URLSearchParams(toSearchParams(selection, free)).toString()}`} className="px-2 text-[14px] text-white/80 underline hover:text-white">
                {L3("Chỉ xem danh sách", "Just list them", "Juste la liste")}
              </Link>
            )}
            <button type="submit" disabled={loading || !ready}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[15px] font-semibold text-[#1B4332] hover:bg-[#F1F5EF] disabled:opacity-50 disabled:cursor-not-allowed">
              <Icon name="sparkles" size={16} />{L3("Tìm thiết bị cho tôi", "Find my device", "Trouver mon appareil")}
            </button>
          </div>
        </div>
      </form>

      {error && <ErrorState title={X.askTitle} body={error === "timeout" ? X.askTimeout : X.askError} onRetry={() => ask()} />}

      {!loading && <WhatFits selection={selection} lang={lang} />}

      <section className="flex flex-col gap-2.5" aria-labelledby="examples">
        <h2 id="examples" className="text-[16px] font-semibold text-[#1E2B22]">{L3("Thử một ví dụ", "Try an example", "Essayez un exemple")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {examples3.map((ex) => (
            <button key={ex} type="button" disabled={loading}
                    className="flex items-start gap-2.5 rounded-[18px] bg-white border border-[#E6E2D6] px-4 py-3 text-left text-[14.5px] text-[#1E2B22] hover:border-[#2E7D4F] transition disabled:opacity-50"
                    onClick={() => { setFree(ex); setSelection({}); setError(null); box.current?.focus(); }}>
              <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 shrink-0 text-[#2E7D4F]"><path d="M4 4.5h12a1.5 1.5 0 0 1 1.5 1.5v6.5A1.5 1.5 0 0 1 16 14H9l-4 3v-3H4a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 4 4.5Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
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
