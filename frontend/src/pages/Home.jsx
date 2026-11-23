import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n/LanguageContext";
import { dashText } from "../i18n/dashboard";
import { formatKg, formatNum } from "../lib/format";
import LanguageSwitcher from "./components/header/LanguageSwitcher.jsx";
import Icon from "./components/ui/Icon";
import { Logo } from "./components/layout/AppShell";
import { IconTile, MiniWorld, StatCard } from "./components/dashboard/DashBits";
import { useOverview } from "./Dashboard";
import { SUGGESTED_KEYS } from "./Assistant";

function Hills() {
  return (
    <svg viewBox="0 0 1440 420" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 w-full h-[46%] pointer-events-none" aria-hidden="true">
      <defs>
        <linearGradient id="h1" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#bcd9a2" /><stop offset="1" stopColor="#e9efd9" /></linearGradient>
        <linearGradient id="h2" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#8fbf73" /><stop offset="1" stopColor="#cfe2b6" /></linearGradient>
      </defs>
      <path d="M0 210 C220 120 420 170 620 140 S1040 60 1440 150 V420 H0Z" fill="url(#h1)" opacity=".7" />
      <path d="M0 300 C260 230 520 280 780 250 S1200 200 1440 260 V420 H0Z" fill="url(#h2)" opacity=".55" />
      {[[30, 300], [1260, 250], [1320, 262], [1380, 255]].map(([x, y]) => (
        <g key={x} transform={`translate(${x} ${y})`} opacity=".8"><rect x="-2" y="0" width="4" height="16" fill="#6b4a2e" /><circle cy="-6" r="13" fill="#4f9a45" /><circle cx="-8" cy="2" r="9" fill="#5fae52" /><circle cx="8" cy="2" r="9" fill="#3f8a3a" /></g>
      ))}
    </svg>
  );
}

function LaptopPreview({ o, lang, D, t }) {
  const laptop = o?.by_category?.find((c) => c.category === "laptop");
  return (
    <div className="relative">
      <div className="rounded-[22px] bg-[#1E2B22] p-2.5 shadow-[0_40px_80px_-40px_rgba(23,63,40,.65)]">
        <div className="rounded-[14px] overflow-hidden bg-[#F6F4EC] flex">
          <div className="hidden sm:flex w-[120px] shrink-0 flex-col gap-1.5 p-3 text-white text-[10px]" style={{ background: "linear-gradient(180deg,#1F5D3A,#173F28)" }}>
            <span className="font-extrabold text-[12px] mb-2">🍃 SmartProduct</span>
            {["nav.dashboard", "nav.world", "nav.search", "nav.ask", "nav.compare"].map((k, i) => (
              <span key={k} className={`rounded-lg px-2 py-1.5 ${i === 0 ? "bg-[#3B8C55]" : "text-white/70"}`}>{t(k)}</span>
            ))}
          </div>
          <div className="flex-1 p-3 space-y-2.5 min-w-0">
            <p className="font-display text-[15px] font-bold">{D.dashTitle}</p>
            <div className="grid grid-cols-2 gap-2">
              <MiniStat icon="leaf" tone="green" label={D.stats.products} value={formatNum(o?.with_co2 ?? 7515, lang, 0)} />
              <MiniStat icon="bolt" tone="red" label={D.stats.grid} value={formatNum(o?.grid_ef ?? 0.681, lang, 3)} />
              <MiniStat icon="droplet" tone="blue" label={D.stats.laptop} value={`${formatKg(laptop?.median_kg ?? 277.2, lang)} kg`} />
              <MiniStat icon="book" tone="amber" label={D.stats.refs} value={formatNum(o?.references ?? 1450, lang, 0)} />
            </div>
            <div className="rounded-xl overflow-hidden border border-[#E7E2D4]"><MiniWorld onClick={() => {}} /></div>
          </div>
        </div>
      </div>
      <div className="mx-auto h-3 w-[86%] rounded-b-2xl bg-gradient-to-b from-[#c9c4b4] to-[#a7a291]" />
    </div>
  );
}

