import { LOCALES, tri, useI18n } from "../i18n/LanguageContext";
import { dashText } from "../i18n/dashboard";
import { formatNum } from "../lib/format";
import Icon from "./components/ui/Icon";
import { Bar, Card, SourceStack, StatCard } from "./components/dashboard/DashBits";
import { ServiceList, useHealth, useOverview } from "./Dashboard";

export default function System() {
  const { lang } = useI18n();
  const D = dashText(lang);
  const { health, refresh } = useHealth();
  const { overview: o } = useOverview();
  const online = (health?.services || []).filter((s) => s.status === "online").length;
  const total = (health?.services || []).length;
  const maxPlatform = Math.max(1, ...(o?.platforms || []).map((p) => p.n));
  const checked = health?.checked_at ? new Date(health.checked_at).toLocaleTimeString(LOCALES[lang]) : "—";

  return (
    <main className="mx-auto max-w-[1320px] px-4 min-[900px]:px-8 py-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Smart Product Finder</p>
          <h1 className="text-[34px] font-bold leading-tight">{D.systemTitle}</h1>
          <p className="text-[#6B7468]">{D.systemLead}</p>
        </div>
        <button type="button" onClick={refresh} className="inline-flex items-center gap-2 rounded-full bg-[#1F5D3A] text-white px-4 py-2 text-sm font-semibold hover:bg-[#173F28]">
          <Icon name="server" size={16} /> {D.refresh}
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon="server" tone="green" loading={!health} label={D.servicesTitle} value={`${online}/${total}`} sub={`${D.checked} ${checked}`} />
        <StatCard icon="database" tone="blue" loading={!o} label={D.stats.products} value={formatNum(o?.with_co2, lang, 0)} sub={D.statSubs.refs} />
        <StatCard icon="book" tone="amber" loading={!o} label={D.stats.refs} value={formatNum(o?.references, lang, 0)} sub="EPD / PCF" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card title={D.servicesTitle} sub={D.servicesLead}><ServiceList health={health} D={D} /></Card>
        <div className="space-y-5">
          <Card title={D.platforms}>
            <ul className="space-y-3">
              {(o?.platforms || []).map((p) => (
                <li key={p.name} className="text-sm">
                  <div className="flex justify-between mb-1"><span className="font-semibold">{p.name}</span><b>{formatNum(p.n, lang, 0)}</b></div>
                  <Bar pct={(100 * p.n) / maxPlatform} />
                </li>
              ))}
            </ul>
          </Card>
          <Card title={D.sourcesTitle} sub={D.sourcesLead}><SourceStack rows={o?.by_source || []} labels={D.sourceLabels} lang={lang} /></Card>
        </div>
      </div>
    </main>
  );
}
