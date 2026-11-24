import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { stageShareLine, stageText } from "../lib/lifecycleText";
import { Co2FormulaLine } from "./components/co2/Co2Explainer";
import { LOCALES, tri, useI18n } from "../i18n/LanguageContext";
import { api } from "../api/client";
import { addToCart } from "../lib/cart";
import { formatKg, formatNum, greenColor } from "../lib/format";
import Flipbook from "./components/story/Flipbook";
import BookShelf from "./components/story/BookShelf";
import {
  CityScene, CoverArt, FactoryScene, GridScene, JourneyMap, RecycleScene, ShipScene, StoryStyles, TreesScene,
} from "./components/story/Illustrations";
import { derive, txt } from "./components/story/storyText";

// ------------------------------------------------------------------ small page parts

function H({ children, kicker }) {
  return (
    <header className="mb-3">
      {kicker && <p className="text-[13.5px] uppercase tracking-widest text-emerald-700 font-semibold">{kicker}</p>}
      <h2 className="text-xl md:text-2xl font-extrabold text-[#1f3b4d] leading-tight">{children}</h2>
    </header>
  );
}

function Big({ kg, lang, label = "kg CO₂e" }) {
  return (
    <p className="text-4xl md:text-5xl font-black text-emerald-700 leading-none">
      {formatKg(kg, lang) ?? "—"} <span className="text-base font-semibold text-gray-600">{label}</span>
    </p>
  );
}

function Tip({ children }) {
  return <p className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-900">💡 {children}</p>;
}

/** A stage's size: its own kilograms when the backend really split them, otherwise the share a
 * product of this category typically has — never presented as this product's measurement. */
function StagePill({ stage, lang, measured }) {
  if (!stage) return null;
  return (
    <div className="flex items-center gap-3 my-2">
      {measured ? (
        <>
          <span className="text-3xl font-black text-[#1f3b4d]">{formatKg(stage.kg, lang)} kg</span>
          <span className="text-sm text-gray-600">· {formatNum(stage.pct, lang, 1)}%</span>
        </>
      ) : (
        <>
          <span className="text-3xl font-black text-[#1f3b4d]">{formatNum(stage.pct, lang, 0)}%</span>
          <span className="text-sm text-amber-700">{tri(lang)("điển hình của loại", "typical for the category", "typique de la catégorie")}</span>
        </>
      )}
      <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
        <div className="h-full bg-emerald-600" style={{ width: `${Math.min(100, stage.pct)}%`, transition: "width .8s" }} />
      </div>
    </div>
  );
}

