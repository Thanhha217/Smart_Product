import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useI18n } from "../i18n/LanguageContext";
import { api } from "../api/client";
import { formatKg, formatNum, greenColor } from "../lib/format";
import ProductPicker from "./components/story/ProductPicker";
import { methodText } from "./components/story/storyText";
import WorldScene, { WORLD_H, WORLD_W, legPath, stageTarget } from "./components/world/WorldScene";
import ExplainPanel from "./components/world/ExplainPanel";
import SimPanel from "./components/world/SimPanel";
import Tour, { sceneFor } from "./components/world/Tour";
import { useCamera, useTween } from "./components/world/useCamera";
import { ORIGINS, baseline, presetExplain, simulate } from "./components/world/worldModel";
import { worldText } from "./components/world/worldText";

const RAIL = ["materials", "materials_production", "transport", "use", "end_of_life"];
const TOPIC_STAGE = { materials: "materials", factory: "materials_production", transport: "transport", use: "use", grid: "use", end_of_life: "end_of_life" };
const STAGE_TOPIC = { materials: "materials", materials_production: "factory", transport: "transport", use: "use", end_of_life: "end_of_life" };

// Painted scenes are optional: frontend/public/illustrations/manifest.json (see scripts/demo/generate_illustrations.py).
let artPromise = null;
function loadArt() {
  if (!artPromise) {
    artPromise = fetch("/illustrations/manifest.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => Object.fromEntries(Object.entries(m?.scenes || {}).filter(([, f]) => typeof f === "string" && f).map(([k, f]) => [k, f.startsWith("/") || f.startsWith("http") ? f : `/illustrations/${f}`])))
      .catch(() => ({}));
  }
  return artPromise;
}

function useFillHeight(ref) {
  const [h, setH] = useState(640);
  useLayoutEffect(() => {
    const update = () => {
      const top = ref.current ? ref.current.getBoundingClientRect().top + window.scrollY : 120;
      const tabBar = window.innerWidth < 900 ? 72 : 0;   // AppShell bottom tab bar on phones
      setH(Math.max(460, window.innerHeight - top - tabBar));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [ref]);
  return h;
}

function Chip({ topic, children, className = "", onClick, style }) {
  return (
    <button type="button" data-explain={topic} onClick={onClick} style={style}
            className={`rounded-full px-3 py-1 text-[13px] font-semibold border transition hover:shadow ${className}`}>{children}</button>
  );
}

function WorldView({ productId }) {
  const { lang } = useI18n();
  const T = useMemo(() => worldText(lang), [lang]);
  const [params] = useSearchParams();
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [art, setArt] = useState({});
  const [sc, setSc] = useState(null);
  const [focus, setFocus] = useState(null);
  const [topic, setTopic] = useState(null);
  const [askMode, setAskMode] = useState(params.get("help") === "1");
  const [simOpen, setSimOpen] = useState(params.get("sim") === "1");
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const [tour, setTour] = useState(params.get("tour") === "1");
  const wrap = useRef(null);
  const height = useFillHeight(wrap);
  const camera = useCamera({ width: WORLD_W, height: WORLD_H, minW: 420 });

  useEffect(() => { loadArt().then(setArt); }, []);

  useEffect(() => {
    let alive = true;
    setD(null); setError(null); setTopic(null); setFocus(null);
    (async () => {
      try {
        const co2 = await api.getProductCo2(productId);
        const cat = co2.product?.category;
        const [stats, related] = await Promise.all([
          cat ? api.getCategoryStats(cat, productId).catch(() => null) : null,
          api.getRelated(productId, 6).catch(() => null),
        ]);
        if (!alive) return;
        const data = { ...co2, stats, related };
        const b = baseline(data);
        const origin = ORIGINS[params.get("origin")] ? params.get("origin") : b.origin;
        const years = Number(params.get("years")) || b.years;
        setSc({ origin, mode: params.get("mode") === "air" ? "air" : "sea", grid: params.get("grid") === "solar" ? "solar" : "vn",
                years: Math.max(1, Math.min(12, years)), refurbished: params.get("refurb") === "1" });
        setD(data);
      } catch (e) {
        if (alive) setError(e);
      }
    })();
    return () => { alive = false; };
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const base = useMemo(() => (d ? baseline(d) : null), [d]);
  const sim = useMemo(() => (base && sc ? simulate(base, sc) : null), [base, sc]);
  const tw = {
    materials_production: useTween(sim?.stages.materials_production ?? null),
    transport: useTween(sim?.stages.transport ?? null),
    use: useTween(sim?.stages.use ?? null),
    end_of_life: useTween(sim?.stages.end_of_life ?? null),
  };
  const maxStage = base ? Math.max(1, ...Object.values(base.stages)) : 1;

  // With a side panel open (desktop), centre the stage in the free area left of the panel.
  const frame = useCallback((target, panel) => {
    const elW = wrap.current?.clientWidth || 1200;
    if (!panel || !wide || elW < 900) return target;
    const free = elW - 430;
    const w = target.w * (elW / free);
    return { cx: target.cx + (430 / 2) * (w / elW), cy: target.cy, w };
  }, [wide]);
  const fly = useCallback((stage, panel = true, ms) => {
    const target = stage && sc ? stageTarget(stage, sc) : null;
    if (target) camera.flyTo(frame(target, panel), ms); else camera.overview();
  }, [camera, sc, frame]);

  // deep links: ?focus=transport&ask=factory
  const started = useRef(false);
  useEffect(() => {
    if (!d || !sc || started.current) return;
    started.current = true;
    const f = params.get("focus");
    const a = params.get("ask");
    const tourStage = ["materials", "materials_production", "transport", "use", "end_of_life", null][Math.max(0, Math.min(5, (Number(params.get("step")) || 1) - 1))];
    const stage = (f && stageTarget(f, sc) ? f : null) || (a && TOPIC_STAGE[a]) || (tour ? tourStage : null);
    // place the camera directly (no animation) so a deep link always opens on its stage
    if (stage) camera.flyTo(frame(stageTarget(stage, sc), Boolean(a || tour)), 0); else camera.overview(0);
    if (stage) setFocus(stage);
    if (a) setTopic(a);
  }, [d, sc]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = useCallback((t) => {
    setTour(false);
    setTopic(t);
    const stage = TOPIC_STAGE[t];
    if (stage) { setFocus(stage); fly(stage); }
  }, [fly]);

  const choose = (stage) => { setTour(false); setFocus(stage); fly(stage); setTopic(STAGE_TOPIC[stage]); };

  // keyboard: ← → between stages, Esc closes
  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;
      if (e.key === "Escape") { setTopic(null); setTour(false); }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const i = RAIL.indexOf(focus);
        const next = e.key === "ArrowRight" ? (i + 1) % RAIL.length : (i <= 0 ? RAIL.length - 1 : i - 1);
        choose(RAIL[next]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // "Hỏi bất kỳ chỗ nào": in ask mode every element with data-explain answers instead of acting
  const onCapture = (e) => {
    if (!askMode) return;
    const el = e.target.closest?.("[data-explain]");
    if (el && wrap.current?.contains(el)) { e.preventDefault(); e.stopPropagation(); open(el.getAttribute("data-explain")); }
  };
  const onSceneClick = (e) => {
    if (camera.wasDrag()) return;
    const el = e.target.closest?.("[data-explain]");
    if (el) open(el.getAttribute("data-explain"));
  };

  if (error) return <p className="text-center text-red-600 py-16">{T.notFound}</p>;
  if (!d || !sc) return <div ref={wrap} className="grid place-items-center text-gray-500 animate-pulse" style={{ height }}>🌏 {T.loading}</div>;

  const p = d.product;
  const originName = ORIGINS[sc.origin]?.[lang === "vi" ? "vi" : "en"];
  const labels = {
    aria: T.aria, stages: T.stages, originLand: T.originLand, originPort: T.originPort, vnPort: T.vnPort,
    factory: `${T.factoryAt(originName)} ${sc.origin === base.origin ? T.assumed : ""}`.trim(),
    coal: lang === "vi" ? "Nhiệt điện than" : "Coal power",
  };
  const side = (topic || tour) && wide;   // a side panel is open: keep controls out from under it
  const simStages = { ...tw };
  const scenario = { ...sc, total_kg: sim ? Math.round(sim.total * 10) / 10 : null };
  const preset = topic ? presetExplain(topic, d, sim, sc, lang) : null;
  const leg = focus ? legPath(focus, sc) : null;
  const TOPIC_SCENE = { materials: "mine", factory: "factory", transport: sceneFor("transport", sc), use: "home", grid: sceneFor("grid", sc), end_of_life: "recycle", wefe: "city_wefe" };
  const imageFor = (t) => (TOPIC_SCENE[t] ? art[TOPIC_SCENE[t]] || null : null);

  return (
    <div ref={wrap} className="relative overflow-hidden bg-[#dff1fb]" style={{ height }} onClickCapture={onCapture}>
      <WorldScene svgRef={camera.svgRef} category={p.category} sc={sc} sim={{ stages: simStages }} maxStage={maxStage}
                  focus={focus} labels={labels} ask={askMode} lang={lang} onClick={onSceneClick} art={art} leg={leg} />

      {/* HUD */}
      <div className="absolute z-20 left-3 top-3 right-3 md:right-auto md:max-w-[460px] rounded-3xl bg-white/90 backdrop-blur shadow-xl border border-white p-3 md:p-4">
        <p className="text-[11px] uppercase tracking-widest text-emerald-700 font-semibold">🌏 {lang === "vi" ? "Thế giới CO₂ của sản phẩm" : "The product's CO₂ world"}</p>
        <h1 className="font-extrabold text-[#16324a] leading-tight text-base md:text-lg line-clamp-2">{p.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Chip topic="co2e_total" onClick={() => open("co2e_total")} className="bg-emerald-600 border-emerald-600 text-white text-[15px]">
            {p.co2e_kg !== null ? `${formatKg(p.co2e_kg, lang)} kg CO₂e` : (lang === "vi" ? "Chưa có số CO₂" : "No CO₂ figure")}
          </Chip>
          {p.green_score !== null && p.green_score !== undefined && (
            <Chip topic="green_score" onClick={() => open("green_score")} className="text-white border-transparent" style={{ background: greenColor(p.green_score) }}>
              {T.greenScore} {formatNum(p.green_score, lang, 1)}/5
            </Chip>
          )}
          <Chip topic="confidence" onClick={() => open("confidence")} className="bg-white border-gray-200 text-gray-700 hidden sm:inline-block">
            {T.confidence} {formatNum((d.formula?.confidence || 0) * 100, lang, 0)}%
          </Chip>
          <Chip topic="formula" onClick={() => open("formula")} className="bg-white border-gray-200 text-gray-700">🧮 {T.formula}</Chip>
          <Chip topic="category" onClick={() => open("category")} className="bg-white border-gray-200 text-gray-700 hidden sm:inline-block">📊 {T.category}</Chip>
          {d.related?.greener_alternative && <Chip topic="greener_alternative" onClick={() => open("greener_alternative")} className="bg-white border-emerald-300 text-emerald-800 hidden sm:inline-block">🌱 {T.alternative}</Chip>}
        </div>
        <p className="mt-2 text-[12px] text-gray-500 hidden md:block">{methodText(d.formula?.method, lang)} · <Link to={`/story/${p.product_id}`} className="text-sky-700 underline">{T.book}</Link> · <Link to="/method" className="text-sky-700 underline">{T.method}</Link></p>
      </div>

      {/* tour button */}
      {!tour && (
        <button type="button" onClick={() => { setTopic(null); setTour(true); }}
                className="absolute z-20 left-1/2 -translate-x-1/2 top-[148px] md:top-4 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-extrabold px-5 py-2.5 shadow-xl hover:scale-105 transition whitespace-nowrap">
          ▶ {lang === "vi" ? "Xem giải thích từng bước" : "Guided explanation"}
        </button>
      )}

      {sc && base && (
        <SimPanel open={simOpen && !tour} onToggle={() => setSimOpen(!simOpen)} sc={sc} setSc={setSc} base={base} sim={sim} lang={lang} T={T}
                  origins={ORIGINS} onAsk={() => open("what_if")} onReset={() => setSc({ ...sc, origin: base.origin, mode: base.mode, grid: base.grid, years: base.years, refurbished: false })} />
      )}

      {/* stage rail */}
      <nav style={side ? { left: "calc(50% - 210px)", maxWidth: "calc(100% - 460px)" } : undefined}
           className="absolute z-20 left-1/2 -translate-x-1/2 bottom-3 max-w-[calc(100%-24px)] overflow-x-auto rounded-full bg-white/90 backdrop-blur shadow-xl border border-white p-1.5 flex gap-1" aria-label="stages">
        {RAIL.map((s) => {
          const kg = s === "materials" ? null : tw[s];
          return (
            <button key={s} type="button" data-explain={STAGE_TOPIC[s]} onClick={() => choose(s)} aria-pressed={focus === s}
                    className={`rounded-full px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap transition ${focus === s ? "bg-[#16324a] text-white shadow" : "hover:bg-emerald-50 text-gray-700"}`}>
              {T.stages[s]}{kg !== null && kg !== undefined ? <span className={`ml-1 ${focus === s ? "text-emerald-200" : "text-emerald-700"}`}>{formatKg(kg, lang)}</span> : null}
            </button>
          );
        })}
        <button type="button" data-explain="co2e_total" onClick={() => { setFocus(null); camera.overview(); open("co2e_total"); }}
                className="rounded-full px-3 py-1.5 text-[13px] font-bold whitespace-nowrap bg-emerald-600 text-white">{T.total} {formatKg(sim?.total ?? p.co2e_kg, lang)} kg</button>
      </nav>

      {/* camera + ask controls */}
      <div className="absolute z-20 right-3 bottom-20 md:bottom-4 flex flex-col gap-2" style={side ? { right: 432 } : undefined}>
        <button type="button" onClick={() => setAskMode(!askMode)} aria-pressed={askMode} title={askMode ? T.askModeOn : T.askMode}
                className={`rounded-full w-11 h-11 shadow-lg text-lg font-bold ${askMode ? "bg-amber-400 text-[#16324a] ring-4 ring-amber-200" : "bg-white text-[#16324a]"}`}>❓</button>
        <button type="button" onClick={() => camera.zoomBy(0.7)} aria-label={T.zoomIn} className="rounded-full w-11 h-11 bg-white shadow-lg text-xl font-bold">+</button>
        <button type="button" onClick={() => camera.zoomBy(1.4)} aria-label={T.zoomOut} className="rounded-full w-11 h-11 bg-white shadow-lg text-xl font-bold">−</button>
        <button type="button" onClick={() => { setFocus(null); camera.overview(); }} aria-label={T.overview} title={T.overview} className="rounded-full w-11 h-11 bg-white shadow-lg text-lg">⤢</button>
      </div>
      {askMode && <p className="absolute z-20 left-1/2 -translate-x-1/2 bottom-[72px] rounded-full bg-amber-400 text-[#16324a] text-sm font-semibold px-4 py-1.5 shadow">❓ {T.askModeOn}</p>}
      {!askMode && !topic && !tour && <p className="absolute z-10 right-4 top-4 rounded-full bg-white/80 px-3 py-1 text-xs text-[#16324a] shadow hidden lg:block">🖐 {T.hint}</p>}

      {tour ? (
        <Tour open={tour} startStep={Math.max(0, (Number(params.get("step")) || 1) - 1)} onClose={() => { setTour(false); setFocus(null); camera.overview(); }} art={art} lang={lang}
              formula={d.formula} greenScore={p.green_score}
              ctx={{ sc, stages: sim?.stages || {}, total: sim?.total, officialTotal: p.co2e_kg }}
              onStep={(stage) => { if (stage === "formula") { setFocus(null); camera.overview(); } else { setFocus(stage); fly(stage); } }} />
      ) : (
        <ExplainPanel open={!!topic} topic={topic} preset={preset} productId={p.product_id} lang={lang} scenario={scenario} T={T}
                      image={topic ? imageFor(topic) : null} onClose={() => setTopic(null)} />
      )}
    </div>
  );
}

export default function World() {
  const { productId } = useParams();
  const { lang } = useI18n();
  const T = useMemo(() => worldText(lang), [lang]);
  if (productId) return <WorldView key={productId} productId={productId} />;
  return (
    <main className="min-h-screen px-3 md:px-6 py-6 overflow-x-hidden" style={{ background: "radial-gradient(circle at 80% 0%, #d6f0ff, #eef8f1 55%, #f6f1e6)" }}>
      <ProductPicker basePath="/world" icon="🌏🏭🚢🏠♻️" title={T.landingTitle} lead={T.landingLead} />
    </main>
  );
}
