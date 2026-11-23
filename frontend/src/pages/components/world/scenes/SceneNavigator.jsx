// Moves the viewer between places of the CO2 world:
//   enter / deeper  -> the new scene grows out of the clicked object (zoom from its screen box)
//   up / exit       -> the scene shrinks back into the object it came from
//   siblings        -> slide left / right with parallax; drag or swipe follows the finger and snaps
// Only transforms and opacity are animated (Web Animations API); only the active scene and its
// two neighbours are mounted.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ART_CSS } from "./SceneArt";
import { JOURNEY, TOP, parentOf, relation, siblingsOf, topOf } from "./sceneGraph";

const EASE = "cubic-bezier(.22,.8,.2,1)";
const ZOOM_MS = 650;
const SLIDE_MS = 520;
let uid = 0;

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function fromRect(container, rect) {
  const C = container.getBoundingClientRect();
  if (!rect || !rect.width) return { tx: 0, ty: 0, s: 0.6 };
  const s = Math.max(0.06, Math.min(0.9, Math.max(rect.width / C.width, rect.height / C.height)));
  return { tx: rect.left + rect.width / 2 - (C.left + C.width / 2), ty: rect.top + rect.height / 2 - (C.top + C.height / 2), s };
}

export default function SceneNavigator({ scene, go, takeOrigin, renderScene, S, rightInset = 0 }) {
  const root = useRef(null);
  const els = useRef(new Map());
  const [layers, setLayers] = useState(() => (scene ? [{ id: ++uid, key: scene }] : []));
  const prev = useRef(scene);
  const pending = useRef(null);
  const skip = useRef(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  const peekPrev = useRef(null);
  const peekNext = useRef(null);

  const el = (id) => els.current.get(id);
  const parallax = (node) => node?.querySelector("[data-parallax]");
  // Finished animations are committed to inline style and cancelled, so a later drag can set transforms.
  const anim = (node, frames, ms) => {
    if (!node) return Promise.resolve();
    const a = node.animate(frames, { duration: reduced() ? 220 : ms, easing: EASE, fill: "forwards" });
    return a.finished.then(() => { try { a.commitStyles(); } catch { /* detached */ } a.cancel(); }).catch(() => {});
  };

  const zoomIn = (node, rect) => {
    if (reduced()) return anim(node, [{ opacity: 0 }, { opacity: 1 }], 220);
    const { tx, ty, s } = fromRect(root.current, rect);
    return anim(node, [
      { transform: `translate(${tx}px,${ty}px) scale(${s})`, opacity: 0.2, borderRadius: "40px" },
      { offset: 0.4, opacity: 1 },
      { transform: "translate(0,0) scale(1)", opacity: 1, borderRadius: "0px" },
    ], ZOOM_MS);
  };
  const zoomOut = (node, rect) => {
    if (reduced()) return anim(node, [{ opacity: 1 }, { opacity: 0 }], 220);
    const { tx, ty, s } = fromRect(root.current, rect);
    return anim(node, [
      { transform: "translate(0,0) scale(1)", opacity: 1, borderRadius: "0px" },
      { offset: 0.6, opacity: 1 },
      { transform: `translate(${tx}px,${ty}px) scale(${s})`, opacity: 0, borderRadius: "40px" },
    ], ZOOM_MS - 80);
  };
  const slide = (outNode, inNode, dir, fromX = 0) => {
    const W = root.current.clientWidth;
    if (reduced()) return Promise.all([anim(outNode, [{ opacity: 1 }, { opacity: 0 }], 220), anim(inNode, [{ opacity: 0 }, { opacity: 1 }], 220)]);
    return Promise.all([
      anim(outNode, [{ transform: `translateX(${fromX}px)` }, { transform: `translateX(${-dir * W}px)` }], SLIDE_MS),
      anim(parallax(outNode), [{ transform: "translateX(0)" }, { transform: `translateX(${dir * W * 0.3}px)` }], SLIDE_MS),
      anim(inNode, [{ transform: `translateX(${dir * W + fromX}px)` }, { transform: "translateX(0)" }], SLIDE_MS),
      anim(parallax(inNode), [{ transform: `translateX(${-dir * W * 0.3}px)` }, { transform: "translateX(0)" }], SLIDE_MS),
    ]);
  };

  // react to URL scene changes
  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = scene;
    if (before === scene) return;
    if (skip.current) { skip.current = false; setLayers(scene ? [{ id: ++uid, key: scene }] : []); return; }
    const rel = relation(before, scene);
    const origin = takeOrigin();
    const curId = layers.length ? layers[layers.length - 1].id : null;
    const n = ++uid;
    if (rel.kind === "exit") {
      zoomOut(el(curId), origin).then(() => setLayers([]));
      return;
    }
    if (rel.kind === "enter" || rel.kind === "deeper" || rel.kind === "swap") {
      setLayers((l) => [...l.slice(-1), { id: n, key: scene }]);
      pending.current = () => (rel.kind === "swap" ? anim(el(n), [{ opacity: 0 }, { opacity: 1 }], 380) : zoomIn(el(n), origin))
        .then(() => setLayers((l) => l.filter((x) => x.id === n)));
      return;
    }
    if (rel.kind === "up") {
      setLayers((l) => [{ id: n, key: scene }, ...l.slice(-1)]);
      pending.current = () => {
        const spot = el(n)?.querySelector(`[data-hotspot="${CSS.escape(before)}"]`);
        return zoomOut(el(curId), origin || spot?.getBoundingClientRect()).then(() => setLayers((l) => l.filter((x) => x.id === n)));
      };
      return;
    }
    if (rel.kind === "slide") {
      setLayers((l) => [...l.slice(-1), { id: n, key: scene }]);
      pending.current = () => slide(el(curId), el(n), rel.dir).then(() => setLayers((l) => l.filter((x) => x.id === n)));
    }
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (pending.current) { const run = pending.current; pending.current = null; run(); }
  }, [layers]);

  // ---- drag / swipe between siblings
  const current = layers.length === 1 ? layers[0].key : null;
  const sibs = current ? siblingsOf(current) : [];
  const idx = current ? sibs.indexOf(current) : -1;
  const prevKey = idx > 0 ? sibs[idx - 1] : null;
  const nextKey = idx >= 0 && idx < sibs.length - 1 ? sibs[idx + 1] : null;

  const onPointerDown = (e) => {
    if (!current || e.button > 0) return;
    if (e.target.closest("button,a,input,select,textarea,label,[role=button],[data-card]")) return;
    drag.current = { x: e.clientX, t: performance.now(), dx: 0, id: e.pointerId, active: false };
  };
  const onPointerMove = (e) => {
    const g = drag.current;
    if (!g || g.id !== e.pointerId) return;
    g.dx = e.clientX - g.x;
    if (!g.active && Math.abs(g.dx) > 10) { g.active = true; root.current.setPointerCapture(e.pointerId); setDragging(true); }
    if (!g.active) return;
    if (g.raf) return;
    g.raf = requestAnimationFrame(() => {
      g.raf = 0;
      const W = root.current.clientWidth;
      const dx = (g.dx > 0 && !prevKey) || (g.dx < 0 && !nextKey) ? g.dx * 0.25 : g.dx;   // rubber band at the ends
      const cur = el(layers[0].id);
      if (cur) { cur.style.transform = `translateX(${dx}px)`; const p = parallax(cur); if (p) p.style.transform = `translateX(${-dx * 0.3}px)`; }
      if (peekPrev.current) { peekPrev.current.style.transform = `translateX(${dx - W}px)`; const p = parallax(peekPrev.current); if (p) p.style.transform = `translateX(${-(dx - W) * 0.3}px)`; }
      if (peekNext.current) { peekNext.current.style.transform = `translateX(${dx + W}px)`; const p = parallax(peekNext.current); if (p) p.style.transform = `translateX(${-(dx + W) * 0.3}px)`; }
    });
  };
  const onPointerUp = (e) => {
    const g = drag.current;
    drag.current = null;
    if (!g || !g.active) return;
    const W = root.current.clientWidth;
    const v = g.dx / Math.max(1, performance.now() - g.t);
    const dir = g.dx < 0 ? 1 : -1;
    const target = dir > 0 ? nextKey : prevKey;
    const cur = el(layers[0].id);
    const peek = dir > 0 ? peekNext.current : peekPrev.current;
    const clear = () => { [cur, peekPrev.current, peekNext.current].forEach((n) => { if (n) { n.getAnimations().forEach((a) => a.cancel()); n.style.transform = ""; const p = parallax(n); if (p) { p.getAnimations().forEach((a) => a.cancel()); p.style.transform = ""; } } }); };
    if (target && (Math.abs(g.dx) > W * 0.18 || Math.abs(v) > 0.6)) {
      [cur, peek].forEach((n) => { if (n) n.style.transform = ""; });
      slide(cur, peek, dir, g.dx).then(() => { skip.current = true; go(target, null); setDragging(false); requestAnimationFrame(clear); });
    } else {
      Promise.all([
        anim(cur, [{ transform: `translateX(${g.dx}px)` }, { transform: "translateX(0)" }], 260),
        anim(peekPrev.current, [{ transform: `translateX(${g.dx - W}px)` }, { transform: `translateX(${-W}px)` }], 260),
        anim(peekNext.current, [{ transform: `translateX(${g.dx + W}px)` }, { transform: `translateX(${W}px)` }], 260),
      ]).then(() => { clear(); setDragging(false); });
    }
  };

  const flourish = useCallback((rect) => zoomIn(root.current?.querySelector("[data-flourish]"), rect), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { els.current.clear(); }, []);

  if (!layers.length) return null;
  const shown = layers[layers.length - 1].key;
  const crumbs = [];
  for (let k = shown; k; k = parentOf(k)) crumbs.unshift(k);
  const top = topOf(shown);
  const sib = siblingsOf(shown);
  const si = sib.indexOf(shown);

  return (
    <div ref={root} className="absolute z-[25] inset-y-0 left-0 overflow-hidden select-none touch-pan-y" style={{ right: rightInset }}
         onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <style>{ART_CSS}</style>
      {layers.map((l) => (
        <div key={l.id} ref={(n) => (n ? els.current.set(l.id, n) : els.current.delete(l.id))} className="absolute inset-0 will-change-transform shadow-2xl">
          {renderScene(l.key, flourish)}
        </div>
      ))}
      {current && prevKey && <div ref={peekPrev} className="absolute inset-0 will-change-transform" style={{ transform: "translateX(-100%)", visibility: dragging ? "visible" : "hidden" }}>{renderScene(prevKey, flourish)}</div>}
      {current && nextKey && <div ref={peekNext} className="absolute inset-0 will-change-transform" style={{ transform: "translateX(100%)", visibility: dragging ? "visible" : "hidden" }}>{renderScene(nextKey, flourish)}</div>}
      <div data-flourish className="absolute inset-0 pointer-events-none bg-[#f6f1e6] opacity-0" />

      {/* breadcrumb + close */}
      <nav className="absolute z-30 left-3 md:left-6 top-3 md:top-5 right-16 flex flex-wrap items-center gap-1 text-[16px]" aria-label="breadcrumb">
        <button type="button" onClick={() => go(null, null)} className="rounded-full bg-white/90 shadow px-3 py-1.5 font-semibold text-[#1F5D3A] hover:bg-white">🌏 {S.world}</button>
        {crumbs.map((k) => (
          <span key={k} className="flex items-center gap-1">
            <span className="text-white drop-shadow font-bold">›</span>
            <button type="button" onClick={() => k !== shown && go(k, null)} aria-current={k === shown ? "page" : undefined}
                    className={`rounded-full px-3 py-1.5 shadow font-semibold ${k === shown ? "bg-[#1F5D3A] text-white" : "bg-white/90 text-[#1F5D3A] hover:bg-white"}`}>{S.names[k]}</button>
          </span>
        ))}
      </nav>
      <button type="button" onClick={() => go(parentOf(shown), null)} aria-label={S.back} title={`${S.back} (Esc)`}
              className="absolute z-30 right-3 md:right-5 top-3 md:top-5 w-11 h-11 rounded-full bg-white shadow-lg text-xl font-bold text-[#16324a] hover:scale-105 transition">↩</button>

      {/* side arrows between siblings */}
      {si > 0 && (
        <button type="button" onClick={() => go(sib[si - 1], null)} aria-label={S.prev} title={`${S.prev}: ${S.names[sib[si - 1]]}`}
                className="hidden md:grid absolute z-20 left-[480px] top-1/2 -translate-y-1/2 w-14 h-14 place-items-center rounded-full bg-white/90 shadow-xl text-2xl hover:scale-110 transition">‹</button>
      )}
      {si < sib.length - 1 && (
        <button type="button" onClick={() => go(sib[si + 1], null)} aria-label={S.next} title={`${S.next}: ${S.names[sib[si + 1]]}`}
                className="hidden md:grid absolute z-20 right-5 top-1/2 -translate-y-1/2 w-14 h-14 place-items-center rounded-full bg-white/90 shadow-xl text-2xl hover:scale-110 transition">›</button>
      )}

      {/* the journey: always visible, jump anywhere */}
      <div className="absolute z-20 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-24 top-[60px] md:top-6 flex items-center gap-1.5 rounded-full bg-white/90 shadow px-3 py-2">
        {TOP.map((k) => (
          <button key={k} type="button" onClick={() => go(k, null)} title={S.names[k]} aria-label={S.names[k]} aria-current={top === k ? "step" : undefined}
                  className={`rounded-full transition-all ${top === k ? "w-8 h-3 bg-[#1F5D3A]" : JOURNEY.includes(k) ? "w-3 h-3 bg-emerald-300 hover:bg-emerald-500" : "w-3 h-3 bg-amber-300 hover:bg-amber-500"}`} />
        ))}
      </div>
      <p className="hidden md:block absolute z-20 right-5 bottom-5 rounded-full bg-black/35 text-white text-[13.5px] px-3 py-1">↔ {S.swipe}</p>
    </div>
  );
}
