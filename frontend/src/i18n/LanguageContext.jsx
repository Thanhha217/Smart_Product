import { intlNumber } from "../lib/format";
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import en from "./en.json";
import fr from "./fr.json";
import vi from "./vi.json";

const DICTS = { en, fr, vi };
// Order shown in the switcher; English is the default.
export const SUPPORTED_LANGS = ["en", "fr", "vi"];
export const DEFAULT_LANG = "en";
// v2: earlier versions saved the auto-detected language; only an explicit choice is kept now.
const STORAGE_KEY = "spf.lang.v3";   // v3: earlier versions stored the ?lang= of demo links

// Full locales for Intl (numbers, money, dates)
export const LOCALES = { en: "en-US", fr: "fr-FR", vi: "vi-VN" };

function readStored() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_LANGS.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

function store(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
}

function detectInitialLang() {
  // ?lang=fr in the URL wins for this visit (handy for demos and shared links) but is NOT
  // remembered: English stays the site's language until the visitor picks another one.
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    if (SUPPORTED_LANGS.includes(fromUrl)) return fromUrl;
  } catch {
    /* no window */
  }
  return readStored() ?? DEFAULT_LANG;
}

/** Pick the text of the current language: pick(lang, {en, fr, vi}); fr falls back to en. */
export function pick(lang, texts) {
  if (!texts) return "";
  return texts[lang] ?? texts.en ?? texts.vi ?? "";
}

/** 3-way helper for modules written as tri(lang)(vi, en, fr). Missing fr falls back to en. */
export function tri(lang) {
  return (viText, enText, frText) => (lang === "vi" ? viText : lang === "fr" ? (frText ?? enText) : enText);
}

/** Backend fields come as name_vi / name_en (no French yet): fr uses en. */
export function field(obj, base, lang) {
  if (!obj) return undefined;
  return obj[`${base}_${lang}`] ?? obj[`${base}_en`] ?? obj[`${base}_vi`];
}

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectInitialLang);

  useEffect(() => {
    document.documentElement.lang = lang; // good for SEO and screen readers
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!SUPPORTED_LANGS.includes(next)) return;
    store(next); // remembered only when the user actively chooses
    setLangState(next);
  }, []);

  // t("results.for", { query: "iphone" }); fallback fr -> en -> key
  const t = useCallback((key, vars) => {
    const template = DICTS[lang]?.[key] ?? DICTS.en?.[key] ?? key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (_, name) =>
      vars[name] !== undefined ? String(vars[name]) : `{${name}}`
    );
  }, [lang]);

  // formatNumber(15636212) -> "15,636,212" (en) / "15 636 212" (fr) / "15.636.212" (vi)
  const formatNumber = useCallback((value) => {
    if (value == null || Number.isNaN(Number(value))) return "";
    return intlNumber(LOCALES[lang] ?? LOCALES[DEFAULT_LANG], {}, Number(value));
  }, [lang]);

  const value = useMemo(
    () => ({ lang, setLang, t, formatNumber, pick: (texts) => pick(lang, texts) }),
    [lang, setLang, t, formatNumber]
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useI18n must be used inside <LanguageProvider>");
  return ctx;
}
