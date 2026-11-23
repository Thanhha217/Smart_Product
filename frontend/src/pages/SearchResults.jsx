// Find products: URL-driven search with understood conditions, real facets, honest empty and
// error states, and stale-response protection (an older answer never replaces a newer query).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useI18n } from "../i18n/LanguageContext";
import { useShopText } from "../i18n/shop";
import { formatCount, formatPrice, normalizeList } from "../lib/data";
import { formatKg } from "../lib/format";
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

  const exampleChips = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[14px] text-[#4b5563]">{st("search.tryExamples")}</span>
      {(Array.isArray(examples) ? examples : []).map((ex) => (
        <button key={ex} type="button" className="chip" onClick={() => go(updateState(parseSearchParams(""), { q: ex }))}>{ex}</button>
      ))}
    </div>
  );

  return (
    <main className="page-wrap" ref={topRef}>
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="page-title">{st("search.title")}</h1>
          <p className="page-lead">{catalogueTotal ? st("search.lead", { total: formatCount(catalogueTotal, lang) }) : st("search.leadNoCount")}</p>
        </div>
        <form role="search" onSubmit={submit} className="flex flex-col sm:flex-row gap-2 max-w-3xl">
          <label className="relative flex-1">
            <span className="sr-only">{st("shell.searchLabel")}</span>
            <Icon name="search" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b7280]" />
            <input type="search" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={st("search.placeholder")} enterKeyHint="search"
                   className="w-full rounded-2xl border-2 border-[#d9d4c4] bg-white pl-12 pr-11 py-3.5 text-[16px] focus:outline-none focus:border-[#2E7D4F]" />
            {draft && (
              <button type="button" onClick={() => { setDraft(""); go(updateState(state, { q: "" })); }} aria-label={st("search.clear")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-full text-[#6b7280] hover:bg-[#f3f4f6]">
                <Icon name="close" size={17} />
              </button>
            )}
          </label>
          <button type="submit" className="btn-primary px-6">{st("search.button")}</button>
        </form>
        {exampleChips}
        {data?.sample && <SampleDataNote />}
      </header>

      {explore && (
        <section className="mt-8" aria-labelledby="cats">
          <h2 id="cats" className="text-xl font-semibold text-[#1E2B22]">{st("search.categories")}</h2>
          {categories === null ? (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white border border-[#ebe6d8] animate-pulse" />)}</div>
          ) : categories.length > 0 && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {categories.map((c) => (
                <button key={c.category} type="button" onClick={() => change({ category: c.category })}
                        className="text-left rounded-2xl bg-white border border-[#ebe6d8] p-4 hover:border-[#2E7D4F] hover:shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D4F]">
                  <span className="block font-semibold text-[#1E2B22]">{st(`cat.${c.category}`)}</span>
                  <span className="block text-[14px] text-[#4b5563]">{st("search.categoryCount", { n: formatCount(c.products, lang) })}</span>
                  {c.median_kg !== null && c.median_kg !== undefined && (
                    <span className="block text-[13.5px] text-[#1F5D3A] mt-1">{st("search.categoryCo2", { kg: formatKg(c.median_kg, lang) })}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden lg:block" aria-label={st("search.filters")}>
          <div className="sticky top-[88px] rounded-2xl bg-white border border-[#ebe6d8] p-5 max-h-[calc(100vh-110px)] overflow-y-auto">
            <h2 className="text-[17px] font-semibold mb-4">{st("search.filters")}</h2>
            <SearchFilters state={state} facets={data?.facets} onChange={change} />
          </div>
        </aside>

        <section aria-live="polite" aria-busy={status === "loading" || status === "updating"}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-[#1E2B22]">
                {explore ? st("search.explore") : state.q ? st("search.resultsFor", { q: state.q }) : st("search.resultsFiltered")}
              </h2>
              {explore && <p className="text-[14px] text-[#4b5563]">{st("search.exploreNote")}</p>}
              {!explore && total !== null && status !== "error" && (
                <p className="text-[15px] text-[#4b5563]">{total === 1 ? st("search.countOne") : st("search.count", { n: formatCount(total, lang) })}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-secondary lg:hidden" onClick={() => setDrawer(true)}>
                <Icon name="menu" size={17} />{st("search.showFilters", { n: filters.length })}
              </button>
              <label className="flex items-center gap-2 text-[15px] text-[#4b5563]">
                <span className="hidden sm:inline">{st("search.sort")}</span>
                <select value={state.sort} onChange={(e) => change({ sort: e.target.value })}
                        className="rounded-xl border border-[#d9d4c4] bg-white px-3 py-2.5 text-[15px] text-[#1E2B22] focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]/40">
                  {SORTS.map((s) => <option key={s} value={s}>{st(`search.sort.${s}`)}</option>)}
                </select>
              </label>
            </div>
          </div>

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

          {filters.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {filters.map((f) => (
                <button key={f.key} type="button" className="chip-active" onClick={() => go(removeFilter(state, f.key))}
                        aria-label={st("search.removeFilter", { what: filterLabel(f) })}>
                  {filterLabel(f)}<Icon name="close" size={14} />
                </button>
              ))}
              <button type="button" className="text-[14px] font-medium text-[#1F5D3A] underline px-1" onClick={() => go(clearFilters(state))}>{st("search.clearAll")}</button>
            </div>
          )}
          {showMissingNote && <p className="mt-2 text-[13.5px] text-[#4b5563]">{st("search.missingLast")}</p>}
          {status === "updating" && <div className="mt-3"><InlineSpinner label={st("search.updating")} /></div>}

          <div className={`mt-5 ${status === "updating" ? "opacity-60 transition-opacity" : ""}`}>
            {status === "loading" && <LoadingGrid count={6} />}
            {status === "error" && (
              <div className="flex flex-col gap-4">
                <ErrorState title={st("search.loadError")} body={st("search.loadErrorBody")} onRetry={retry} />
                {items.length > 0 && <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 opacity-60">{items.map((p) => <ProductCard key={p.product_id} product={p} />)}</div>}
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
                {items[0] && <WhyConsider productId={items[0].product_id} need={state.q || null}
                                          title={st("search.whyTop", { name: items[0].name })} className="mb-4" />}
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {items.map((p) => <ProductCard key={p.product_id} product={p} />)}
                </div>
                <Pagination page={state.page} pages={pages} onPage={onPage} st={st} />
              </>
            )}
          </div>
        </section>
      </div>

      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={st("search.filters")}>
          <button type="button" className="absolute inset-0 bg-black/40" aria-label={st("shell.closeMenu")} onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 right-0 w-[min(360px,92vw)] bg-[#F6F4EC] shadow-2xl flex flex-col">
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
