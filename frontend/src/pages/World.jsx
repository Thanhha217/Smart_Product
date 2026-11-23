import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { tri, useI18n } from "../i18n/LanguageContext";
import { api } from "../api/client";
import { formatKg } from "../lib/format";
import { ErrorState } from "./components/common/States";
import { explore } from "../i18n/explore";
import WorldExplore from "./components/world/explore/WorldExplore";
import WorldScene, { WORLD_H, WORLD_W, legPath, stageTarget } from "./components/world/WorldScene";
import ExplainPanel from "./components/world/ExplainPanel";
import SimPanel from "./components/world/SimPanel";
import FormulaHud from "./components/world/FormulaHud";
import GreenPanel from "./components/world/GreenPanel";
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
  const [greenOpen, setGreenOpen] = useState(false);   // the Green lifestyle panel on narrow screens
  const hudRef = useRef(null);
  const [tour, setTour] = useState(params.get("tour") === "1");
  const wrap = useRef(null);
  const height = useFillHeight(wrap);
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
    const box = { x0: 60, x1: 2360, y0: 415, y1: 1310 };
    const right = xl ? 360 : 12;
    const r = hudRef.current?.getBoundingClientRect();
    const hudW = r ? r.width + 24 : 0, hudH = r ? r.height + 24 : 0;
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
          <Link to="/world" className="btn-secondary">{X.worldBack}</Link>
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
  const TOPIC_SCENE = { materials: "mine", factory: "factory", transport: sceneFor("transport", sc), use: "home", grid: sceneFor("grid", sc), end_of_life: "recycle", wefe: "city_wefe" };
  const imageFor = (t) => (TOPIC_SCENE[t] ? art[TOPIC_SCENE[t]] || null : null);

  return (
    <div ref={wrap} className="relative overflow-hidden bg-[#dff1fb]" style={{ height }} onClickCapture={onCapture}
         onPointerDownCapture={(e) => { if (e.target.closest?.("svg.wx")) atHome.current = false; }}
         onWheelCapture={(e) => { if (e.target.closest?.("svg.wx")) atHome.current = false; }}>
      <WorldScene svgRef={camera.svgRef} category={p.category} sc={sc} sim={{ stages: simStages }} maxStage={maxStage}
                  focus={focus} labels={labels} ask={askMode} lang={lang} onClick={onSceneClick} art={art} leg={leg} />

      {/* walk-in scenes (zoom / slide / drag between places) */}
      <SceneNavigator scene={scene} go={go} takeOrigin={takeOrigin} S={S} rightInset={side ? 430 : 0}
        renderScene={(key, flourish) => (
          <SceneView sceneKey={key} d={d} base={base} sim={sim} sc={sc} setSc={setSc} lang={lang} S={S} art={art}
                     onDive={(k, rect) => { setTopic(null); go(k, rect); }}
                     onAsk={(t) => setTopic(t)}
                     onOpenProduct={(id, rect) => flourish(rect).then(() => navigate(`/world/${id}`))} />
        )} />

      {/* HUD: product, total and the CO2 formula with this product's numbers */}
      {!scene && (
        <div ref={hudRef} className="absolute z-20 left-3 top-3 right-3 md:right-auto md:w-[440px] max-h-[calc(100%-96px)] overflow-y-auto rounded-3xl">
          <FormulaHud d={d} lang={lang} T={T} t={t} compact={!wide} onTopic={open} onFormula={(e) => enter("formula", e)} />
          {!xl && !tour && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => { setTopic(null); setTour(true); }}
                      className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-extrabold px-4 py-2 shadow-lg whitespace-nowrap">
                ▶ {L3("Giải thích từng bước", "Guided explanation", "Explication pas à pas")}
              </button>
              {!side && !greenOpen && (
                <button type="button" onClick={() => setGreenOpen(true)}
                        className="rounded-full bg-[#1F5D3A] text-white px-4 py-2 text-[15px] font-bold shadow-lg whitespace-nowrap">
                  🍃 {L3("Sống xanh", "Green lifestyle", "Vivre sobre")}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Green lifestyle: low-CO2 choice, use longer, recycle + AI insight (right side) */}
      {!scene && !side && !tour && (xl || greenOpen) && (
        <div className={`absolute z-30 right-3 top-3 flex ${xl ? "w-[340px]" : "left-3 md:left-auto md:w-[360px]"}`} style={{ maxHeight: xl ? height - 232 : height - 100 }}>
          <GreenPanel d={d} base={base} sc={sc} setSc={setSc} lang={lang} className="max-h-full w-full"
                      onRecycle={(e) => choose("end_of_life", e?.currentTarget?.getBoundingClientRect?.() || null)} />
          {!xl && <button type="button" onClick={() => setGreenOpen(false)} className="absolute -top-1 -right-1 w-9 h-9 rounded-full bg-white shadow text-lg" aria-label={L3("Đóng", "Close", "Fermer")}>✕</button>}
        </div>
      )}

      {/* tour button */}
      {/* on wide screens it sits in the sky between the two cards; narrower, right under the formula card */}
      {!tour && !scene && xl && (
        <button type="button" onClick={() => { setTopic(null); setTour(true); }}
                className="absolute z-20 top-4 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-extrabold px-5 py-2.5 shadow-xl hover:scale-105 transition whitespace-nowrap"
                style={{ left: "calc(470px + (100% - 830px) / 2)" }}>
          ▶ {L3("Xem giải thích từng bước", "Guided explanation", "Explication pas à pas")}
        </button>
      )}

      {sc && base && !scene && (
        <SimPanel open={simOpen && !tour} onToggle={() => setSimOpen(!simOpen)} sc={sc} setSc={setSc} base={base} sim={sim} lang={lang} T={T}
                  origins={ORIGINS} onAsk={() => open("what_if")} onReset={() => setSc({ ...sc, origin: base.origin, mode: base.mode, grid: base.grid, years: base.years, refurbished: false })} />
      )}

      {/* stage rail written as the split equation: production + transport + use + end of life = total */}
      {!scene && <nav style={side ? { left: "calc(50% - 210px)", maxWidth: "calc(100% - 460px)" }
                          : xl ? { left: "calc(150px + (100% - 520px) / 2)", maxWidth: "calc(100% - 530px)" }
                          : wide ? { left: "calc(150px + (100% - 220px) / 2)", maxWidth: "calc(100% - 230px)" } : undefined}
           className="absolute z-20 left-1/2 -translate-x-1/2 bottom-3 max-w-[calc(100%-24px)] overflow-x-auto rounded-full bg-white/95 backdrop-blur shadow-xl border border-white p-1.5 flex items-center gap-0.5" aria-label="stages">
        <span className="hidden sm:inline pl-2 pr-1 text-[13px] font-bold text-[#2E7D4F] whitespace-nowrap">③ {L3("Theo chặng", "By stage", "Par étape")}</span>
        {RAIL.filter((s) => s !== "materials").map((s, i) => {
          const kg = tw[s];
          return (
            <span key={s} className="flex items-center">
              {i > 0 && <span className="px-0.5 text-[18px] font-bold text-[#9ca3af]" aria-hidden="true">+</span>}
              <button type="button" data-explain={STAGE_TOPIC[s]} onClick={(e) => { e.stopPropagation(); choose(s, e.currentTarget.getBoundingClientRect()); }} aria-pressed={focus === s}
                      className={`rounded-full px-3 py-2 text-[15px] font-semibold whitespace-nowrap transition ${focus === s ? "bg-[#16324a] text-white shadow" : "hover:bg-emerald-50 text-gray-700"}`}>
                {T.stages[s]}{kg !== null && kg !== undefined ? <span className={`ml-1 font-bold ${focus === s ? "text-emerald-200" : "text-emerald-700"}`}>{formatKg(kg, lang)}</span> : null}
              </button>
            </span>
          );
        })}
        <span className="px-1 text-[18px] font-bold text-[#9ca3af]" aria-hidden="true">=</span>
        <button type="button" data-explain="co2e_total" onClick={() => { setFocus(null); home(); open("co2e_total"); }}
                className="rounded-full px-3.5 py-2 text-[15px] font-bold whitespace-nowrap bg-emerald-600 text-white">{T.total} {formatKg(sim?.total ?? p.co2e_kg, lang)} kg</button>
      </nav>}

      {/* camera + ask controls */}
      <div className={`absolute ${scene ? "z-30 bottom-24 md:bottom-16" : "z-20 bottom-20 md:bottom-4"} right-3 flex flex-col gap-2`} style={side ? { right: 432 } : undefined}>
        <button type="button" onClick={() => setAskMode(!askMode)} aria-pressed={askMode} title={askMode ? T.askModeOn : T.askMode}
                className={`rounded-full w-11 h-11 shadow-lg text-lg font-bold ${askMode ? "bg-amber-400 text-[#16324a] ring-4 ring-amber-200" : "bg-white text-[#16324a]"}`}>❓</button>
        {!scene && <>
          <button type="button" onClick={() => { atHome.current = false; camera.zoomBy(0.7); }} aria-label={T.zoomIn} className="rounded-full w-11 h-11 bg-white shadow-lg text-xl font-bold">+</button>
          <button type="button" onClick={() => { atHome.current = false; camera.zoomBy(1.4); }} aria-label={T.zoomOut} className="rounded-full w-11 h-11 bg-white shadow-lg text-xl font-bold">−</button>
          <button type="button" onClick={() => { setFocus(null); home(); }} aria-label={T.overview} title={T.overview} className="rounded-full w-11 h-11 bg-white shadow-lg text-lg">⤢</button>
        </>}
      </div>
      {askMode && <p className="absolute z-20 left-1/2 -translate-x-1/2 bottom-[72px] rounded-full bg-amber-400 text-[#16324a] text-sm font-semibold px-4 py-1.5 shadow">❓ {T.askModeOn}</p>}

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
  );
}

export default function World() {
  const { productId } = useParams();
  if (productId) return <WorldView key={productId} productId={productId} />;
  return <WorldExplore />;
}
