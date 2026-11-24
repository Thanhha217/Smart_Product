import { useI18n, SUPPORTED_LANGS } from "../../../i18n/LanguageContext";

const LABELS = { en: "EN", fr: "FR", vi: "VI" };
const NAMES = { en: "English", fr: "Français", vi: "Tiếng Việt" };

// Segmented control EN · FR · VI. Arrow keys move between the options.
export default function LanguageSwitcher({ className = "", dark = false }) {
  const { lang, setLang, t } = useI18n();

  const onKey = (e) => {
    const i = SUPPORTED_LANGS.indexOf(lang);
    if (e.key === "ArrowRight") setLang(SUPPORTED_LANGS[(i + 1) % SUPPORTED_LANGS.length]);
    if (e.key === "ArrowLeft") setLang(SUPPORTED_LANGS[(i - 1 + SUPPORTED_LANGS.length) % SUPPORTED_LANGS.length]);
  };

  return (
    <div
      className={`inline-flex items-center rounded-full p-1 gap-0.5 ${dark ? "bg-white/12 ring-1 ring-white/15" : "bg-white border border-[#E7E2D4]"} ${className}`}
      role="radiogroup"
      aria-label={t("lang.switchLabel")}
      onKeyDown={onKey}
    >
      {SUPPORTED_LANGS.map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={NAMES[code]}
            title={NAMES[code]}
            tabIndex={active ? 0 : -1}
            onClick={() => setLang(code)}
            className={`grid place-items-center min-w-[46px] px-3 h-9 text-[15px] font-bold rounded-full cursor-pointer transition ${
              active
                ? dark ? "bg-white text-[#1F5D3A] shadow" : "bg-[#1B4D31] text-white shadow-sm"
                : dark ? "text-white/75 hover:text-white hover:bg-white/10" : "text-[#4c5a4f] hover:bg-[#EEF3E6]"
            }`}
          >
            {LABELS[code]}
          </button>
        );
      })}
    </div>
  );
}
