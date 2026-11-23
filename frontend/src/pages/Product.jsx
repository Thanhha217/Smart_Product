// Product detail: one card with what the store says, what we know about its CO₂ (value, unit,
// scope, source, published or estimated, reports used) and the next steps (compare, cart, world).
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useI18n } from "../i18n/LanguageContext";
import { useShopText } from "../i18n/shop";
import { addToCart } from "../lib/cart";
import { addToCompare, removeFromCompare, useCompare } from "../lib/compare";
import { co2Kind, co2Scope, formatCount, formatPrice, normalizeList, normalizeProduct, num, text } from "../lib/data";
import { formatKg, formatNum } from "../lib/format";
import { addRecent } from "../lib/recent";
import { qualityOf } from "../lib/searchState";
import { GATEWAY_URL } from "./utils/consts";
import ProductCard, { ProductImage, specLabel } from "./components/common/ProductCard";
import { EmptyState, ErrorState } from "./components/common/States";
import FormulaCard from "./components/co2/FormulaCard";
import LifecycleDiagram from "./components/co2/LifecycleDiagram";
import Icon from "./components/ui/Icon";

async function loadProduct(id) {
  const res = await fetch(`${GATEWAY_URL}/product/${encodeURIComponent(id)}`);
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  const data = await res.json();
  const item = data?.product;
  if (!item || item.error || !item.product) return null;
  return item;
}

