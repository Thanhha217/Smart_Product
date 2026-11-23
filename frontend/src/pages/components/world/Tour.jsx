import { useEffect, useRef, useState } from "react";
import { formatKg, formatNum, greenColor } from "../../../lib/format";
import { ORIGINS } from "./worldModel";
import { useTween } from "./useCamera";
import { tri } from "../../../i18n/LanguageContext";

export const TOUR_STEPS = ["materials", "materials_production", "transport", "use", "end_of_life", "formula"];
const STEP_MS = 8000;
const FORMULA_MS = 14000;

export function sceneFor(stage, sc) {
  switch (stage) {
    case "materials": return "mine";
    case "materials_production": return "factory";
    case "transport": return sc.origin === "VN" ? "truck" : sc.mode === "air" ? "plane" : "ship";
    case "use": return "home";
    case "grid": return sc.grid === "solar" ? "solar" : "coal_plant";
    case "end_of_life": return "recycle";
    case "wefe": return "city_wefe";
    case "factory": return "factory";
    default: return null;
  }
}

function tourText(stage, ctx, lang) {
  const L3 = tri(lang);
  const k = (x) => formatKg(x, lang) ?? "—";
  const pct = (x) => (ctx.total ? formatNum((x / ctx.total) * 100, lang, 0) : "—");
  const s = ctx.stages;
  const origin = ORIGINS[ctx.sc.origin]?.[lang] ?? ORIGINS[ctx.sc.origin]?.en;
  const how = ctx.sc.origin === "VN" ? L3("xe tải", "truck", "camion") : ctx.sc.mode === "air" ? L3("máy bay", "plane", "avion") : L3("tàu biển", "ship", "bateau");
  const T = {
    materials: [L3("1. Đào nguyên liệu", "1. Digging up materials", "1. Extraire les matières"),
      L3("Mọi thứ bắt đầu từ mỏ. Đồng, nhôm, vàng và đất hiếm được đào lên rồi tinh chế. Phần này được tính chung với nhà máy.", "It all starts at a mine. Copper, aluminium, gold and rare earths are dug up and refined. This is counted together with the factory.", "Tout commence dans une mine. Cuivre, aluminium, or et terres rares sont extraits puis raffinés. Cette part est comptée avec l'usine."), null],
    materials_production: [L3("2. Nhà máy sản xuất", "2. The factory", "2. L'usine"),
      L3(`Ở nhà máy tại ${origin}, chip, màn hình và pin được làm ra rồi lắp ráp. Đây thường là phần thải nhiều nhất.`, `In a factory in ${origin}, chips, screens and batteries are made and assembled. This is usually the biggest part.`, `Dans une usine en ${origin}, puces, écrans et batteries sont fabriqués puis assemblés. C'est souvent la plus grosse part.`), s.materials_production],
    transport: [L3("3. Chở về Việt Nam", "3. Shipping to Vietnam", "3. Expédition vers le Vietnam"),
      L3(`Sản phẩm đi bằng ${how} về Việt Nam rồi lên xe tới cửa hàng. Tàu biển thải rất ít, máy bay thải gấp nhiều lần.`, `It travels by ${how} to Vietnam, then by truck to the shop. Ships emit little; planes many times more.`, `Il voyage en ${how} jusqu'au Vietnam, puis en camion jusqu'au magasin. Le bateau émet peu ; l'avion bien plus.`), s.transport],
    use: [L3("4. Dùng ở nhà bạn", "4. Using it at home", "4. L'utiliser chez vous"),
      L3(`Bạn dùng sản phẩm ${ctx.sc.years} năm. Điện Việt Nam còn nhiều nhiệt điện than, nên mỗi giờ cắm điện đều có CO₂.`, `You use it for ${ctx.sc.years} years. Vietnam's power still relies on coal, so every hour plugged in adds CO₂.`, `Vous l'utilisez ${ctx.sc.years} ans. L'électricité vietnamienne dépend encore du charbon : chaque heure branchée ajoute du CO₂.`), s.use],
    end_of_life: [L3("5. Thải bỏ và tái chế", "5. Disposal and recycling", "5. Fin de vie et recyclage"),
      L3("Hết dùng, sản phẩm được thu gom và tái chế. Phần này nhỏ, nhưng vứt sai chỗ sẽ làm hỏng đất và nước.", "At the end it is collected and recycled. Small, but dumping it harms soil and water.", "En fin de vie, il est collecté et recyclé. C'est peu, mais l'abandonner abîme le sol et l'eau."), s.end_of_life],
    formula: [L3("6. Cộng lại thành một con số", "6. Adding it up", "6. Tout additionner"),
      L3("Hệ thống tính con số chính thức từng bước như sau:", "The official number is computed step by step:", "Le chiffre officiel est calculé étape par étape :"), null],
  };
  const [title, text, kg] = T[stage];
  return { title, text, kg, pct: kg !== null && kg !== undefined ? pct(kg) : null };
}

