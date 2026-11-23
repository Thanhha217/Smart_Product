import SearchBar from "./components/search/SearchBar.jsx"
import LanguageSwitcher from "./components/header/LanguageSwitcher.jsx";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n/LanguageContext";
import { SUGGESTED_KEYS } from "./Assistant";

export default function Home() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const ask = (q) => {
    const text = (q ?? question).trim();
    if (text) navigate(`/assistant?q=${encodeURIComponent(text)}&go=1`);
  };

  return (
    <div className="relative flex flex-col items-center gap-6 min-h-full">
      <div className="absolute top-4 right-6 z-10">
        <LanguageSwitcher />
      </div>

      <div className="bg-primary-100 min-w-full min-h-5/12 flex flex-col items-center py-12 gap-2">
        <div className='flex flex-col items-center py-12 px-2 md:px-12 gap-6'>
          <h1 className="text-primary-500 font-bold text-5xl md:text-8xl text-center">{t("app.title")}</h1>
          <p className="text-primary-800 text-sm md:text-2xl text-center">{t("home.tagline")}</p>
        </div>

        <SearchBar className="w-9/10 md:w-6/10"/>

        {/* Ask the AI: the answer is a full generated page */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
          className="w-9/10 md:w-6/10 mt-6 bg-white rounded-2xl p-3 shadow-sm flex flex-col gap-2"
        >
          <label htmlFor="home-ask" className="font-semibold text-primary-900">✨ {t("home.askTitle")}</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="home-ask"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t("home.askPlaceholder")}
              className="flex-1 bg-primary-200 rounded-xl px-3 py-2"
            />
            <button type="submit" disabled={!question.trim()} className="bg-primary-500 text-white rounded-xl px-4 py-2 font-semibold disabled:opacity-50">
              {t("home.askButton")}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_KEYS.slice(0, 4).map((key) => (
              <button key={key} type="button" onClick={() => ask(t(key))} className="bg-primary-100 rounded-full px-3 py-1 text-xs hover:bg-secondary-500 hover:text-white">
                {t(key)}
              </button>
            ))}
          </div>
        </form>

        <div className="flex flex-wrap justify-center gap-4 mt-4 text-sm">
          <Link to="/assistant" className="text-primary-500 font-semibold hover:underline">{t("nav.assistant")} →</Link>
          <Link to="/method" className="text-primary-500 font-semibold hover:underline">{t("nav.method")} →</Link>
          <Link to="/compare" className="text-primary-500 font-semibold hover:underline">{t("nav.compare")} →</Link>
        </div>
      </div>
    </div>
  );
}
