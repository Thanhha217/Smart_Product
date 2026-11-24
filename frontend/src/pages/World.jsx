import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { tri, useI18n } from "../i18n/LanguageContext";
import { api } from "../api/client";
import { formatKg, formatNum, greenColor } from "../lib/format";
import { useRecent } from "../lib/recent";
import { lifecycle as readLifecycle } from "../lib/co2Formula";
import { ErrorState } from "./components/common/States";
import { explore } from "../i18n/explore";
import { methodText } from "./components/story/storyText";
import WorldExplore from "./components/world/explore/WorldExplore";
import WorldScene, { WORLD_H, WORLD_W, legPath, stageTarget } from "./components/world/WorldScene";
import ExplainPanel from "./components/world/ExplainPanel";
import SimPanel from "./components/world/SimPanel";
import GreenPanel, { InsightCard } from "./components/world/GreenPanel";
import Tour, { sceneFor } from "./components/world/Tour";
import { useCamera, useTween } from "./components/world/useCamera";
import { ORIGINS, baseline, presetExplain, simulate } from "./components/world/worldModel";
import { sceneText, worldText } from "./components/world/worldText";
import SceneNavigator from "./components/world/scenes/SceneNavigator";
import SceneView from "./components/world/scenes/SceneView";
import { SCENE_OF_STAGE, SCENE_OF_TOPIC, isValid, parentOf, siblingsOf } from "./components/world/scenes/sceneGraph";

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

