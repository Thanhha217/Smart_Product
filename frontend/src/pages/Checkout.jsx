import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n/LanguageContext";
import { api } from "../api/client";
import { cartTotals, clearCart, useCart } from "../lib/cart";
import { formatKg, formatVnd } from "../lib/format";
import { SectionCard, TestModeBanner } from "./components/co2/Co2Bits";

// /checkout — simulated payment only: no card, bank or wallet field exists on purpose.
export default function Checkout() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const items = useCart();
  const totals = cartTotals(items);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    if (!items.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const order = await api.createTestOrder({
        items: items.map((i) => ({ product_id: String(i.product.product_id), quantity: i.quantity })),
        created_by: "user",
      });
      const confirmed = await api.confirmTestOrder(order.id);
      clearCart();
      navigate(`/orders/${confirmed.id || order.id}`);
    } catch {
      setError(t("checkout.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-4">
      <TestModeBanner />
      <h1 className="text-2xl font-bold text-primary-500">{t("checkout.title")}</h1>
      {!items.length ? (
        <p className="text-gray-600">
          {t("cart.empty")} <Link to="/cart" className="text-primary-500 underline">{t("cart.title")}</Link>
        </p>
      ) : (
        <>
          <SectionCard title={t("checkout.shipping")}>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div><dt className="text-gray-500">{t("checkout.name")}</dt><dd>{t("checkout.sampleName")}</dd></div>
              <div><dt className="text-gray-500">{t("checkout.phone")}</dt><dd>0900 000 000</dd></div>
              <div className="sm:col-span-2"><dt className="text-gray-500">{t("checkout.address")}</dt><dd>{t("checkout.sampleAddress")}</dd></div>
            </dl>
            <p className="text-xs text-gray-500">{t("checkout.sampleNote")}</p>
          </SectionCard>

          <SectionCard title={t("checkout.payment")}>
            <label className="flex items-center gap-2">
              <input type="radio" name="payment" checked readOnly />
              <span className="font-semibold">{t("checkout.simulated")}</span>
            </label>
            <p className="text-xs text-gray-500">{t("checkout.noRealPayment")}</p>
          </SectionCard>

          <SectionCard title={t("checkout.summary")}>
            <ul className="text-sm flex flex-col gap-1">
              {items.map(({ product, quantity }) => (
                <li key={product.product_id} className="flex justify-between gap-2">
                  <span className="line-clamp-1">{quantity} × {product.name}</span>
                  <span className="whitespace-nowrap">{formatVnd((product.price_vnd || 0) * quantity, lang)}</span>
                </li>
              ))}
            </ul>
            <p>{t("cart.totalPrice")}: <span className="font-bold">{formatVnd(totals.vnd, lang)}</span></p>
            <p>{t("cart.totalCo2")}: <span className="font-bold">{formatKg(totals.co2, lang)} kg CO₂e</span></p>
            {error && <p className="text-red-600">{error}</p>}
            <button
              type="button"
              onClick={confirm}
              disabled={busy}
              className="bg-green-600 text-white rounded-2xl px-5 py-3 font-bold disabled:opacity-50"
            >
              {busy ? t("checkout.processing") : t("checkout.confirm")}
            </button>
          </SectionCard>
        </>
      )}
    </main>
  );
}
