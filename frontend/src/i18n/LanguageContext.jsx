import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import en from "./en.json";
import vi from "./vi.json";

const DICTS = { en, vi };
export const SUPPORTED_LANGS = ["vi", "en"];
const DEFAULT_LANG = "vi";           // đổi thành "en" nếu team muốn
const STORAGE_KEY = "spf.lang";

// Locale đầy đủ dùng cho Intl (định dạng số, tiền, ngày)
const LOCALES = { vi: "vi-VN", en: "en-US" };

function detectInitialLang() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (SUPPORTED_LANGS.includes(saved)) return saved;

  const browser = navigator.language?.slice(0, 2);
  if (SUPPORTED_LANGS.includes(browser)) return browser;

  return DEFAULT_LANG;
}

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectInitialLang);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;   // tốt cho SEO + screen reader
  }, [lang]);

  const setLang = useCallback((next) => {
    if (SUPPORTED_LANGS.includes(next)) setLangState(next);
  }, []);

  // t("results.for", { query: "iphone" })
  const t = useCallback((key, vars) => {
    const template = DICTS[lang]?.[key] ?? DICTS[DEFAULT_LANG]?.[key] ?? key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (_, name) =>
      vars[name] !== undefined ? String(vars[name]) : `{${name}}`
    );
  }, [lang]);

  // formatNumber(15636212) -> "15.636.212" (vi) / "15,636,212" (en)
  const formatNumber = useCallback((value) => {
    if (value == null || Number.isNaN(Number(value))) return "";
    return new Intl.NumberFormat(LOCALES[lang] ?? LOCALES[DEFAULT_LANG]).format(Number(value));
  }, [lang]);

  const value = useMemo(
    () => ({ lang, setLang, t, formatNumber }),
    [lang, setLang, t, formatNumber]
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useI18n must be used inside <LanguageProvider>");
  return ctx;
}
