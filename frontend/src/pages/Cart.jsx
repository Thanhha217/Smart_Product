// /cart — test-mode cart (browser only), with two tabs (design "Giỏ hàng và ví AI"): "My cart" and
// "AI buys it for you". Totals never pretend: items without a price are left out of the total and
// named; only CO₂ figures of the same (whole-life) scope are added. No payment is ever taken.
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { tri, useI18n } from "../i18n/LanguageContext";
import { useShopText } from "../i18n/shop";
import { cartTotals, replaceInCart, setQuantity, useCart } from "../lib/cart";
import { formatCount, formatPrice, normalizeProduct, num, price } from "../lib/data";
import { formatKg, formatNum } from "../lib/format";
import { useRecent } from "../lib/recent";
import { shortName } from "../lib/shortName";
import SuggestedProducts from "./components/common/SuggestedProducts";
import ProductCard from "./components/common/ProductCard";
import ProductThumb from "./components/common/ProductThumb";
import { EmptyState } from "./components/common/States";
import AiBuyer from "./components/cart/AiBuyer";
import Icon from "./components/ui/Icon";

export const MAX_QTY = 10; // same limit as the order service

function Header({ tab, setTab }) {
  const { lang } = useI18n();
  const L3 = tri(lang);
  const btn = (on) => `inline-flex h-11 items-center gap-2 rounded-full px-5 text-[15.5px] font-semibold transition ${on ? "bg-[#1B4332] text-white" : "text-[#1E2B22] hover:bg-[#F3F1EA]"}`;
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-3 font-display text-[40px] font-semibold leading-none text-[#1B4332] sm:text-[44px]">
          <span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-[#1B4332] text-white"><Icon name="cart" size={24} /></span>
          {L3("Giỏ hàng", "Cart", "Panier")}
        </h1>
        <p className="mt-2 text-[16px] text-[#55604F]">{L3("Đơn thử, không thu tiền thật.", "Test orders, no real payment.", "Commandes test, aucun paiement réel.")}</p>
      </div>
      <div className="flex rounded-full border border-[#E6E2D6] bg-white p-1.5" role="tablist" aria-label={L3("Giỏ hàng", "Cart", "Panier")}>
        <button type="button" role="tab" aria-selected={tab === "cart"} className={btn(tab === "cart")} onClick={() => setTab("cart")}>{L3("Giỏ của tôi", "My cart", "Mon panier")}</button>
        <button type="button" role="tab" aria-selected={tab === "ai"} className={btn(tab === "ai")} onClick={() => setTab("ai")}>
          <Icon name="sparkles" size={16} />{L3("AI mua giúp", "AI buys for me", "L'IA achète")}
        </button>
      </div>
    </header>
  );
}

export default function Cart() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "ai" ? "ai" : "cart";
  const setTab = (t) => { const n = new URLSearchParams(params); if (t === "ai") n.set("tab", "ai"); else n.delete("tab"); setParams(n, { replace: true }); };
  return (
    <main className="page-wrap flex max-w-[1180px] flex-col gap-6 py-7 pb-28">
      <Header tab={tab} setTab={setTab} />
      {tab === "ai" ? <AiBuyer /> : <MyCart onAi={() => setTab("ai")} />}
    </main>
  );
}

