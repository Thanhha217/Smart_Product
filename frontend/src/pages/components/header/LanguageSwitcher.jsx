import { useI18n, SUPPORTED_LANGS } from "../../../i18n/LanguageContext";

const LABELS = { en: "EN", fr: "FR", vi: "VI" };
const NAMES = { en: "English", fr: "Français", vi: "Tiếng Việt" };

// Flags drawn as inline SVG instead of emoji: Windows has no flag glyphs and would show "GB" / "FR" / "VN".
const FLAG_CLASS = "h-3.5 w-5 shrink-0 rounded-[2px] ring-1 ring-black/15";

function FlagVI() {
  return (
    <svg viewBox="0 0 30 20" className={FLAG_CLASS} aria-hidden="true">
      <rect width="30" height="20" fill="#DA251D" />
      <polygon fill="#FFCD00" points="15,4 16.35,8.15 20.71,8.15 17.18,10.71 18.53,14.85 15,12.29 11.47,14.85 12.82,10.71 9.29,8.15 13.65,8.15" />
    </svg>
  );
}

function FlagEN() {
  return (
    <svg viewBox="0 0 30 20" className={FLAG_CLASS} aria-hidden="true">
      <rect width="30" height="20" fill="#012169" />
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#FFFFFF" strokeWidth="4" />
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#C8102E" strokeWidth="2" />
      <path d="M15,0 V20 M0,10 H30" stroke="#FFFFFF" strokeWidth="6" />
      <path d="M15,0 V20 M0,10 H30" stroke="#C8102E" strokeWidth="3.5" />
    </svg>
  );
}

function FlagFR() {
  return (
    <svg viewBox="0 0 30 20" className={FLAG_CLASS} aria-hidden="true">
      <rect width="10" height="20" fill="#002654" />
      <rect x="10" width="10" height="20" fill="#FFFFFF" />
      <rect x="20" width="10" height="20" fill="#CE1126" />
    </svg>
  );
}

const FLAGS = { en: FlagEN, fr: FlagFR, vi: FlagVI };

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
        const Flag = FLAGS[code];
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
            className={`flex items-center gap-1.5 px-2.5 h-8 text-[15px] font-bold rounded-full cursor-pointer transition ${
              active
                ? dark ? "bg-white text-[#1F5D3A] shadow" : "bg-[#1F5D3A] text-white shadow-sm"
                : dark ? "text-white/75 hover:text-white hover:bg-white/10" : "text-[#4c5a4f] hover:bg-[#EEF3E6]"
            }`}
          >
            <Flag />
            {LABELS[code]}
          </button>
        );
      })}
    </div>
  );
}
