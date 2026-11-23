import { useEffect, useRef, useState } from "react";
import { api } from "../../../api/client";

/**
 * "Chọn đâu hỏi đó": an instant local explanation from the real numbers, then the AI's answer
 * (POST /api/explain), follow-up chips and a free question box. Side panel on desktop,
 * bottom sheet on phones.
 */
export default function ExplainPanel({ open, topic, preset, productId, lang, scenario, T, onClose, image }) {
  const [ai, setAi] = useState(null);       // {answer, bullets, follow_ups, model}
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState(null);
  const reqId = useRef(0);

  const ask = async (q = null) => {
    const id = ++reqId.current;
    setBusy(true); setError(false); setAsked(q);
    try {
      const res = await api.explain({ product_id: productId, topic: q ? (topic || "free") : topic, question: q, lang, scenario: topic === "what_if" || q ? scenario : null });
      if (id === reqId.current) setAi(res);
    } catch {
      if (id === reqId.current) setError(true);
    } finally {
      if (id === reqId.current) setBusy(false);
    }
  };

  // a new topic: show the preset at once, then ask the AI in the background
  useEffect(() => {
    if (!open || !topic) return;
    setAi(null); setError(false); setQuestion(""); setAsked(null);
    ask(null);
  }, [open, topic, productId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !preset) return null;
  const isRules = ai && String(ai.model || "").startsWith("rule");
  const body = ai && !isRules ? ai : null;
  const followUps = (ai?.follow_ups?.length ? ai.follow_ups : preset.follow_ups) || [];

  return (
    <aside className="absolute z-30 bg-white shadow-2xl border border-emerald-100 flex flex-col
                      inset-x-0 bottom-0 max-h-[62%] rounded-t-3xl
                      md:inset-x-auto md:right-4 md:top-4 md:bottom-4 md:w-[400px] md:max-h-none md:rounded-3xl"
           style={{ animation: "wx-panel-in .35s cubic-bezier(.2,.8,.2,1)" }} aria-live="polite">
      <style>{`@keyframes wx-panel-in{from{transform:translateY(28px)}to{transform:none}}
        @keyframes wx-shimmer{0%{background-position:-300px 0}100%{background-position:300px 0}}
        .wx-shim{background:linear-gradient(90deg,#eef5f1 0,#d9ece2 50%,#eef5f1 100%);background-size:600px 100%;animation:wx-shimmer 1.2s linear infinite}`}</style>
      <div className="md:hidden mx-auto mt-2 h-1.5 w-12 rounded-full bg-gray-300" />
      <header className="flex items-start gap-2 px-5 pt-3 md:pt-5">
        <h2 className="flex-1 text-lg md:text-xl font-extrabold text-[#16324a] leading-tight">{body?.title || preset.title}</h2>
        <button type="button" onClick={onClose} aria-label={T.close} className="rounded-full w-9 h-9 grid place-items-center hover:bg-gray-100 text-xl">×</button>
      </header>
      <div className="overflow-y-auto px-5 pb-4 flex-1 min-h-0">
        {image && <img src={image} alt="" className="mt-3 w-full h-36 md:h-44 object-cover rounded-2xl shadow" />}
        {asked && <p className="mt-2 text-sm font-semibold text-emerald-800">❓ {asked}</p>}
        <p className="mt-2 text-[16px] leading-relaxed text-gray-800">{body?.answer || preset.answer}</p>
        {(body?.bullets?.length ? body.bullets : preset.bullets || []).length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-gray-700">
            {(body?.bullets?.length ? body.bullets : preset.bullets).map((b) => <li key={b} className="flex gap-2"><span className="text-emerald-600">●</span><span>{b}</span></li>)}
          </ul>
        )}
        {busy && (
          <div className="mt-3 space-y-2" aria-label={T.thinking}>
            <p className="text-xs text-emerald-700">✨ {T.thinking}</p>
            <div className="h-3 rounded wx-shim" /><div className="h-3 rounded wx-shim w-5/6" /><div className="h-3 rounded wx-shim w-2/3" />
          </div>
        )}
        {!busy && ai && <p className="mt-3 text-[13.5px] text-gray-400">{isRules ? T.byRules : T.byAi(ai.model)}</p>}
        {!busy && error && <p className="mt-3 text-[13.5px] text-amber-700">⚠ {T.aiError}</p>}
        {followUps.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {followUps.map((f) => (
              <button key={f} type="button" disabled={busy} onClick={() => ask(f)}
                      className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm text-emerald-900 hover:bg-emerald-100 disabled:opacity-50">{f}</button>
            ))}
          </div>
        )}
        <p className="mt-3 text-[13.5px] text-gray-400">{T.numbersNote}</p>
      </div>
      <form className="border-t border-gray-100 p-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (question.trim()) { ask(question.trim()); setQuestion(""); } }}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={T.askPlaceholder}
               className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
        <button type="submit" disabled={busy || !question.trim()} className="rounded-xl bg-emerald-600 text-white px-4 text-sm font-semibold disabled:opacity-50">{T.send}</button>
      </form>
    </aside>
  );
}
