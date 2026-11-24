// /compare — up to 4 products side by side. The browser store is the list; ?ids= mirrors it so a
// link can be shared. Best values are marked only where the comparison is meaningful.
import { useEffect, useId, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { tri, useI18n } from "../i18n/LanguageContext";
import { useShopText } from "../i18n/shop";
import { addToCart } from "../lib/cart";
import { addToCompare, clearCompare, COMPARE_MAX, removeFromCompare, setCompareIds, useCompare } from "../lib/compare";
import { co2Kind, co2Scope, formatPrice, normalizeList, normalizeProduct, num, text } from "../lib/data";
import { formatKg, formatNum } from "../lib/format";
import { useRecent } from "../lib/recent";
import SuggestedProducts from "./components/common/SuggestedProducts";
import { qualityOf } from "../lib/searchState";
import { ProductImage } from "./components/common/ProductCard";
import { EmptyState, ErrorState, InlineSpinner } from "./components/common/States";
import Icon from "./components/ui/Icon";
import { Hero, HowWorked } from "./components/compare/CompareHero";
import AskAiDock from "./components/find/AskAiDock";
import { recommend } from "../lib/compareMath";
import { shortName, variantOf } from "../lib/shortName";

const CO2_CAT = { computer_monitor: "monitors", monitor: "monitors", headphone: "headphones", earphone: "headphones", smartwatch: "smartwatches", tablet: "tablets", smartphone: "smartphones", laptop: "laptops" };
const parseIds = (s) => [...new Set(String(s || "").split(",").map((x) => x.trim()).filter((x) => /^\d+$/.test(x)))].slice(0, COMPARE_MAX);

/** Ids holding the lowest value, only when at least 2 values exist and they are not all equal. */
function lowest(products, get) {
  const vals = products.map((p) => [p.product_id, get(p)]).filter(([, v]) => v !== null && v !== undefined);
  if (vals.length < 2) return new Set();
  const min = Math.min(...vals.map(([, v]) => v));
  const max = Math.max(...vals.map(([, v]) => v));
  if (min === max) return new Set();
  return new Set(vals.filter(([, v]) => v === min).map(([id]) => id));
}
function highest(products, get) {
  return lowest(products, (p) => { const v = get(p); return v === null || v === undefined ? null : -v; });
}

export default function Compare() {
  const { t, lang } = useI18n();
  const st = useShopText();
  const [params, setParams] = useSearchParams();
  const list = useCompare();
  const storeIds = list.map((p) => p.product_id).join(",");
  const urlIds = parseIds(params.get("ids")).join(",");
  // A shared link with other ids than the browser list: adopt the link once.
  const [adopting, setAdopting] = useState(() => Boolean(urlIds) && urlIds !== storeIds);
  const [table, setTable] = useState({ status: "idle", data: null });
  const [retry, setRetry] = useState(0);
  const [note, setNote] = useState(null);
  const [adding, setAdding] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [statsByCat, setStatsByCat] = useState({});
  const [related, setRelated] = useState([]);
  const recent = useRecent();
  const L3 = tri(lang);
  const seq = useRef(0);

  useEffect(() => {
    if (!adopting) return;
    let alive = true;
    api.compareTable(urlIds.split(","), lang)
      .then((d) => {
        if (!alive) return;
        const byId = new Map(normalizeList(d?.products).map((p) => [p.product_id, p]));
        setCompareIds(urlIds.split(",").map((id) => byId.get(id)).filter(Boolean));
      })
      .catch(() => {})
      .finally(() => alive && setAdopting(false));
    return () => { alive = false; };
  }, [adopting]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the URL in step with the list (replace: no history entry per click).
  useEffect(() => {
    if (adopting || storeIds === urlIds) return;
    const next = new URLSearchParams(params);
    if (storeIds) next.set("ids", storeIds); else next.delete("ids");
    setParams(next, { replace: true });
  }, [storeIds, adopting]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (adopting || list.length < 2) { setTable({ status: "idle", data: null }); return; }
    const my = ++seq.current;
    setTable((s) => ({ status: s.data ? "updating" : "loading", data: s.data }));
    api.compareTable(storeIds.split(","), lang)
      .then((d) => my === seq.current && setTable({ status: "success", data: d }))
      .catch(() => my === seq.current && setTable((s) => ({ status: "error", data: s.data })));
  }, [storeIds, lang, adopting, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = (p) => {
    const r = addToCompare(p);
    setNote(r === "duplicate" ? t("compare.duplicate") : r === "full" ? t("compare.full") : null);
    return r;
  };

  // the category median of every compared category (the dashed line and the "vs category" figures)
  const catKey = list.map((p) => `${p.co2_category || ""}:${p.product_id}`).join(",");
  useEffect(() => {
    let alive = true;
    const firstOf = new Map();
    list.forEach((p) => { if (p.co2_category && !firstOf.has(p.co2_category)) firstOf.set(p.co2_category, p.product_id); });
    Promise.all([...firstOf].map(([cat, id]) => api.getCategoryStats(cat, id).then((d) => [cat, d]).catch(() => [cat, null])))
      .then((pairs) => alive && setStatsByCat(Object.fromEntries(pairs)));
    return () => { alive = false; };
  }, [catKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // products to suggest: similar ones to the first compared product
  const firstId = list[0]?.product_id || null;
  useEffect(() => {
    let alive = true;
    if (!firstId) { setRelated([]); return undefined; }
    api.getRelated(firstId, 6).then((d) => alive && setRelated(normalizeList(d?.items))).catch(() => alive && setRelated([]));
    return () => { alive = false; };
  }, [firstId]);

  // Rows read from the table response, kept in the order of the list.
  const extra = new Map((table.data?.products || []).map((p) => [String(p.product_id), p]));
  const products = list.map((p) => {
    const e = extra.get(p.product_id);
    const fresh = normalizeProduct(e) || p;
    return { ...fresh, annual_kwh: num(e?.annual_kwh), electricity_vnd_year: num(e?.electricity_vnd_year) };
  });
  const categories = new Set(products.map((p) => p.co2_category || p.category).filter(Boolean));
  const mixed = categories.size > 1;
  const scopes = new Set(products.map(co2Scope).filter(Boolean));
  const sameScope = scopes.size <= 1;

  // Different product types: no value is "better" than another, so nothing is marked.
  const none = new Set();
  const best = mixed ? {} : {
    price: lowest(products, (p) => p.price_vnd),
    co2: sameScope ? lowest(products, (p) => p.co2e_kg) : none,
    green: highest(products, (p) => p.green_score),
    kwh: lowest(products, (p) => p.annual_kwh),
    bill: lowest(products, (p) => p.electricity_vnd_year),
  };
  const noData = <span className="text-[#6b7280]">{st("cmp.noData")}</span>;
  const catLabel = (p) => {
    for (const c of [p.category, p.co2_category, CO2_CAT[p.co2_category]].filter(Boolean)) {
      for (const k of [c, `${c}s`]) { const l = st(`cat.${k}`); if (l !== `cat.${k}`) return l; }
    }
    const raw = p.category || p.co2_category;
    return raw ? raw.replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase()) : null;
  };

  const rows = [
    { key: "price", label: st("cmp.row.price"), cell: (p) => formatPrice(p.price_vnd, lang) },
    { key: "store", label: st("cmp.row.store"), cell: (p) => p.platform },
    { key: "category", label: st("cmp.row.category"), cell: (p) => catLabel(p) },
    { key: "co2", label: st("cmp.row.co2"), cell: (p) => (p.co2e_kg === null ? null : `${formatKg(p.co2e_kg, lang)} kg CO₂e`) },
    { key: "scope", label: st("cmp.row.scope"), cell: (p) => (co2Scope(p) ? t(`common.scope.${co2Scope(p)}`) : null) },
    { key: "kind", label: st("cmp.row.kind"), cell: (p) => (co2Kind(p) ? t(co2Kind(p) === "published" ? "common.co2Published" : "common.co2Estimated") : null) },
    { key: "source", label: st("cmp.row.source"), cell: (p) => (p.co2e_source ? (st(`src.${p.co2e_source}`) === `src.${p.co2e_source}` ? p.co2e_source : st(`src.${p.co2e_source}`)) : null) },
    { key: "quality", label: st("cmp.row.quality"), cell: (p) => (qualityOf(p.co2e_confidence) ? st(`quality.${qualityOf(p.co2e_confidence)}`) : null) },
    ...(mixed ? [] : [{ key: "green", label: st("cmp.row.green"), cell: (p) => (p.green_score === null ? null : `${formatNum(p.green_score, lang, 1)} / 5`) }]),
    ...(products.some((p) => p.annual_kwh !== null) ? [
      { key: "kwh", label: st("cmp.row.kwh"), cell: (p) => (p.annual_kwh === null ? null : `${formatNum(p.annual_kwh, lang, 0)} kWh`) },
      { key: "bill", label: st("cmp.row.bill"), cell: (p) => formatPrice(p.electricity_vnd_year, lang) },
    ] : []),
  ];
  const conclusion = !mixed && sameScope ? text(table.data?.conclusion) : null;
  // the row the table marks as the lowest CO2; only meaningful when the products compare at all
  const medianOf = (p) => (p ? statsByCat[p.co2_category]?.median_kg ?? null : null);
  const statsOf = (p) => (p ? statsByCat[p.co2_category] || null : null);
  const withCo2 = products.filter((p) => p.co2e_kg !== null).length;
  const rec = !mixed && sameScope ? recommend(products, medianOf(products.find((p) => p.co2e_kg !== null))) : null;
  const noPick = mixed ? L3("Các món thuộc loại khác nhau. CO₂ chỉ nên so trong cùng loại, nên trang không chọn hộ.",
                             "These products are of different types. CO₂ only compares within a type, so no product is picked.",
                             "Ces produits sont de types différents : le CO₂ ne se compare qu'au sein d'un type.")
    : !sameScope ? L3("Các số CO₂ không cùng phạm vi (cả vòng đời và chỉ sản xuất), nên không so trực tiếp.",
                      "The CO₂ figures cover different scopes (whole lifecycle and production only), so they are not compared directly.",
                      "Les chiffres CO₂ n'ont pas la même portée : pas de comparaison directe.")
    : withCo2 < 2 ? L3("Cần ít nhất hai món có số CO₂ để chọn.", "At least two products need a CO₂ figure to pick one.", "Il faut au moins deux produits avec un chiffre CO₂.")
    : null;
  const catName = (() => { const c = rec?.best; if (!c) return ""; const l = catLabel(c); return l ? l.toLowerCase() : ""; })();
  // suggestions: not already compared, and not the same model sold by another store (same full name)
  const inList = new Set(list.map((p) => p.product_id));
  const sameName = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
  const suggestions = [];
  for (const p of [...recent, ...related]) {
    if (!p || inList.has(p.product_id) || list.some((x) => sameName(x.name, p.name))) continue;
    if (!suggestions.some((x) => x.product_id === p.product_id || sameName(x.name, p.name))) suggestions.push(p);
  }
  // a suggestion with the same short name as a compared product shows its configuration too
  const listShort = new Set(list.map((p) => shortName(p.name)));
  const chipName = (p) => { const n = shortName(p.name); const v = variantOf(p.name); return listShort.has(n) && v ? `${n} · ${v}` : n; };
  const askText = list.length >= 2 ? L3(`So sánh ${list.map((p) => shortName(p.name)).join(" và ")}: nên chọn món nào?`,
                                      `Compare ${list.map((p) => shortName(p.name)).join(" and ")}: which one should I choose?`,
                                      `Comparer ${list.map((p) => shortName(p.name)).join(" et ")} : lequel choisir ?`) : "";

  return (
    <main className="page-wrap flex max-w-[1180px] flex-col gap-6 py-7 pb-28">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[40px] font-semibold leading-none text-[#1E2B22] sm:text-[44px]">{L3("So sánh", "Compare", "Comparer")}</h1>
        <span className="text-[16px] font-semibold text-[#55604F]" aria-label={st("cmp.slotsLeft", { n: COMPARE_MAX - list.length })}>{list.length}/{COMPARE_MAX}</span>
        {list.length < COMPARE_MAX && suggestions.slice(0, 3).map((p) => (
          <button key={p.product_id} type="button" onClick={() => add(p)} title={`${st("cmp.addThis")}: ${p.name}`}
                  className="inline-flex h-[44px] max-w-[220px] items-center rounded-full border border-[#DCD7C9] bg-white px-4 text-[15.5px] text-[#1E2B22] hover:border-[#2E7D4F]">
            <span className="truncate">+ {chipName(p)}</span>
          </button>
        ))}
        {list.length < COMPARE_MAX && (
          <button type="button" onClick={() => setAdding(!adding)} aria-expanded={adding}
                  className="inline-flex h-[44px] items-center gap-1.5 rounded-full border border-dashed border-[#B9B29E] px-4 text-[15px] text-[#55604F] hover:border-[#2E7D4F]">
            <Icon name="search" size={16} />{L3("Tìm thêm", "Find more", "Chercher")}
          </button>
        )}
        {list.length > 0 && (
          <button type="button" onClick={() => { clearCompare(); setNote(null); }}
                  className="ml-auto h-[44px] rounded-[12px] border border-[#1B4332] bg-white px-5 text-[15.5px] font-semibold text-[#1B4332] hover:bg-[#F3F8F1]">
            {L3("Xóa tất cả", "Remove all", "Tout retirer")}
          </button>
        )}
      </header>

      {adopting ? <InlineSpinner label={t("common.loading")} /> : (
        <>
          {(adding || list.length === 0) && list.length < COMPARE_MAX && (
            <AddBox onAdd={add} exclude={list.map((p) => p.product_id)} slots={COMPARE_MAX - list.length} />
          )}
          {list.length >= COMPARE_MAX && adding && <p className="text-[15px] text-[#4b5563]" role="status">{t("compare.full")}</p>}
          {note && <p role="status" className="text-[15px] text-[#92400e]">{note}</p>}

          {list.length === 0 && <HowTo />}
          {list.length === 0 && <SuggestedProducts />}

          {list.length === 1 && (
            <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,320px)_1fr]">
              <HeaderCard product={products[0]} />
              <EmptyState compact icon="scale" title={st("cmp.oneMore")}><Link to="/search" className="btn-primary">{st("cmp.goSearch")}</Link></EmptyState>
            </div>
          )}

          {list.length >= 2 && (
            <>
              <Hero rec={rec} reason={noPick} catName={catName} />
              <HowWorked products={products} rec={rec} medianOf={medianOf} statsOf={statsOf} sameCategory={!mixed} />

              <section aria-labelledby="table" className="flex flex-col gap-3">
                <h2 id="table" className="flex items-center gap-3 font-display text-[26px] font-semibold text-[#1E2B22]">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#1B4332] font-sans text-[15px] font-bold text-white">2</span>
                  {L3("Bảng so sánh chi tiết", "The detailed table", "Le tableau détaillé")}
                </h2>
                {!sameScope && <p role="note" className="text-[15px] text-[#4b5563]">{st("cmp.scopeNote")}</p>}
                {table.status === "error" && <ErrorState compact title={st("cmp.tableError")} onRetry={() => setRetry((n) => n + 1)} />}
                {(table.status === "loading" || table.status === "updating") && <InlineSpinner label={t("common.loading")} />}
                <div className="overflow-x-auto rounded-[20px] border border-[#E8E4D8] bg-white" tabIndex={0} aria-label={st("cmp.title")}>
                  <table className="w-full min-w-[640px] border-collapse text-[15px]">
                    <thead>
                      <tr>
                        <th scope="col" className="w-44 p-3 text-left align-bottom text-[14px] font-medium text-[#6b7280]"><span className="sr-only">{st("cmp.row.price")}</span></th>
                        {products.map((p) => (
                          <th key={p.product_id} scope="col" className="min-w-[180px] p-3 text-left align-top font-normal"><HeaderCard product={p} compact /></th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.key} className="border-t border-[#efece2]">
                          <th scope="row" className="bg-[#faf8f2] p-3 text-left font-medium text-[#374151]">{row.label}</th>
                          {products.map((p) => {
                            const v = row.cell(p);
                            const isBest = Boolean(v) && best[row.key]?.has(p.product_id);
                            return (
                              <td key={p.product_id} className={`p-3 align-top ${isBest ? "bg-[#E4F1E6] font-semibold text-[#1F5D3A]" : ""}`}>
                                {v || noData}
                                {isBest && <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-white px-2 py-0.5 text-[12.5px] font-semibold text-[#1F5D3A]"><Icon name="check" size={13} />{st("cmp.best")}</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[13.5px] text-[#6b7280]">{st("cmp.qualityNote")}</p>
                {conclusion && <p className="rounded-xl bg-[#f6f3ea] px-4 py-3 text-[15.5px] text-[#1E2B22]">{conclusion}</p>}
              </section>
            </>
          )}
        </>
      )}

      <AskAiDock open={askOpen} onOpen={() => setAskOpen(true)} onClose={() => setAskOpen(false)} initial={askText} />
    </main>
  );
}

function HeaderCard({ product, compact = false }) {
  const { t, lang } = useI18n();
  const st = useShopText();
  const [added, setAdded] = useState(false);
  const priceText = formatPrice(product.price_vnd, lang);
  return (
    <div className={`flex flex-col gap-2 ${compact ? "" : "rounded-2xl bg-white border border-[#ebe6d8] p-4"}`}>
      <ProductImage product={product} className="h-28" />
      <Link to={`/product/${product.product_id}`} className="font-semibold text-[15px] leading-snug text-[#1E2B22] hover:underline line-clamp-2">{product.name}</Link>
      <span className="text-[15px] font-semibold">{priceText || <span className="font-normal text-[#6b7280]">{t("common.noPrice")}</span>}</span>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[14px]">
        <button type="button" className="font-medium text-[#1F5D3A] underline" onClick={() => { addToCart(product); setAdded(true); }}>
          {added ? t("common.addedToCart") : t("common.addToCart")}
        </button>
        <button type="button" className="font-medium text-[#b42318] underline" onClick={() => removeFromCompare(product.product_id)}
                aria-label={`${st("cart.remove")}: ${product.name}`}>
          {st("cart.remove")}
        </button>
      </div>
    </div>
  );
}

function HowTo() {
  const st = useShopText();
  return (
    <section className="rounded-2xl bg-white border border-[#ebe6d8] p-6" aria-labelledby="howto">
      <h2 id="howto" className="text-lg font-semibold text-[#1E2B22]">{st("cmp.howTitle")}</h2>
      <ol className="mt-3 flex flex-col gap-2 text-[15.5px] text-[#374151] list-decimal pl-5">
        <li>{st("cmp.step1")}</li><li>{st("cmp.step2")}</li><li>{st("cmp.step3")}</li>
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/search" className="btn-primary"><Icon name="search" size={18} />{st("cmp.goSearch")}</Link>
        <Link to="/world" className="btn-secondary"><Icon name="globe" size={18} />{st("prod.world")}</Link>
      </div>
    </section>
  );
}

/** Search-as-you-type box (combobox) plus recently viewed products as one-click suggestions. */
function AddBox({ onAdd, exclude, slots }) {
  const { lang } = useI18n();
  const st = useShopText();
  const recent = useRecent().filter((p) => !exclude.includes(p.product_id)).slice(0, 4);
  const [q, setQ] = useState("");
  const [res, setRes] = useState({ status: "idle", items: [] });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();

  useEffect(() => {
    const value = q.trim();
    if (value.length < 2) { setRes({ status: "idle", items: [] }); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setRes((r) => ({ ...r, status: "loading" }));
      api.search({ q: value, page_size: 8 }, { signal: ctrl.signal })
        .then((d) => setRes({ status: "success", items: normalizeList(d?.items) }))
        .catch((e) => { if (e?.code !== "cancelled" && e?.name !== "AbortError") setRes({ status: "error", items: [] }); });
    }, 250);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q]);

  const items = res.items.filter((p) => !exclude.includes(p.product_id));
  const pick = (p) => {
    if (onAdd(p) === "added") { setQ(""); setOpen(false); setActive(-1); }
  };
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (items[active >= 0 ? active : 0]) pick(items[active >= 0 ? active : 0]); }
    else if (e.key === "Escape") { setOpen(false); setActive(-1); }
  };
  const showList = open && q.trim().length >= 2;

  return (
    <section className="rounded-2xl bg-white border border-[#ebe6d8] p-4 flex flex-col gap-3" aria-label={st("cmp.addLabel")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="cmp-add" className="text-[15.5px] font-semibold text-[#1E2B22]">{st("cmp.addLabel")}</label>
        <span className="text-[14px] text-[#6b7280]">{st("cmp.slotsLeft", { n: slots })}</span>
      </div>
      <div className="relative">
        <input id="cmp-add" type="search" value={q} autoComplete="off" placeholder={st("cmp.addPh")}
               role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
               aria-activedescendant={showList && active >= 0 && items[active] ? `${listId}-${active}` : undefined}
               onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }} onKeyDown={onKey}
               onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
               className="w-full rounded-xl border border-[#d9d4c4] bg-white px-3.5 py-2.5 text-[15.5px] focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]/40" />
        {showList && (
          <ul id={listId} role="listbox" className="absolute z-20 left-0 right-0 mt-1 max-h-80 overflow-y-auto rounded-xl border border-[#ebe6d8] bg-white shadow-lg">
            {res.status === "loading" && items.length === 0 && <li className="px-3 py-2.5 text-[15px] text-[#6b7280]" role="presentation">…</li>}
            {res.status === "error" && <li className="px-3 py-2.5 text-[15px] text-[#b42318]" role="presentation">{st("cmp.tableError")}</li>}
            {res.status === "success" && items.length === 0 && <li className="px-3 py-2.5 text-[15px] text-[#6b7280]" role="presentation">{st("cmp.noSuggest")}</li>}
            {items.map((p, i) => (
              <li key={p.product_id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                  onMouseDown={(e) => { e.preventDefault(); pick(p); }} onMouseEnter={() => setActive(i)}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${i === active ? "bg-[#E4F1E6]" : ""}`}>
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-[15px] font-medium">{p.name}</span>
                  <span className="block text-[13.5px] text-[#6b7280]">
                    {[formatPrice(p.price_vnd, lang), p.co2e_kg !== null ? `${formatKg(p.co2e_kg, lang)} kg CO₂e` : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <Icon name="scale" size={16} className="text-[#1F5D3A] shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </div>
      {recent.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[14px] font-medium text-[#4b5563]">{st("cmp.recent")}</span>
          <div className="flex flex-wrap gap-2">
            {recent.map((p) => (
              <button key={p.product_id} type="button" className="chip max-w-[280px]" onClick={() => onAdd(p)} title={st("cmp.addThis")}>
                <span className="truncate">+ {p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
