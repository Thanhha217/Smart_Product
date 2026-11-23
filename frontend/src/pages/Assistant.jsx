import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "../i18n/LanguageContext";
import { api, MOCK_API } from "../api/client";
import { addHistory, getHistory } from "../lib/storage";
import VoiceInput from "./components/assistant/VoiceInput";
import { PageSkeleton } from "./components/assistant/PageRenderer";

export const SUGGESTED_KEYS = ["suggest.laptop", "suggest.monitor", "suggest.ac", "suggest.fridge", "suggest.phone", "suggest.buyAc"];

// /assistant — ask by text or voice; the answer is a full page at /assistant/:id.
export default function Assistant() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [message, setMessage] = useState(params.get("q") || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(getHistory);
  const autoSent = useRef(false);

  const ask = async (text) => {
    const q = (text ?? message).trim();
    if (!q || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.askAssistant({ message: q, lang });
      addHistory({ id: res.id, query: q });
      setHistory(getHistory());
      navigate(`/assistant/${res.id}`, { state: { page: res.page } });
    } catch (err) {
      console.error("Assistant request failed:", err);
      setError(t("assistant.error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.get("go") === "1" && params.get("q") && !autoSent.current) {
      autoSent.current = true;
      ask(params.get("q"));
    }
  }, []); // run once on mount: auto-send a question passed as ?q=...&go=1

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6">
      <section>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-primary-500">{t("assistant.title")}</h1>
          {MOCK_API && <span className="text-xs bg-purple-100 text-purple-800 rounded-full px-2 py-0.5">{t("mock.badge")}</span>}
        </div>
        <p className="text-gray-600">{t("assistant.subtitle")}</p>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
        className="flex flex-col gap-3"
      >
        <label htmlFor="ask" className="sr-only">{t("assistant.title")}</label>
        <textarea
          id="ask"
          className="bg-white border border-[#E7E2D4] shadow-sm rounded-2xl p-4 min-h-28 outline-secondary-500 focus:outline-2"
          placeholder={t("assistant.placeholder")}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask();
            }
          }}
        />
        <div className="flex gap-3 justify-end">
          <VoiceInput disabled={loading} onTranscript={(text) => setMessage((m) => (m ? `${m} ${text}` : text))} />
          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="bg-primary-500 text-white rounded-2xl px-5 py-2 font-semibold disabled:opacity-50"
          >
            {t("assistant.submit")}
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-sm text-gray-600">{t("assistant.suggested")}</h2>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              disabled={loading}
              onClick={() => {
                setMessage(t(key));
                ask(t(key));
              }}
              className="bg-white rounded-full px-3 py-1 text-sm shadow-sm hover:bg-secondary-500 hover:text-white disabled:opacity-50"
            >
              {t(key)}
            </button>
          ))}
        </div>
      </section>

      {loading && (
        <div className="flex flex-col gap-2">
          <p className="text-gray-600">{t("assistant.loading")}</p>
          <PageSkeleton />
        </div>
      )}
      {error && <p className="text-red-600">{error}</p>}

      {history.length > 0 && !loading && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-sm text-gray-600">{t("assistant.history")}</h2>
          <ul className="bg-white rounded-2xl shadow-sm divide-y divide-primary-100">
            {history.map((h) => (
              <li key={h.id}>
                <Link to={`/assistant/${h.id}`} className="flex justify-between gap-2 px-4 py-2 hover:bg-primary-100">
                  <span className="line-clamp-1">{h.query}</span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {(() => {
                      try {
                        return new Date(h.at).toLocaleString(lang === "vi" ? "vi-VN" : "en-US");
                      } catch {
                        return "";
                      }
                    })()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
