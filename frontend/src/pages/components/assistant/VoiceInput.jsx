import { useEffect, useRef, useState } from "react";
import { LOCALES, useI18n } from "../../../i18n/LanguageContext";
import { explore } from "../../../i18n/explore";

// Browser speech recognition (Chrome / Edge / Safari). When the browser has none, say so instead of hiding.
const SpeechRecognition =
  typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

/** States: idle → listening → idle (text added) | denied | error. "unsupported" when the API is missing. */
export default function VoiceInput({ onTranscript, disabled }) {
  const { lang } = useI18n();
  const V = explore(lang).voice;
  const [state, setState] = useState(SpeechRecognition ? "idle" : "unsupported");
  const recognitionRef = useRef(null);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  if (state === "unsupported") {
    return <p className="text-[14px] text-[#4b5563] self-center">{V.unsupported}</p>;
  }

  const listening = state === "listening";
  const toggle = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = LOCALES[lang] ?? "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((r) => r[0].transcript).join(" ").trim();
      if (text) onTranscript(text);
    };
    recognition.onend = () => setState((s) => (s === "listening" ? "idle" : s));
    recognition.onerror = (e) => setState(e.error === "not-allowed" || e.error === "service-not-allowed" ? "denied" : e.error === "aborted" || e.error === "no-speech" ? "idle" : "error");
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setState("listening");
    } catch {
      setState("error");
    }
  };

  const note = listening ? V.listening : state === "denied" ? V.denied : state === "error" ? V.error : null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {note && <span role="status" className={`text-[14px] ${listening ? "text-[#1F5D3A]" : "text-[#92400e]"}`}>{note}</span>}
      <button type="button" onClick={toggle} disabled={disabled} aria-pressed={listening}
              className={listening ? "btn-secondary-active animate-pulse" : "btn-secondary"}>
        {listening ? V.stop : V.start}
      </button>
    </div>
  );
}