function Distribution({ stats, kg, T, lang }) {
  if (!stats || stats.min === null || stats.max === null || kg === null) return null;
  const lo = stats.min, hi = stats.max;
  const pos = (v) => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo || 1)) * 100))}%`;
  return (
    <div className="my-4">
      <div className="relative h-4 rounded-full" style={{ background: "linear-gradient(90deg,#2e9e5b,#e0a526,#d64545)" }}>
        <div className="absolute top-0 h-4 border-x-2 border-white/80 bg-white/25" style={{ left: pos(stats.p25), width: `calc(${pos(stats.p75)} - ${pos(stats.p25)})` }} />
        <div className="absolute -top-1 h-6 w-0.5 bg-[#1f3b4d]" style={{ left: pos(stats.median_kg) }} title={T.median} />
        <div className="absolute -top-3 -ml-3 text-xl" style={{ left: pos(kg) }} aria-label="this product">📍</div>
      </div>
      <div className="flex justify-between text-[13.5px] text-gray-500 mt-1">
        <span>{formatKg(lo, lang)} kg · {T.lowLabel}</span><span>{T.median} {formatKg(stats.median_kg, lang)}</span><span>{formatKg(hi, lang)} kg · {T.highLabel}</span>
      </div>
    </div>
  );
}

function RelatedBars({ product, items, lang, navigate }) {
  const seen = new Set();
  const rows = [product, ...(items || [])]
    .filter((c) => c && c.co2e_kg !== null && c.co2e_kg !== undefined && !seen.has(c.product_id) && seen.add(c.product_id))
    .sort((a, b) => a.co2e_kg - b.co2e_kg);
  const top = rows.slice(0, 5);
  if (!top.some((r) => r.product_id === product.product_id) && rows.some((r) => r.product_id === product.product_id)) {
    top.push(rows.find((r) => r.product_id === product.product_id));
  }
  rows.splice(0, rows.length, ...top);
  if (rows.length < 2) return null;
  const max = Math.max(...rows.map((r) => r.co2e_kg));
  return (
    <div className="mt-4 space-y-1.5">
      {rows.map((r) => {
        const self = r.product_id === product.product_id;
        return (
          <button key={r.product_id} type="button" onClick={() => !self && navigate(`/story/${r.product_id}`)}
                  className={`w-full text-left text-[13.5px] ${self ? "font-bold" : "hover:opacity-80"}`}>
            <span className="block truncate">{self ? "📍 " : ""}{r.name}</span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 rounded-full" style={{ width: `${Math.max(4, (r.co2e_kg / max) * 75)}%`, background: greenColor(r.green_score), transition: "width .8s" }} />
              <span className="text-gray-600 whitespace-nowrap">{formatKg(r.co2e_kg, lang)} kg</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ the book

function buildPages({ d, T, lang, go, navigate }) {
  const p = d.product;
  const x = derive(d);
  const origin = x.route ? (lang === "vi" ? x.route.origin_vi : x.route.origin_en) : null;
  const st = x.stages;
  const prodStage = st.materials_production;
  // the catalogue stores one total; only basis "formula" is a real per-stage split
  const measured = d.lifecycle?.basis === "formula";
  const size = (s) => (!s ? null : measured ? `${formatKg(s.kg, lang)} kg` : `${formatNum(s.pct, lang, 0)}%`);
  /** stage wording shared with the CO2 world when the split is only typical */
  const shared = (key, s, fallback) => {
    if (measured || !s) return fallback;
    const txt = stageText(key, lang, x.route);
    const share = stageShareLine(key, { measured: false, pctText: `${formatNum(s.pct, lang, 0)}%` }, lang);
    return `${txt.what} ${txt.why} ${share ? share.charAt(0).toUpperCase() + share.slice(1) + "." : ""}`.trim();
  };
  const stations = [
    { key: "materials", label: T.stages[0], value: null },
    { key: "materials_production", label: T.stages[1], value: size(prodStage) },
    { key: "transport", label: T.stages[2], value: size(st.transport) },
    { key: "use", label: T.stages[3], value: size(st.use) },
    { key: "end_of_life", label: T.stages[4], value: size(st.end_of_life) },
  ];
  const stagePage = [3, 3, 4, 5, 6];
  const intensity = prodStage ? Math.min(1, prodStage.kg / 400) : 0.4;
  const chainIdx = { manufacturer: 0, neighbor_average: 1, llm_estimate: 1, lifecycle_formula: 2, category_model: 2, eeio_price: 2 }[d.formula?.method] ?? 3;
  const alt = d.related?.greener_alternative;

  return [
    // 0 cover
    <div key="cover" className="h-full flex flex-col">
      <p className="text-[13.5px] uppercase tracking-widest text-emerald-700 font-semibold">{T.kicker}</p>
      <h1 className="text-2xl md:text-3xl font-black text-[#1f3b4d] leading-tight mt-1">{p.name}</h1>
      <p className="text-sm text-gray-500 mt-1">{p.platform} · {T.price(p.price_vnd)}</p>
      <div className="my-2 mx-auto w-full max-w-[230px]"><CoverArt category={p.category} score={p.green_score} /></div>
      <Big kg={x.kg} lang={lang} />
      {p.green_score !== null && p.green_score !== undefined && (
        <p className="mt-2 inline-flex self-start rounded-full px-3 py-1 text-sm font-bold text-white" style={{ background: greenColor(p.green_score) }}>
          {tri(lang)("Điểm xanh", "Green score", "Score vert")} {formatNum(p.green_score, lang, 1)}/5
        </p>
      )}
      <p className="mt-3 text-gray-700">{T.coverLead(x.kg)}</p>
    </div>,

    // 1 meaning
    <div key="meaning">
      <H kicker="1 kg CO₂e = ?">{T.meaningTitle}</H>
      <p className="text-gray-700">{T.meaningLead}</p>
      {x.kg !== null && <>
        <div className="my-3"><TreesScene trees={x.trees} /></div>
        <ul className="space-y-2 text-[16px]">
          <li>🌳 {T.trees(x.trees)}</li>
          <li>🚗 {T.car(x.carKm)}</li>
          <li>🔋 {T.charges(x.charges)}</li>
        </ul>
      </>}
    </div>,

    // 2 journey (click to explore)
    <div key="journey">
      <H kicker="Cradle-to-grave · ISO 14067">{T.journeyTitle}</H>
      <p className="text-gray-700 mb-2">{T.journeyLead}</p>
      <JourneyMap stations={stations} onPick={(i) => go(stagePage[i])} />
      <div className="mt-3 flex h-3 rounded-full overflow-hidden" aria-label="stage shares">
        {["materials_production", "transport", "use", "end_of_life"].map((key, i) => st[key] && (
          <button key={key} type="button" title={`${T.stages[i + 1 > 4 ? 4 : i + 1]}: ${formatNum(st[key].pct, lang, 1)}%`}
                  onClick={() => go(stagePage[i + 1])} style={{ width: `${st[key].pct}%`, background: ["#1B5B7E", "#329AD2", "#d97706", "#7AA725"][i] }} />
        ))}
      </div>
      {x.assumed && <p className="text-[13.5px] text-amber-700 mt-2">⚠ {d.lifecycle?.[lang === "vi" ? "note_vi" : "note_en"]}</p>}
    </div>,

    // 3 production
    <div key="prod">
      <H kicker={T.stages[0] + " · " + T.stages[1]}>{T.prodTitle}</H>
      <FactoryScene intensity={intensity} />
      <StagePill stage={prodStage} lang={lang} measured={measured} />
      <p className="text-gray-700">{shared("materials_production", prodStage, T.prodBody(prodStage, origin))}</p>
      <Tip>{T.prodTip}</Tip>
    </div>,

    // 4 transport
    <div key="trans">
      <H kicker={T.stages[2]}>{T.transTitle}</H>
      <ShipScene originCode={x.route?.origin_code} distanceKm={x.route?.distance_km} mode={x.route?.mode} />
      <StagePill stage={st.transport} lang={lang} measured={measured} />
      <p className="text-gray-700">{shared("transport", st.transport, T.transBody(st.transport, x.route))}</p>
      {x.route?.assumed && <p className="text-[13.5px] text-amber-700 mt-2">⚠ {T.assumedRoute}</p>}
    </div>,

    // 5 use
    <div key="use">
      <H kicker={T.stages[3]}>{T.useTitle}</H>
      <GridScene category={p.category} />
      <StagePill stage={st.use} lang={lang} measured={measured} />
      <p className="text-gray-700">{shared("use", st.use, T.useBody(st.use, x.kwhLife, x.usePhase))}</p>
      <Tip>{T.useTip}</Tip>
    </div>,

    // 6 end of life
    <div key="eol">
      <H kicker={T.stages[4]}>{T.eolTitle}</H>
      <RecycleScene />
      <StagePill stage={st.end_of_life} lang={lang} measured={measured} />
      <p className="text-gray-700">{shared("end_of_life", st.end_of_life, T.eolBody(st.end_of_life))}</p>
      <Tip>{T.eolTip}</Tip>
    </div>,

    // 7 formula
    <div key="formula">
      <H kicker={tri(lang)("Minh bạch", "Transparency", "Transparence")}>{T.formulaTitle}</H>
      <p className="text-gray-700 text-sm">{T.formulaLead(d.formula?.method)}</p>
      <ol className="my-3 space-y-1">
        {T.chain.map((c, i) => (
          <li key={c} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${i === chainIdx ? "bg-emerald-600 text-white font-bold shadow" : i < chainIdx ? "bg-gray-100 text-gray-400 line-through" : "bg-gray-50 text-gray-500"}`}>
            <span className="w-5 text-center">{i + 1}</span>{c}{i === chainIdx && " ✓"}
          </li>
        ))}
      </ol>
      <Co2FormulaLine co2={d} className="rounded-xl bg-[#F7FBF6] border border-[#DCEBD9] px-3 py-2" />
      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className="text-gray-600">{T.confidence}</span>
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-emerald-600" style={{ width: `${(d.formula?.confidence || 0) * 100}%` }} /></div>
        <span className="font-semibold">{formatNum((d.formula?.confidence || 0) * 100, lang, 0)}%</span>
      </div>
      <p className="mt-2 text-[13.5px] text-gray-500">🤖 {T.principle}</p>
      {d.references?.length > 0 && (
        <div className="mt-2 text-[13.5px]"><p className="font-semibold text-gray-700">{T.refs}</p>
          <ul>{d.references.slice(0, 3).map((r) => (
            <li key={r.name}>{r.url ? <a className="text-sky-700 underline" href={r.url} target="_blank" rel="noreferrer">{r.name}</a> : r.name} — {formatKg(r.co2e_kg, lang)} kg</li>
          ))}</ul></div>
      )}
    </div>,

    // 8 compare
    <div key="compare">
      <H kicker={tri(lang)("Điểm xanh 0–5", "Green score 0–5", "Score vert 0–5")}>{T.compareTitle}</H>
      <p className="text-gray-700">{T.compareBody(d.stats)}</p>
      <Distribution stats={d.stats} kg={x.kg} T={T} lang={lang} />
      {alt && (
        <div className="mt-3 rounded-xl border-2 border-emerald-500 p-3 bg-emerald-50">
          <p className="text-xs font-bold text-emerald-700">🌱 {T.greener}</p>
          <p className="font-semibold">{alt.name}</p>
          <p className="text-sm text-gray-600">{T.price(alt.price_vnd)} · <b>{formatKg(alt.co2e_kg, lang)} kg CO₂e</b>
            {x.kg !== null && alt.co2e_kg !== null && <> (−{formatKg(x.kg - alt.co2e_kg, lang)} kg)</>}</p>
          <button type="button" className="mt-1 text-sm font-semibold text-emerald-800 underline" onClick={() => navigate(`/story/${alt.product_id}`)}>{T.openStory}</button>
        </div>
      )}
      <RelatedBars product={p} items={d.related?.items} lang={lang} navigate={navigate} />
    </div>,

    // 9 WEFE / smart city
    <div key="wefe">
      <H kicker="Water · Energy · Food · Ecosystems">{T.wefeTitle}</H>
      <CityScene />
      <p className="text-gray-700 mt-2 text-sm">{T.wefeLead}</p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {x.kwhLife !== null && <li>{T.wefeEnergy(x.kwhLife)}</li>}
        <li>{T.wefeWater}</li>
        <li>{T.wefeFood}</li>
        {x.trees !== null && <li>{T.wefeEco(x.trees)}</li>}
      </ul>
      <p className="mt-3 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-sm text-sky-900">🏙️ {T.city(x.cityTonnes, x.savedPerUnit)}</p>
      <p className="text-[13.5px] text-gray-400 mt-1">{T.scenarioNote}</p>
    </div>,

    // 10 actions
    <div key="act">
      <H>{T.actTitle}</H>
      <ul className="space-y-1.5 text-[16px] mb-4">{T.tips.map((t) => <li key={t}>✅ {t}</li>)}</ul>
      <div className="grid gap-2">
        <button type="button" className="rounded-xl bg-emerald-600 text-white font-semibold py-2.5" onClick={() => navigate(`/assistant?q=${encodeURIComponent(p.name)}&go=1`)}>✨ {T.actAsk}</button>
        <button type="button" className="rounded-xl border border-emerald-600 text-emerald-700 font-semibold py-2.5" onClick={() => navigate(`/compare?ids=${p.product_id}${alt ? "," + alt.product_id : ""}`)}>⚖️ {T.actCompare}</button>
        <button type="button" className="rounded-xl border border-gray-300 font-semibold py-2.5" onClick={() => { addToCart(p); navigate("/cart"); }}>🛒 {T.actCart}</button>
        <Link className="text-center text-sm text-sky-700 underline" to={`/product/${p.product_id}`}>{T.actProduct}</Link>
        <Link className="text-center text-sm text-sky-700 underline" to="/story">{T.actAnother}</Link>
      </div>
    </div>,

    // 11 back cover
    <div key="back" className="h-full flex flex-col">
      <H>{T.backTitle}</H>
      <ul className="space-y-2 text-sm text-gray-700 list-disc pl-5">{T.backBody.map((b) => <li key={b}>{b}</li>)}</ul>
      <div className="mt-auto pt-6 text-center">
        <p className="text-2xl">🌏</p>
        <p className="font-black text-[#1f3b4d]">Smart Product Finder</p>
        <Link to="/method" className="text-sm text-sky-700 underline">{tri(lang)("Phương pháp tính CO₂ đầy đủ", "Full CO₂ method", "Méthode CO₂ complète")}</Link>
      </div>
    </div>,
  ];
}

