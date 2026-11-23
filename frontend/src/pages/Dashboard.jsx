import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { tri, useI18n } from "../i18n/LanguageContext";
import { dashText } from "../i18n/dashboard";
import { explore } from "../i18n/explore";
import { api } from "../api/client";
import { formatKg, formatNum } from "../lib/format";
import Icon from "./components/ui/Icon";
import AskHero from "./components/dashboard/AskHero";
import Co2Spotlight from "./components/dashboard/Co2Spotlight";
import CategoryStrip from "./components/dashboard/CategoryStrip";
import HowCalculated from "./components/dashboard/HowCalculated";
import WhyConsider from "./components/co2/WhyConsider";
import ProductCard from "./components/common/ProductCard";
import { normalizeList } from "../lib/data";
import { byCategoryOrder } from "../lib/categories";
import {
  Bar, Card, CardLink, ChartTabs, GreenCard, IconTile, MiniWorld, RangeBars, Ring, SourceStack, StatCard,
} from "./components/dashboard/DashBits";

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

export default function Dashboard() {
  const { lang } = useI18n();
  const D = dashText(lang);
  const L3 = tri(lang);
  const X = explore(lang);
  const { overview: o, error } = useOverview();
  const catalogue = useCatalogue();
  const loading = !o && !error;

  // a real product to walk the formula through when the visitor has not opened one yet
  const exampleIds = useMemo(() => {
    const ids = (o?.greenest || []).map((g) => g.product?.product_id);
    for (const s of o?.suggestions || []) ids.push(s.to?.product_id, s.from?.product_id);
    return [...new Set(ids.filter(Boolean))];
  }, [o]);
  // the picks shown with a reason: the lowest-CO2 priced product of each category
  // in the site's own category order, so the picks never shuffle between visits
  const picks = useMemo(
    () => normalizeList(byCategoryOrder(o?.greenest || []).map((g) => g.product)).slice(0, 3), [o]);
  const coverage = catalogue?.listed ? (100 * catalogue.withCo2) / catalogue.listed : null;
  const catStatus = catalogue === null ? "loading" : catalogue === false ? "error" : "ok";

  return (
    <main className="mx-auto max-w-[1180px] px-4 min-[900px]:px-8 py-7 space-y-9">
      <Co2Spotlight fallbackIds={exampleIds} />

      {error && <p className="rounded-2xl bg-[#FBE4E2] text-[#9B2F2A] px-4 py-3 text-[15.5px]">{D.unavailable}</p>}

      <HowCalculated fallbackIds={exampleIds} />

      <AskHero />

      <CategoryStrip rows={catalogue?.rows} status={catStatus} onRetry={() => window.location.reload()} lang={lang} />

      <section aria-labelledby="picks-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="picks-title" className="text-[24px] font-bold text-[#1E2B22]">
              {L3("Vài món đáng xem", "A few worth a look", "Quelques produits à regarder")}
            </h2>
            <p className="text-[16px] text-[#6B7468]">
              {L3("Món có giá và CO₂ thấp nhất trong mỗi loại, kèm lý do.",
                  "The priced product with the lowest CO₂ in each category, with the reason.",
                  "Le produit avec prix au CO₂ le plus bas de chaque catégorie, avec la raison.")}
            </p>
          </div>
          <Link to="/search?sort=co2_asc&has_co2=true" className="text-[15.5px] font-semibold text-[#1F5D3A] hover:underline">
            {L3("Xem thêm", "See more", "Voir plus")} →
          </Link>
        </div>
        <div className="mt-4 grid gap-4 grid-cols-1 md:grid-cols-3">
          {loading && [0, 1, 2].map((i) => <div key={i} className="h-72 rounded-2xl bg-[#F1EEE4] animate-pulse" />)}
          {picks.map((product) => (
            <div key={product.product_id} className="flex flex-col gap-2">
              <ProductCard product={product} />
              <WhyConsider productId={product.product_id} compact />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="data-title" className="rounded-3xl bg-white border border-[#EFEBDF] p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="data-title" className="text-[20px] font-bold text-[#1E2B22]">
            {L3("Dữ liệu đứng sau các con số", "The data behind the figures", "Les données derrière les chiffres")}
          </h2>
          <span className="flex flex-wrap gap-3">
            <Link to="/method" className="text-[15.5px] font-semibold text-[#1F5D3A] hover:underline">{X.linkMethod} →</Link>
            <Link to="/system" className="text-[15.5px] font-semibold text-[#1F5D3A] hover:underline">{D.systemTitle} →</Link>
          </span>
        </div>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#FBFAF5] border border-[#EFEBDF] px-4 py-3">
            <dt className="text-[15px] text-[#55604F]">{D.stats.products}</dt>
            <dd className="text-[26px] font-extrabold text-[#1E2B22]">
              {catalogue ? formatNum(catalogue.withCo2, lang, 0) : "…"}
              {catalogue && <span className="ml-1 text-[14px] font-medium text-[#6B7468]">/ {formatNum(catalogue.listed, lang, 0)}</span>}
            </dd>
            {coverage !== null && (
              <dd className="text-[13.5px] text-[#6B7468]">
                {L3(`${formatNum(coverage, lang, 0)}% sản phẩm đang bán có số CO₂`,
                    `${formatNum(coverage, lang, 0)}% of listed products have a CO₂ figure`,
                    `${formatNum(coverage, lang, 0)} % des produits listés ont un chiffre CO₂`)}
              </dd>
            )}
          </div>
          <div className="rounded-2xl bg-[#FBFAF5] border border-[#EFEBDF] px-4 py-3">
            <dt className="text-[15px] text-[#55604F]">{D.stats.refs}</dt>
            <dd className="text-[26px] font-extrabold text-[#1E2B22]">{o ? formatNum(o.references, lang, 0) : "…"}</dd>
            <dd className="text-[13.5px] text-[#6B7468]">{D.statSubs.refs}</dd>
          </div>
          <div className="rounded-2xl bg-[#FBFAF5] border border-[#EFEBDF] px-4 py-3">
            <dt className="text-[15px] text-[#55604F]">{D.stats.grid}</dt>
            <dd className="text-[26px] font-extrabold text-[#1E2B22]">{o?.grid_ef != null ? formatNum(o.grid_ef, lang, 3) : "…"}</dd>
            <dd className="text-[13.5px] text-[#6B7468]">{D.statSubs.grid}</dd>
          </div>
        </dl>
        <p className="mt-3 text-[14.5px] text-[#6B7468]">
          {L3("Số CO₂ chỉ có với sản phẩm đủ căn cứ; phần còn lại để trống chứ không đoán. Tình trạng dịch vụ và chi tiết kỹ thuật nằm ở trang Hệ thống.",
              "A CO₂ figure exists only where there is enough evidence; the rest is left empty rather than guessed. Service status and technical details live on the System page.",
              "Un chiffre CO₂ n'existe que s'il y a assez d'éléments ; le reste est laissé vide plutôt que deviné. L'état des services est sur la page Système.")}
        </p>
      </section>
    </main>
  );
}
