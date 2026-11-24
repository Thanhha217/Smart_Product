// Shared data hooks and the service list, used by the landing page and the System page.
// (The Overview page itself is gone: the CO2 world is the overview now -- see pages/World.jsx.)
import { useEffect, useState } from "react";
import { tri, useI18n } from "../i18n/LanguageContext";
import { explore } from "../i18n/explore";
import { api } from "../api/client";
import Icon from "./components/ui/Icon";
import { normalizeList } from "../lib/data";
import { formatNum } from "../lib/format";

const SERVICE_ICON = { "db-search": "database", ranking: "bars", clip: "eye", assistant: "sparkles", mcp: "link", etl: "cpu", gateway: "server" };

// Overview + health, with ids resolved to ProductCards when the API sends only ids.
export function useOverview() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const o = await api.getOverview();
        const card = async (id) => (id ? (await api.getProductCo2(id).catch(() => null))?.product || null : null);
        if (!o.greenest?.length && o.greenest_ids?.length) {
          o.greenest = await Promise.all(o.greenest_ids.map(async (g) => ({ category: g.category, product: await card(g.id) })));
        }
        o.suggestions = await Promise.all((o.suggestions || []).map(async (s) => ({
          ...s, from: s.from || (await card(s.from_id)), to: s.to || (await card(s.to_id)),
        })));
        if (alive) setOverview(o);
      } catch {
        if (alive) setError(true);
      }
    })();
    return () => { alive = false; };
  }, []);
  return { overview, error };
}

/** Catalogue totals from /api/categories: listed products, with a CO₂ figure, manufacturer-published. */
export function useCatalogue() {
  const [cat, setCat] = useState(null);
  useEffect(() => {
    let alive = true;
    api.getCategories()
      .then((r) => {
        const rows = Array.isArray(r?.categories) ? r.categories : [];
        const sum = (k) => rows.reduce((n, c) => n + (Number(c?.[k]) || 0), 0);
        if (alive) setCat(rows.length ? { rows, listed: sum("products"), withCo2: sum("with_co2"), manufacturer: sum("manufacturer") } : false);
      })
      .catch(() => alive && setCat(false));
    return () => { alive = false; };
  }, []);
  return cat;   // null = loading, false = unavailable
}

export function useHealth() {
  const [health, setHealth] = useState(null);     // null until the first answer: "not checked yet"
  const [pending, setPending] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setPending(true);
    api.getHealth()
      .then((h) => alive && setHealth({ ...h, services: Array.isArray(h?.services) ? h.services : [], error: false }))
      .catch(() => alive && setHealth((prev) => ({ ...(prev || { services: [] }), error: true })))
      .finally(() => alive && setPending(false));
    return () => { alive = false; };
  }, [tick]);
  return { health, pending, refresh: () => { if (!pending) setTick((n) => n + 1); } };
}

const STATUS_STYLE = {
  online: ["bg-[#E4F1E6] text-[#2E7D4F]", "bg-[#2E7D4F]"],
  degraded: ["bg-[#FEF3C7] text-[#92400e]", "bg-[#d97706]"],
  offline: ["bg-[#FBE4E2] text-[#C2413C]", "bg-[#C2413C]"],
  unchecked: ["bg-[#F1EEE4] text-[#4b5563]", "bg-[#9ca3af]"],
};

export function ServiceStatus({ status, lang }) {
  const X = explore(lang);
  const k = STATUS_STYLE[status] ? status : "unchecked";
  return (
    <span className={`pill ${STATUS_STYLE[k][0]}`} title={X.statusHelp[k]}>
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLE[k][1]}`} aria-hidden="true" />{X.status[k]}
    </span>
  );
}

export function ServiceList({ health, D, compact = false }) {
  const { lang } = useI18n();
  const X = explore(lang);
  if (!health) return <div className="space-y-3" role="status" aria-label={X.sysChecking}>{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-2xl bg-[#F1EEE4] animate-pulse" />)}</div>;
  if (!health.services?.length) return <p className="text-[15px] text-[#7a271a]">{health.error ? X.sysError : D.unavailable}</p>;
  return (
    <ul className="divide-y divide-[#EFEBDF]">
      {health.services.slice(0, compact ? 5 : undefined).map((s) => {
        const detail = s.detail ? (X.aiMode[s.detail] || (s.key === "assistant" ? null : s.detail)) : null;
        const latency = typeof s.latency_ms === "number" ? X.latency(formatNum(s.latency_ms, lang, 0)) : null;
        return (
          <li key={s.key} className="flex items-center gap-3.5 py-3.5">
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#F1EEE4] text-[#1F5D3A]"><Icon name={SERVICE_ICON[s.key] || "server"} size={19} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[16.5px] truncate">{X.services[s.key] || s.name || s.key}</p>
              <p className="text-[14.5px] text-[#6B7468] truncate">{[X.statusHelp[s.status] || null, latency, detail].filter(Boolean).join(" · ")}</p>
            </div>
            <ServiceStatus status={s.status} lang={lang} />
          </li>
        );
      })}
    </ul>
  );
}
