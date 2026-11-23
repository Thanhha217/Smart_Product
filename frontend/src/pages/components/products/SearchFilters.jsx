// Filters built from the facets the search API returns (real counts under the other filters).
import { useEffect, useState } from "react";
import { useI18n } from "../../../i18n/LanguageContext";
import { useShopText } from "../../../i18n/shop";
import { formatCount } from "../../../lib/data";

function Section({ title, children }) {
  return (
    <fieldset className="border-t border-[#ebe6d8] pt-4 first:border-t-0 first:pt-0">
      <legend className="mb-2 text-[15px] font-semibold text-[#1E2B22]">{title}</legend>
      {children}
    </fieldset>
  );
}

function OptionList({ name, options, value, onChange, label, limit = 8, anyLabel }) {
  const [open, setOpen] = useState(false);
  const { lang } = useI18n();
  const shown = open ? options : options.slice(0, limit);
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[15px] hover:bg-[#f6f3ea] cursor-pointer">
        <input type="radio" name={name} checked={!value} onChange={() => onChange("")} className="accent-[#1F5D3A] w-4 h-4" />
        <span className="flex-1">{anyLabel}</span>
      </label>
      {shown.map((o) => (
        <label key={o.value} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[15px] hover:bg-[#f6f3ea] cursor-pointer">
          <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} className="accent-[#1F5D3A] w-4 h-4" />
          <span className="flex-1 min-w-0 truncate">{label(o.value)}</span>
          <span className="text-[13.5px] text-[#6b7280] tabular-nums">{formatCount(o.count, lang)}</span>
        </label>
      ))}
      {options.length > limit && (
        <button type="button" onClick={() => setOpen(!open)} className="self-start px-2 text-[14px] font-medium text-[#1F5D3A] underline">
          {open ? "−" : `+ ${options.length - limit}`}
        </button>
      )}
    </div>
  );
}

export default function SearchFilters({ state, facets, onChange }) {
  const st = useShopText();
  const { lang } = useI18n();
  const [minP, setMinP] = useState(state.min_price ?? "");
  const [maxP, setMaxP] = useState(state.max_price ?? "");
  const [priceError, setPriceError] = useState(false);
  useEffect(() => { setMinP(state.min_price ?? ""); setMaxP(state.max_price ?? ""); }, [state.min_price, state.max_price]);
  const f = facets || {};
  const any = { en: "Any", fr: "Tous", vi: "Tất cả" }[lang] || "Any";

  const applyPrice = (e) => {
    e.preventDefault();
    const lo = Number(String(minP).replace(/[^\d]/g, "")) || null;
    const hi = Number(String(maxP).replace(/[^\d]/g, "")) || null;
    if (lo && hi && lo > hi) { setPriceError(true); return; }
    setPriceError(false);
    onChange({ min_price: lo, max_price: hi });
  };

  return (
    <div className="flex flex-col gap-4">
      {Array.isArray(f.category) && f.category.length > 0 && (
        <Section title={st("search.facet.category")}>
          <OptionList name="category" options={f.category} value={state.category} anyLabel={any}
                      label={(v) => { const l = st(`cat.${v}`); return l === `cat.${v}` ? v : l; }}
                      onChange={(v) => onChange({ category: v })} />
        </Section>
      )}
      {Array.isArray(f.brand) && f.brand.length > 0 && (
        <Section title={st("search.facet.brand")}>
          <OptionList name="brand" options={f.brand} value={state.brand} anyLabel={any} label={(v) => v} onChange={(v) => onChange({ brand: v })} />
        </Section>
      )}
      {Array.isArray(f.platform) && f.platform.length > 0 && (
        <Section title={st("search.facet.platform")}>
          <OptionList name="platform" options={f.platform} value={state.platform} anyLabel={any} label={(v) => v} onChange={(v) => onChange({ platform: v })} />
        </Section>
      )}
      <Section title={st("search.facet.price")}>
        <form onSubmit={applyPrice} className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[14px] text-[#4b5563]">{st("search.priceFrom")}
              <input inputMode="numeric" value={minP} onChange={(e) => setMinP(e.target.value)} placeholder="0"
                     className="rounded-lg border border-[#d9d4c4] bg-white px-2.5 py-2 text-[15px] text-[#1E2B22] focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]/40" />
            </label>
            <label className="flex flex-col gap-1 text-[14px] text-[#4b5563]">{st("search.priceTo")}
              <input inputMode="numeric" value={maxP} onChange={(e) => setMaxP(e.target.value)} placeholder="20000000"
                     className="rounded-lg border border-[#d9d4c4] bg-white px-2.5 py-2 text-[15px] text-[#1E2B22] focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]/40" />
            </label>
          </div>
          {priceError && <p role="alert" className="text-[14px] text-[#b42318]">{st("search.priceInvalid")}</p>}
          <button type="submit" className="btn-secondary">{st("search.priceApply")}</button>
        </form>
      </Section>
      <Section title={st("search.facet.data")}>
        <label className="flex items-start gap-2 py-1 text-[15px] cursor-pointer">
          <input type="checkbox" checked={state.has_price} onChange={(e) => onChange({ has_price: e.target.checked })} className="mt-1 accent-[#1F5D3A] w-4 h-4" />
          <span>{st("search.hasPrice", { n: formatCount(f.has_price, lang) ?? "—" })}</span>
        </label>
        <label className="flex items-start gap-2 py-1 text-[15px] cursor-pointer">
          <input type="checkbox" checked={state.has_co2} onChange={(e) => onChange({ has_co2: e.target.checked })} className="mt-1 accent-[#1F5D3A] w-4 h-4" />
          <span>{st("search.hasCo2", { n: formatCount(f.has_co2, lang) ?? "—" })}</span>
        </label>
      </Section>
      {Array.isArray(f.co2_source) && f.co2_source.length > 0 && (
        <Section title={st("search.facet.co2Source")}>
          <OptionList name="co2_source" options={f.co2_source} value={state.co2_source} anyLabel={any}
                      label={(v) => { const l = st(`src.${v}`); return l === `src.${v}` ? v : l; }} onChange={(v) => onChange({ co2_source: v })} />
        </Section>
      )}
      {(state.include_accessories || (f.accessories_hidden ?? 0) > 0) && (
        <Section title="">
          <label className="flex items-start gap-2 py-1 text-[15px] cursor-pointer">
            <input type="checkbox" checked={state.include_accessories} onChange={(e) => onChange({ include_accessories: e.target.checked })} className="mt-1 accent-[#1F5D3A] w-4 h-4" />
            <span>{state.include_accessories ? st("search.accessoriesShown") : st("search.accessories", { n: formatCount(f.accessories_hidden || 0, lang) })}</span>
          </label>
          <p className="mt-1 text-[13.5px] text-[#6b7280]">{st("search.accessoriesNote")}</p>
        </Section>
      )}
    </div>
  );
}