/** The map band: a comfortable height in the page, taller while a scene is open. */
function useMapHeight(scene) {
  const calc = () => (typeof window === "undefined" ? 460
    : scene ? Math.max(520, Math.min(760, window.innerHeight - 150)) : Math.max(380, Math.min(540, Math.round(window.innerHeight * 0.55))));
  const [h, setH] = useState(calc);
  useEffect(() => {
    const on = () => setH(calc());
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps
  return h;
}


function Chip({ topic, children, className = "", onClick, style }) {
  return (
    <button type="button" data-explain={topic} onClick={onClick} style={style}
            className={`rounded-full px-3.5 py-1.5 text-[15px] font-semibold border transition hover:shadow ${className}`}>{children}</button>
  );
}

function WorldView({ productId }) {
  const { t, lang } = useI18n();
  const T = useMemo(() => worldText(lang), [lang]);
  const S = useMemo(() => sceneText(lang), [lang]);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // the walk-in scene is part of the URL (?scene=production/chip): back/forward and deep links work
  const scene = isValid(params.get("scene")) ? params.get("scene") : null;
  const origin = useRef(null);
  const takeOrigin = useCallback(() => { const r = origin.current; origin.current = null; return r; }, []);
  const go = useCallback((key, rect = null, opts = {}) => {
    origin.current = rect;
    const next = new URLSearchParams(window.location.search);
    ["ask", "focus", "step", "tour", "help"].forEach((k) => next.delete(k));
    if (key) next.set("scene", key); else next.delete("scene");
    setParams(next, { replace: Boolean(opts.replace) });
  }, [setParams]);
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
  const [xl, setXl] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const on = () => setXl(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const hudRef = useRef(null);
  const [tour, setTour] = useState(params.get("tour") === "1");
  const wrap = useRef(null);
  const height = useMapHeight(scene);
  const camera = useCamera({ width: WORLD_W, height: WORLD_H, minW: 420, margin: 1600 });

  useEffect(() => { loadArt().then(setArt); }, []);
  const [nonce, setNonce] = useState(0);

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
  }, [productId, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // Home view: the whole loop (mine -> ship -> house -> recycling -> back), fitted in the free area
  // beside (or below) the formula card, left of the Green lifestyle panel (xl) and above the stage bar.
  const atHome = useRef(false);     // re-fit the home view when the card or the window changes size
  const home = useCallback((ms = 750) => {
    atHome.current = true;
    const el = wrap.current;
    const elW = el?.clientWidth || 1200, elH = el?.clientHeight || 700;
    const box = { x0: 60, x1: 2360, y0: 400, y1: 1310 };
    const right = 12;
    const hudW = 0, hudH = 0;   // nothing covers the map any more
    // beside the card or below it, whichever shows the loop bigger
    const fit = (f) => Math.min(Math.max(200, f.r - f.l) / (box.x1 - box.x0), Math.max(160, f.b - f.t) / (box.y1 - box.y0));
    const besideF = { l: hudW, t: 12, r: elW - right, b: elH - 70 }, belowF = { l: 12, t: hudH, r: elW - right, b: elH - 70 };
    const free = fit(besideF) >= fit(belowF) ? besideF : belowF;
    const fw = Math.max(200, free.r - free.l), fh = Math.max(160, free.b - free.t);
    const sc0 = fit(free);
    const w = elW / sc0;
    const left = box.x0 - (free.l + (fw - (box.x1 - box.x0) * sc0) / 2) / sc0;
    const top = box.y0 - (free.t + (fh - (box.y1 - box.y0) * sc0) / 2) / sc0;
    camera.flyTo({ cx: left + w / 2, cy: top + elH / sc0 / 2, w }, ms);
  }, [camera, xl]);
  const fly = useCallback((stage, panel = true, ms) => {
    const target = stage && sc ? stageTarget(stage, sc) : null;
    if (target) { atHome.current = false; camera.flyTo(frame(target, panel), ms); } else home(ms);
  }, [camera, sc, frame, home]);
  useEffect(() => {
    if (!d || !sc || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => { if (atHome.current) home(0); });
    if (wrap.current) ro.observe(wrap.current);
    if (hudRef.current) ro.observe(hudRef.current);
    return () => ro.disconnect();
  }, [d, sc, home, scene]);

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
    if (stage) { atHome.current = false; camera.flyTo(frame(stageTarget(stage, sc), Boolean(a || tour)), 0); } else requestAnimationFrame(() => home(0));
    if (stage) setFocus(stage);
    if (a) setTopic(a);
  }, [d, sc]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = useCallback((t) => {
    setTour(false);
    setTopic(t);
    const stage = TOPIC_STAGE[t];
    if (stage) { setFocus(stage); fly(stage); }
  }, [fly]);

  const choose = (stage, rect = null) => { setTour(false); setTopic(null); setFocus(stage); go(SCENE_OF_STAGE[stage], rect); };

  // keyboard: ← → between stages, Esc closes
  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;
      if (scene) {
        if (e.key === "Escape" || e.key === "Backspace") {
          e.preventDefault();
          if (topic) setTopic(null); else go(parentOf(scene));
        }
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          const sib = siblingsOf(scene);
          const i = sib.indexOf(scene) + (e.key === "ArrowRight" ? 1 : -1);
          if (i >= 0 && i < sib.length) go(sib[i]);
        }
        return;
      }
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
    if (!el) return;
    const t = el.getAttribute("data-explain");
    if (SCENE_OF_TOPIC[t]) { setTopic(null); setTour(false); go(SCENE_OF_TOPIC[t], el.getBoundingClientRect()); }
    else open(t);
  };
  const enter = (t, e) => { setTopic(null); setTour(false); go(SCENE_OF_TOPIC[t], e?.currentTarget?.getBoundingClientRect() || null); };

  if (error) {
    const X = explore(lang);
    const missing = error.status === 404;
    return (
      <div className="page-wrap py-10 max-w-3xl">
        <ErrorState title={missing ? T.notFound : X.worldErrorTitle} body={missing ? X.worldNotFoundBody : X.worldErrorBody}
                    onRetry={missing ? null : () => setNonce((n) => n + 1)} />
        <p className="mt-4 flex flex-wrap gap-3">
          <Link to="/world?explore=1" className="btn-secondary">{X.worldBack}</Link>
          <Link to="/search" className="btn-secondary">{X.linkSearch}</Link>
        </p>
      </div>
    );
  }
  if (!d || !sc) return (
    <div ref={wrap} role="status" aria-live="polite" className="grid place-items-center text-[#4b5563] bg-[#eef6fb]" style={{ height }}>
      <span className="inline-flex items-center gap-3 text-[16px]">
        <span className="w-5 h-5 rounded-full border-2 border-[#2E7D4F] border-t-transparent animate-spin" aria-hidden="true" />
        {T.loading}
      </span>
    </div>
  );

  const p = d.product;
  const originName = ORIGINS[sc.origin]?.[lang] ?? ORIGINS[sc.origin]?.en;
  const L3 = tri(lang);
  const labels = {
    aria: T.aria, stages: T.stages, originLand: T.originLand, originPort: T.originPort, vnPort: T.vnPort,
    factory: `${T.factoryAt(originName)} ${sc.origin === base.origin ? T.assumed : ""}`.trim(),
    coal: L3("Nhiệt điện than", "Coal power", "Centrale à charbon"),
    vietnam: L3("Việt Nam", "Vietnam", "Vietnam"),
    doors: {
      materials: L3("Mỏ khoáng", "Mine", "Mine"),
      factory: L3("Nhà máy", "Factory", "Usine"),
      transport: L3("Con tàu", "Ship", "Navire"),
      use: L3("Ngôi nhà", "Home", "Maison"),
      grid: L3("Nhà máy điện", "Power plant", "Centrale"),
      end_of_life: L3("Trạm tái chế", "Recycling", "Recyclage"),
    },
    loop: {
      make: L3("Sản xuất", "Manufacture", "Fabrication"),
      move: L3("Vận chuyển", "Transport", "Transport"),
      use: L3("Sử dụng", "Use", "Usage"),
      back: L3("Thu hồi & tái chế", "Return & Recycle", "Retour & recyclage"),
      recovered: L3("Vật liệu thu hồi cho sản phẩm mới", "Recovered materials for new products", "Matériaux récupérés pour de nouveaux produits"),
      circular: L3("Vòng đời tuần hoàn", "Circular lifecycle", "Cycle de vie circulaire"),
      circularSub: L3("Ít CO₂ hơn, ít rác điện tử hơn", "Lower CO₂, less e-waste", "Moins de CO₂, moins de déchets électroniques"),
    },
  };
  const side = (topic || tour) && wide;   // a side panel is open: keep controls out from under it
  const simStages = { ...tw };
  const scenario = { ...sc, total_kg: sim ? Math.round(sim.total * 10) / 10 : null };
  const preset = topic ? presetExplain(topic, d, sim, sc, lang) : null;
  const leg = focus ? legPath(focus, sc) : null;
  // The catalogue stores ONE total per product. Only lifecycle.basis === "formula" is a real
  // per-stage split; otherwise the shares are typical for the category and are shown as such,
  // never as this product's kilograms.
  const lc = readLifecycle(d.lifecycle);
  const share = Object.fromEntries(lc.parts.map((part) => [part.key, part.pct]));
  const stageValue = (key) => (simStages[key] === null || simStages[key] === undefined
    ? (share[key] === undefined ? null : `${formatNum(share[key], lang, 0)}%`)
    : `${formatKg(simStages[key], lang)} kg`);
  const stageNote = lc.measured ? null : L3("ước tính", "estimate", "estimation");
  const TOPIC_SCENE = { materials: "mine", factory: "factory", transport: sceneFor("transport", sc), use: "home", grid: sceneFor("grid", sc), end_of_life: "recycle", wefe: "city_wefe" };
  const imageFor = (t) => (TOPIC_SCENE[t] ? art[TOPIC_SCENE[t]] || null : null);

  const toolBtn = "grid place-items-center w-10 h-10 rounded-full border border-[#E3DFD3] bg-white text-[#1E2B22] hover:border-[#2E7D4F]";
  return (
    <main className="mx-auto max-w-[1320px] px-3 sm:px-5 py-4 space-y-4">
      {/* header card (design page 3) */}
      <section ref={hudRef} className="rounded-[24px] bg-white border border-[#E8E4D8] px-5 sm:px-6 py-5">
        <p className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-[0.14em] text-[#2E7D4F]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#3FA0B8]" aria-hidden="true" />
          {L3("Thế giới CO₂ của sản phẩm", "The product's CO₂ world", "Le monde CO₂ du produit")}
        </p>
        <h1 className="mt-1 font-display text-[28px] sm:text-[34px] font-semibold leading-tight text-[#1E2B22]">{p.name}</h1>
        <p className="mt-1 text-[14.5px] text-[#55604F]">
          {methodText(d.formula?.method, lang)} · <Link to={`/story/${p.product_id}`} className="text-[#1F5D3A] font-semibold underline">{T.book}</Link>
          {" · "}<Link to={`/method?product=${p.product_id}`} className="text-[#1F5D3A] font-semibold underline">{T.method}</Link>
          {" · "}<Link to="/world?explore=1" className="text-[#1F5D3A] font-semibold underline">{L3("Sản phẩm khác", "Other products", "Autres produits")}</Link>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip topic="co2e_total" onClick={() => open("co2e_total")} className="bg-[#1F6B43] border-[#1F6B43] text-white !text-[17px] !px-4 !py-2">
            {p.co2e_kg !== null ? `${formatKg(p.co2e_kg, lang)} kg CO₂e` : L3("Chưa có số CO₂", "No CO₂ figure", "Pas de chiffre CO₂")}
          </Chip>
          {p.green_score !== null && p.green_score !== undefined && (
            <Chip topic="green_score" onClick={() => open("green_score")} className="text-white border-transparent !text-[17px] !px-4 !py-2" style={{ background: greenColor(p.green_score) }}>
              {T.greenScore} {formatNum(p.green_score, lang, 1)}/5
            </Chip>
          )}
          {typeof d.formula?.confidence === "number" && (
            <Chip topic="confidence" onClick={() => open("confidence")} className="bg-white border-[#E3DFD3] text-[#1E2B22] !px-4 !py-2">
              {T.confidence} {formatNum(d.formula.confidence * 100, lang, 0)}%
            </Chip>
          )}
          <Chip topic="formula" onClick={(e) => enter("formula", e)} className="bg-white border-[#E3DFD3] text-[#1E2B22] !px-4 !py-2">🧮 {T.formula}</Chip>
          <Chip topic="category" onClick={(e) => enter("category", e)} className="bg-white border-[#E3DFD3] text-[#1E2B22] !px-4 !py-2">📊 {T.category}</Chip>
        </div>
      </section>

      {/* map card: toolbar, map, stage bar */}
      <section className="rounded-[24px] bg-white border border-[#E8E4D8] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-[#EFEBDF]">
          <p className="text-[14.5px] font-semibold text-[#B45309]">👆 {L3("Bấm vào nhà máy, con tàu, ngôi nhà… để bước vào bên trong", "Tap the factory, the ship, the house… to step inside", "Touchez l'usine, le navire, la maison… pour entrer à l'intérieur")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setSimOpen(!simOpen)} aria-expanded={simOpen}
                    className="inline-flex items-center gap-2 rounded-full bg-[#1B2F45] px-4 py-2 text-[14.5px] font-bold text-white hover:bg-[#243e5a]">
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M4 6h12M4 14h12" /><circle cx="8" cy="6" r="2" fill="#1B2F45" /><circle cx="13" cy="14" r="2" fill="#1B2F45" />
              </svg>
              {String(T.sim).replace(/^[^\p{L}]+/u, "")}
            </button>
            <button type="button" onClick={() => { setTopic(null); setTour(true); }}
                    className="inline-flex items-center gap-2 rounded-full bg-[#E0700E] px-4 py-2 text-[14.5px] font-bold text-white hover:bg-[#c96209]">
              ▶ {L3("Giải thích từng bước", "Guided explanation", "Explication pas à pas")}
            </button>
            <span className="mx-1 h-6 w-px bg-[#E3DFD3]" aria-hidden="true" />
            <button type="button" onClick={() => setAskMode(!askMode)} aria-pressed={askMode} title={askMode ? T.askModeOn : T.askMode}
                    className={`${toolBtn} ${askMode ? "!bg-amber-300 !border-amber-400" : ""} text-[#C2413C] font-bold`}>?</button>
            <button type="button" onClick={() => { atHome.current = false; camera.zoomBy(0.7); }} aria-label={T.zoomIn} className={`${toolBtn} text-lg font-bold`}>+</button>
            <button type="button" onClick={() => { atHome.current = false; camera.zoomBy(1.4); }} aria-label={T.zoomOut} className={`${toolBtn} text-lg font-bold`}>−</button>
            <button type="button" onClick={() => { setFocus(null); go(null); home(); }} aria-label={T.overview} title={T.overview} className={toolBtn}>⤢</button>
          </div>
        </div>

        <div ref={wrap} className="relative overflow-hidden bg-[#dff1fb]" style={{ height }} onClickCapture={onCapture}
             onPointerDownCapture={(e) => { if (e.target.closest?.("svg.wx")) atHome.current = false; }}
             onWheelCapture={(e) => { if (e.target.closest?.("svg.wx")) atHome.current = false; }}>
          <WorldScene svgRef={camera.svgRef} category={p.category} sc={sc} sim={{ stages: simStages }} maxStage={maxStage}
                      focus={focus} labels={labels} ask={askMode} lang={lang} onClick={onSceneClick} art={art} leg={leg}
                      stageValue={stageValue} stageNote={stageNote} />

          <SceneNavigator scene={scene} go={go} takeOrigin={takeOrigin} S={S} rightInset={side ? 430 : 0}
            renderScene={(key, flourish) => (
              <SceneView sceneKey={key} d={d} base={base} sim={sim} sc={sc} setSc={setSc} lang={lang} S={S} art={art}
                         onDive={(k, rect) => { setTopic(null); go(k, rect); }}
                         onAsk={(t) => setTopic(t)}
                         onOpenProduct={(id, rect) => flourish(rect).then(() => navigate(`/world/${id}`))} />
            )} />

          {sc && base && !scene && (
            <SimPanel open={simOpen && !tour} hideToggle onToggle={() => setSimOpen(!simOpen)} sc={sc} setSc={setSc} base={base} sim={sim} lang={lang} T={T} measured={lc.measured}
                      origins={ORIGINS} onAsk={() => open("what_if")} onReset={() => setSc({ ...sc, origin: base.origin, mode: base.mode, grid: base.grid, years: base.years, refurbished: false })} />
          )}
          {askMode && <p className="absolute z-20 left-1/2 -translate-x-1/2 bottom-3 rounded-full bg-amber-400 text-[#16324a] text-sm font-semibold px-4 py-1.5 shadow">❓ {T.askModeOn}</p>}

          {tour ? (
            <Tour open={tour} startStep={Math.max(0, (Number(params.get("step")) || 1) - 1)} onClose={() => { setTour(false); setFocus(null); go(null, null, { replace: true }); home(0); }} art={art} lang={lang}
                  formula={d.formula} greenScore={p.green_score}
                  ctx={{ sc, stages: sim?.stages || {}, total: sim?.total, officialTotal: p.co2e_kg }}
                  onStep={(stage) => { setFocus(stage === "formula" ? null : stage); go(SCENE_OF_STAGE[stage], null, { replace: true }); }} />
          ) : (
            <ExplainPanel open={!!topic} topic={topic} preset={preset} productId={p.product_id} lang={lang} scenario={scenario} T={T}
                          image={topic ? imageFor(topic) : null} onClose={() => setTopic(null)} />
          )}
        </div>

        {/* footer: circular lifecycle + the stage bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-[#EFEBDF]">
          <p className="text-[14.5px] text-[#55604F]">
            <b className="text-[#1F5D3A]">⟳ {labels.loop.circular}</b> · {labels.loop.circularSub.charAt(0).toLowerCase() + labels.loop.circularSub.slice(1)}
          </p>
          <nav aria-label="stages" className="flex max-w-full overflow-x-auto rounded-full border border-[#E3DFD3] bg-white"
               title={lc.measured ? undefined : L3("Số từng chặng = tổng × tỷ lệ điển hình của loại (ước tính)",
                                                   "Stage figures = total × the category's typical shares (estimate)",
                                                   "Chiffres par étape = total × parts typiques de la catégorie (estimation)")}>
            {RAIL.map((st, i) => {
              const kg = st === "materials" ? null : tw[st];
              return (
                <button key={st} type="button" data-explain={STAGE_TOPIC[st]} aria-pressed={focus === st}
                        onClick={(e) => { e.stopPropagation(); choose(st, e.currentTarget.getBoundingClientRect()); }}
                        className={`whitespace-nowrap px-4 py-2 text-[15px] font-semibold transition ${i > 0 ? "border-l border-[#E3DFD3]" : ""} ${focus === st ? "bg-[#1B2F45] text-white" : "text-[#33403A] hover:bg-[#F3F8F1]"}`}>
                  {T.stages[st]}{kg !== null && kg !== undefined ? <span className={`ml-1.5 font-bold ${focus === st ? "text-emerald-200" : "text-[#1F6B43]"}`}>{formatKg(kg, lang)}</span> : null}
                </button>
              );
            })}
            <button type="button" data-explain="co2e_total" onClick={() => { setFocus(null); home(); open("co2e_total"); }}
                    className="whitespace-nowrap border-l border-[#E3DFD3] bg-[#1F6B43] px-4 py-2 text-[15px] font-bold text-white">
              {T.total} {formatKg(sim?.total ?? p.co2e_kg, lang)} kg
            </button>
          </nav>
        </div>
      </section>

      {/* Green lifestyle and the AI insight, side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        <GreenPanel d={d} base={base} sc={sc} setSc={setSc} lang={lang} lifestyleOnly
                    onRecycle={(e) => { window.scrollTo({ top: 0, behavior: "smooth" }); choose("end_of_life", e?.currentTarget?.getBoundingClientRect?.() || null); }} />
        <InsightCard productId={p.product_id} lang={lang} stats={d.stats} kg={p.co2e_kg}
                     category={String(p.category || "").replace(/_/g, " ").replace(/^computer /, "")} />
      </div>
    </main>
  );
}

/** Search params that mean "I want to explore the catalogue", not "show me the map". */
const EXPLORE_KEYS = ["explore", "q", "category", "brand", "min_price", "max_price", "co2_source", "has_co2", "sort", "page", "include_accessories"];

/** /world with no product: jump into the map of the last product seen, or the greenest laptop. */
function WorldHome() {
  const { lang } = useI18n();
  const L3 = tri(lang);
  const recent = useRecent();
  const [target, setTarget] = useState(recent[0]?.product_id || null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (target) return undefined;
    let alive = true;
    api.getOverview()
      .then((o) => {
        const list = (o?.greenest || []).map((g) => ({ category: g.category, id: g.product?.product_id || g.item?.product?.id || g.id }));
        const pick = list.find((g) => g.category === "laptop" && g.id) || list.find((g) => g.id);
        if (!alive) return;
        if (pick) setTarget(String(pick.id)); else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [target]);
  if (failed) return <WorldExplore />;
  if (target) return <Navigate to={`/world/${target}${window.location.search}`} replace />;
  return (
    <div role="status" aria-live="polite" className="grid place-items-center min-h-[70vh] bg-[#eef6fb] text-[#4b5563]">
      <span className="inline-flex items-center gap-3 text-[16px]">
        <span className="w-5 h-5 rounded-full border-2 border-[#2E7D4F] border-t-transparent animate-spin" aria-hidden="true" />
        {L3("Đang mở thế giới CO₂…", "Opening the CO₂ world…", "Ouverture du monde CO₂…")}
      </span>
    </div>
  );
}

export default function World() {
  const { productId } = useParams();
  const [params] = useSearchParams();
  if (productId) return <WorldView key={productId} productId={productId} />;
  if (EXPLORE_KEYS.some((k) => params.has(k))) return <WorldExplore />;
  return <WorldHome />;
}