function Counter({ value, lang, digits }) {
  const v = useTween(value, 900);
  return <>{digits !== undefined ? formatNum(v, lang, digits) : formatKg(v, lang)}</>;
}

export function FormulaReveal({ steps, total, greenScore, lang }) {
  const [shown, setShown] = useState(0);
  const n = steps.length + 2;
  useEffect(() => {
    setShown(0);
    const id = setInterval(() => setShown((i) => (i >= n ? i : i + 1)), 1300);
    return () => clearInterval(id);
  }, [steps, n]);
  const L3 = tri(lang);
  return (
    <div className="mt-2 space-y-1.5">
      {steps.map((s, i) => i < shown && (
        <div key={i} className="rounded-xl bg-[#16324a] text-emerald-50 px-3 py-2" style={{ animation: "wx-panel-in .4s ease-out" }}>
          <p className="text-[13.5px] text-emerald-200">{lang === "vi" ? s.label_vi : s.label_en}</p>
          <p className="font-mono text-[16px] font-semibold">{s.expr}</p>
        </div>
      ))}
      {shown > steps.length && total !== null && (
        <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-400 px-4 py-3 text-center" style={{ animation: "wx-panel-in .4s ease-out" }}>
          <p className="text-xs font-semibold text-emerald-800">{L3("Tổng cả vòng đời", "Lifecycle total", "Total du cycle de vie")}</p>
          <p className="text-4xl font-black text-[#16324a]"><Counter value={total} lang={lang} /> <span className="text-base text-gray-500">kg CO₂e</span></p>
        </div>
      )}
      {shown > steps.length + 1 && greenScore !== null && greenScore !== undefined && (
        <p className="text-center" style={{ animation: "wx-panel-in .4s ease-out" }}>
          <span className="inline-block rounded-full px-4 py-1.5 text-white font-bold" style={{ background: greenColor(greenScore) }}>
            {L3("Điểm xanh", "Green score", "Score vert")} <Counter value={greenScore} lang={lang} digits={1} />/5
          </span>
        </p>
      )}
    </div>
  );
}

