import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/LanguageContext";
import { api } from "../api/client";
import { cartTotals, replaceInCart, setQuantity, useCart } from "../lib/cart";
import { formatKg, formatVnd } from "../lib/format";
import { Co2Value, GreenBadge, SectionCard, TestModeBanner } from "./components/co2/Co2Bits";

// /cart — test-mode cart (browser only), total CO2 and "switch to a greener item" hints.
export default function Cart() {
  const { t, lang } = useI18n();
  const items = useCart();
  const totals = cartTotals(items);
  const [greener, setGreener] = useState({});
  const idsKey = items.map((i) => i.product.product_id).join(",");

  useEffect(() => {
    let cancelled = false;
    const ids = idsKey ? idsKey.split(",") : [];
    Promise.all(
      ids.map((id) =>
        api
          .getRelated(id, 6)
          .then((r) => [id, r.greener_alternative])
          .catch(() => [id, null])
      )
    ).then((pairs) => !cancelled && setGreener(Object.fromEntries(pairs)));
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-4">
      <TestModeBanner />
      <h1 className="text-2xl font-bold text-primary-500">🛒 {t("cart.title")}</h1>
      {!items.length ? (
        <p className="text-gray-600">
          {t("cart.empty")} <Link to="/assistant" className="text-primary-500 underline">{t("nav.assistant")}</Link>
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {items.map(({ product, quantity }) => {
              const alt = greener[product.product_id];
              const saving = alt && product.co2e_kg != null && alt.co2e_kg != null ? product.co2e_kg - alt.co2e_kg : null;
              return (
                <li key={product.product_id} className="bg-white rounded-2xl p-3 shadow-sm flex flex-col gap-2">
                  <div className="flex gap-3 items-start">
                    {product.image_url && <img src={product.image_url} alt={product.name} className="w-20 h-20 object-contain bg-primary-100 rounded-xl" />}
                    <div className="flex-1 flex flex-col gap-1">
                      <Link to={`/product/${product.product_id}`} className="font-semibold hover:underline">{product.name}</Link>
                      <span className="text-orange-500 font-bold">{formatVnd(product.price_vnd, lang)}</span>
                      <Co2Value kg={product.co2e_kg} className="text-sm" />
                      <GreenBadge score={product.green_score} product={product} />
                    </div>
                    <label className="flex flex-col text-xs items-center gap-1">
                      {t("cart.quantity")}
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={quantity}
                        onChange={(e) => setQuantity(product.product_id, Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
                        className="w-16 rounded-lg px-2 py-1"
                      />
                    </label>
                  </div>
                  {alt && saving > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                      <span>
                        💡 {t("cart.greener", { name: alt.name, kg: formatKg(saving, lang), price: formatVnd(alt.price_vnd, lang) })}
                      </span>
                      <button
                        type="button"
                        onClick={() => replaceInCart(product.product_id, alt)}
                        className="bg-green-600 text-white rounded-lg px-3 py-1 font-semibold whitespace-nowrap"
                      >
                        {t("cart.switch")}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <SectionCard title={t("cart.summary")}>
            <p>{t("cart.totalPrice")}: <span className="font-bold">{formatVnd(totals.vnd, lang)}</span></p>
            <p>{t("cart.totalCo2")}: <span className="font-bold">{formatKg(totals.co2, lang)} kg CO₂e</span></p>
            {totals.missing > 0 && <p className="text-xs text-gray-500">{t("cart.missingCo2", { n: totals.missing })}</p>}
            <Link to="/checkout" className="self-start bg-primary-500 text-white rounded-2xl px-5 py-2 font-semibold">
              {t("cart.checkout")} →
            </Link>
          </SectionCard>
        </>
      )}
    </main>
  );
}
