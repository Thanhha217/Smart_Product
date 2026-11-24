// /world without a product: explore and search CO₂ data of the real catalogue.
// Every number on this page comes from /api/categories, /api/overview or /api/search.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "../../../../i18n/LanguageContext";
import { explore } from "../../../../i18n/explore";
import { api, MOCK_API } from "../../../../api/client";
import { formatCount, formatPrice, normalizeList } from "../../../../lib/data";
import { formatKg, formatNum } from "../../../../lib/format";
import ProductCard from "../../common/ProductCard";
import { EmptyState, ErrorState, InlineSpinner, LoadingGrid, SampleDataNote } from "../../common/States";
import Icon from "../../ui/Icon";
import CategoryStrip from "../../dashboard/CategoryStrip";

const PAGE_SIZE = 12;
const PARAM_KEYS = ["q", "category", "brand", "min_price", "max_price", "co2_source", "has_co2", "sort", "page", "include_accessories"];

function readParams(sp) {
  const p = {};
  for (const k of PARAM_KEYS) {
    const v = sp.get(k);
    if (v !== null && v !== "") p[k] = v;
  }
  return p;
}

function Landing({ X, lang, run }) {
  const [cats, setCats] = useState({ state: "loading", list: [] });
  const [green, setGreen] = useState({ state: "loading", list: [] });
  const load = useCallback(() => {
    setCats({ state: "loading", list: [] });
    setGreen({ state: "loading", list: [] });
    api.getCategories().then((r) => setCats({ state: "ok", list: r?.categories || [] })).catch(() => setCats({ state: "error", list: [] }));
    api.getOverview().then((o) => setGreen({ state: "ok", list: normalizeList((o?.greenest || []).map((g) => g.product || g.item)) }))
      .catch(() => setGreen({ state: "error", list: [] }));
  }, []);
  useEffect(load, [load]);

  return (
    <>
      <section className="mt-8">
        <CategoryStrip rows={cats.list} status={cats.state === "ok" ? "ok" : cats.state} onRetry={load} lang={lang}
                       title={X.categoriesTitle} lead={X.categoriesLead}
                       linkTo={(row) => `/world?category=${encodeURIComponent(row.category)}&sort=co2_asc`}
                       allHref="/world?has_co2=true&sort=co2_asc" allLabel={X.linkSearch} />
        <p className="mt-2 text-[13.5px] text-[#6b7280]">{X.catDefinition}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold text-[#1E2B22]">{X.greenestTitle}</h2>
        <p className="text-[15px] text-[#4b5563] mt-1">{X.greenestLead}</p>
        <div className="mt-4">
          {green.state === "loading" && <LoadingGrid count={3} />}
          {green.state === "error" && <ErrorState onRetry={load} body={X.errorBody} />}
          {green.state === "ok" && (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {green.list.map((p) => <ResultCard key={p.product_id} product={p} X={X} />)}
            </div>
          )}
        </div>
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl bg-white border border-[#ebe6d8] p-5">
          <h2 className="text-xl font-semibold text-[#1E2B22]">{X.readTitle}</h2>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2">
            {X.read.map(([title, body]) => (
              <div key={title}><dt className="font-semibold text-[#1F5D3A]">{title}</dt><dd className="text-[15px] text-[#374151] mt-1">{body}</dd></div>
            ))}
          </dl>
        </div>
        <nav className="rounded-2xl bg-[#eef4ec] border border-[#d7e6d3] p-5 flex flex-col gap-2" aria-label={X.linksTitle}>
          <h2 className="text-xl font-semibold text-[#1E2B22]">{X.linksTitle}</h2>
          <Link to="/search" className="btn-secondary justify-between"><span>{X.linkSearch}</span><Icon name="arrowRight" size={17} /></Link>
          <Link to="/compare" className="btn-secondary justify-between"><span>{X.linkCompare}</span><Icon name="arrowRight" size={17} /></Link>
          <Link to="/method" className="btn-secondary justify-between"><span>{X.linkMethod}</span><Icon name="arrowRight" size={17} /></Link>
          <button type="button" className="btn-secondary justify-between" onClick={() => run({ co2_source: "manufacturer", sort: "co2_asc" })}>
            <span>{X.samples[4].label}</span><Icon name="arrowRight" size={17} />
          </button>
        </nav>
      </section>
    </>
  );
}

function ResultCard({ product, X }) {
  return (
    <div className="flex flex-col">
      <ProductCard product={product} />
      {product.co2e_kg !== null && (
        <Link to={`/world/${product.product_id}`} className="mt-2 inline-flex items-center gap-1.5 self-start text-[15px] font-semibold text-[#1F5D3A] hover:underline">
          <Icon name="globe" size={17} />{X.exploreWorld}
        </Link>
      )}
    </div>
  );
}

function Understood({ data, X, lang }) {
  const u = data?.understood || {};
  const chips = [];
  if (u.category) chips.push(`${X.u.category}: ${X.categories[u.category] || u.category}`);
  if (u.brand) chips.push(`${X.u.brand}: ${u.brand}`);
  if (u.min_price) chips.push(`${X.u.min} ${formatPrice(u.min_price, lang)}`);
  if (u.max_price) chips.push(`${X.u.max} ${formatPrice(u.max_price, lang)}`);
  if (u.eco) chips.push(X.u.eco);
  if (u.terms?.length) chips.push(`${X.u.terms}: ${u.terms.join(" ")}`);
  if (!chips.length) return null;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-2 text-[15px] text-[#374151]">
      <span className="font-semibold">{X.understood}</span>
      {chips.map((c) => <span key={c} className="rounded-full bg-[#eef4ec] px-2.5 py-0.5 text-[14px] text-[#1F5D3A]">{c}</span>)}
    </p>
  );
}

function Results({ params, X, lang, setParam, run }) {
  const [state, setState] = useState({ status: "loading", data: null, error: null });
  const [nonce, setNonce] = useState(0);
  const ctrl = useRef(null);
  const key = JSON.stringify(params);

  useEffect(() => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setState((s) => ({ status: s.data ? "updating" : "loading", data: s.data, error: null }));
    api.search({ ...params, page_size: PAGE_SIZE }, { signal: c.signal })
      .then((data) => { if (!c.signal.aborted) setState({ status: "ok", data, error: null }); })
      .catch((e) => { if (!c.signal.aborted && e.code !== "cancelled") setState((s) => ({ status: "error", data: s.data, error: e })); });
    return () => c.abort();
  }, [key, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const { status, data } = state;
  if (status === "loading") return <div className="mt-6"><LoadingGrid count={6} /></div>;
  if (status === "error" && !data) return <div className="mt-6"><ErrorState body={X.errorBody} onRetry={() => setNonce((n) => n + 1)} /></div>;

  const items = normalizeList(data?.items);
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Number(params.page || 1);
  const facets = data?.facets || {};
  const title = params.q ? X.resultsFor(params.q) : X.resultsFiltered;

  return (
    <section className="mt-6" aria-live="polite">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-[#1E2B22]">{title}</h2>
          <Understood data={data} X={X} lang={lang} />
        </div>
        {!data?.unsupported && <p className="text-[15px] text-[#374151]">{total === 1 ? X.countOne : X.count(formatCount(total, lang))}</p>}
      </div>
      {status === "updating" && <p className="mt-2"><InlineSpinner label={X.updating} /></p>}
      {status === "error" && <div className="mt-3"><ErrorState compact body={X.errorBody} onRetry={() => setNonce((n) => n + 1)} /></div>}
      {data?.sample && <div className="mt-2"><SampleDataNote /></div>}

      {data?.unsupported ? (
        <div className="mt-5">
          <EmptyState icon="info" title={X.unsupportedTitle}
                      body={`${X.unsupportedBody(X.unsupportedNames[data.unsupported] || data.unsupported)} ${X.unsupportedMethod}`}>
            {X.samples.slice(0, 4).map((s) => <button key={s.label} type="button" className="chip" onClick={() => run(s.params)}>{s.label}</button>)}
            <Link to="/method" className="btn-secondary">{X.linkMethod}</Link>
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white border border-[#ebe6d8] p-3">
            <label className="flex items-center gap-2 text-[15px]">
              <span className="font-medium">{X.filterCategory}</span>
              <select className="rounded-lg border border-[#d9d4c4] bg-white px-2 py-1.5" value={params.category || ""}
                      onChange={(e) => setParam({ category: e.target.value || null })}>
                <option value="">{X.filterAll}</option>
                {(facets.category || []).map((f) => <option key={f.value} value={f.value}>{X.categories[f.value] || f.value} ({formatCount(f.count, lang)})</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[15px]">
              <span className="font-medium">{X.filterSource}</span>
              <select className="rounded-lg border border-[#d9d4c4] bg-white px-2 py-1.5" value={params.co2_source || ""}
                      onChange={(e) => setParam({ co2_source: e.target.value || null })}>
                <option value="">{X.filterAll}</option>
                {(facets.co2_source || []).map((f) => <option key={f.value} value={f.value}>{X.sources[f.value] || f.value} ({formatCount(f.count, lang)})</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[15px]">
              <input type="checkbox" className="w-4 h-4 accent-[#1F5D3A]" checked={params.has_co2 === "true"}
                     onChange={(e) => setParam({ has_co2: e.target.checked ? "true" : null })} />
              {X.hasCo2}
            </label>
            <label className="flex items-center gap-2 text-[15px] sm:ml-auto">
              <span className="font-medium">{X.sort}</span>
              <select className="rounded-lg border border-[#d9d4c4] bg-white px-2 py-1.5" value={params.sort || "relevance"}
                      onChange={(e) => setParam({ sort: e.target.value === "relevance" ? null : e.target.value })}>
                {Object.entries(X.sorts).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-1 text-[13.5px] text-[#6b7280]">{X.sortNote}</p>
          {facets.accessories_hidden > 0 && (
            <p className="mt-2 text-[14px] text-[#92400e]">
              {X.hiddenAccessories(formatCount(facets.accessories_hidden, lang), facets.accessories_hidden)}{" "}
              <button type="button" className="underline font-medium" onClick={() => setParam({ include_accessories: "true" })}>{X.showAccessories}</button>
            </p>
          )}

          {total === 0 ? (
            <div className="mt-5">
              <EmptyState title={X.emptyTitle} body={X.emptyBody}>
                {(data?.relaxations || []).map((r) => {
                  const label = r.drop === "term" ? X.relaxLabels.term(r.value) : X.relaxLabels[r.drop] || r.drop;
                  return <button key={`${r.drop}-${r.value}`} type="button" className="chip" onClick={() => run(relaxed(params, data, r))}>{X.relax(label, formatCount(r.count, lang))}</button>;
                })}
                {X.samples.slice(0, 3).map((s) => <button key={s.label} type="button" className="chip" onClick={() => run(s.params)}>{s.label}</button>)}
              </EmptyState>
            </div>
          ) : (
            <div className={`mt-5 grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 transition-opacity ${status === "updating" ? "opacity-60" : ""}`}>
              {items.map((p) => <ResultCard key={p.product_id} product={p} X={X} />)}
            </div>
          )}

          {pages > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-3" aria-label={X.page(page, pages)}>
              <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setParam({ page: page - 1 > 1 ? String(page - 1) : null }, true)}>{X.prev}</button>
              <span className="text-[15px]">{X.page(page, pages)}</span>
              <button type="button" className="btn-secondary" disabled={page >= pages} onClick={() => setParam({ page: String(page + 1) }, true)}>{X.next}</button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

/** Rebuild the search as explicit filters without the condition the user chose to drop. */
function relaxed(params, data, r) {
  const u = data?.understood || {};
  const next = { ...params };
  delete next.page;
  // conditions understood from the text become explicit filters, then the dropped one is removed
  const terms = (u.terms || []).filter((t) => !(r.drop === "term" && t === r.value));
  if (u.category || u.brand || u.min_price || u.max_price || u.eco || r.drop === "term") {
    next.q = terms.join(" ");
    if (u.category && !next.category) next.category = u.category;
    if (u.brand && !next.brand) next.brand = u.brand;
    if (u.min_price && !next.min_price) next.min_price = String(u.min_price);
    if (u.max_price && !next.max_price) next.max_price = String(u.max_price);
    if (u.eco && !next.sort) next.sort = "co2_asc";
  }
  if (r.drop !== "term") delete next[r.drop];
  if (!next.q) delete next.q;
  return next;
}

export default function WorldExplore() {
  const { lang } = useI18n();
  const X = useMemo(() => explore(lang), [lang]);
  const [sp, setSp] = useSearchParams();
  const params = readParams(sp);
  const searching = Object.keys(params).some((k) => k !== "lang");
  const [text, setText] = useState(params.q || "");
  useEffect(() => { setText(params.q || ""); }, [params.q]);

  const run = useCallback((p) => {
    const next = new URLSearchParams({ explore: "1" });   // stay on this page: plain /world opens the map
    for (const [k, v] of Object.entries(p)) if (v !== null && v !== undefined && v !== "") next.set(k, v);
    setSp(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [setSp]);

  const setParam = useCallback((patch, keepPage = false) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === undefined || v === "") next.delete(k); else next.set(k, v); }
    if (!keepPage && !("page" in patch)) next.delete("page");
    setSp(next);
  }, [sp, setSp]);

  const submit = (e) => {
    e.preventDefault();
    const q = text.replace(/\s+/g, " ").trim();
    if (!q) { run({}); return; }
    const next = { ...params, q };
    delete next.page;
    run(next);
  };

  return (
    <div className="page-wrap">
      <header>
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#2E7D4F]">{X.eyebrow}</p>
        <h1 className="page-title">{X.title}</h1>
        <p className="page-lead">{X.lead}</p>
        {MOCK_API && <div className="mt-2"><SampleDataNote /></div>}
      </header>

      <form onSubmit={submit} className="mt-5 rounded-2xl bg-white border border-[#ebe6d8] p-3 sm:p-4 shadow-sm" role="search">
        <label htmlFor="world-q" className="block text-[15px] font-semibold text-[#1E2B22] mb-2">{X.searchLabel}</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]"><Icon name="search" size={20} /></span>
            <input id="world-q" value={text} onChange={(e) => setText(e.target.value)} placeholder={X.searchPh}
                   className="w-full rounded-xl border border-[#d9d4c4] bg-[#fbfaf6] pl-10 pr-3 py-3 text-[17px] focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]" />
          </div>
          <button type="submit" className="btn-primary px-6">{X.searchBtn}</button>
          {searching && <button type="button" className="btn-secondary" onClick={() => { setText(""); run({}); }}>{X.clear}</button>}
        </div>
        <p className="mt-2 text-[14px] text-[#4b5563]">{X.scopeNote}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-medium text-[#374151]">{X.samplesTitle}:</span>
          {X.samples.map((s) => (
            <button key={s.label} type="button" className="chip" onClick={() => run(s.params)}>{s.label}</button>
          ))}
        </div>
      </form>

      {searching ? <Results params={params} X={X} lang={lang} setParam={setParam} run={run} /> : <Landing X={X} lang={lang} run={run} />}
    </div>
  );
}

