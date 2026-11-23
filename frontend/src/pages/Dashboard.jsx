import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LOCALES, tri, useI18n } from "../i18n/LanguageContext";
import { dashText } from "../i18n/dashboard";
import { api } from "../api/client";
import { formatKg, formatNum } from "../lib/format";
import Icon from "./components/ui/Icon";
import {
  Bar, Card, CardLink, ChartTabs, GreenCard, IconTile, MiniWorld, RangeBars, Ring, SourceStack, StatCard, StatusPill,
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

export function useHealth() {
  const [health, setHealth] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    api.getHealth().then((h) => alive && setHealth(h)).catch(() => alive && setHealth({ services: [], error: true }));
    return () => { alive = false; };
  }, [tick]);
  return { health, refresh: () => { setHealth(null); setTick((n) => n + 1); } };
}

export function ServiceList({ health, D, compact = false }) {
  if (!health) return <div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-2xl bg-[#F1EEE4] animate-pulse" />)}</div>;
  if (!health.services?.length) return <p className="text-sm text-[#6B7468]">{D.unavailable}</p>;
  return (
    <ul className="divide-y divide-[#EFEBDF]">
      {health.services.slice(0, compact ? 5 : undefined).map((s) => (
        <li key={s.key} className="flex items-center gap-3.5 py-3.5">
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#F1EEE4] text-[#1F5D3A]"><Icon name={SERVICE_ICON[s.key] || "server"} size={19} /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[16.5px] truncate">{s.name}</p>
            <p className="text-[14.5px] text-[#6B7468] truncate">{[s.detail, s.latency_ms != null ? `${s.latency_ms} ms` : null].filter(Boolean).join(" · ") || s.key}</p>
          </div>
          <StatusPill ok={s.status === "online"} labels={[D.online, D.offline]} />
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { t, lang } = useI18n();
  const D = dashText(lang);
  const navigate = useNavigate();
  const { overview: o, error } = useOverview();
  const { health } = useHealth();
  const loading = !o && !error;
  const catLabel = (c) => { const k = t(`cat.${c}`); return k === `cat.${c}` ? (c || "").replace(/_/g, " ") : k; };
  const laptop = o?.by_category?.find((c) => c.category === "laptop");
  const coverage = o?.total_products ? (100 * o.with_co2) / o.total_products : 0;
  const sourceTotal = (o?.by_source || []).reduce((n, r) => n + r.n, 0) || 1;
  const sourcePct = (key) => (100 * ((o?.by_source || []).find((r) => r.source === key)?.n || 0)) / sourceTotal;
  const greenestId = useMemo(() => {
    const list = (o?.greenest || []).filter((g) => g.product);
    return list.find((g) => g.category === "laptop")?.product?.product_id || list[0]?.product?.product_id;
  }, [o]);
  const today = new Date().toLocaleDateString(LOCALES[lang], { day: "numeric", month: "short", year: "numeric" });

  return (
    <main className="mx-auto max-w-[1360px] px-4 min-[900px]:px-10 py-8 space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Smart Product Finder</p>
          <h1 className="text-[40px] font-bold text-[#1E2B22] leading-tight mt-1">{D.dashTitle}</h1>
          <p className="text-[18px] text-[#6B7468] mt-1">{D.dashLead}</p>
        </div>
        <span className="pill bg-white border border-[#E7E2D4] text-[#1E2B22] !py-2.5 !px-4 !text-[15.5px]"><Icon name="calendar" size={16} /> {today}</span>
      </div>
      {error && <p className="card p-4 text-sm text-[#C2413C]">{D.unavailable}</p>}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="leaf" tone="green" loading={loading} label={D.stats.products} value={formatNum(o?.with_co2, lang, 0)} sub={D.statSubs.products(`${formatNum(coverage, lang, 0)}%`)} />
        <StatCard icon="book" tone="amber" loading={loading} label={D.stats.refs} value={formatNum(o?.references, lang, 0)} sub={D.statSubs.refs} />
        <StatCard icon="droplet" tone="blue" loading={loading} label={D.stats.laptop} value={formatKg(laptop?.median_kg, lang) ?? "—"} unit="kg" sub={D.statSubs.laptop} />
        <StatCard icon="bolt" tone="red" loading={loading} label={D.stats.grid} value={formatNum(o?.grid_ef ?? 0.681, lang, 3)} sub={D.statSubs.grid} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <Card title={D.worldTitle} right={<CardLink to="/world">{D.worldOpen}</CardLink>}>
          <MiniWorld onClick={() => navigate(greenestId ? `/world/${greenestId}` : "/world")} labels={tri(lang)(["Sản xuất", "Sử dụng", "Vận chuyển"], ["Production", "Use", "Transport"], ["Fabrication", "Utilisation", "Transport"])} />
          <div className="mt-4 flex flex-wrap gap-2.5">
            {[["#6FB04A", D.legend[0]], ["#E0A526", D.legend[1]], ["#D9534F", D.legend[2]]].map(([c, l]) => (
              <span key={l} className="pill bg-white border border-[#E7E2D4]"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />{l}</span>
            ))}
          </div>
        </Card>

        <Card title={D.gridTitle} sub={`${tri(lang)("Việt Nam", "Vietnam", "Vietnam")} · 2024`} right={<IconTile icon="factory" tone="slate" size={36} />}>
          <div className="flex items-center gap-4">
            <IconTile icon="bolt" tone="amber" size={64} />
            <div>
              <p className="text-[44px] leading-none font-extrabold text-[#1E2B22]">{formatNum(o?.grid_ef ?? 0.681, lang, 3)}</p>
              <p className="text-[16px] text-[#6B7468] mt-1.5">{D.gridUnit}</p>
            </div>
          </div>
          <p className="mt-4 text-[16.5px] leading-relaxed text-[#55604F]">{D.gridNote}</p>
          <div className="mt-5 grid grid-cols-5 gap-1.5 text-center">
            {D.gridSources.map(([icon, name, g]) => (
              <div key={name} className="rounded-xl bg-[#FBFAF5] border border-[#EFEBDF] py-2.5 px-1">
                <p className="text-[13.5px] font-semibold text-[#55604F] whitespace-nowrap tracking-tight">{name}</p>
                <span className="my-1 inline-grid place-items-center" style={{ color: g > 300 ? "#C2413C" : g > 40 ? "#B7801A" : "#2E7D4F" }}><Icon name={icon} size={22} /></span>
                <p className="text-[17px] font-bold">{formatNum(g, lang, 0)}</p>
              </div>
            ))}
          </div>
          <p className="mt-2.5 text-[13.5px] text-[#7d8579]">{D.sourcesNote}</p>
          {greenestId && <Link to={`/world/${greenestId}?sim=1&grid=solar`} className="mt-4 inline-flex items-center gap-1 text-[16px] font-semibold text-[#2E7D4F] hover:underline">{D.gridSim} <Icon name="arrowRight" size={14} /></Link>}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <Card title={D.sourcesTitle} sub={D.sourcesLead} right={<CardLink to="/method">{D.viewDetails}</CardLink>}>
          <div className="grid gap-3 sm:grid-cols-2">
            {[["manufacturer", "check", "green"], ["neighbor_average", "eye", "blue"], ["category_model", "bars", "amber"], ["none", "info", "red"]].map(([key, icon, tone]) => (
              <div key={key} className="rounded-2xl border border-[#EFEBDF] bg-[#FBFAF5] p-4 flex items-center gap-3.5">
                <IconTile icon={icon} tone={tone} size={46} />
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] text-[#55604F]">{D.sourceLabels[key]}</p>
                  <p className="text-[24px] leading-tight font-extrabold mb-1">{loading ? "…" : `${formatNum(sourcePct(key), lang, 1)}%`}</p>
                  <Bar pct={sourcePct(key)} color={{ green: "#2E7D4F", blue: "#3B8FD9", amber: "#E0A526", red: "#D9534F" }[tone]} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-[#EFEBDF] p-4">
            <p className="text-[16.5px] font-bold mb-3">{D.chainTitle}</p>
            <ol className="space-y-3">
              {[["manufacturer", "0,9"], ["neighbor_average", "0,5"], ["category_model", "0,35"], ["none", "—"]].map(([key, conf], i) => (
                <li key={key} className="flex items-start gap-3">
                  <span className="grid place-items-center w-7 h-7 shrink-0 rounded-full bg-[#1F5D3A] text-white text-[13.5px] font-bold">{i + 1}</span>
                  <p className="flex-1 text-[16px] leading-snug"><b>{D.sourceLabels[key]}</b> <span className="text-[#6B7468]">· {D.chainDesc[key]}</span></p>
                  {conf !== "—" && <span className="pill bg-[#E4F1E6] text-[#1F5D3A] shrink-0">{D.confidence} {conf}</span>}
                </li>
              ))}
            </ol>
          </div>
        </Card>

        <Card title={D.alertsTitle} right={<CardLink to="/compare">{D.viewAll}</CardLink>}>
          <ul className="space-y-4">
            {(o?.suggestions || []).filter((s) => s.from && s.to).slice(0, 4).map((s) => {
              const m = D.suggestion(s.from.name, s.to.name, formatKg(s.saved_kg, lang));
              return (
                <li key={`${s.from.product_id}-${s.to.product_id}`}>
                  <Link to={`/compare?ids=${s.from.product_id},${s.to.product_id}`} className="flex gap-3 rounded-2xl p-2 -m-2 hover:bg-[#FBFAF5]">
                    <IconTile icon="alert" tone="amber" size={36} />
                    <span className="min-w-0">
                      <span className="block text-[16.5px] font-semibold leading-snug line-clamp-2">{m.title}</span>
                      <span className="block text-[15px] leading-snug text-[#6B7468] line-clamp-2 mt-0.5">{m.sub}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
            <li className="flex gap-3"><IconTile icon="info" tone="green" size={36} />
              <span><span className="block text-[16.5px] font-semibold">{D.tipTitle}</span><span className="block text-[15px] text-[#6B7468] mt-0.5">{D.tipSub}</span></span>
            </li>
            {loading && [0, 1].map((i) => <li key={i} className="h-12 rounded-2xl bg-[#F1EEE4] animate-pulse" />)}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <Card title={D.greenTitle} sub={D.greenLead} right={<CardLink to="/world">{D.openWorld}</CardLink>}>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {(o?.greenest || []).filter((g) => g.product).slice(0, 4).map((g) => <GreenCard key={g.category} product={g.product} category={catLabel(g.category)} lang={lang} />)}
            {loading && [0, 1, 2, 3].map((i) => <div key={i} className="h-36 rounded-2xl bg-[#F1EEE4] animate-pulse" />)}
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-[1fr_190px] items-start">
            <div className="rounded-2xl border border-[#EFEBDF] p-5">
              <ChartTabs tabs={D.tabs}>
                <div>
                  <RangeBars rows={(o?.by_category || []).slice(0, 6)} label={catLabel} lang={lang} />
                  <p className="mt-3 text-[13.5px] text-[#7d8579]">{D.logScale}</p>
                </div>
                <SourceStack rows={o?.by_source || []} labels={D.sourceLabels} lang={lang} />
              </ChartTabs>
            </div>
            <div className="rounded-2xl border border-[#EFEBDF] p-5 flex flex-col items-center">
              <p className="text-[16.5px] font-bold mb-3 text-center">{D.coverage}</p>
              <Ring value={coverage} />
              <p className="mt-3 text-[15px] text-[#6B7468] text-center flex items-center gap-1"><Icon name="check" size={14} className="text-[#2E7D4F]" />{D.coverageSub}</p>
            </div>
          </div>
        </Card>

        <Card title={D.servicesTitle} sub={D.servicesLead} right={<CardLink to="/system">{D.viewAll}</CardLink>}>
          <ServiceList health={health} D={D} compact />
        </Card>
      </div>
    </main>
  );
}
