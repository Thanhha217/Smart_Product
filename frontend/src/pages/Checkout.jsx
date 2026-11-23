// /checkout — creates a TEST order only. No card, bank or wallet field exists on purpose;
// the order then waits on its page for the person to confirm it.
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useI18n } from "../i18n/LanguageContext";
import { useShopText } from "../i18n/shop";
import { cartTotals, clearCart, useCart } from "../lib/cart";
import { formatPrice, price } from "../lib/data";
import { CartSummary, MAX_QTY } from "./Cart";
import { EmptyState } from "./components/common/States";
import TestModeNote from "./components/common/TestModeNote";

export default function Checkout() {
  const { t, lang } = useI18n();
  const st = useShopText();
  const navigate = useNavigate();
  const items = useCart();
  const totals = cartTotals(items);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const blocked = totals.missingPrice > 0 || items.some((i) => i.quantity > MAX_QTY);

  const submit = async () => {
    if (!items.length || blocked || inFlight.current) return; // double-click guard
    inFlight.current = true;
    setBusy(true);
    setError(false);
    try {
      const order = await api.createTestOrder({
        items: items.map((i) => ({ product_id: String(i.product.product_id), quantity: i.quantity })),
        created_by: "user",
      });
      clearCart();
      navigate(`/orders/${encodeURIComponent(order.id)}?created=1`, { replace: true });
    } catch {
      setError(true);
      inFlight.current = false;
      setBusy(false);
    }
  };

  if (!items.length) {
    return (
      <main className="page-wrap flex flex-col gap-5">
        <h1 className="page-title">{st("checkout.title")}</h1>
        <EmptyState icon="cart" title={st("cart.emptyTitle")} body={st("cart.emptyBody")}>
          <Link to="/search" className="btn-primary">{st("cmp.goSearch")}</Link>
        </EmptyState>
      </main>
    );
  }

  return (
    <main className="page-wrap flex flex-col gap-5">
      <header>
        <h1 className="page-title">{st("checkout.title")}</h1>
        <p className="page-lead">{st("checkout.review")}</p>
      </header>
      <TestModeNote />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <section className="rounded-2xl bg-white border border-[#ebe6d8] p-5" aria-label={st("checkout.review")}>
          <ul className="flex flex-col divide-y divide-[#efece2]">
            {items.map(({ product, quantity }) => {
              const unit = price(product.price_vnd);
              return (
                <li key={product.product_id} className="flex justify-between gap-3 py-2.5 text-[15px]">
                  <span className="min-w-0 line-clamp-2">{quantity} × {product.name}</span>
                  <span className="whitespace-nowrap font-medium">{unit !== null ? formatPrice(unit * quantity, lang) : t("common.noPrice")}</span>
                </li>
              );
            })}
          </ul>
          <Link to="/cart" className="mt-3 inline-block text-[15px] font-medium text-[#1F5D3A] underline">{st("checkout.backToCart")}</Link>
        </section>
        <CartSummary totals={totals} showCheckout={false}>
          {error && <p role="alert" className="text-[14.5px] text-[#b42318]">{st("checkout.error")}</p>}
          {blocked ? (
            <p role="note" className="rounded-xl bg-[#fff8eb] px-3 py-2 text-[14px] text-[#7c4a03]">{st("cart.blocked")}</p>
          ) : (
            <button type="button" className="btn-primary justify-center" onClick={submit} disabled={busy} aria-busy={busy}>
              {busy ? st("checkout.confirming") : st("checkout.confirm")}
            </button>
          )}
        </CartSummary>
      </div>
    </main>
  );
}
