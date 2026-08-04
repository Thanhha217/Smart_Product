import { useI18n, SUPPORTED_LANGS } from "../../../i18n/LanguageContext";

const LABELS = { vi: "VI", en: "EN" };

// Cờ vẽ bằng SVG inline thay vì emoji 🇻🇳/🇬🇧 — Windows không có glyph cờ,
// emoji sẽ hiện thành 2 chữ cái "VN"/"GB" trên Chrome/Edge.
const FLAG_CLASS = "h-3.5 w-5 shrink-0 rounded-[2px] ring-1 ring-black/15";

function FlagVI() {
    return (
        <svg viewBox="0 0 30 20" className={FLAG_CLASS} aria-hidden="true">
            <rect width="30" height="20" fill="#DA251D" />
            <polygon
                fill="#FFCD00"
                points="15,4 16.35,8.15 20.71,8.15 17.18,10.71 18.53,14.85 15,12.29 11.47,14.85 12.82,10.71 9.29,8.15 13.65,8.15"
            />
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

const FLAGS = { vi: FlagVI, en: FlagEN };

export default function LanguageSwitcher({ className = "" }) {
  const { lang, setLang, t } = useI18n();

  return (
    <div
      className={`flex items-center rounded-full bg-primary-200 p-0.5 ${className}`}
      role="group"
      aria-label={t("lang.switchLabel")}
    >
      {SUPPORTED_LANGS.map((code) => {
        const Flag = FLAGS[code];

        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={lang === code}
            className={`flex items-center gap-1.5 px-2 py-1 text-sm font-bold rounded-full cursor-pointer transition duration-100 ease-in-out ${
              lang === code
                ? "bg-secondary-500 text-primary-100"
                : "text-primary-800 opacity-60 hover:opacity-100 hover:text-primary-500"
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
