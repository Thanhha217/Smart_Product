import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LOCALES, tri, useI18n } from "../i18n/LanguageContext";
import { api } from "../api/client";
import { formatKg, formatVnd } from "../lib/format";
import { SectionCard, Skeleton, TestModeBanner } from "./components/co2/Co2Bits";

const STATUS_STYLE = {
  awaiting_confirmation: "bg-amber-100 text-amber-900",
  confirmed_test: "bg-green-100 text-green-900",
  cancelled: "bg-gray-200 text-gray-700",
  draft: "bg-gray-100 text-gray-700",
};

// /orders/:id — test order; an order created by the AI (assistant / ChatGPT via MCP)
// waits here until the human clicks confirm.
export default function Order() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getTestOrder(id)
      .then((o) => !cancelled && setOrder(o))
      .catch((e) => !cancelled && setError(e.status === 404 ? t("order.notFound") : t("checkout.error")));
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  const act = async (fn) => {
    setBusy(true);
    setError("");
    try {
      setOrder(await fn(id));
    } catch {
      setError(t("checkout.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-4">
      <TestModeBanner />
      {error && <p className="text-red-600">{error}</p>}
      {!order && !error && <Skeleton className="h-64" />}
      {order && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-primary-500">{t("order.title")}</h1>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLE[order.status] || ""}`}>
              {t(`order.status.${order.status}`)}
            </span>
          </div>
          <p className="text-sm text-gray-600 break-all">
            {t("order.code")}: <span className="font-mono">{order.id}</span> · {t("order.mode")}: {order.mode} ·{" "}
            {t("order.createdBy")}: {t(`order.by.${order.created_by}`)}
          </p>

          {order.status === "awaiting_confirmation" && (
            <SectionCard title={t("order.needConfirm")}>
              <p className="text-sm">{t("order.needConfirmText")}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => act(api.confirmTestOrder)} className="bg-green-600 text-white rounded-2xl px-5 py-2 font-bold disabled:opacity-50">
                  {t("checkout.confirm")}
                </button>
                <button type="button" disabled={busy} onClick={() => act(api.cancelTestOrder)} className="bg-gray-200 rounded-2xl px-5 py-2 font-semibold disabled:opacity-50">
                  {t("order.cancel")}
                </button>
              </div>
            </SectionCard>
          )}

          <SectionCard title={t("order.items")}>
            <ul className="text-sm flex flex-col gap-1">
              {order.items?.map((it) => (
                <li key={it.product_id} className="flex justify-between gap-2 border-b border-primary-100 pb-1">
                  <Link to={`/product/${it.product_id}`} className="line-clamp-1 hover:underline">
                    {it.quantity} × {it.name}
                  </Link>
                  <span className="whitespace-nowrap">
                    {formatVnd(it.unit_price_vnd * it.quantity, lang)} · {formatKg(it.co2e_kg, lang) ? `${formatKg(it.co2e_kg, lang)} kg` : t("co2.none")}
                  </span>
                </li>
              ))}
            </ul>
            <p>{t("cart.totalPrice")}: <span className="font-bold">{formatVnd(order.total_vnd, lang)}</span></p>
            <p>{t("cart.totalCo2")}: <span className="font-bold">{formatKg(order.total_co2e_kg, lang)} kg CO₂e</span></p>
          </SectionCard>

          {order.saved_co2e_kg > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-green-900 text-lg">
              🌱 {t("order.saved", { kg: formatKg(order.saved_co2e_kg, lang), baseline: formatKg(order.baseline_co2e_kg, lang) })}
            </div>
          )}

          {order.events?.length > 0 && (
            <SectionCard title={t("order.log")}>
              <ul className="text-xs text-gray-600 flex flex-col gap-1">
                {order.events.map((e, i) => (
                  <li key={i}>
                    {(() => {
                      try {
                        return new Date(e.at).toLocaleString(LOCALES[lang]);
                      } catch {
                        return e.at;
                      }
                    })()}{" "}
                    · {t(`order.by.${e.actor}`)} · {e.action}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
          <Link to="/" className="self-start text-primary-500 hover:underline">← {t("order.back")}</Link>
        </>
      )}
    </main>
  );
}
