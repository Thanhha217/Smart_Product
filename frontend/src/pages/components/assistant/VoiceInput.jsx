import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../../i18n/LanguageContext";

// Browser speech recognition (Chrome / Edge / Safari). Hidden when unsupported.
const SpeechRecognition =
  typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

export default function VoiceInput({ onTranscript, disabled }) {
  const { t, lang } = useI18n();
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  if (!SpeechRecognition) return null;

  const toggle = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = lang === "vi" ? "vi-VN" : "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((r) => r[0].transcript).join(" ");
      onTranscript(text);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      title={t("assistant.voice")}
      aria-pressed={listening}
      className={`rounded-2xl px-4 py-2 font-semibold ${
        listening ? "bg-red-500 text-white animate-pulse" : "bg-primary-200 text-primary-500"
      } disabled:opacity-50`}
    >
      {listening ? t("assistant.voiceStop") : t("assistant.voice")}
    </button>
  );
}
