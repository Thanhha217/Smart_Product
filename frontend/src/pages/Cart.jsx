// /cart — test-mode cart (browser only). Totals never pretend: items without a price are left
// out of the total and named; only CO₂ figures of the same (whole-life) scope are added.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useI18n } from "../i18n/LanguageContext";
import { useShopText } from "../i18n/shop";
import { cartTotals, replaceInCart, setQuantity, useCart } from "../lib/cart";
import { formatCount, formatPrice, normalizeProduct, num, price } from "../lib/data";
import { formatKg } from "../lib/format";
import { useRecent } from "../lib/recent";
import SuggestedProducts from "./components/common/SuggestedProducts";
import ProductCard, { Co2Badge, ProductImage } from "./components/common/ProductCard";
import { EmptyState } from "./components/common/States";
import TestModeNote from "./components/common/TestModeNote";
import Icon from "./components/ui/Icon";

export const MAX_QTY = 10; // same limit as the order service

export default function Cart() {
  const { t, lang } = useI18n();
  const st = useShopText();
  const items = useCart();
  const recent = useRecent();
  const totals = cartTotals(items);
  const [greener, setGreener] = useState({});
  const idsKey = items.map((i) => i.product.product_id).join(",");

  useEffect(() => {
    let alive = true;
    const ids = idsKey ? idsKey.split(",") : [];
    Promise.all(ids.map((id) => api.getRelated(id, 6).then((r) => [id, normalizeProduct(r?.greener_alternative)]).catch(() => [id, null])))
      .then((pairs) => alive && setGreener(Object.fromEntries(pairs)));
    return () => { alive = false; };
  }, [idsKey]);

  if (!items.length) {
    return (
      <main className="page-wrap flex flex-col gap-5">
        <h1 className="page-title">{st("cart.title")}</h1>
        <TestModeNote />
        <EmptyState icon="cart" title={st("cart.emptyTitle")} body={st("cart.emptyBody")}>
          <Link to="/search" className="btn-primary"><Icon name="search" size={18} />{st("cmp.goSearch")}</Link>
          <Link to="/assistant" className="btn-secondary"><Icon name="sparkles" size={18} />{st("cart.askAi")}</Link>
        </EmptyState>
        {recent.length === 0 && <SuggestedProducts />}
        {recent.length > 0 && (
          <section aria-labelledby="cart-recent">
            <h2 id="cart-recent" className="text-lg font-semibold">{st("cart.suggest")}</h2>
            <div className="mt-3 grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
              {recent.slice(0, 4).map((p) => <ProductCard key={p.product_id} product={p} />)}
            </div>
          </section>
        )}
      </main>
    );
  }

  return (
    <main className="page-wrap flex flex-col gap-5">
      <header>
        <h1 className="page-title">{st("cart.title")}</h1>
        <p className="page-lead">{st("cart.lead")}</p>
      </header>
      <TestModeNote />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <ul className="flex flex-col gap-3">
          {items.map(({ product, quantity }) => {
            const unit = price(product.price_vnd);
            const alt = greener[product.product_id];
            const saving = alt && num(product.co2e_kg) !== null && alt.co2e_kg !== null ? product.co2e_kg - alt.co2e_kg : null;
            return (
              <li key={product.product_id} className="rounded-2xl bg-white border border-[#ebe6d8] p-4 flex flex-col gap-3">
                <div className="flex gap-3 items-start">
                  <Link to={`/product/${product.product_id}`} className="shrink-0 w-20 sm:w-24"><ProductImage product={product} className="h-20 sm:h-24" /></Link>
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <Link to={`/product/${product.product_id}`} className="font-semibold text-[15.5px] leading-snug hover:underline line-clamp-2">{product.name}</Link>
                    <span className="text-[15px]">{unit !== null ? formatPrice(unit, lang) : <span className="text-[#b45309] font-medium">{t("common.noPrice")}</span>}</span>
                    <Co2Badge product={product} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2" role="group" aria-label={st("cart.qty")}>
                    <button type="button" className="grid place-items-center w-9 h-9 rounded-lg border border-[#d9d4c4] bg-white text-lg disabled:opacity-40"
                            onClick={() => setQuantity(product.product_id, quantity - 1)} aria-label={st("cart.decrease", { name: product.name })}>−</button>
                    <span className="w-8 text-center tabular-nums font-semibold" aria-live="polite">{quantity}</span>
                    <button type="button" className="grid place-items-center w-9 h-9 rounded-lg border border-[#d9d4c4] bg-white text-lg disabled:opacity-40"
                            disabled={quantity >= MAX_QTY} onClick={() => setQuantity(product.product_id, Math.min(MAX_QTY, quantity + 1))}
                            aria-label={st("cart.increase", { name: product.name })}>+</button>
                    <button type="button" className="ml-2 text-[14.5px] font-medium text-[#b42318] underline" onClick={() => setQuantity(product.product_id, 0)}
                            aria-label={`${st("cart.remove")}: ${product.name}`}>{st("cart.remove")}</button>
                  </div>
                  <span className="text-[15px]">
                    <span className="text-[#6b7280]">{st("cart.lineTotal")}: </span>
                    <span className="font-semibold">{unit !== null ? formatPrice(unit * quantity, lang) : t("common.noPrice")}</span>
                  </span>
                </div>
                {alt && saving > 0 && (
                  <div className="rounded-xl bg-[#E4F1E6] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[14.5px] text-[#1F5D3A]">
                    <span>{st("cart.greener", { name: alt.name, kg: formatKg(saving, lang) })}</span>
                    <button type="button" className="btn-secondary !py-1.5" onClick={() => replaceInCart(product.product_id, alt)}>{st("cart.swap")}</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <CartSummary totals={totals} />
      </div>
    </main>
  );
}

export function CartSummary({ totals, children, showCheckout = true }) {
  const { lang } = useI18n();
  const st = useShopText();
  const blocked = totals.missingPrice > 0;
  return (
    <aside className="rounded-2xl bg-white border border-[#ebe6d8] p-5 flex flex-col gap-3 lg:sticky lg:top-24" aria-labelledby="cart-sum">
      <h2 id="cart-sum" className="text-lg font-semibold">{st("cart.summary")}</h2>
      <p className="text-[15px] text-[#4b5563]">{st("cart.items", { n: formatCount(totals.units, lang) })}</p>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[15px]">{blocked ? st("cart.totalPartial") : st("cart.total")}</span>
        <span className="text-2xl font-bold">{formatPrice(totals.vnd, lang) || "0 ₫"}</span>
      </div>
      {blocked && <p className="text-[14px] text-[#b45309]">{st("cart.missingPrice", { n: totals.missingPrice })}</p>}
      <div className="border-t border-[#efece2] pt-3 flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[15px]">{st("cart.co2")}</span>
          <span className="text-lg font-semibold text-[#1F5D3A] whitespace-nowrap">{totals.co2 > 0 ? `${formatKg(totals.co2, lang)} kg CO₂e` : st("cmp.noData")}</span>
        </div>
        {totals.missing > 0 && <p className="text-[13.5px] text-[#6b7280]">{st("cart.co2Missing", { n: totals.missing })}</p>}
        {totals.otherScope > 0 && <p className="text-[13.5px] text-[#6b7280]">{st("cart.co2OtherScope", { n: totals.otherScope })}</p>}
      </div>
      {children}
      {showCheckout && (blocked ? (
        <p role="note" className="rounded-xl bg-[#fff8eb] px-3 py-2 text-[14px] text-[#7c4a03]">{st("cart.blocked")}</p>
      ) : (
        <Link to="/checkout" className="btn-primary justify-center">{st("cart.checkout")}</Link>
      ))}
    </aside>
  );
}
