// Ask AI inside Find products: the robot button opens a small panel; the question goes to the
// assistant service and its answer opens as a full page at /assistant/:id (same flow as the
// Ask AI page, which stays reachable for the step-by-step builder).
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../api/client";
import { tri, useI18n } from "../../../i18n/LanguageContext";
import { explore } from "../../../i18n/explore";
import { addHistory } from "../../../lib/storage";
import VoiceInput from "../assistant/VoiceInput";
import { InlineSpinner } from "../common/States";
import Icon from "../ui/Icon";

function Robot({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <line x1="24" y1="6" x2="24" y2="12" stroke="#E9F2EA" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="24" cy="5" r="3" fill="#F2B544" />
      <rect x="9" y="12" width="30" height="24" rx="9" fill="#E9F2EA" />
      <rect x="5" y="20" width="5" height="9" rx="2.5" fill="#7FBF8E" />
      <rect x="38" y="20" width="5" height="9" rx="2.5" fill="#7FBF8E" />
      <rect x="14" y="18" width="20" height="11" rx="5.5" fill="#1B4332" />
      <circle cx="19.5" cy="23.5" r="2.4" fill="#8BE39B" />
      <circle cx="28.5" cy="23.5" r="2.4" fill="#8BE39B" />
      <path d="M19 32.5c3 1.8 7 1.8 10 0" fill="none" stroke="#1B4332" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function AskAiDock({ open, onOpen, onClose, initial = "" }) {
  const { lang } = useI18n();
  const L3 = tri(lang);
  const X = explore(lang);
  const navigate = useNavigate();
  const [text, setText] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const box = useRef(null);
  const busy = useRef(false);

  useEffect(() => { if (open) { setText((t) => t || initial); setTimeout(() => box.current?.focus(), 50); } }, [open, initial]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const ask = async (value) => {
    const q = String(value ?? text).replace(/\s+/g, " ").trim();
    if (!q || busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await api.askAssistant({ message: q, lang });
      if (!res?.id) throw new Error("no page id");
      addHistory({ id: res.id, query: q });
      navigate(`/assistant/${res.id}`, { state: { page: res.page } });
    } catch (err) {
      setError(err?.code === "timeout" ? X.askTimeout : X.askError);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  return (
    <>
      {open && (
        <div role="dialog" aria-modal="false" aria-labelledby="ask-ai-title"
             className="fixed z-50 right-4 bottom-[164px] min-[900px]:bottom-[104px] w-[min(420px,calc(100vw-32px))] rounded-[22px] border border-[#E6E2D6] bg-white p-4 shadow-[0_24px_60px_-20px_rgba(20,40,28,.45)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p id="ask-ai-title" className="flex items-center gap-1.5 font-display text-[21px] font-semibold text-[#1E2B22]">
                <Icon name="sparkles" size={18} className="text-[#2E7D4F]" />{L3("Hỏi AI", "Ask AI", "Demander à l'IA")}
              </p>
              <p className="mt-0.5 text-[13.5px] leading-snug text-[#55604F]">
                {L3("Nói nhu cầu, ngân sách và điều bạn quan tâm. AI tìm trong dữ liệu thật và giải thích vì sao nên chọn.",
                    "Say what you need, your budget and what matters. The AI searches the real catalogue and explains its choice.",
                    "Dites votre besoin, votre budget et ce qui compte. L'IA cherche dans le vrai catalogue et explique son choix.")}
              </p>
            </div>
            <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#55604F] hover:bg-[#F3F1EA]"
                    aria-label={L3("Đóng", "Close", "Fermer")}><Icon name="close" size={17} /></button>
          </div>
          <form className="mt-3" onSubmit={(e) => { e.preventDefault(); ask(); }} aria-busy={loading}>
            <label htmlFor="ask-ai-text" className="sr-only">{L3("Câu hỏi", "Your question", "Votre question")}</label>
            <textarea id="ask-ai-text" ref={box} rows={3} value={text} disabled={loading}
                      onChange={(e) => { setText(e.target.value); if (error) setError(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
                      placeholder={X.askPh}
                      className="w-full resize-none rounded-[14px] border border-[#E1DCCD] bg-[#FBFAF5] px-3.5 py-3 text-[15.5px] text-[#1E2B22] placeholder:text-[#8A9186] focus:border-[#2E7D4F] focus:outline-none" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {X.examples.slice(0, 3).map((ex) => (
                <button key={ex} type="button" disabled={loading} onClick={() => { setText(ex); setError(null); box.current?.focus(); }}
                        className="rounded-full border border-[#E1DCCD] bg-white px-3 py-1 text-left text-[13px] text-[#1E2B22] hover:border-[#2E7D4F] disabled:opacity-50">{ex}</button>
              ))}
            </div>
            {error && <p role="alert" className="mt-2 text-[14px] text-[#b42318]">{error}</p>}
            <div className="mt-3 flex items-center gap-2">
              <VoiceInput disabled={loading} onTranscript={(t) => setText((m) => (m ? `${m} ${t}` : t))} />
              <button type="submit" disabled={loading || !text.trim()}
                      className="ml-auto inline-flex h-11 items-center gap-2 rounded-[12px] bg-[#1B4332] px-4 text-[15px] font-semibold text-white hover:bg-[#143D26] disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? <InlineSpinner label={L3("Đang tìm…", "Searching…", "Recherche…")} /> : <><Icon name="sparkles" size={16} />{L3("Tìm cho tôi", "Find it for me", "Trouver pour moi")}</>}
              </button>
            </div>
          </form>
          <Link to="/assistant" className="mt-3 block text-[13.5px] font-medium text-[#1F5D3A] underline">
            {L3("Hoặc chọn nhanh bằng vài lần chạm →", "Or build the request in a few taps →", "Ou composez la demande en quelques clics →")}
          </Link>
        </div>
      )}
      <button type="button" onClick={open ? onClose : onOpen} aria-expanded={open}
              aria-label={L3("Hỏi AI", "Ask AI", "Demander à l'IA")} title={L3("Hỏi AI", "Ask AI", "Demander à l'IA")}
              className="fixed z-50 right-4 bottom-[80px] min-[900px]:bottom-5 grid h-[68px] w-[68px] place-items-center rounded-full bg-[#1B4332] shadow-[0_16px_36px_-12px_rgba(20,40,28,.8)] hover:bg-[#143D26] transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E7D4F]/40">
        <Robot size={44} />
      </button>
    </>
  );
}