export default function Product() {
  const { productId } = useParams();
  const { t, lang } = useI18n();
  const st = useShopText();
  const navigate = useNavigate();
  const compare = useCompare();
  const [state, setState] = useState({ status: "loading", item: null });
  const [co2, setCo2] = useState(null);
  const [related, setRelated] = useState(null);
  const [retry, setRetry] = useState(0);
  const [note, setNote] = useState(null);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading", item: null });
    setCo2(null);
    setRelated(null);
    setNote(null);
    loadProduct(productId)
      .then((item) => { if (alive) setState({ status: item ? "success" : "notfound", item }); })
      .catch(() => alive && setState({ status: "error", item: null }));
    api.getProductCo2(productId).then((d) => alive && setCo2(d)).catch(() => alive && setCo2(false));
    api.getRelated(productId, 8).then((d) => alive && setRelated(d)).catch(() => alive && setRelated(false));
    return () => { alive = false; };
  }, [productId, retry]);

  const item = state.item;
  const product = normalizeProduct(item);
  useEffect(() => { if (product) addRecent(product); }, [product?.product_id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.status === "loading") {
    return (
      <main className="page-wrap" aria-busy="true">
        <div className="rounded-2xl bg-white border border-[#ebe6d8] p-6 grid md:grid-cols-[360px_1fr] gap-6 animate-pulse">
          <div className="h-72 rounded-xl bg-[#efece2]" />
          <div className="flex flex-col gap-3"><div className="h-8 w-3/4 rounded bg-[#efece2]" /><div className="h-6 w-1/3 rounded bg-[#efece2]" /><div className="h-24 rounded bg-[#efece2]" /></div>
        </div>
        <span className="sr-only">{t("common.loading")}</span>
      </main>
    );
  }
  if (state.status === "error") {
    return <main className="page-wrap"><ErrorState title={st("prod.loadError")} onRetry={() => setRetry((n) => n + 1)} /></main>;
  }
  if (state.status === "notfound" || !product) {
    return (
      <main className="page-wrap">
        <EmptyState icon="search" title={st("prod.notFound")} body={st("prod.notFoundBody")}>
          <Link to="/search" className="btn-primary">{st("search.title")}</Link>
        </EmptyState>
      </main>
    );
  }

  const inCompare = compare.some((c) => c.product_id === product.product_id);
  const priceText = formatPrice(product.price_vnd, lang);
  const kg = num(product.co2e_kg);
  const scope = co2Scope(product);
  const kind = co2Kind(product);
  const quality = qualityOf(product.co2e_confidence);
  const explanation = text(lang === "vi" ? (item?.product?.co2e_explanation_vi || item?.product?.co2e_explanation) : item?.product?.co2e_explanation);
  const references = (Array.isArray(item?.product?.co2e_references) ? item.product.co2e_references : []).filter((r) => r && text(r.name));
  const warranty = num(item?.return_policy?.warranty_duration);
  const returns = num(item?.return_policy?.days_for_return);
  const description = text(item?.product?.description);
  const relatedItems = related ? normalizeList(related.items).filter((p) => p.product_id !== product.product_id) : [];
  const greener = related ? normalizeProduct(related.greener_alternative) : null;
  const categoryLabel = product.category ? (st(`cat.${product.category}`) !== `cat.${product.category}` ? st(`cat.${product.category}`) : null) : null;

  const toggleCompare = () => {
    if (inCompare) { removeFromCompare(product.product_id); setNote(null); return; }
    const r = addToCompare(product);
    setNote(r === "full" ? t("compare.full") : r === "duplicate" ? t("compare.duplicate") : null);
  };

  return (
    <main className="page-wrap flex flex-col gap-6">
      <nav aria-label="breadcrumb" className="text-[14px] text-[#4b5563] flex flex-wrap gap-1.5">
        <Link to="/search" className="underline hover:text-[#1F5D3A]">{st("search.title")}</Link>
        {categoryLabel && (<><span aria-hidden="true">›</span><Link to={`/search?category=${product.category}`} className="underline hover:text-[#1F5D3A]">{categoryLabel}</Link></>)}
      </nav>

      <section className="rounded-2xl bg-white border border-[#ebe6d8] p-5 md:p-7 grid gap-6 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <ProductImage product={product} className="h-64 md:h-[360px]" />
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex flex-wrap gap-2">
            {product.platform && <span className="rounded-full bg-[#E4F1E6] text-[#1F5D3A] px-3 py-1 text-[14px] font-medium">{st("prod.store")}: {product.platform}</span>}
            {product.condition === "used" && <span className="rounded-full bg-[#fff4e5] text-[#92400e] px-3 py-1 text-[14px]">{t("common.used")}</span>}
          </div>
          <h1 className="page-title !text-[28px] md:!text-[34px]">{product.name}</h1>
          {(product.brand || product.specs.length > 0) && (
            <p className="text-[16px] text-[#374151]">{[product.brand, ...product.specs.map((s) => specLabel(t, s))].filter(Boolean).join(" · ")}</p>
          )}
          <p className="text-[15px] text-[#4b5563]">
            {product.rating !== null ? st("prod.rating", { r: formatNum(product.rating, lang, 1), n: formatCount(product.review_count || 0, lang) }) : st("prod.noRating")}
          </p>
          <div className="flex flex-wrap items-baseline gap-3">
            {priceText ? <span className="text-3xl font-bold text-[#1E2B22]">{priceText}</span>
              : <span className="text-xl font-medium text-[#6b7280]">{t("common.noPrice")}</span>}
            {product.original_price_vnd && <s className="text-[16px] text-[#9ca3af]">{formatPrice(product.original_price_vnd, lang)}</s>}
            {product.discount_pct ? <span className="rounded-full bg-[#fde8e7] px-2 py-0.5 text-[14px] font-semibold text-[#b42318]">−{product.discount_pct}%</span> : null}
          </div>
          {(warranty > 0 || returns > 0) && (
            <div className="flex flex-wrap gap-2 text-[14px]">
              {warranty > 0 && <span className="rounded-lg bg-[#f6f3ea] px-2.5 py-1">{t("product.warranty", { months: warranty })}</span>}
              {returns > 0 && <span className="rounded-lg bg-[#f6f3ea] px-2.5 py-1">{st("prod.returns", { days: returns })}</span>}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <button type="button" className="btn-primary" onClick={() => { addToCart(product); setNote(t("common.addedToCart")); }}>
              <Icon name="cart" size={18} />{t("common.addToCart")}
            </button>
            <button type="button" className={inCompare ? "btn-secondary-active" : "btn-secondary"} onClick={toggleCompare} aria-pressed={inCompare}>
              <Icon name="scale" size={18} />{inCompare ? t("compare.added") : st("cmp.addThis")}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate(`/world/${product.product_id}`)}><Icon name="globe" size={18} />{st("prod.world")}</button>
            <button type="button" className="btn-secondary" onClick={() => navigate(`/assistant?q=${encodeURIComponent(t("product.askAiPrompt", { name: product.name }))}`)}>
              <Icon name="sparkles" size={18} />{st("prod.askAi")}
            </button>
            {product.product_url && (
              <a href={product.product_url} target="_blank" rel="noreferrer" className="btn-secondary"><Icon name="link" size={18} />{st("prod.openStore")}</a>
            )}
          </div>
          {note && <p role="status" className="text-[14px] text-[#1F5D3A]">{note}</p>}
        </div>
      </section>

      <section className="rounded-2xl bg-white border border-[#ebe6d8] p-5 md:p-7" aria-labelledby="co2h">
        <h2 id="co2h" className="text-xl font-semibold text-[#1E2B22]">{st("prod.co2Title")}</h2>
        {kg === null ? (
          <p className="mt-3 text-[16px] text-[#374151] max-w-3xl">{st("prod.co2None")}</p>
        ) : (
          <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-2">
              <p className="text-4xl font-bold text-[#1F5D3A]">{formatKg(kg, lang)} <span className="text-xl font-medium text-[#4b5563]">kg CO₂e</span></p>
              {product.green_score !== null && <p className="text-[15px] font-medium text-[#1F5D3A]">{t("co2.greenScore")}: {formatNum(product.green_score, lang, 1)} / 5 <span className="font-normal text-[#4b5563]">({t("co2.greenScoreHint")})</span></p>}
              <ul className="mt-1 text-[15px] text-[#374151] flex flex-col gap-1">
                <li>{st("prod.co2Scope", { scope: t(`common.scope.${scope}`) })}</li>
                <li>{st("prod.co2Source", { src: st(`src.${product.co2e_source}`) })} · {t(kind === "published" ? "common.co2Published" : "common.co2Estimated")}</li>
                {quality && <li>{st("prod.co2Quality", { q: st(`quality.${quality}`) })}</li>}
              </ul>
              {explanation && <p className="text-[15px] text-[#4b5563] bg-[#f6f3ea] rounded-xl px-3 py-2">{explanation}</p>}
              <p className="text-[13.5px] text-[#6b7280]">{st("cmp.qualityNote")}</p>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-[15px] font-semibold">{st("prod.equivalents")}</h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-[#f6f3ea] p-3"><p className="text-xl font-bold">{formatNum(kg * 4.1, lang, 0)}</p><p className="text-[14px] text-[#4b5563]">{st("prod.eqCar")}</p></div>
                  <div className="rounded-xl bg-[#f6f3ea] p-3"><p className="text-xl font-bold">{formatNum(kg / 21.8, lang, 1)}</p><p className="text-[14px] text-[#4b5563]">{st("prod.eqTrees")}</p></div>
                </div>
              </div>
              {references.length > 0 && (
                <div>
                  <h3 className="text-[15px] font-semibold">{st("prod.references")}</h3>
                  <ul className="mt-1 text-[14px] text-[#374151] flex flex-col gap-1">
                    {references.slice(0, 5).map((r, i) => (
                      <li key={`${r.name}-${i}`}>
                        {text(r.url) ? <a href={r.url} target="_blank" rel="noreferrer" className="underline text-[#1F5D3A]">{r.name}</a> : r.name}
                        {num(r.co2e_kg) !== null && <> — {formatKg(r.co2e_kg, lang)} kg CO₂e</>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {co2 && co2.formula && kg !== null && (
        <div className="grid gap-6 lg:grid-cols-2">
          <FormulaCard formula={co2.formula} />
          <LifecycleDiagram lifecycle={co2.lifecycle} />
        </div>
      )}

      {greener && greener.product_id !== product.product_id && (
        <section aria-labelledby="greener">
          <h2 id="greener" className="text-xl font-semibold text-[#1E2B22]">{st("prod.greener")}</h2>
          <div className="mt-3 max-w-sm"><ProductCard product={greener} highlight /></div>
        </section>
      )}

      {relatedItems.length > 0 && (
        <section aria-labelledby="related">
          <h2 id="related" className="text-xl font-semibold text-[#1E2B22]">{st("prod.related")}</h2>
          <div className="mt-3 grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            {relatedItems.slice(0, 4).map((p) => <ProductCard key={p.product_id} product={p} />)}
          </div>
        </section>
      )}

      {description && description.length > 20 && (
        <details className="rounded-2xl bg-white border border-[#ebe6d8] p-5">
          <summary className="cursor-pointer text-[16px] font-semibold">{st("prod.description")}</summary>
          <p className="mt-3 whitespace-pre-line text-[15px] text-[#374151]">{description.slice(0, 2000)}</p>
        </details>
      )}
    </main>
  );
}