function MyCart({ onAi }) {
  const { t, lang } = useI18n();
  const L3 = tri(lang);
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
      <>
        <EmptyState icon="cart" title={st("cart.emptyTitle")} body={st("cart.emptyBody")}>
          <Link to="/search" className="btn-primary"><Icon name="search" size={18} />{st("cmp.goSearch")}</Link>
          <button type="button" onClick={onAi} className="btn-secondary"><Icon name="sparkles" size={18} />{L3("Nhờ AI mua giúp", "Let the AI buy it", "Laisser l'IA acheter")}</button>
        </EmptyState>
        {recent.length === 0 && <SuggestedProducts />}
        {recent.length > 0 && (
          <section aria-labelledby="cart-recent">
            <h2 id="cart-recent" className="text-lg font-semibold">{st("cart.suggest")}</h2>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {recent.slice(0, 4).map((p) => <ProductCard key={p.product_id} product={p} />)}
            </div>
          </section>
        )}
      </>
    );
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)]">
      <ul className="flex flex-col gap-4">
        {items.map(({ product, quantity }) => {
          const unit = price(product.price_vnd);
          const alt = greener[product.product_id];
          const saving = alt && num(product.co2e_kg) !== null && alt.co2e_kg !== null ? product.co2e_kg - alt.co2e_kg : null;
          return (
            <li key={product.product_id} className="flex flex-col gap-4 rounded-[22px] border border-[#E8E4D8] bg-white p-6">
              <div className="flex items-start gap-5">
                <Link to={`/product/${product.product_id}`} className="h-[116px] w-[144px] shrink-0 overflow-hidden rounded-[16px] bg-[#F3EFE4]">
                  <ProductThumb product={product} className="h-full w-full" rounded="rounded-[16px]" standIn={false} tone="find" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Link to={`/product/${product.product_id}`} className="line-clamp-2 text-[18px] font-semibold leading-snug text-[#1E2B22] hover:underline">{product.name}</Link>
                  <span className="text-[16px] text-[#1E2B22]">{unit !== null ? formatPrice(unit, lang) : <span className="font-medium text-[#b45309]">{t("common.noPrice")}</span>}</span>
                  {product.co2e_kg !== null ? (
                    <p className="flex flex-wrap items-baseline gap-x-1.5">
                      <span className="font-display text-[24px] font-bold leading-none text-[#1B4D31]">≈{formatKg(product.co2e_kg, lang)}</span>
                      <span className="text-[14.5px] text-[#55604F]">kg CO₂e{product.green_score !== null ? ` · ${L3("điểm xanh", "green score", "score vert")} ${formatNum(product.green_score, lang, 1)}/5` : ""}</span>
                    </p>
                  ) : <p className="text-[14.5px] text-[#6B7468]">{t("common.noCo2")}</p>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-[#EFEBDF] pt-4" role="group" aria-label={st("cart.qty")}>
                <button type="button" className="grid h-11 w-11 place-items-center rounded-[12px] border border-[#1B4332] bg-white text-[18px] text-[#1B4332] disabled:opacity-40"
                        onClick={() => setQuantity(product.product_id, quantity - 1)} aria-label={st("cart.decrease", { name: product.name })}>−</button>
                <span className="w-8 text-center text-[17px] font-semibold tabular-nums" aria-live="polite">{quantity}</span>
                <button type="button" className="grid h-11 w-11 place-items-center rounded-[12px] border border-[#1B4332] bg-white text-[18px] text-[#1B4332] disabled:opacity-40"
                        disabled={quantity >= MAX_QTY} onClick={() => setQuantity(product.product_id, Math.min(MAX_QTY, quantity + 1))}
                        aria-label={st("cart.increase", { name: product.name })}>+</button>
                <button type="button" className="ml-2 text-[15px] font-semibold text-[#55604F] underline hover:text-[#b42318]" onClick={() => setQuantity(product.product_id, 0)}
                        aria-label={`${L3("Xóa", "Remove", "Retirer")}: ${product.name}`}>{L3("Xóa", "Remove", "Retirer")}</button>
                {quantity > 1 && unit !== null && <span className="ml-auto text-[15px] text-[#55604F]">{st("cart.lineTotal")}: <b className="text-[#1E2B22]">{formatPrice(unit * quantity, lang)}</b></span>}
              </div>
              {alt && saving > 0 && (
                <div className="flex flex-col justify-between gap-2 rounded-[14px] bg-[#E4F1E6] p-3 text-[14.5px] text-[#1F5D3A] sm:flex-row sm:items-center">
                  <span>{st("cart.greener", { name: shortName(alt.name), kg: formatKg(saving, lang) })}</span>
                  <button type="button" className="btn-secondary !py-1.5" onClick={() => replaceInCart(product.product_id, alt)}>{st("cart.swap")}</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <CartSummary totals={totals}>
        <button type="button" onClick={onAi}
                className="flex h-[52px] items-center justify-center gap-2 rounded-[14px] border border-[#1B4332] bg-white text-[16px] font-semibold text-[#1B4332] hover:bg-[#F3F8F1]">
          <Icon name="sparkles" size={16} />{L3("Nhờ AI mua giúp", "Let the AI buy it", "Laisser l'IA acheter")}
        </button>
      </CartSummary>
    </div>
  );
}

/** Totals and the test checkout button; also used by /checkout (without the button). */
export function CartSummary({ totals, children, showCheckout = true }) {
  const { lang } = useI18n();
  const L3 = tri(lang);
  const st = useShopText();
  const blocked = totals.missingPrice > 0;
  return (
    <aside className="flex flex-col gap-4 rounded-[22px] border border-[#E8E4D8] bg-white p-6 lg:sticky lg:top-24" aria-labelledby="cart-sum">
      <h2 id="cart-sum" className="text-[20px] font-semibold text-[#1E2B22]">{L3("Tóm tắt", "Summary", "Résumé")}</h2>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[16px] text-[#55604F]">{blocked ? st("cart.totalPartial") : L3("Tổng cộng", "Total", "Total")}
          <span className="block text-[13.5px]">{st("cart.items", { n: formatCount(totals.units, lang) })}</span>
        </span>
        <span className="font-display text-[34px] font-bold leading-none text-[#1E2B22]">{formatPrice(totals.vnd, lang) || "0 ₫"}</span>
      </div>
      {blocked && <p className="text-[14px] text-[#b45309]">{st("cart.missingPrice", { n: totals.missingPrice })}</p>}
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[16px] text-[#55604F]">{L3("CO₂ vòng đời", "Lifecycle CO₂", "CO₂ du cycle de vie")}</span>
        <span className="whitespace-nowrap font-display text-[24px] font-bold text-[#1B4D31]">{totals.co2 > 0 ? `≈${formatKg(totals.co2, lang)} kg` : st("cmp.noData")}</span>
      </div>
      {totals.missing > 0 && <p className="-mt-2 text-[13.5px] text-[#6b7280]">{st("cart.co2Missing", { n: totals.missing })}</p>}
      {totals.otherScope > 0 && <p className="-mt-2 text-[13.5px] text-[#6b7280]">{st("cart.co2OtherScope", { n: totals.otherScope })}</p>}
      {showCheckout && (blocked ? (
        <p role="note" className="rounded-xl bg-[#fff8eb] px-3 py-2 text-[14px] text-[#7c4a03]">{st("cart.blocked")}</p>
      ) : (
        <Link to="/checkout" className="flex h-[52px] items-center justify-center rounded-[14px] bg-[#1B4332] text-[16px] font-semibold text-white hover:bg-[#143D26]">
          {L3("Thanh toán thử", "Test checkout", "Paiement test")}
        </Link>
      ))}
      {children}
    </aside>
  );
}
