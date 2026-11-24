// Find products: one place to search the catalogue, open a product's CO₂ book, compare, and ask the AI.
// URL-driven (?q=&category=&min_price=&max_price=&sort=&page=), honest empty and error states, and
// stale-response protection (an older answer never replaces a newer query).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { tri, useI18n } from "../i18n/LanguageContext";
import { useShopText } from "../i18n/shop";
import { formatCount, formatPrice, normalizeList } from "../lib/data";
import { removeFromQuery } from "../lib/queryEdit";
import { clearFilters, PAGE_SIZE, parseSearchParams, removeFilter, toApiParams, toSearchParams, updateState } from "../lib/searchState";
import FindCard from "./components/find/FindCard";
import CompareBar from "./components/find/CompareBar";
import AskAiDock from "./components/find/AskAiDock";
import { EmptyState, ErrorState, InlineSpinner, SampleDataNote } from "./components/common/States";
import Icon from "./components/ui/Icon";

function useSearch(state) {
  const [res, setRes] = useState({ status: "loading", data: null, error: null });
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify({ ...toApiParams(state), retry });
  const seq = useRef(0);
  useEffect(() => {
    const id = ++seq.current;
    const controller = new AbortController();
    const params = toApiParams(state);
    // without typed words "best match" means nothing: full information first, then the lowest CO₂
    if (!state.q && (!params.sort || params.sort === "relevance")) params.sort = "complete";
    setRes((r) => ({ status: r.data ? "updating" : "loading", data: r.data, error: null }));
    api.search(params, { signal: controller.signal })
      .then((data) => { if (id === seq.current) setRes({ status: "success", data, error: null }); })
      .catch((error) => {
        if (id !== seq.current || error?.code === "cancelled") return;
        setRes((r) => ({ status: "error", data: r.data, error }));
      });
    return () => controller.abort();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...res, retry: () => setRetry((n) => n + 1) };
}

function useCategories() {
  const [cats, setCats] = useState(null);
  useEffect(() => {
    let alive = true;
    api.getCategories().then((d) => alive && setCats(Array.isArray(d?.categories) ? d.categories : [])).catch(() => alive && setCats([]));
    return () => { alive = false; };
  }, []);
  return cats;
}

function Pagination({ page, pages, onPage, st }) {
  if (pages <= 1) return null;
  const nums = [];
  for (let p = 1; p <= pages; p += 1) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  return (
    <nav className="mt-6 flex flex-wrap items-center justify-center gap-1.5" aria-label={st("search.page", { p: page, n: pages })}>
      <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={st("search.prev")}>‹</button>
      {nums.map((n, i) => n === "…"
        ? <span key={`e${i}`} className="px-2 text-[#6b7280]">…</span>
        : <button key={n} type="button" onClick={() => onPage(n)} aria-current={n === page ? "page" : undefined}
                  className={n === page ? "btn-primary min-w-11" : "btn-secondary min-w-11"}>{n}</button>)}
      <button type="button" className="btn-secondary" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={st("search.next")}>›</button>
    </nav>
  );
}

// Price bands of the price menu, in VND
const PRICE_BANDS = [
  { key: "lt10", max: 10_000_000, label: ["Dưới 10 triệu", "Under 10 million ₫", "Moins de 10 millions ₫"] },
  { key: "10-20", min: 10_000_000, max: 20_000_000, label: ["10–20 triệu", "10–20 million ₫", "10–20 millions ₫"] },
  { key: "20-30", min: 20_000_000, max: 30_000_000, label: ["20–30 triệu", "20–30 million ₫", "20–30 millions ₫"] },
  { key: "30-50", min: 30_000_000, max: 50_000_000, label: ["30–50 triệu", "30–50 million ₫", "30–50 millions ₫"] },
  { key: "gt50", min: 50_000_000, label: ["Trên 50 triệu", "Over 50 million ₫", "Plus de 50 millions ₫"] },
];
const LANG_IDX = { vi: 0, en: 1, fr: 2 };
// Chip order: the categories with the biggest CO₂ first (as in the design), then the rest
const CHIP_ORDER = ["laptops", "monitors", "tablets", "smartphones", "smartwatches", "headphones"];
// Short chip labels; the full category name stays in the breadcrumb and the title
const CHIP_LABEL = {
  smartwatches: ["Đồng hồ", "Watches", "Montres"],
  headphones: ["Tai nghe", "Headphones", "Casques"],
  laptops: ["Laptop", "Laptops", "Portables"],
};

export default function SearchResults() {
  const st = useShopText();
  const { lang } = useI18n();
  const L3 = tri(lang);
  const li = LANG_IDX[lang] ?? 1;
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseSearchParams(params), [params]);
  const { status, data, retry } = useSearch(state);
  const categories = useCategories();
  const [draft, setDraft] = useState(state.q);
  const [askOpen, setAskOpen] = useState(false);
  const [compareNote, setCompareNote] = useState(null);
  const topRef = useRef(null);
  useEffect(() => setDraft(state.q), [state.q]);
  useEffect(() => {
    if (!compareNote) return undefined;
    const t = setTimeout(() => setCompareNote(null), 3500);
    return () => clearTimeout(t);
  }, [compareNote]);

  const go = useCallback((next, { replace = false } = {}) => {
    setParams(toSearchParams(next), { replace });
  }, [setParams]);
  const change = (patch) => go(updateState(state, patch));
  const onPage = (page) => { go({ ...state, page }); topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const submit = (e) => {
    e.preventDefault();
    go(updateState(state, { q: draft.replace(/\s+/g, " ").trim() }));
  };

  const items = normalizeList(data?.items);
  const total = typeof data?.total === "number" ? data.total : null;
  const pages = total ? Math.ceil(total / (data?.page_size || PAGE_SIZE)) : 0;
  const catLabel = (slug) => { const l = st(`cat.${slug}`); return l === `cat.${slug}` ? slug : l; };
  const chipLabel = (slug) => (CHIP_LABEL[slug] ? CHIP_LABEL[slug][li] : catLabel(slug));
  const chipCats = [...(categories || [])].sort((a, b) => {
    const ia = CHIP_ORDER.indexOf(a.category), ib = CHIP_ORDER.indexOf(b.category);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  // what the search understood from the words, each removable
  const und = data?.understood || {};
  const understood = [];
  if (state.q) {
    if (und.category && !state.category) understood.push({ kind: "category", value: und.category, label: catLabel(und.category) });
    if (und.brand && !state.brand) understood.push({ kind: "brand", value: und.brand, label: und.brand });
    if (und.min_price && !state.min_price) understood.push({ kind: "min_price", value: und.min_price, label: st("search.minPrice", { p: formatPrice(und.min_price, lang) }) });
    if (und.max_price && !state.max_price) understood.push({ kind: "max_price", value: und.max_price, label: st("search.maxPrice", { p: formatPrice(und.max_price, lang) }) });
    for (const term of und.terms || []) understood.push({ kind: "term", value: term, label: st("search.term", { t: term }) });
    if (und.eco) understood.push({ kind: "eco", value: true, label: st("search.lowCo2") });
  }
  const removeUnderstood = (chip) => {
    if (chip.kind !== "eco") go(updateState(state, { q: removeFromQuery(state.q, chip.kind, chip.value) }));
  };
  const applyRelaxation = (r) => {
    if (r.drop === "term") return go(updateState(state, { q: removeFromQuery(state.q, "term", r.value) }));
    if (state[r.drop] || ["platform", "co2_source", "has_co2", "has_price"].includes(r.drop)) return go(removeFilter(state, r.drop));
    return go(updateState(state, { q: removeFromQuery(state.q, r.drop, r.value) }));
  };
  const relaxLabel = (r) => {
    let what = String(r.value);
    if (r.drop === "term") what = `“${r.value}”`;
    else if (r.drop === "category") what = catLabel(r.value);
    else if (r.drop === "max_price") what = st("search.maxPrice", { p: formatPrice(r.value, lang) });
    else if (r.drop === "min_price") what = st("search.minPrice", { p: formatPrice(r.value, lang) });
    return st("search.relax", { what, n: formatCount(r.count, lang) });
  };

  // price menu: one of the bands, or the range already in the URL
  const minP = Number(state.min_price) || null;
  const maxP = Number(state.max_price) || null;
  const band = PRICE_BANDS.find((b) => (b.min ?? null) === minP && (b.max ?? null) === maxP);
  const priceValue = !minP && !maxP ? "" : band ? band.key : "custom";
  const setPrice = (key) => {
    const b = PRICE_BANDS.find((x) => x.key === key);
    change({ min_price: b?.min ?? "", max_price: b?.max ?? "" });
  };

  // The default browse order is "complete": products with a price, a CO₂ figure and a photo first.
  // It used to be labelled "Lowest CO₂", which it is not -- and the real lowest-CO₂ sort was not
  // even offered. Name it for what it does, and put the honest CO₂ sort in the menu beside it.
  const sortValue = !state.q && state.sort === "relevance" ? "complete" : state.sort;
  const sortOptions = [
    ...(state.q ? [{ v: "relevance", label: L3("Phù hợp nhất", "Best match", "Pertinence") }] : []),
    { v: "complete", label: L3("Đề xuất", "Suggested", "Suggestions") },
    { v: "co2_asc", label: L3("CO₂ thấp nhất", "Lowest CO₂", "CO₂ le plus bas") },
    { v: "price_asc", label: L3("Giá thấp → cao", "Price: low to high", "Prix croissant") },
    { v: "price_desc", label: L3("Giá cao → thấp", "Price: high to low", "Prix décroissant") },
  ];
  if (!sortOptions.some((o) => o.v === sortValue)) sortOptions.push({ v: sortValue, label: st(`search.sort.${sortValue}`) });

  const chip = (on) => `inline-flex h-[42px] shrink-0 items-center whitespace-nowrap rounded-full border px-[14px] text-[15.5px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D4F] ${on ? "border-[#1B4332] bg-[#1B4332] text-white" : "border-[#E1DCCD] bg-white text-[#1E2B22] hover:border-[#2E7D4F]"}`;
  const select = "h-[42px] rounded-[10px] border border-[#DCD7C9] bg-white pl-3.5 pr-2 text-[15.5px] text-[#1E2B22] focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]/40";
  const busy = status === "loading" || status === "updating";

  return (
    <main className="page-wrap max-w-[1240px] py-7 pb-36" ref={topRef}>
      <form role="search" onSubmit={submit}
            className="flex h-[60px] items-center gap-3 rounded-[18px] border border-[#E6E2D6] bg-white pl-5 pr-2 shadow-[0_1px_3px_rgba(30,43,34,0.05)] focus-within:border-[#2E7D4F]">
        <Icon name="search" size={20} className="shrink-0 text-[#6B7468]" />
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{st("shell.searchLabel")}</span>
          <input type="search" value={draft} onChange={(e) => setDraft(e.target.value)} enterKeyHint="search"
                 placeholder={L3("Laptop dưới 20 triệu, CO₂ thấp…", "Laptop under 20 million, low CO₂…", "Portable à moins de 20 millions, peu de CO₂…")}
                 className="w-full bg-transparent pr-9 text-[16.5px] text-[#1E2B22] placeholder:text-[#8A9186] focus:outline-none [&::-webkit-search-cancel-button]:hidden" />
          {draft && (
            <button type="button" onClick={() => { setDraft(""); go(updateState(state, { q: "" })); }} aria-label={st("search.clear")}
                    className="absolute right-0 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-[#6b7280] hover:bg-[#f3f4f6]">
              <Icon name="close" size={16} />
            </button>
          )}
        </label>
        <button type="submit" aria-label={st("search.button")} title={L3("Tìm thông minh: hiểu giá, loại, CO₂ thấp", "Smart search: understands price, category, low CO₂", "Recherche intelligente : prix, catégorie, CO₂ bas")}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] bg-[#1B4332] text-white hover:bg-[#143D26] transition">
          <Icon name="sparkles" size={20} />
        </button>
      </form>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]" role="group" aria-label={L3("Danh mục", "Category", "Catégorie")}>
          <button type="button" className={chip(!state.category)} aria-pressed={!state.category} onClick={() => change({ category: "" })}>
            {L3("Tất cả", "All", "Tout")}
          </button>
          {chipCats.map((c) => (
            <button key={c.category} type="button" className={chip(state.category === c.category)} aria-pressed={state.category === c.category}
                    title={catLabel(c.category)} onClick={() => change({ category: state.category === c.category ? "" : c.category })}>
              {chipLabel(c.category)}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 gap-2">
          <label>
            <span className="sr-only">{L3("Mức giá", "Price", "Prix")}</span>
            <select value={priceValue} onChange={(e) => setPrice(e.target.value)} className={`${select} w-[160px]`}>
              <option value="">{L3("Mọi mức giá", "Any price", "Tous les prix")}</option>
              {PRICE_BANDS.map((b) => <option key={b.key} value={b.key}>{b.label[li]}</option>)}
              {priceValue === "custom" && (
                <option value="custom" disabled>{[minP && formatPrice(minP, lang), maxP && formatPrice(maxP, lang)].filter(Boolean).join(" – ")}</option>
              )}
            </select>
          </label>
          <label>
            <span className="sr-only">{st("search.sort")}</span>
            <select value={sortValue} onChange={(e) => change({ sort: e.target.value })} className={`${select} w-[184px]`}
                    title={sortValue === "complete" ? L3("Sản phẩm đủ giá, số CO₂ và ảnh lên trước, rồi CO₂ thấp nhất trong từng loại", "Products with a price, a CO₂ figure and a photo first, then each category's lowest CO₂", "Produits complets d'abord, puis le CO₂ le plus bas de chaque catégorie") : undefined}>
              {sortOptions.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      {(state.q || understood.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[14.5px] text-[#55604F]">
          {total !== null && status !== "error" && (
            <span>{total === 1 ? st("search.countOne") : st("search.count", { n: formatCount(total, lang) })}</span>
          )}
          {understood.map((c) => c.kind === "eco"
            ? <span key="eco" className="rounded-full bg-[#E4F1E6] px-3 py-1 text-[13.5px] text-[#1F5D3A]">{c.label}</span>
            : <button key={`${c.kind}-${c.value}`} type="button" onClick={() => removeUnderstood(c)}
                      className="inline-flex items-center gap-1 rounded-full bg-[#E4F1E6] px-3 py-1 text-[13.5px] text-[#1F5D3A] hover:bg-[#D5EAD9]"
                      aria-label={st("search.removeFilter", { what: c.label })}>{c.label}<Icon name="close" size={12} /></button>)}
          {state.q && (
            <button type="button" onClick={() => setAskOpen(true)}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#1B4332] bg-white px-3.5 py-1.5 text-[14px] font-semibold text-[#1B4332] hover:bg-[#F3F8F1]">
              <Icon name="sparkles" size={15} />{L3("Hỏi AI về câu này", "Ask the AI about this", "Demander à l'IA")}
            </button>
          )}
        </div>
      )}
      {data?.sample && <div className="mt-3"><SampleDataNote /></div>}
      {status === "updating" && <div className="mt-3"><InlineSpinner label={st("search.updating")} /></div>}

      <section className={`mt-5 ${status === "updating" ? "opacity-60 transition-opacity" : ""}`} aria-live="polite" aria-busy={busy}
               aria-label={L3("Sản phẩm", "Products", "Produits")}>
        {status === "loading" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[372px] animate-pulse rounded-[22px] border border-[#E8E4D8] bg-white" />)}
          </div>
        )}
        {status === "error" && (
          <ErrorState title={st("search.loadError")} body={st("search.loadErrorBody")} onRetry={retry} />
        )}
        {(status === "success" || status === "updating") && data?.unsupported && (
          <EmptyState icon="info" title={st("search.unsupportedTitle", { what: st(`unsup.${data.unsupported}`) })} body={st("search.unsupportedBody")}>
            <button type="button" className="btn-secondary" onClick={() => setAskOpen(true)}>{L3("Hỏi AI", "Ask AI", "Demander à l'IA")}</button>
          </EmptyState>
        )}
        {(status === "success" || status === "updating") && !data?.unsupported && items.length === 0 && (
          <EmptyState title={st("search.noResultsTitle")} body={st("search.noResultsBody")}>
            {(data?.relaxations || []).map((r) => (
              <button key={`${r.drop}-${r.value}`} type="button" className="btn-secondary" onClick={() => applyRelaxation(r)}>{relaxLabel(r)}</button>
            ))}
            <button type="button" className="btn-secondary" onClick={() => go(clearFilters({ ...state, q: "" }))}>{st("search.clearAll")}</button>
          </EmptyState>
        )}
        {(status === "success" || status === "updating") && items.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((p) => (
                <FindCard key={p.product_id} product={p}
                          onCompareFull={() => setCompareNote(L3("Đã đủ 4 món để so sánh", "The comparison already has 4 products", "La comparaison a déjà 4 produits"))} />
              ))}
            </div>
            <Pagination page={state.page} pages={pages} onPage={onPage} st={st} />
          </>
        )}
      </section>

      <CompareBar note={compareNote} />
      <AskAiDock open={askOpen} onOpen={() => setAskOpen(true)} onClose={() => setAskOpen(false)} initial={state.q} />
    </main>
  );
}
