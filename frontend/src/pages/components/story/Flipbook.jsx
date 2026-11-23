import { useCallback, useEffect, useRef, useState } from "react";

const TURN_MS = 750;

function useWide() {
  const query = "(min-width: 900px)";
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

function Paper({ children, side, number }) {
  return (
    <div className={`relative h-full w-full bg-[#fffdf8] overflow-hidden ${side === "left" ? "rounded-l-xl" : side === "right" ? "rounded-r-xl" : "rounded-xl"}`}
         style={{ boxShadow: side === "left" ? "inset -18px 0 24px -18px rgba(0,0,0,.25)" : side === "right" ? "inset 18px 0 24px -18px rgba(0,0,0,.25)" : "none" }}>
      <div className="h-full overflow-y-auto px-6 py-5 md:px-8 md:py-6">{children}</div>
      {number !== undefined && <span className="absolute bottom-2 text-[13.5px] text-gray-400 select-none" style={{ [side === "left" ? "left" : "right"]: 14 }}>{number}</span>}
    </div>
  );
}

/**
 * A book with real page turns. `index` is the page to show (0-based); on wide screens the
 * book shows the spread that contains it. Pages are plain React nodes.
 */
export default function Flipbook({ pages, index, onIndex, height = 640 }) {
  const wide = useWide();
  const [turn, setTurn] = useState(null); // {dir: "next"|"prev", from: spreadLeftIndex}
  const touch = useRef(null);
  const n = pages.length;
  const left = wide ? index - (index % 2) : index;

  const go = useCallback((dir) => {
    if (turn) return;
    const step = wide ? 2 : 1;
    const target = dir === "next" ? left + step : left - step;
    if (target < 0 || target > n - 1) return;
    if (!wide) { onIndex(target); return; }
    setTurn({ dir, from: left });
    setTimeout(() => { setTurn(null); onIndex(target); }, TURN_MS);
  }, [turn, wide, left, n, onIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT", "TEXTAREA"].includes(e.target?.tagName)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") go("next");
      if (e.key === "ArrowLeft" || e.key === "PageUp") go("prev");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const touchHandlers = {
    onTouchStart: (e) => { touch.current = e.touches[0].clientX; },
    onTouchEnd: (e) => {
      if (touch.current === null) return;
      const dx = e.changedTouches[0].clientX - touch.current;
      if (Math.abs(dx) > 50) go(dx < 0 ? "next" : "prev");
      touch.current = null;
    },
  };

  const page = (i, side) => (i >= 0 && i < n ? <Paper side={side} number={i + 1}>{pages[i]}</Paper> : <div className="h-full w-full" />);

  if (!wide) {
    return (
      <div {...touchHandlers}>
        <style>{`@keyframes sb-in { from { opacity:0; transform: translateX(24px) rotateY(-8deg) } to { opacity:1; transform:none } }`}</style>
        <div key={index} className="shadow-xl rounded-xl" style={{ height: Math.min(height, 720), animation: "sb-in .35s ease-out", perspective: 1200 }}>
          {page(index, "single")}
        </div>
      </div>
    );
  }

  const L = turn ? turn.from : left;
  const leftUnder = turn?.dir === "prev" ? L - 2 : L;
  const rightUnder = turn?.dir === "next" ? L + 3 : L + 1;
  return (
    <div {...touchHandlers} className="relative mx-auto" style={{ height, perspective: 2400 }}>
      <style>{`
        @keyframes sb-turn-next { from { transform: rotateY(0deg) } to { transform: rotateY(-180deg) } }
        @keyframes sb-turn-prev { from { transform: rotateY(0deg) } to { transform: rotateY(180deg) } }
        .sb-face { position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden; }
      `}</style>
      <div className="absolute inset-0 flex rounded-xl shadow-2xl" style={{ background: "#e9e2d0" }}>
        <div className="w-1/2 h-full">{page(leftUnder, "left")}</div>
        <div className="w-1/2 h-full">{page(rightUnder, "right")}</div>
        <div className="absolute top-0 bottom-0 left-1/2 w-[2px] -ml-[1px] bg-black/10 pointer-events-none" />
      </div>
      {turn && (
        <div className="absolute top-0 h-full w-1/2" style={{
          left: turn.dir === "next" ? "50%" : 0, transformStyle: "preserve-3d",
          transformOrigin: turn.dir === "next" ? "left center" : "right center",
          animation: `sb-turn-${turn.dir} ${TURN_MS}ms cubic-bezier(.45,.05,.35,1) forwards`, zIndex: 5,
        }}>
          <div className="sb-face">{page(turn.dir === "next" ? L + 1 : L, turn.dir === "next" ? "right" : "left")}</div>
          <div className="sb-face" style={{ transform: "rotateY(180deg)" }}>{page(turn.dir === "next" ? L + 2 : L - 1, turn.dir === "next" ? "left" : "right")}</div>
        </div>
      )}
      <button type="button" aria-label="previous page" onClick={() => go("prev")} disabled={left === 0}
              className="absolute left-0 bottom-0 w-14 h-14 z-10 rounded-bl-xl disabled:opacity-0"
              style={{ background: "linear-gradient(45deg, rgba(0,0,0,.08) 50%, transparent 50%)" }} />
      <button type="button" aria-label="next page" onClick={() => go("next")} disabled={left + 2 > n - 1}
              className="absolute right-0 bottom-0 w-14 h-14 z-10 rounded-br-xl disabled:opacity-0"
              style={{ background: "linear-gradient(-45deg, rgba(0,0,0,.08) 50%, transparent 50%)" }} />
    </div>
  );
}

export function useFlipNav(n) {
  const [index, setIndex] = useState(0);
  return { index, setIndex: (i) => setIndex(Math.max(0, Math.min(n - 1, i))) };
}