function MiniStat({ icon, tone, label, value }) {
  return (
    <div className="rounded-xl bg-white border border-[#E7E2D4] p-2 flex items-center gap-2 min-w-0">
      <IconTile icon={icon} tone={tone} size={26} />
      <div className="min-w-0"><p className="text-[9px] text-[#6B7468] truncate">{label}</p><p className="text-[12px] font-extrabold truncate">{value}</p></div>
    </div>
  );
}

function PhonePreview({ D, o, lang }) {
  return (
    <div className="w-[200px] rounded-[30px] bg-[#1E2B22] p-2 shadow-[0_30px_60px_-30px_rgba(23,63,40,.7)]">
      <div className="rounded-[24px] bg-[#F6F4EC] overflow-hidden">
        <div className="flex justify-between px-4 pt-2 text-[9px] font-bold"><span>9:41</span><span>●●●</span></div>
        <div className="px-3 pb-3 space-y-2">
          <p className="text-[11px] font-extrabold text-[#1F5D3A]">🍃 SmartProduct</p>
          <div className="rounded-2xl p-3 text-white" style={{ background: "linear-gradient(135deg,#2E7D4F,#6FB04A)" }}>
            <p className="text-[12px] font-bold">{D.greeting}</p>
            <p className="text-[9px] opacity-90">{D.greetingSub}</p>
            <p className="mt-2 text-[22px] font-extrabold leading-none">{formatNum(o?.grid_ef ?? 0.681, lang, 3)}</p>
            <p className="text-[9px] opacity-90">{D.gridUnit}</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <MiniStat icon="leaf" tone="green" label={D.stats.products} value={formatNum(o?.with_co2 ?? 7515, lang, 0)} />
            <MiniStat icon="book" tone="amber" label={D.stats.refs} value={formatNum(o?.references ?? 1450, lang, 0)} />
          </div>
          <div className="rounded-xl bg-white border border-[#E7E2D4] p-2">
            <p className="text-[10px] font-bold mb-1">{D.todayTitle}</p>
            {D.todayItems.map((it, i) => (
              <p key={it} className="flex items-center gap-1.5 text-[9px] py-0.5"><span className={`w-3 h-3 rounded grid place-items-center ${i === 1 ? "bg-[#2E7D4F] text-white" : "border border-[#cfc9b8]"}`}>{i === 1 ? "✓" : ""}</span>{it}</p>
            ))}
          </div>
          <div className="grid grid-cols-5 text-center text-[8px] text-[#8a9186] pt-1 border-t border-[#E7E2D4]">
            {["dashboard", "globe", "search", "sparkles", "cart"].map((ic, i) => <span key={ic} className={`grid place-items-center ${i === 0 ? "text-[#2E7D4F]" : ""}`}><Icon name={ic} size={13} /></span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { t, lang } = useI18n();
  const D = dashText(lang);
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const { overview: o } = useOverview();
  const ask = (q) => {
    const text = (q ?? question).trim();
    if (text) navigate(`/assistant?q=${encodeURIComponent(text)}&go=1`);
  };

  return (
    <div className="min-h-screen bg-[#F6F4EC] text-[#1E2B22]">
      <section className="relative overflow-hidden" style={{ background: "radial-gradient(1200px 500px at 70% -10%, #ffffff 0%, #eef3e3 45%, #F6F4EC 75%)" }}>
        <Hills />
        <div className="relative mx-auto max-w-[1320px] px-5 min-[900px]:px-10 pt-6 pb-16">
          <div className="flex items-center justify-between">
            <Logo />
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <Link to="/dashboard" className="hidden sm:inline-flex items-center gap-2 rounded-full bg-[#1F5D3A] text-white px-4 py-2 text-sm font-semibold hover:bg-[#173F28]">{D.dashCta} <Icon name="arrowRight" size={15} /></Link>
            </div>
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-[0.95fr_1.25fr] items-center">
            <div>
              <div className="h-[2px] w-10 bg-[#2E7D4F] mb-4" />
              <p className="eyebrow">{D.eyebrow}</p>
              <h1 className="mt-3 text-[42px] sm:text-[52px] leading-[1.04] font-bold text-[#173F28]">
                {D.headline[0]}<br />{D.headline[1]}<br /><span className="text-[#2E7D4F]">{D.headline[2]}</span>
              </h1>
              <p className="mt-5 max-w-[520px] text-[17px] leading-relaxed text-[#4B554A]">{D.lead}</p>

              <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="mt-6 card p-2 flex items-center gap-2 max-w-[560px]">
                <Icon name="sparkles" className="ml-2 text-[#2E7D4F]" />
                <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={D.searchPh}
                       className="flex-1 min-w-0 bg-transparent outline-none text-[15px] py-2" aria-label={D.askCta} />
                <button type="submit" disabled={!question.trim()} className="rounded-xl bg-[#1F5D3A] text-white font-semibold px-4 py-2.5 disabled:opacity-50">{D.askCta}</button>
              </form>
              <div className="mt-3 flex flex-wrap gap-2 max-w-[560px]">
                {SUGGESTED_KEYS.slice(0, 3).map((key) => (
                  <button key={key} type="button" onClick={() => ask(t(key))} className="rounded-full bg-white border border-[#E7E2D4] px-3 py-1 text-xs hover:border-[#6FB04A]">{t(key)}</button>
                ))}
              </div>
              <Link to="/world" className="mt-6 inline-flex items-center gap-3 rounded-full bg-white border border-[#E7E2D4] pl-2 pr-5 py-2 font-semibold hover:border-[#6FB04A] shadow-sm">
                <span className="grid place-items-center w-9 h-9 rounded-full bg-[#E4F1E6] text-[#2E7D4F]"><Icon name="globe" /></span>{D.worldCta}<Icon name="arrowRight" size={16} />
              </Link>

              <div className="mt-8 grid grid-cols-4 gap-3 max-w-[520px]">
                {D.features.map(([icon, a, b]) => (
                  <div key={a} className="flex flex-col items-center text-center gap-2">
                    <span className="grid place-items-center w-14 h-14 rounded-full bg-white border border-[#E7E2D4] text-[#2E7D4F] shadow-sm"><Icon name={icon} size={24} /></span>
                    <span className="text-[12.5px] font-semibold leading-tight">{a}<br />{b}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative pb-16 md:pr-24">
              <LaptopPreview o={o} lang={lang} D={D} t={t} />
              <div className="hidden md:block absolute -right-6 -bottom-14 xl:-right-10"><PhonePreview D={D} o={o} lang={lang} /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 min-[900px]:px-10 -mt-6 relative">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon="leaf" tone="green" loading={!o} label={D.stats.products} value={formatNum(o?.with_co2, lang, 0)} sub={D.statSubs.products("100%")} />
          <StatCard icon="book" tone="amber" loading={!o} label={D.stats.refs} value={formatNum(o?.references, lang, 0)} sub={D.statSubs.refs} />
          <StatCard icon="droplet" tone="blue" loading={!o} label={D.stats.laptop} value={formatKg(o?.by_category?.find((c) => c.category === "laptop")?.median_kg, lang) ?? "—"} unit="kg" sub={D.statSubs.laptop} />
          <StatCard icon="bolt" tone="red" label={D.stats.grid} value={formatNum(o?.grid_ef ?? 0.681, lang, 3)} sub={D.statSubs.grid} />
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 min-[900px]:px-10 py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {D.benefits.map(([icon, title, sub]) => (
            <div key={title} className="flex items-start gap-4">
              <span className="grid place-items-center w-14 h-14 shrink-0 rounded-full bg-white border border-[#E7E2D4] text-[#2E7D4F] shadow-sm"><Icon name={icon} size={24} /></span>
              <div><p className="font-display text-[20px] font-bold leading-tight text-[#173F28]">{title}</p><p className="mt-1 text-sm text-[#6B7468]">{sub}</p></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
