// The method diagram as a place you can walk into — the same scene engine as the CO₂ world.
// Tap a box and its scene grows out of it; inside, ‹ › or a swipe jumps to the next scene, the
// dots jump anywhere, Esc (or the breadcrumb) shrinks back into the diagram. The scene lives in
// the URL (?scene=formula), so Back and shared links land in the same place.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../../api/client";
import { useI18n } from "../../../i18n/LanguageContext";
import MethodFlow from "./MethodFlow";
import SceneNavigator from "../world/scenes/SceneNavigator";
import SceneView from "../world/scenes/SceneView";
import { isValid, parentOf, siblingsOf } from "../world/scenes/sceneGraph";
import { sceneText } from "../world/worldText";
import { baseline, simulate } from "../world/worldModel";

export default function MethodExplorer({ co2, onSeeCalc, links, onPickProduct }) {
  const { lang } = useI18n();
  const S = useMemo(() => sceneText(lang), [lang]);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const scene = isValid(params.get("scene")) ? params.get("scene") : null;
  const productId = co2?.product?.product_id;

  // the scenes want the same data the CO2 world loads: category stats and related products
  const [extra, setExtra] = useState({ stats: null, related: null });
  useEffect(() => {
    let alive = true;
    const cat = co2?.product?.category;
    if (!productId) return undefined;
    Promise.all([
      cat ? api.getCategoryStats(cat, productId).catch(() => null) : null,
      api.getRelated(productId, 6).catch(() => null),
    ]).then(([stats, related]) => alive && setExtra({ stats, related }));
    return () => { alive = false; };
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const d = useMemo(() => (co2 ? { ...co2, ...extra } : null), [co2, extra]);
  const base = useMemo(() => (d ? baseline(d) : null), [d]);
  const [sc, setSc] = useState(null);
  useEffect(() => {
    if (base) setSc({ origin: base.origin, mode: base.mode, grid: base.grid, years: base.years, refurbished: false });
  }, [base]);
  const sim = useMemo(() => (base && sc ? simulate(base, sc) : null), [base, sc]);

  // where the next scene should grow from (the box that was tapped)
  const origin = useRef(null);
  const takeOrigin = useCallback(() => { const r = origin.current; origin.current = null; return r; }, []);
  const box = useRef(null);
  const go = useCallback((key, rect = null) => {
    origin.current = rect;
    // bring the whole scene into view, under the sticky top bar
    if (key && box.current) {
      const top = box.current.getBoundingClientRect().top + window.scrollY - 80;
      if (Math.abs(window.scrollY - top) > 40) window.scrollTo({ top, behavior: "smooth" });
    }
    const next = new URLSearchParams(window.location.search);
    if (key) next.set("scene", key); else next.delete("scene");
    setParams(next, { replace: false });
  }, [setParams]);

  // keyboard, as in the CO2 world: Esc goes up, ← → between sibling scenes
  useEffect(() => {
    if (!scene) return undefined;
    const onKey = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;
      if (e.key === "Escape" || e.key === "Backspace") { e.preventDefault(); go(parentOf(scene)); }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const sib = siblingsOf(scene);
        const i = sib.indexOf(scene) + (e.key === "ArrowRight" ? 1 : -1);
        if (i >= 0 && i < sib.length) go(sib[i]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scene, go]);

  if (!co2) return null;

  return (
    <div ref={box} className={`relative rounded-3xl ${scene ? "overflow-hidden h-[min(720px,calc(100vh-110px))] min-h-[560px] bg-[#f6f1e6]" : ""}`}>
      {/* the diagram: the "map" the scenes open from; hidden while a scene is open */}
      <div className={scene ? "invisible" : ""} aria-hidden={scene ? "true" : undefined}>
        <MethodFlow co2={co2} onSeeCalc={onSeeCalc} links={links} onEnter={(key, rect) => go(key, rect)} />
      </div>

      {d && sc && (
        <SceneNavigator scene={scene} go={go} takeOrigin={takeOrigin} S={S}
          renderScene={(key, flourish) => (
            <SceneView sceneKey={key} d={d} base={base} sim={sim} sc={sc} setSc={setSc} lang={lang} S={S} art={{}}
                       onDive={(k, rect) => go(k, rect)}
                       onAsk={(topic) => navigate(`/world/${productId}?ask=${encodeURIComponent(topic)}`)}
                       onOpenProduct={(id, rect) => flourish(rect).then(() => { go(null); onPickProduct?.(String(id)); })} />
          )} />
      )}
    </div>
  );
}
