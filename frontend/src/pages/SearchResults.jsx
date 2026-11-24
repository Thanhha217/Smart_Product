// Find products: URL-driven search with understood conditions, real facets, honest empty and
// error states, and stale-response protection (an older answer never replaces a newer query).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { tri, useI18n } from "../i18n/LanguageContext";
import { useShopText } from "../i18n/shop";
import { formatCount, formatPrice, normalizeList } from "../lib/data";
import { formatKg } from "../lib/format";
import DeviceIcon, { iconKeyFor } from "./components/ui/DeviceIcon";
import { removeFromQuery } from "../lib/queryEdit";
import {
  activeFilters, clearFilters, isActiveSearch, PAGE_SIZE, parseSearchParams, removeFilter, SORTS, toApiParams,
  toSearchParams, updateState,
} from "../lib/searchState";
import ProductCard from "./components/common/ProductCard";
import WhyConsider from "./components/co2/WhyConsider";
import { EmptyState, ErrorState, InlineSpinner, LoadingGrid, SampleDataNote } from "./components/common/States";
import SearchFilters from "./components/products/SearchFilters";
import Icon from "./components/ui/Icon";

function useSearch(state, explore) {
  const [res, setRes] = useState({ status: "loading", data: null, error: null });
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify({ ...toApiParams(state), explore, retry });
  const seq = useRef(0);
  useEffect(() => {
    const id = ++seq.current;
    const controller = new AbortController();
    const params = toApiParams(state);
    if (explore) Object.assign(params, { has_price: true, has_co2: true });
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

export default function SearchResults() {
  const st = useShopText();
  const { lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseSearchParams(params), [params]);
  const active = isActiveSearch(state);
  const explore = !active;
  const { status, data, error, retry } = useSearch(state, explore);
  const categories = useCategories();
  const [draft, setDraft] = useState(state.q);
  const [drawer, setDrawer] = useState(false);
  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setDrawer(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);
  const topRef = useRef(null);
  useEffect(() => setDraft(state.q), [state.q]);

  const go = useCallback((next, { replace = false } = {}) => {
    setParams(toSearchParams(next), { replace });
  }, [setParams]);
  const change = (patch) => go(updateState(state, patch));
  const onPage = (page) => { go({ ...state, page }); topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const submit = (e) => {
    e.preventDefault();
    const q = draft.replace(/\s+/g, " ").trim();
    go(updateState(state, { q }));
  };

  const items = normalizeList(data?.items);
  const total = typeof data?.total === "number" ? data.total : null;
  const pages = total ? Math.ceil(total / (data?.page_size || PAGE_SIZE)) : 0;
  const catalogueTotal = categories?.reduce((n, c) => n + (c.products || 0), 0) || null;
  const und = data?.understood || {};
  const understoodChips = [];
  if (state.q) {
    if (und.category && !state.category) understoodChips.push({ kind: "category", value: und.category, label: st(`cat.${und.category}`) });
    if (und.brand && !state.brand) understoodChips.push({ kind: "brand", value: und.brand, label: und.brand });
    if (und.min_price && !state.min_price) understoodChips.push({ kind: "min_price", value: und.min_price, label: st("search.minPrice", { p: formatPrice(und.min_price, lang) }) });
    if (und.max_price && !state.max_price) understoodChips.push({ kind: "max_price", value: und.max_price, label: st("search.maxPrice", { p: formatPrice(und.max_price, lang) }) });
    for (const term of und.terms || []) understoodChips.push({ kind: "term", value: term, label: st("search.term", { t: term }) });
    if (und.eco) understoodChips.push({ kind: "eco", value: true, label: st("search.lowCo2") });
  }
  const removeUnderstood = (chip) => {
    if (chip.kind === "eco") return;
    go(updateState(state, { q: removeFromQuery(state.q, chip.kind, chip.value) }));
  };
  const filterLabel = (f) => {
    if (f.key === "category") { const l = st(`cat.${f.value}`); return l === `cat.${f.value}` ? f.value : l; }
    if (f.key === "co2_source") { const l = st(`src.${f.value}`); return l === `src.${f.value}` ? f.value : l; }
    if (f.key === "min_price") return st("search.minPrice", { p: formatPrice(f.value, lang) });
    if (f.key === "max_price") return st("search.maxPrice", { p: formatPrice(f.value, lang) });
    if (f.key === "has_co2") return st("search.hasCo2", { n: "" }).replace(/\s*\(\s*\)/, "");
    if (f.key === "has_price") return st("search.hasPrice", { n: "" }).replace(/\s*\(\s*\)/, "");
    if (f.key === "include_accessories") return st("search.accessories", { n: "" }).replace(/\s+/g, " ");
    return String(f.value);
  };
  const applyRelaxation = (r) => {
    const fromQuery = !state[r.drop] || r.drop === "term";
    if (r.drop === "term") return go(updateState(state, { q: removeFromQuery(state.q, "term", r.value) }));
    if (!fromQuery || ["platform", "co2_source", "has_co2", "has_price"].includes(r.drop)) return go(removeFilter(state, r.drop));
    return go(updateState(state, { q: removeFromQuery(state.q, r.drop, r.value) }));
  };
  const relaxLabel = (r) => {
    let what;
    if (r.drop === "term") what = `“${r.value}”`;
    else if (r.drop === "category") what = st(`cat.${r.value}`);
    else if (r.drop === "max_price") what = st("search.maxPrice", { p: formatPrice(r.value, lang) });
    else if (r.drop === "min_price") what = st("search.minPrice", { p: formatPrice(r.value, lang) });
    else if (r.drop === "co2_source") what = st(`src.${r.value}`);
    else if (r.drop === "has_co2" || r.drop === "has_price") what = filterLabel({ key: r.drop });
    else what = String(r.value);
    return st("search.relax", { what, n: formatCount(r.count, lang) });
  };
  const filters = activeFilters(state);
  const examples = st("search.examples");
  const showMissingNote = state.sort !== "relevance" && state.sort !== "discount";

  const L3 = tri(lang);
  const sortShown = !state.q && state.sort === "relevance" ? "complete" : state.sort;
  const sortOptions = state.q ? SORTS : SORTS.filter((x) => x !== "relevance");
  const catFacet = (data?.facets?.category || []).filter((c) => c.value && c.count > 0);
  const maxMedian = Math.max(1, ...(categories || []).map((c) => Number(c.median_kg) || 0));
  const otherFilters = filters.filter((f) => f.key !== "category");
  const catLabel = (slug) => { const l = st(`cat.${slug}`); return l === `cat.${slug}` ? slug : l; };

  const exampleChips = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-[14.5px] text-[#55604F]">{st("search.tryExamples")}</span>
      {(Array.isArray(examples) ? examples : []).map((ex) => (
        <button key={ex} type="button" onClick={() => go(updateState(parseSearchParams(""), { q: ex }))}
                className="rounded-full bg-white border border-[#E1DCCD] px-3.5 py-1.5 text-[14px] text-[#1E2B22] hover:border-[#2E7D4F] transition">{ex}</button>
      ))}
    </div>
  );

  const pill = (on) => `inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[14px] transition ${on ? "bg-[#1B4D31] border-[#1B4D31] text-white font-semibold" : "bg-white border-[#E1DCCD] text-[#1E2B22] hover:border-[#2E7D4F]"}`;

  return (
    <main className="page-wrap py-7 max-w-[1240px]" ref={topRef}>
      <header className="flex flex-col gap-4">
        <div className="max-w-3xl">
          <h1 className="font-display text-[40px] sm:text-[50px] font-semibold leading-[1.05] text-[#1E2B22]">{st("search.title")}</h1>
          <p className="mt-2 text-[16.5px] leading-relaxed text-[#55604F]">{catalogueTotal ? st("search.lead", { total: formatCount(catalogueTotal, lang) }) : st("search.leadNoCount")}</p>
        </div>
        <form role="search" onSubmit={submit} className="flex items-center gap-2 max-w-[720px] rounded-[20px] bg-white border border-[#E6E2D6] p-2 pl-4 shadow-[0_2px_10px_rgba(30,43,34,0.06)]">
          <Icon name="search" size={20} className="shrink-0 text-[#6b7280]" />
          <label className="relative flex-1 min-w-0">
            <span className="sr-only">{st("shell.searchLabel")}</span>
            <input type="search" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={st("search.placeholder")} enterKeyHint="search"
                   className="w-full bg-transparent py-2.5 pr-9 text-[16px] text-[#1E2B22] placeholder:text-[#8A9186] focus:outline-none" />
            {draft && (
              <button type="button" onClick={() => { setDraft(""); go(updateState(state, { q: "" })); }} aria-label={st("search.clear")}
                      className="absolute right-0 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-full text-[#6b7280] hover:bg-[#f3f4f6]">
                <Icon name="close" size={16} />
              </button>
            )}
          </label>
          <button type="submit" className="shrink-0 rounded-[14px] bg-[#1B4D31] px-5 sm:px-6 py-3 text-[15.5px] font-semibold text-white hover:bg-[#143D26] transition">{st("search.button")}</button>
        </form>
        {exampleChips}
        {data?.sample && <SampleDataNote />}
      </header>

      {explore && (
        <section className="mt-9" aria-labelledby="cats">
          <h2 id="cats" className="font-display text-[26px] font-semibold text-[#1E2B22]">{st("search.categories")}</h2>
          {categories === null ? (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[118px] rounded-[20px] bg-white border border-[#ebe6d8] animate-pulse" />)}</div>
          ) : categories.length > 0 && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {categories.map((c) => {
                const med = Number(c.median_kg);
                const has = c.median_kg !== null && c.median_kg !== undefined && Number.isFinite(med);
                return (
                  <button key={c.category} type="button" onClick={() => change({ category: c.category })}
                          className="flex flex-col text-left rounded-[20px] bg-white border border-[#E6E2D6] p-4 hover:border-[#2E7D4F] hover:shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D4F]">
                    <span className="grid place-items-center w-9 h-9 rounded-xl bg-[#EEF3EC] text-[#1B4D31]"><DeviceIcon name={iconKeyFor(c.category)} size={20} /></span>
                    <span className="mt-3 block font-semibold text-[#1E2B22]">{catLabel(c.category)}</span>
                    <span className="block text-[13px] text-[#6B7468]">{st("search.categoryCount", { n: formatCount(c.products, lang) })}</span>
                    {has && (
                      <>
                        <span className="mt-2 block text-[13px] text-[#4b5563]">
                          {L3("trung vị", "median", "médiane")} <span className="whitespace-nowrap"><b className="text-[15px] text-[#1E2B22]">{formatKg(med, lang)}</b> kg CO₂e</span>
                        </span>
                        <span className="mt-1.5 block h-1.5 rounded-full bg-[#ECEAE1] overflow-hidden" aria-hidden="true">
                          <span className="block h-full rounded-full bg-[#2E7D4F]" style={{ width: `${Math.max(3, (med / maxMedian) * 100)}%` }} />
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="mt-9" aria-live="polite" aria-busy={status === "loading" || status === "updating"}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-[26px] font-semibold text-[#1E2B22]">
              {explore ? st("search.explore") : state.q ? st("search.resultsFor", { q: state.q }) : st("search.resultsFiltered")}
            </h2>
            {explore && <p className="text-[14px] text-[#55604F]">{st("search.exploreNote")}</p>}
            {!explore && total !== null && status !== "error" && (
              <p className="text-[14.5px] text-[#55604F]">{total === 1 ? st("search.countOne") : st("search.count", { n: formatCount(total, lang) })}</p>
            )}
          </div>
          <label className="flex items-center gap-2 text-[14px] text-[#55604F]">
            <span>{st("search.sort")}</span>
            <select value={sortShown} onChange={(e) => change({ sort: e.target.value })}
                    className="rounded-xl border border-[#DCD7C9] bg-white px-3 py-2 text-[14.5px] font-medium text-[#1E2B22] focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]/40">
              {sortOptions.map((x) => <option key={x} value={x}>{st(`search.sort.${x}`)}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label={L3("Danh mục", "Category", "Catégorie")}>
          <button type="button" className={pill(!state.category)} aria-pressed={!state.category} onClick={() => change({ category: "" })}>
            {L3("Tất cả", "Any", "Tout")}
          </button>
          {catFacet.map((c) => (
            <button key={c.value} type="button" className={pill(state.category === c.value)} aria-pressed={state.category === c.value}
                    onClick={() => change({ category: state.category === c.value ? "" : c.value })}>
              {catLabel(c.value)}
              <span className={state.category === c.value ? "text-white/75" : "text-[#8A9186]"}>{formatCount(c.count, lang)}</span>
            </button>
          ))}
          <button type="button" className="inline-flex items-center gap-1.5 rounded-full bg-[#ECE9DE] px-3.5 py-1.5 text-[14px] font-medium text-[#1E2B22] hover:bg-[#E2DED0] transition"
                  onClick={() => setDrawer(true)}>
            <Icon name="menu" size={15} />{otherFilters.length ? st("search.showFilters", { n: otherFilters.length }) : L3("Thêm bộ lọc", "More filters", "Plus de filtres")}
          </button>
        </div>

        {otherFilters.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {otherFilters.map((f) => (
              <button key={f.key} type="button" className="chip-active" onClick={() => go(removeFilter(state, f.key))}
                      aria-label={st("search.removeFilter", { what: filterLabel(f) })}>
                {filterLabel(f)}<Icon name="close" size={14} />
              </button>
            ))}
            <button type="button" className="text-[14px] font-medium text-[#1F5D3A] underline px-1" onClick={() => go(clearFilters(state))}>{st("search.clearAll")}</button>
          </div>
        )}

        {understoodChips.length > 0 && (
          <div className="mt-3 rounded-2xl bg-[#eef4ec] px-4 py-3">
            <p className="text-[14px] font-medium text-[#1F5D3A]">{st("search.understood")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {understoodChips.map((c) => c.kind === "eco"
                ? <span key="eco" className="chip">{c.label}</span>
                : <button key={`${c.kind}-${c.value}`} type="button" className="chip" onClick={() => removeUnderstood(c)}
                          aria-label={st("search.removeFilter", { what: c.label })}>{c.label}<Icon name="close" size={14} /></button>)}
            </div>
            <p className="mt-2 text-[13.5px] text-[#4b5563]">{st("search.understoodNote")}</p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl bg-white/70 border border-[#E6E2D6] px-4 py-2.5 text-[13px] text-[#55604F]">
          <b className="text-[#1E2B22]">{L3("Về ảnh", "About the photos", "À propos des photos")}</b>
          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#2E7D4F]" aria-hidden="true" />
            {L3("Ảnh của chính sản phẩm", "The product's own photo", "La photo du produit")}</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded-md bg-[#FBE7B5] px-1.5 py-0.5 text-[11.5px] font-medium text-[#6B4E00]">{L3("Ảnh: mẫu khác", "Photo: other model", "Photo : autre modèle")}</span>
            {L3("mẫu cùng hãng, cùng loại, giá gần nhất", "a model of the same brand and category, nearest price", "un modèle de même marque et catégorie, prix le plus proche")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="grid place-items-center w-5 h-5 rounded bg-[#F1F3EE] text-[#2B3A30]"><DeviceIcon name="laptop" size={13} /></span>
            {L3("chưa có ảnh", "no photo yet", "pas encore de photo")}
          </span>
        </div>
        {showMissingNote && <p className="mt-2 text-[13.5px] text-[#4b5563]">{st("search.missingLast")}</p>}
        {status === "updating" && <div className="mt-3"><InlineSpinner label={st("search.updating")} /></div>}

        <div className={`mt-5 ${status === "updating" ? "opacity-60 transition-opacity" : ""}`}>
          {status === "loading" && <LoadingGrid count={8} />}
          {status === "error" && (
            <div className="flex flex-col gap-4">
              <ErrorState title={st("search.loadError")} body={st("search.loadErrorBody")} onRetry={retry} />
              {items.length > 0 && <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 opacity-60">{items.map((x) => <ProductCard key={x.product_id} product={x} />)}</div>}
            </div>
          )}
          {(status === "success" || status === "updating") && data?.unsupported && (
            <EmptyState icon="info" title={st("search.unsupportedTitle", { what: st(`unsup.${data.unsupported}`) })} body={st("search.unsupportedBody")}>
              <Link to="/method" className="btn-secondary">{st("search.unsupportedMethod")}</Link>
              {(categories || []).slice(0, 4).map((c) => (
                <button key={c.category} type="button" className="chip" onClick={() => go(updateState(parseSearchParams(""), { category: c.category }))}>{st(`cat.${c.category}`)}</button>
              ))}
            </EmptyState>
          )}
          {(status === "success" || status === "updating") && !data?.unsupported && items.length === 0 && (
            <EmptyState title={st("search.noResultsTitle")} body={st("search.noResultsBody")}>
              {(data?.relaxations || []).map((r) => (
                <button key={`${r.drop}-${r.value}`} type="button" className="btn-secondary" onClick={() => applyRelaxation(r)}>{relaxLabel(r)}</button>
              ))}
              {filters.length > 0 && <button type="button" className="btn-secondary" onClick={() => go(clearFilters(state))}>{st("search.clearAll")}</button>}
            </EmptyState>
          )}
          {(status === "success" || status === "updating") && items.length > 0 && (
            <>
              {state.q && items[0] && <WhyConsider productId={items[0].product_id} need={state.q}
                                                   title={st("search.whyTop", { name: items[0].name })} className="mb-4" />}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((x) => <ProductCard key={x.product_id} product={x} />)}
              </div>
              <Pagination page={state.page} pages={pages} onPage={onPage} st={st} />
            </>
          )}
        </div>
      </section>

      {drawer && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={st("search.filters")}>
          <button type="button" className="absolute inset-0 bg-black/40" aria-label={st("shell.closeMenu")} onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 right-0 w-[min(380px,92vw)] bg-[#F6F4EC] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#ebe6d8]">
              <h2 className="text-[17px] font-semibold">{st("search.filters")}</h2>
              <button type="button" onClick={() => setDrawer(false)} aria-label={st("shell.closeMenu")} className="grid place-items-center w-9 h-9 rounded-full hover:bg-white"><Icon name="close" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5"><SearchFilters state={state} facets={data?.facets} onChange={change} /></div>
            <div className="p-4 border-t border-[#ebe6d8] flex gap-2">
              {filters.length > 0 && <button type="button" className="btn-secondary" onClick={() => go(clearFilters(state))}>{st("search.clearAll")}</button>}
              <button type="button" className="btn-primary flex-1" onClick={() => setDrawer(false)}>
                {st("search.applyFilters", { n: total !== null ? formatCount(total, lang) : "…" })}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