function StoryBook({ productId }) {
  const { lang } = useI18n();
  const T = useMemo(() => txt(lang), [lang]);
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [params] = useSearchParams();
  const startPage = Math.max(0, parseInt(params.get("p") || "0", 10) || 0);
  const [index, setIndex] = useState(startPage);
  const [auto, setAuto] = useState(params.get("auto") === "1");

  useEffect(() => {
    let alive = true;
    setData(null); setError(null); setIndex(startPage);
    (async () => {
      try {
        const co2 = await api.getProductCo2(productId);
        const cat = co2.product?.category;
        const [stats, related] = await Promise.all([
          cat ? api.getCategoryStats(cat, productId).catch(() => null) : null,
          api.getRelated(productId, 6).catch(() => null),
        ]);
        if (alive) setData({ ...co2, stats, related });
      } catch (e) {
        if (alive) setError(e);
      }
    })();
    return () => { alive = false; };
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = useMemo(() => (data ? buildPages({ d: data, T, lang, go: setIndex, navigate }) : []), [data, T, lang, navigate]);

  useEffect(() => {
    if (!auto || !pages.length) return;
    const id = setInterval(() => setIndex((i) => {
      const step = window.innerWidth >= 900 ? 2 : 1;
      const from = step === 2 ? i - (i % 2) : i;
      return from + step > pages.length - 1 ? 0 : from + step;
    }), 6500);
    return () => clearInterval(id);
  }, [auto, pages.length]);

  if (error) return <p className="text-center text-red-600 py-16">{T.notFound}</p>;
  if (!data) return <p className="text-center text-gray-500 py-24 animate-pulse">📖 {T.loading}</p>;

  return (
    <div>
      <Flipbook pages={pages} index={index} onIndex={setIndex} />
      <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 mt-4 text-sm">
        <button type="button" className="rounded-full border px-4 py-1.5 disabled:opacity-40" disabled={index === 0} onClick={() => setIndex(Math.max(0, index - (window.innerWidth >= 900 ? 2 : 1)))}>← {T.prev}</button>
        <div className="hidden sm:flex gap-1" role="tablist" aria-label="pages">
          {pages.map((_, i) => (
            <button key={i} type="button" aria-label={`page ${i + 1}`} onClick={() => setIndex(i)}
                    className={`h-2.5 rounded-full transition-all ${Math.floor(i / 2) === Math.floor(index / 2) ? "w-6 bg-emerald-600" : "w-2.5 bg-gray-300"}`} />
          ))}
        </div>
        <button type="button" className="rounded-full border px-4 py-1.5 disabled:opacity-40" disabled={index >= pages.length - 1} onClick={() => setIndex(Math.min(pages.length - 1, index + (window.innerWidth >= 900 ? 2 : 1)))}>{T.next} →</button>
        <button type="button" className={`rounded-full px-4 py-1.5 ${auto ? "bg-amber-500 text-white" : "border"}`} onClick={() => setAuto(!auto)}>{auto ? `⏸ ${T.stop}` : `▶ ${T.autoplay}`}</button>
      </div>
    </div>
  );
}

function StoryLanding() {
  return <BookShelf />;
}

export default function Story() {
  const { productId } = useParams();
  return (
    <main className="min-h-screen px-3 md:px-6 py-6 overflow-x-hidden" style={productId ? { background: "radial-gradient(circle at 20% 0%, #e6f6ee, #f3efe4 60%)" } : undefined}>
      <StoryStyles />
      <div className="max-w-6xl mx-auto min-w-0">{productId ? <StoryBook productId={productId} /> : <StoryLanding />}</div>
    </main>
  );
}