/** Guided tour panel; drives the camera through onStep(stage). */
export default function Tour({ open, onClose, onStep, ctx, formula, greenScore, art, lang, startStep = 0 }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const last = useRef(0);
  const elapsedRef = useRef(0);
  const stage = TOUR_STEPS[i];
  const dur = stage === "formula" ? FORMULA_MS : STEP_MS;

  useEffect(() => { if (open) { setI(Math.max(0, Math.min(TOUR_STEPS.length - 1, startStep))); setPlaying(true); setElapsed(0); elapsedRef.current = 0; } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) { onStep(stage); setElapsed(0); elapsedRef.current = 0; } }, [open, i]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !playing) return undefined;
    last.current = performance.now();
    let raf = 0;
    let acc = elapsedRef.current;
    const tick = (now) => {
      acc += now - last.current; last.current = now;
      if (acc >= dur) {
        acc = 0;
        if (i < TOUR_STEPS.length - 1) { elapsedRef.current = 0; setElapsed(0); setI(i + 1); return; }
        elapsedRef.current = dur; setElapsed(dur); setPlaying(false); return;
      }
      elapsedRef.current = acc;
      setElapsed(acc);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, playing, dur, i]);

  if (!open) return null;
  const t = tourText(stage, ctx, lang);
  const scene = sceneFor(stage, ctx.sc);
  const img = scene && art?.[scene];
  const L3 = tri(lang);
  const progress = Math.min(1, elapsed / dur);
  return (
    <aside className="absolute z-30 bg-white shadow-2xl border border-emerald-100 flex flex-col overflow-hidden
                      inset-x-0 bottom-0 max-h-[66%] rounded-t-3xl md:inset-x-auto md:right-4 md:top-4 md:bottom-4 md:w-[400px] md:max-h-none md:rounded-3xl"
           style={{ animation: "wx-panel-in .35s cubic-bezier(.2,.8,.2,1)" }} aria-live="polite">
      <div className="flex gap-1 px-4 pt-4">
        {TOUR_STEPS.map((s, j) => (
          <button key={s} type="button" onClick={() => setI(j)} aria-label={`step ${j + 1}`} className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <span className="block h-full bg-emerald-500" style={{ width: j < i ? "100%" : j === i ? `${progress * 100}%` : "0%" }} />
          </button>
        ))}
      </div>
      <div className="overflow-y-auto px-5 pb-3 flex-1 min-h-0" key={stage}>
        {img && <img src={img} alt="" className="mt-3 w-full h-40 object-cover rounded-2xl shadow" style={{ animation: "wx-panel-in .5s ease-out" }} />}
        <h2 className="mt-3 text-xl font-extrabold text-[#16324a]" style={{ animation: "wx-panel-in .4s ease-out" }}>{t.title}</h2>
        <p className="mt-1 text-[17px] leading-relaxed text-gray-800" style={{ animation: "wx-panel-in .5s ease-out" }}>{t.text}</p>
        {t.kg !== null && t.kg !== undefined && (
          <p className="mt-3 text-4xl font-black text-emerald-700" style={{ animation: "wx-panel-in .6s ease-out" }}>
            <Counter value={t.kg} lang={lang} /> <span className="text-base font-semibold text-gray-500">kg CO₂e · {t.pct}%</span>
          </p>
        )}
        {stage === "formula" && <FormulaReveal steps={(formula?.steps || []).slice(-4)} total={ctx.officialTotal} greenScore={greenScore} lang={lang} />}
      </div>
      <div className="border-t border-gray-100 p-3 flex items-center gap-2">
        <button type="button" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="rounded-full border w-10 h-10 disabled:opacity-40" aria-label={L3("Bước trước", "Previous", "Précédent")}>◀</button>
        <button type="button" onClick={() => { if (!playing && i === TOUR_STEPS.length - 1 && elapsedRef.current >= dur) { setI(0); } setPlaying(!playing); }} className="rounded-full bg-emerald-600 text-white px-4 h-10 font-semibold">
          {playing ? L3("⏸ Tạm dừng", "⏸ Pause", "⏸ Pause") : L3("▶ Tiếp tục", "▶ Play", "▶ Lecture")}
        </button>
        <button type="button" onClick={() => setI(Math.min(TOUR_STEPS.length - 1, i + 1))} disabled={i === TOUR_STEPS.length - 1} className="rounded-full border w-10 h-10 disabled:opacity-40" aria-label={L3("Bước sau", "Next", "Suivant")}>▶</button>
        <span className="flex-1 text-right text-xs text-gray-500">{i + 1}/{TOUR_STEPS.length}</span>
        <button type="button" onClick={onClose} className="rounded-full w-10 h-10 hover:bg-gray-100 text-xl" aria-label={L3("Đóng", "Close", "Fermer")}>×</button>
      </div>
    </aside>
  );
}
