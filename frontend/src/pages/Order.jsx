// /orders/:id — a TEST order. An order made by the AI (assistant or ChatGPT via MCP) waits
// here until the person confirms it; only this page can confirm.
import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useI18n } from "../i18n/LanguageContext";
import { useShopText } from "../i18n/shop";
import { formatDate, formatPrice, num, price } from "../lib/data";
import { formatKg } from "../lib/format";
import { EmptyState, ErrorState } from "./components/common/States";
import TestModeNote from "./components/common/TestModeNote";

const STATUS_STYLE = {
  awaiting_confirmation: "bg-[#fff4e5] text-[#92400e]",
  confirmed_test: "bg-[#E4F1E6] text-[#1F5D3A]",
  cancelled: "bg-[#efece2] text-[#4b5563]",
  draft: "bg-[#efece2] text-[#4b5563]",
};

export default function Order() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { t, lang } = useI18n();
  const st = useShopText();
  const [state, setState] = useState({ status: "loading", order: null });
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading", order: null });
    api.getTestOrder(id)
      .then((o) => alive && setState({ status: "success", order: o }))
      .catch((e) => alive && setState({ status: e?.status === 404 ? "notfound" : "error", order: null }));
    return () => { alive = false; };
  }, [id, retry]);

  const act = async (fn) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setActionError(false);
    try {
      const o = await fn(id);
      setState({ status: "success", order: o });
    } catch {
      setActionError(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  if (state.status === "loading") {
    return <main className="page-wrap"><div className="h-64 rounded-2xl bg-white border border-[#ebe6d8] animate-pulse" aria-busy="true" /><span className="sr-only">{t("common.loading")}</span></main>;
  }
  if (state.status === "notfound") {
    return (
      <main className="page-wrap">
        <EmptyState icon="cart" title={st("order.notFound")}><Link to="/cart" className="btn-primary">{st("cart.title")}</Link></EmptyState>
      </main>
    );
  }
  if (state.status === "error") {
    return <main className="page-wrap"><ErrorState onRetry={() => setRetry((n) => n + 1)} /></main>;
  }

  const order = state.order;
  const status = order.status in STATUS_STYLE ? order.status : "draft";
  const saved = num(order.saved_co2e_kg);
  const totalCo2 = num(order.total_co2e_kg);
  const lines = Array.isArray(order.items) ? order.items : [];
  const unpriced = lines.filter((l) => price(l.unit_price_vnd) === null).length;
  const events = Array.isArray(order.events) ? order.events : [];
  const who = (w) => { const l = st(`order.who.${w}`); return l === `order.who.${w}` ? w : l; };

  return (
    <main className="page-wrap flex flex-col gap-5 max-w-4xl">
      {params.get("created") === "1" && status === "awaiting_confirmation" && (
        <p role="status" className="rounded-xl bg-[#E4F1E6] px-4 py-3 text-[15.5px] font-medium text-[#1F5D3A]">{st("order.success")}</p>
      )}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title">{st("order.title")}</h1>
          <span className={`rounded-full px-3 py-1 text-[14px] font-semibold ${STATUS_STYLE[status]}`}>{st(`order.status.${status}`)}</span>
        </div>
        <p className="text-[15px] text-[#4b5563] break-all">
          {st("order.number", { id: order.id })} · {st("order.createdBy", { who: who(order.created_by) })}
          {formatDate(order.created_at, lang, true) ? ` · ${formatDate(order.created_at, lang, true)}` : ""}
        </p>
      </header>
      <TestModeNote />

      {status === "awaiting_confirmation" && (
        <section className="rounded-2xl border border-[#f3d9a4] bg-[#fff8eb] p-5 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={busy} aria-busy={busy} onClick={() => act(api.confirmTestOrder)}>{st("order.confirm")}</button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => act(api.cancelTestOrder)}>{st("order.cancel")}</button>
          </div>
          {actionError && <p role="alert" className="text-[14.5px] text-[#b42318]">{t("common.error.title")}</p>}
        </section>
      )}

      <section className="rounded-2xl bg-white border border-[#ebe6d8] p-5 flex flex-col gap-3">
        <ul className="flex flex-col divide-y divide-[#efece2]">
          {lines.map((l) => {
            const unit = price(l.unit_price_vnd);
            const kg = num(l.co2e_kg);
            return (
              <li key={l.product_id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2.5 text-[15px]">
                <Link to={`/product/${l.product_id}`} className="min-w-0 flex-1 hover:underline line-clamp-2">{l.quantity} × {l.name || l.product_id}</Link>
                <span className="whitespace-nowrap">
                  <span className="font-medium">{unit !== null ? formatPrice(unit * l.quantity, lang) : t("common.noPrice")}</span>
                  <span className="text-[#6b7280]"> · {kg !== null ? `${formatKg(kg * l.quantity, lang)} kg CO₂e` : st("cmp.noData")}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-[#efece2] pt-3 grid gap-1 text-[15.5px]">
          <p className="flex justify-between gap-2"><span>{unpriced ? st("cart.totalPartial") : st("cart.total")}</span><span className="font-bold">{formatPrice(order.total_vnd, lang) || "0 ₫"}</span></p>
          {unpriced > 0 && <p className="text-[14px] text-[#b45309]">{st("cart.missingPrice", { n: unpriced })}</p>}
          <p className="flex justify-between gap-2"><span>{st("cart.co2")}</span><span className="font-semibold text-[#1F5D3A]">{totalCo2 !== null ? `${formatKg(totalCo2, lang)} kg CO₂e` : st("cmp.noData")}</span></p>
        </div>
      </section>

      {saved !== null && saved > 0 && (
        <p className="rounded-2xl bg-[#E4F1E6] p-4 text-[16px] text-[#1F5D3A]">{st("order.saved", { kg: formatKg(saved, lang) })}</p>
      )}
      {saved !== null && saved < 0 && (
        <p className="rounded-2xl bg-[#f6f3ea] p-4 text-[15.5px] text-[#4b5563]">{st("order.notSaved", { kg: formatKg(-saved, lang) })}</p>
      )}

      {events.length > 0 && (
        <details className="rounded-2xl bg-white border border-[#ebe6d8] p-5">
          <summary className="cursor-pointer font-semibold">{st("order.history")}</summary>
          <ul className="mt-2 flex flex-col gap-1 text-[14px] text-[#4b5563]">
            {events.map((e, i) => (
              <li key={i}>{formatDate(e.at, lang, true) || ""} · {who(e.actor)} · {e.action}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="flex flex-wrap gap-2">
        <Link to="/search" className="btn-secondary">{st("cmp.goSearch")}</Link>
      </div>
    </main>
  );
}
