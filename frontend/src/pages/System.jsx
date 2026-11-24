import { LOCALES, useI18n } from "../i18n/LanguageContext";
import { dashText } from "../i18n/dashboard";
import { explore } from "../i18n/explore";
import { formatNum } from "../lib/format";
import Icon from "./components/ui/Icon";
import { ErrorState } from "./components/common/States";
import { Bar, Card, SourceStack, StatCard } from "./components/dashboard/DashBits";
import { ServiceList, useCatalogue, useHealth, useOverview } from "./overviewData";

function checkedAt(iso, lang) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(LOCALES[lang], { dateStyle: "medium", timeStyle: "medium" });
}

// /system — live service checks (online | degraded | offline; "not checked yet" before the first answer) and data definitions.
export default function System() {
  const { lang } = useI18n();
  const D = dashText(lang);
  const X = explore(lang);
  const { health, pending, refresh } = useHealth();
  const { overview: o, error: overviewError } = useOverview();
  const catalogue = useCatalogue();
  const services = health?.services || [];
  const working = services.filter((s) => s.status === "online").length;
  const platforms = Array.isArray(o?.platforms) ? o.platforms.filter((p) => p?.name && typeof p.n === "number") : [];
  const maxPlatform = Math.max(1, ...platforms.map((p) => p.n));
  const when = checkedAt(health?.checked_at, lang);

  return (
    <main className="page-wrap py-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{X.sysTitle}</h1>
          <p className="page-lead">{X.sysLead}</p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1">
          <button type="button" onClick={refresh} disabled={pending} aria-busy={pending} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60">
            <Icon name="server" size={16} /> {pending ? X.sysChecking : X.sysCheck}
          </button>
          <p className="text-[14px] text-[#4b5563]" role="status">{when ? X.sysLast(when) : X.sysNever}</p>
        </div>
      </div>

      {health?.error && <ErrorState compact body={X.sysError} onRetry={refresh} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon="server" tone="green" loading={!health} label={D.servicesTitle}
                  value={services.length ? `${formatNum(working, lang, 0)}/${formatNum(services.length, lang, 0)}` : "—"} sub={X.status.online} />
        <StatCard icon="database" tone="blue" loading={catalogue === null} label={X.defs[1][0]}
                  value={catalogue ? formatNum(catalogue.withCo2, lang, 0) : "—"}
                  sub={catalogue ? D.statSubs.products(formatNum(catalogue.listed, lang, 0)) : null} />
        <StatCard icon="book" tone="amber" loading={!o && !overviewError} label={X.defs[2][0]}
                  value={o?.references != null ? formatNum(o.references, lang, 0) : "—"} sub="EPD / PCF" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card title={D.servicesTitle} sub={D.servicesLead}>
          <ServiceList health={health} D={D} />
          <dl className="mt-4 grid gap-1.5 text-[14px] text-[#4b5563]">
            {["online", "degraded", "offline", "unchecked"].map((k) => (
              <div key={k}><dt className="inline font-semibold">{X.status[k]}</dt>: <dd className="inline">{X.statusHelp[k]}</dd></div>
            ))}
          </dl>
        </Card>
        <div className="space-y-5">
          <Card title={X.platformsTitle}>
            {platforms.length === 0
              ? <p className="text-[15px] text-[#6B7468]">{o || overviewError ? D.unavailable : D.loading}</p>
              : (
                <ul className="space-y-3">
                  {platforms.map((p) => (
                    <li key={p.name} className="text-[15px]">
                      <div className="flex justify-between mb-1"><span className="font-semibold">{p.name}</span><b>{formatNum(p.n, lang, 0)}</b></div>
                      <Bar pct={(100 * p.n) / maxPlatform} />
                    </li>
                  ))}
                </ul>
              )}
          </Card>
          <Card title={X.sourcesTitle} sub={X.defs[3][1]}><SourceStack rows={o?.by_source || []} labels={D.sourceLabels} lang={lang} /></Card>
        </div>
      </div>

      <Card title={X.defsTitle}>
        <dl className="grid gap-4 md:grid-cols-2">
          {X.defs.map(([title, body]) => (
            <div key={title}>
              <dt className="font-semibold text-[16px] text-[#1E2B22]">{title}</dt>
              <dd className="mt-1 text-[15px] text-[#4b5563]">{body}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </main>
  );
}
