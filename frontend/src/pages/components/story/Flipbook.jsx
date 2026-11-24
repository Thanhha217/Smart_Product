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

/** Book height that fits the screen under the top bar and above the controls (and the phone tab bar). */
function useBookHeight(wide) {
  const calc = () => {
    if (typeof window === "undefined") return 640;
    const room = window.innerHeight - (wide ? 190 : 250);
    return Math.max(wide ? 520 : 480, Math.min(wide ? 760 : 820, room));
  };
  const [h, setH] = useState(calc);
  useEffect(() => {
    const on = () => setH(calc());
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [wide]); // eslint-disable-line react-hooks/exhaustive-deps
  return h;
}

// Pictures get a ceiling so a page's words never fall off its edge; spacing is shared by all pages.
const PAPER_CSS = `
.sb-paper svg[role="img"], .sb-paper svg[role="group"] { width: 100%; height: auto; max-height: clamp(130px, 27vh, 210px); display: block; margin-inline: auto; }
.sb-paper h2, .sb-paper h1 { text-wrap: balance; }
.sb-paper p, .sb-paper li { text-wrap: pretty; }
.sb-paper ::-webkit-scrollbar { width: 6px; } .sb-paper ::-webkit-scrollbar-thumb { background: #d9d2bf; border-radius: 3px; }
`;

function Paper({ children, side, number }) {
  return (
    <div data-book-page className={`sb-paper relative w-full ${side === "single" ? "min-h-full" : "h-full overflow-hidden"} ${side === "left" ? "rounded-l-lg" : side === "right" ? "rounded-r-lg" : "rounded-lg"}`}
         style={{
           background: "linear-gradient(180deg,#fffdf8,#fbf6ea)",
           boxShadow: side === "left" ? "inset -22px 0 26px -20px rgba(60,45,20,.28)" : side === "right" ? "inset 22px 0 26px -20px rgba(60,45,20,.28)" : "none",
         }}>
      {/* bottom padding leaves room for the page number and the corner turn buttons */}
      <div className={`${side === "single" ? "" : "h-full overflow-y-auto"} px-5 pt-5 pb-14 sm:px-7 md:px-8 md:pt-6`}>{children}</div>
      {number !== undefined && (
        <span className="absolute bottom-3 rounded-full bg-[#F1EADB] px-2 text-[12.5px] font-semibold text-[#8b7f66] select-none"
              style={{ [side === "left" ? "left" : "right"]: side === "single" ? undefined : 64, ...(side === "single" ? { left: "50%", transform: "translateX(-50%)" } : {}) }}>
          {number}
        </span>
      )}
    </div>
  );
}

/**
 * A book with real page turns. `index` is the page to show (0-based); on wide screens the
 * book shows the spread that contains it. Pages are plain React nodes.
 */
export default function Flipbook({ pages, index, onIndex, height: fixedHeight }) {
  const wide = useWide();
  const auto = useBookHeight(wide);
  const height = fixedHeight || auto;
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
        <style>{PAPER_CSS}</style>
        <div className="rounded-2xl bg-gradient-to-br from-[#2E6B47] to-[#1B4D31] p-2 shadow-2xl">
          <div key={index} className="rounded-lg flex" style={{ minHeight: Math.min(height, 620), animation: "sb-in .35s ease-out", perspective: 1200 }}>
            {page(index, "single")}
          </div>
        </div>
      </div>
    );
  }

  const L = turn ? turn.from : left;
  const leftUnder = turn?.dir === "prev" ? L - 2 : L;
  const rightUnder = turn?.dir === "next" ? L + 3 : L + 1;
  return (
    <div {...touchHandlers} className="relative mx-auto rounded-[20px] bg-gradient-to-br from-[#2E6B47] to-[#1B4D31] p-2.5 shadow-[0_30px_60px_-24px_rgba(20,40,28,.6)]"
         style={{ height: height + 20 }}>
      <style>{PAPER_CSS}</style>
      <div className="relative h-full" style={{ perspective: 2400 }}>
      <style>{`
        @keyframes sb-turn-next { from { transform: rotateY(0deg) } to { transform: rotateY(-180deg) } }
        @keyframes sb-turn-prev { from { transform: rotateY(0deg) } to { transform: rotateY(180deg) } }
        .sb-face { position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden; }
      `}</style>
      <div className="absolute inset-0 flex rounded-lg" style={{ background: "#e9e2d0" }}>
        <div className="w-1/2 h-full">{page(leftUnder, "left")}</div>
        <div className="w-1/2 h-full">{page(rightUnder, "right")}</div>
        <div className="absolute top-0 bottom-0 left-1/2 w-[3px] -ml-[1.5px] bg-gradient-to-b from-black/5 via-black/15 to-black/5 pointer-events-none" />
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
              className="absolute left-0 bottom-0 w-12 h-12 z-10 rounded-bl-lg disabled:opacity-0 hover:brightness-95"
              style={{ background: "linear-gradient(45deg, #e6dcc4 50%, transparent 50%)" }} />
      <button type="button" aria-label="next page" onClick={() => go("next")} disabled={left + 2 > n - 1}
              className="absolute right-0 bottom-0 w-12 h-12 z-10 rounded-br-lg disabled:opacity-0 hover:brightness-95"
              style={{ background: "linear-gradient(-45deg, #e6dcc4 50%, transparent 50%)" }} />
      </div>
    </div>
  );
}

export function useFlipNav(n) {
  const [index, setIndex] = useState(0);
  return { index, setIndex: (i) => setIndex(Math.max(0, Math.min(n - 1, i))) };
}
