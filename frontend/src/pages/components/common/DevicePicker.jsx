// Smart device search: type a few letters and the list filters as you type — device types (their
// category median) and real catalogue products with their CO₂ figure, without accents, with model
// names understood ("mac" -> laptops). Arrow keys and Enter pick; a typed name can be kept as is.
// Used for "your old device" on /trade-in and in the cart's "AI buys for me".
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { api } from "../../../api/client";
import { tri, useI18n } from "../../../i18n/LanguageContext";
import { useShopText } from "../../../i18n/shop";
import { normalizeList } from "../../../lib/data";
import { fold, matchTypes, splitMatch } from "../../../lib/deviceMatch";
import { formatKg } from "../../../lib/format";
import { useRecent } from "../../../lib/recent";
import { shortName, variantOf } from "../../../lib/shortName";
import { CAT_OF_SLUG, PRODUCTION_SHARE } from "../../../lib/tradeIn";
import DeviceIcon, { iconKeyFor } from "../ui/DeviceIcon";
import Icon from "../ui/Icon";

function Mark({ label, text }) {
  const parts = splitMatch(label, text);
  if (!parts) return label;
  return <>{parts[0]}<b className="font-semibold text-[#1B4332]">{parts[1]}</b>{parts[2]}</>;
}

/** Category medians, loaded once per page. */
function useCategoryMedians() {
  const [cats, setCats] = useState([]);
  useEffect(() => {
    let alive = true;
    api.getCategories().then((d) => alive && setCats((d?.categories || []).filter((c) => CAT_OF_SLUG[c.category] && typeof c.median_kg === "number"))).catch(() => {});
    return () => { alive = false; };
  }, []);
  return cats;
}

/**
 * @param value     the chosen device { name, kg, category (CO₂ category), kind: "type" | "product" | "typed", product_id? } or null
 * @param onChange  (device | null) -> void
 * @param allowTyped  offer "keep what I typed" (the figure is then entered by hand)
 */
