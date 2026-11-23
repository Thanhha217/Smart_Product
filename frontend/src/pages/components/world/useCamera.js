import { useCallback, useEffect, useRef, useState } from "react";

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Pan / zoom camera for a large SVG world. The camera writes the viewBox directly
 * (no React re-render while dragging) and keeps the view inside the world.
 * Camera state = centre (cx, cy) and visible width w; height follows the element's aspect.
 */
export function useCamera({ width, height, minW = 420, margin = 600, onChange }) {
  const nodeRef = useRef(null);
  const [node, setNode] = useState(null);
  const svgRef = useCallback((el) => { nodeRef.current = el; setNode(el); }, []);
  const cam = useRef({ cx: width / 2, cy: height / 2, w: width });
  const drag = useRef({ pointers: new Map(), moved: 0, last: null, vx: 0, vy: 0, t: 0, pinch: null });
  const raf = useRef(0);

  const aspect = () => {
    const el = nodeRef.current;
    if (!el) return height / width;
    const r = el.getBoundingClientRect();
    return r.width > 0 ? r.height / r.width : height / width;
  };
  const maxW = () => Math.max(width, height / aspect());

  const clamp = useCallback(() => {
    const c = cam.current;
    c.w = Math.max(minW, Math.min(maxW(), c.w));
    const h = c.w * aspect();
    const halfW = c.w / 2, halfH = h / 2;
    // the scenery extends `margin` world units past each edge, so a stage near the edge
    // can still be centred beside an open side panel
    c.cx = c.w >= width + 2 * margin ? width / 2 : Math.max(halfW - margin, Math.min(width + margin - halfW, c.cx));
    c.cy = h >= height ? height / 2 : Math.max(halfH, Math.min(height - halfH, c.cy));
  }, [width, height, minW, margin]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = useCallback(() => {
    clamp();
    const c = cam.current;
    const h = c.w * aspect();
    nodeRef.current?.setAttribute("viewBox", `${c.cx - c.w / 2} ${c.cy - h / 2} ${c.w} ${h}`);
    onChange?.(c);
  }, [clamp, onChange]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = () => cancelAnimationFrame(raf.current);

  const flyTo = useCallback((target, ms = 750) => {
    stop();
    const from = { ...cam.current };
    const to = { cx: target.cx ?? from.cx, cy: target.cy ?? from.cy, w: target.w ?? from.w };
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || ms <= 0) { Object.assign(cam.current, to); apply(); return; }
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      const e = ease(t);
      // zoom out a little in the middle of long trips: feels like a camera move
      const dist = Math.hypot(to.cx - from.cx, to.cy - from.cy);
      const lift = Math.sin(Math.PI * t) * Math.min(0.35, dist / (from.w * 2.2));
      cam.current.cx = from.cx + (to.cx - from.cx) * e;
      cam.current.cy = from.cy + (to.cy - from.cy) * e;
      cam.current.w = (from.w + (to.w - from.w) * e) * (1 + lift);
      apply();
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, [apply]);

  const toWorld = (clientX, clientY) => {
    const el = nodeRef.current;
    const r = el.getBoundingClientRect();
    const c = cam.current;
    const h = c.w * aspect();
    return { x: c.cx - c.w / 2 + ((clientX - r.left) / r.width) * c.w, y: c.cy - h / 2 + ((clientY - r.top) / r.height) * h };
  };

  const zoomAt = useCallback((factor, clientX, clientY) => {
    const el = nodeRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = clientX ?? r.left + r.width / 2, py = clientY ?? r.top + r.height / 2;
    const before = toWorld(px, py);
    cam.current.w = Math.max(minW, Math.min(maxW(), cam.current.w * factor));
    clamp();
    const after = toWorld(px, py);
    cam.current.cx += before.x - after.x;
    cam.current.cy += before.y - after.y;
    apply();
  }, [apply, clamp, minW]); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomBy = useCallback((factor) => {
    stop();
    const from = cam.current.w, to = Math.max(minW, Math.min(maxW(), from * factor));
    flyTo({ w: to }, 320);
  }, [flyTo, minW]); // eslint-disable-line react-hooks/exhaustive-deps

  const overview = useCallback((ms = 750) => flyTo({ cx: width / 2, cy: height / 2, w: maxW() }, ms), [flyTo, width, height]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = node;
    if (!el) return undefined;
    const d = drag.current;

    const onDown = (e) => {
      if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
      stop();
      d.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (d.pointers.size === 1) { d.moved = 0; d.last = { x: e.clientX, y: e.clientY }; d.vx = 0; d.vy = 0; d.t = performance.now(); }
      if (d.pointers.size === 2) {
        const [a, b] = [...d.pointers.values()];
        d.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), w: cam.current.w };
      }
    };
    const onMove = (e) => {
      if (!d.pointers.has(e.pointerId)) return;
      d.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (d.pointers.size === 2 && d.pinch) {
        const [a, b] = [...d.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const target = d.pinch.w * (d.pinch.dist / Math.max(dist, 1));
        zoomAt(target / cam.current.w, mid.x, mid.y);
        d.moved += 10;
        return;
      }
      const r = el.getBoundingClientRect();
      const scale = cam.current.w / r.width;
      const dx = e.clientX - d.last.x, dy = e.clientY - d.last.y;
      d.moved += Math.abs(dx) + Math.abs(dy);
      if (d.moved > 4) {
        if (!el.hasPointerCapture?.(e.pointerId)) el.setPointerCapture?.(e.pointerId);
        cam.current.cx -= dx * scale;
        cam.current.cy -= dy * scale;
        const now = performance.now();
        const dt = Math.max(1, now - d.t);
        d.vx = (-dx * scale) / dt; d.vy = (-dy * scale) / dt; d.t = now;
        apply();
      }
      d.last = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e) => {
      d.pointers.delete(e.pointerId);
      if (d.pointers.size < 2) d.pinch = null;
      if (d.pointers.size === 1) { const p = [...d.pointers.values()][0]; d.last = { ...p }; }
      if (d.pointers.size === 0 && d.moved > 4 && performance.now() - d.t < 80) {
        // inertia
        let vx = d.vx * 16, vy = d.vy * 16;
        const glide = () => {
          vx *= 0.92; vy *= 0.92;
          cam.current.cx += vx; cam.current.cy += vy;
          apply();
          if (Math.hypot(vx, vy) > 0.3) raf.current = requestAnimationFrame(glide);
        };
        raf.current = requestAnimationFrame(glide);
      }
    };
    const onWheel = (e) => {
      e.preventDefault();
      stop();
      zoomAt(Math.exp(e.deltaY * 0.0015), e.clientX, e.clientY);
    };
    const onDbl = (e) => { const p = toWorld(e.clientX, e.clientY); flyTo({ cx: p.x, cy: p.y, w: cam.current.w / 1.8 }, 450); };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("dblclick", onDbl);
    const ro = new ResizeObserver(() => apply());
    ro.observe(el);
    apply();
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("dblclick", onDbl);
      ro.disconnect();
      stop();
    };
  }, [node, apply, flyTo, zoomAt]); // eslint-disable-line react-hooks/exhaustive-deps

  /** True when the last pointer gesture was a drag (so the click should not count). */
  const wasDrag = useCallback(() => drag.current.moved > 6, []);

  return { svgRef, flyTo, zoomBy, overview, wasDrag, cam };
}

/** Animate a number towards its target (used for totals and bubble sizes). */
export function useTween(value, ms = 650) {
  const ref = useRef({ v: value, raf: 0 });
  const [, force] = useRefState();
  useEffect(() => {
    const st = ref.current;
    cancelAnimationFrame(st.raf);
    if (value === null || value === undefined || st.v === null || st.v === undefined) { st.v = value; force(); return undefined; }
    const from = st.v, t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      st.v = from + (value - from) * ease(t);
      force();
      if (t < 1) st.raf = requestAnimationFrame(step);
    };
    st.raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(st.raf);
  }, [value, ms]); // eslint-disable-line react-hooks/exhaustive-deps
  return ref.current.v;
}

function useRefState() {
  const [n, setN] = useState(0);
  return [n, () => setN((x) => (x + 1) % 1e9)];
}
