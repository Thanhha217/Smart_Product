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

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

const TURN_CSS = `
@keyframes sb-turn-next { from { transform: rotateY(0deg) } to { transform: rotateY(-180deg) } }
@keyframes sb-turn-prev { from { transform: rotateY(0deg) } to { transform: rotateY(180deg) } }
@keyframes sb-turn-in { from { transform: rotateY(-180deg) } to { transform: rotateY(0deg) } }
@keyframes sb-shade { 0% { opacity: 0 } 50% { opacity: .55 } 100% { opacity: 0 } }
.sb-face { position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden; }
.sb-shade { position:absolute; inset:0; pointer-events:none; animation: sb-shade ${TURN_MS}ms ease-in-out forwards; }
`;

/**
 * A book with real page turns. `index` is the page to show (0-based); on wide screens the
 * book shows the spread that contains it. Whatever changes `index` — the corner buttons, the
 * arrows, the page dots, autoplay or a link inside a page — the page is turned, not swapped.
 */
export default function Flipbook({ pages, index, onIndex, height: fixedHeight }) {
  const wide = useWide();
  const reduced = useReducedMotion();
  const auto = useBookHeight(wide);
  const height = fixedHeight || auto;
  const n = pages.length;
  const target = wide ? index - (index % 2) : index;
  const [shown, setShown] = useState(target);   // left page of the spread on screen (or the single page)
  const [turn, setTurn] = useState(null);       // {dir: "next"|"prev", from, to}
  const timer = useRef(null);
  const touch = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);
  // switching between one page and two: show the right spread at once, no turn
  useEffect(() => { clearTimeout(timer.current); setTurn(null); setShown(target); }, [wide]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (turn || target === shown) return;
    if (reduced || target < 0 || target > n - 1) { setShown(Math.max(0, Math.min(n - 1, target))); return; }
    setTurn({ dir: target > shown ? "next" : "prev", from: shown, to: target });
    timer.current = setTimeout(() => { setShown(target); setTurn(null); }, TURN_MS);
  }, [target, shown, turn, reduced, n]);

  const go = useCallback((dir) => {
    if (turn) return;
    const step = wide ? 2 : 1;
    const next = dir === "next" ? shown + step : shown - step;
    if (next < 0 || next > n - 1) return;
    onIndex(next);
  }, [turn, wide, shown, n, onIndex]);

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
  const ease = "cubic-bezier(.45,.05,.35,1)";

  if (!wide) {
    // one page: turning forward lifts the current page off to the left; turning back lays the earlier page down over it
    const under = turn ? (turn.dir === "next" ? turn.to : turn.from) : shown;
    const leaf = turn ? (turn.dir === "next" ? turn.from : turn.to) : null;
    return (
      <div {...touchHandlers}>
        <style>{PAPER_CSS}</style>
        <style>{TURN_CSS}</style>
        <div className="rounded-2xl bg-gradient-to-br from-[#2E6B47] to-[#1B4D31] p-2 shadow-2xl">
          <div className="relative rounded-lg" style={{ perspective: 1600 }}>
            <div className="flex rounded-lg" style={{ minHeight: Math.min(height, 620) }}>{page(under, "single")}</div>
            {turn && (
              <div className="absolute inset-0 overflow-hidden rounded-lg" aria-hidden="true" style={{
                transformOrigin: "left center", transformStyle: "preserve-3d", zIndex: 5,
                boxShadow: "8px 0 24px rgba(30,25,10,.25)",
                animation: `${turn.dir === "next" ? "sb-turn-next" : "sb-turn-in"} ${TURN_MS}ms ${ease} forwards`,
              }}>
                <div className="sb-face overflow-hidden">{page(leaf, "single")}</div>
                <div className="sb-shade" style={{ background: "linear-gradient(90deg, rgba(60,45,20,.0), rgba(60,45,20,.35))" }} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const leftUnder = turn ? (turn.dir === "next" ? turn.from : turn.to) : shown;
  const rightUnder = turn ? (turn.dir === "next" ? turn.to + 1 : turn.from + 1) : shown + 1;
  return (
    <div {...touchHandlers} className="relative mx-auto rounded-[20px] bg-gradient-to-br from-[#2E6B47] to-[#1B4D31] p-2.5 shadow-[0_30px_60px_-24px_rgba(20,40,28,.6)]"
         style={{ height: height + 20 }}>
      <style>{PAPER_CSS}</style>
      <style>{TURN_CSS}</style>
      <div className="relative h-full" style={{ perspective: 2400 }}>
      <div className="absolute inset-0 flex rounded-lg" style={{ background: "#e9e2d0" }}>
        <div className="w-1/2 h-full">{page(leftUnder, "left")}</div>
        <div className="w-1/2 h-full">{page(rightUnder, "right")}</div>
        <div className="absolute top-0 bottom-0 left-1/2 w-[3px] -ml-[1.5px] bg-gradient-to-b from-black/5 via-black/15 to-black/5 pointer-events-none" />
      </div>
      {turn && (
        <div className="absolute top-0 h-full w-1/2" aria-hidden="true" style={{
          left: turn.dir === "next" ? "50%" : 0, transformStyle: "preserve-3d",
          transformOrigin: turn.dir === "next" ? "left center" : "right center",
          animation: `sb-turn-${turn.dir} ${TURN_MS}ms ${ease} forwards`, zIndex: 5,
        }}>
          <div className="sb-face">{page(turn.dir === "next" ? turn.from + 1 : turn.from, turn.dir === "next" ? "right" : "left")}</div>
          <div className="sb-face" style={{ transform: "rotateY(180deg)" }}>{page(turn.dir === "next" ? turn.to : turn.to + 1, turn.dir === "next" ? "left" : "right")}</div>
          <div className="sb-shade" style={{ background: `linear-gradient(${turn.dir === "next" ? 90 : 270}deg, rgba(60,45,20,.28), rgba(60,45,20,0) 60%)` }} />
        </div>
      )}
      <button type="button" aria-label="previous page" onClick={() => go("prev")} disabled={shown === 0}
              className="absolute left-0 bottom-0 w-12 h-12 z-10 rounded-bl-lg disabled:opacity-0 hover:brightness-95"
              style={{ background: "linear-gradient(45deg, #e6dcc4 50%, transparent 50%)" }} />
      <button type="button" aria-label="next page" onClick={() => go("next")} disabled={shown + 2 > n - 1}
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