export default function DevicePicker({ value, onChange, allowTyped = true, placeholder, inputClass = "" }) {
  const { lang } = useI18n();
  const L3 = tri(lang);
  const st = useShopText();
  const listId = useId();
  const cats = useCategoryMedians();
  const recent = useRecent();
  const [text, setText] = useState(value?.name || "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [hits, setHits] = useState({ q: "", items: [], loading: false });
  const box = useRef(null);
  useEffect(() => { setText(value?.name || ""); }, [value?.name]);

  // live product suggestions (debounced, the latest answer wins)
  useEffect(() => {
    const q = text.trim();
    if (!open || q.length < 2 || q === value?.name) { setHits({ q, items: [], loading: false }); return undefined; }
    const ctrl = new AbortController();
    setHits((h) => ({ ...h, loading: true }));
    const t = setTimeout(() => {
      api.search({ q, has_co2: true, page_size: 6 }, { signal: ctrl.signal })
        .then((d) => setHits({ q, items: normalizeList(d?.items).filter((p) => p.co2e_kg !== null && PRODUCTION_SHARE[p.co2_category] !== undefined), loading: false }))
        .catch((e) => { if (e?.code !== "cancelled" && e?.name !== "AbortError") setHits({ q, items: [], loading: false }); });
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [text, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const catLabel = (slug) => { const l = st(`cat.${slug}`); return l === `cat.${slug}` ? slug : l; };
  const typed = text.trim();
  const options = useMemo(() => {
    const out = [];
    const typeSlugs = typed ? matchTypes(typed) : cats.map((c) => c.category);
    for (const slug of typeSlugs) {
      const c = cats.find((x) => x.category === slug);
      if (c) out.push({ key: `t:${slug}`, group: "type", label: catLabel(slug), slug, kg: c.median_kg, device: { name: catLabel(slug), kg: c.median_kg, category: CAT_OF_SLUG[slug], kind: "type" } });
    }
    const all = typed ? hits.items : recent.filter((p) => p.co2e_kg !== null && PRODUCTION_SHARE[p.co2_category] !== undefined).slice(0, 4);
    // one line per model: the same full name from another store is left out; look-alikes show their configuration
    const seenNames = new Set();
    const products = all.filter((p) => { const k = fold(p.name); if (seenNames.has(k)) return false; seenNames.add(k); return true; });
    const shortCount = products.reduce((m, p) => m.set(shortName(p.name), (m.get(shortName(p.name)) || 0) + 1), new Map());
    for (const p of products) {
      const short = shortName(p.name);
      const variant = shortCount.get(short) > 1 ? variantOf(p.name) : "";
      const label = variant ? `${short} · ${variant}` : short;
      out.push({ key: `p:${p.product_id}`, group: typed ? "product" : "recent", label, full: p.name, slug: p.category, kg: p.co2e_kg,
                 device: { name: label, kg: p.co2e_kg, category: p.co2_category, kind: "product", product_id: p.product_id } });
    }
    if (allowTyped && typed && !out.some((o) => fold(o.label) === fold(typed))) {
      const guess = matchTypes(typed)[0];
      out.push({ key: "typed", group: "typed", label: typed, device: { name: typed, kg: null, category: guess ? CAT_OF_SLUG[guess] : "laptop", kind: "typed" } });
    }
    return out;
  }, [typed, cats, hits.items, recent, allowTyped]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setActive(0), [typed, hits.items.length]);

  const choose = (o) => { onChange(o.device); setText(o.device.name); setOpen(false); box.current?.blur(); };
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min(options.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { if (open && options[active]) { e.preventDefault(); choose(options[active]); } }
    else if (e.key === "Escape") { setOpen(false); setText(value?.name || ""); }
  };
  const heading = { type: L3("Loại máy", "Device types", "Types d'appareil"), product: L3("Sản phẩm", "Products", "Produits"), recent: L3("Bạn vừa xem", "You looked at", "Consultés"), typed: L3("Máy khác", "Another device", "Autre appareil") };
  const showList = open && (options.length > 0 || hits.loading);

  return (
    <div className="relative">
      <div className="relative">
        <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7468]" />
        <input ref={box} value={text} placeholder={placeholder} autoComplete="off" role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
               aria-activedescendant={showList && options[active] ? `${listId}-${active}` : undefined}
               onChange={(e) => { setText(e.target.value); setOpen(true); }} onFocus={(e) => { setOpen(true); e.target.select(); }}
               onBlur={() => setTimeout(() => { setOpen(false); setText((t) => (t.trim() ? t : value?.name || "")); }, 150)} onKeyDown={onKey}
               className={`h-12 w-full rounded-[12px] border border-[#DCD7C9] bg-white pl-11 pr-10 text-[16px] text-[#1E2B22] placeholder:text-[#8A9186] focus:border-[#2E7D4F] focus:outline-none ${inputClass}`} />
        {text && (
          <button type="button" onMouseDown={(e) => { e.preventDefault(); setText(""); onChange(null); setOpen(true); box.current?.focus(); }}
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-[#6B7468] hover:bg-[#F3F1EA]"
                  aria-label={L3("Xóa", "Clear", "Effacer")}><Icon name="close" size={15} /></button>
        )}
      </div>
      {showList && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1.5 max-h-80 w-full overflow-y-auto rounded-[14px] border border-[#E6E2D6] bg-white py-1.5 shadow-[0_16px_40px_-16px_rgba(30,43,34,0.35)]">
          {options.map((o, i) => (
            <li key={o.key} role="presentation">
              {(i === 0 || options[i - 1].group !== o.group) && (
                <p className="px-4 pb-1 pt-2 text-[11.5px] font-bold uppercase tracking-[0.12em] text-[#8A9186]">{heading[o.group]}</p>
              )}
              <div id={`${listId}-${i}`} role="option" aria-selected={i === active} title={o.full}
                   onMouseDown={(e) => { e.preventDefault(); choose(o); }} onMouseEnter={() => setActive(i)}
                   className={`flex cursor-pointer items-center gap-3 px-4 py-2 ${i === active ? "bg-[#EEF5EF]" : ""}`}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F3EFE4] text-[#4E8F62]">
                  {o.group === "typed" ? <Icon name="info" size={15} /> : <DeviceIcon name={iconKeyFor(o.slug || o.device.category)} size={17} tint={false} />}
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] text-[#1E2B22]">
                  {o.group === "typed" ? L3(`Dùng “${o.label}”, tự nhập số CO₂`, `Use “${o.label}” and enter its CO₂`, `Utiliser « ${o.label} »`) : <Mark label={o.label} text={typed} />}
                </span>
                {o.kg !== undefined && <span className="shrink-0 text-[14px] text-[#55604F]" title={o.group === "type" ? L3("Trung vị danh mục", "Category median", "Médiane") : undefined}>≈{formatKg(o.kg, lang)} kg</span>}
              </div>
            </li>
          ))}
          {hits.loading && typed.length >= 2 && <li className="px-4 py-2 text-[14px] text-[#8A9186]">{L3("Đang tìm sản phẩm…", "Looking for products…", "Recherche…")}</li>}
        </ul>
      )}
    </div>
  );
}
