// One walk-in scene: full-bleed animated art + an info card with the real numbers, plain
// explanations, the sub-places you can dive into, controls that move the world, and "ask AI".
import { formatKg, formatNum, greenColor } from "../../../../lib/format";
import { txt as storyTxt } from "../../story/storyText";
import { FormulaReveal } from "../Tour";
import { GRIDS, ORIGINS, simulate } from "../worldModel";
import SceneArt from "./SceneArt";
import { HOTSPOTS, STAGE_OF, TOPIC_OF_SCENE, topOf } from "./sceneGraph";

// sky -> ground colours of each scene, so the space around the fitted drawing blends in
const BG = {
  materials: "linear-gradient(180deg,#d8efff 0%,#fbf6ea 45%,#cdb68f 46%,#cdb68f 100%)",
  production: "linear-gradient(180deg,#dfe7ec 0%,#eef3f6 50%,#d5dde2 51%)",
  transport: "linear-gradient(180deg,#bfe6fb 0%,#e9f7ff 45%,#5fb5e3 55%,#2b7fb8 100%)",
  use: "linear-gradient(180deg,#fbf3e4 0%,#fbf3e4 60%,#d9b88f 61%)",
  end_of_life: "linear-gradient(180deg,#dde8d9 0%,#eef4ec 50%,#c9d3c4 51%)",
};

const IPCC = [["coal", 820], ["gas", 490], ["hydro", 24], ["solar", 48], ["wind", 11]];   // g CO2e/kWh, IPCC AR5 medians

function Ring({ pct, kg, lang, color = "#2E7D4F" }) {
  const r = 46, c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct || 0));
  return (
    <div className="relative w-[112px] h-[112px] shrink-0">
      <svg viewBox="0 0 112 112" className="w-full h-full -rotate-90">
        <circle cx="56" cy="56" r={r} fill="none" stroke="#e7efe9" strokeWidth="12" />
        <circle cx="56" cy="56" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
                strokeDasharray={`${(p / 100) * c} ${c}`} style={{ transition: "stroke-dasharray .8s ease" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-tight">
        <div><p className="text-[22px] font-black text-[#16324a]">{formatNum(p, lang, 0)}%</p>
          <p className="text-[12px] text-gray-500">{formatKg(kg, lang) ?? "—"} kg</p></div>
      </div>
    </div>
  );
}

function Seg({ value, options, onChange, disabled }) {
  return (
    <div className={`inline-flex rounded-full bg-emerald-50 p-1 border border-emerald-100 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={value === v}
                className={`rounded-full px-4 py-2 text-[15px] font-semibold transition ${value === v ? "bg-[#1F5D3A] text-white shadow" : "text-[#1F5D3A] hover:bg-white"}`}>{label}</button>
      ))}
    </div>
  );
}

function Controls({ sceneKey, sc, setSc, base, S, lang }) {
  const top = topOf(sceneKey);
  const local = sc.origin === "VN";
  if (sceneKey === "transport/mode") {
    return <Seg value={local ? "sea" : sc.mode} disabled={local} onChange={(mode) => setSc({ ...sc, mode })} options={[["sea", S.mode.sea], ["air", S.mode.air]]} />;
  }
  if (sceneKey === "transport/route" || sceneKey === "transport") {
    return <Seg value={sc.origin} onChange={(origin) => setSc({ ...sc, origin })} options={["CN", "VN", "TH"].map((o) => [o, ORIGINS[o][lang === "vi" ? "vi" : "en"]])} />;
  }
  if (sceneKey === "use/grid" || sceneKey === "use") {
    return <Seg value={sc.grid} onChange={(grid) => setSc({ ...sc, grid })} options={[["vn", S.grid.vn], ["solar", S.grid.solar]]} />;
  }
  if (sceneKey === "use/years") {
    return (
      <label className="block">
        <span className="text-[15px] font-semibold text-[#16324a]">{S.years(sc.years)}</span>
        <input type="range" min="1" max="12" value={sc.years} onChange={(e) => setSc({ ...sc, years: Number(e.target.value) })}
               className="w-full accent-[#2E7D4F] mt-1" aria-label={S.names["use/years"]} />
      </label>
    );
  }
  if (top === "production" || top === "materials") {
    return <Seg value={sc.refurbished ? "r" : "n"} onChange={(v) => setSc({ ...sc, refurbished: v === "r" })} options={[["n", S.newDevice], ["r", S.refurb]]} />;
  }
  return base ? null : null;
}

function GridBars({ S, lang }) {
  const max = 820;
  return (
    <div className="mt-2 space-y-1.5">
      {[["vn", GRIDS.vn * 1000], ...IPCC].map(([k, g]) => (
        <div key={k} className="flex items-center gap-2 text-[14px]">
          <span className={`w-24 shrink-0 ${k === "vn" ? "font-bold text-[#16324a]" : "text-gray-600"}`}>{k === "vn" ? S.grid.vn : S.sources[k]}</span>
          <span className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
            <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (g / max) * 100)}%`, background: k === "vn" ? "#D9534F" : g > 300 ? "#E0A526" : "#2E7D4F", transition: "width .8s" }} />
          </span>
          <span className="w-12 text-right font-semibold">{formatNum(g, lang, 0)}</span>
        </div>
      ))}
    </div>
  );
}

function CategoryPanel({ d, lang, S, onOpenProduct }) {
  const st = d.stats;
  const p = d.product;
  const seen = new Set();
  const items = [p, ...(d.related?.items || []), d.related?.greener_alternative]
    .filter((c) => c && c.co2e_kg !== null && c.co2e_kg !== undefined && !seen.has(String(c.product_id)) && seen.add(String(c.product_id)))
    .sort((a, b) => a.co2e_kg - b.co2e_kg).slice(0, 7);
  const max = Math.max(1, ...items.map((c) => c.co2e_kg));
  const pos = (v) => (st && st.max > st.min ? Math.max(0, Math.min(100, ((v - st.min) / (st.max - st.min)) * 100)) : 50);
  return (
    <div className="absolute inset-0 overflow-y-auto px-4 md:px-10 pt-24 pb-[46vh] md:pb-10 md:pl-[500px]" style={{ background: "linear-gradient(135deg,#eef7f0,#fbf6ea)" }}>
      {st && st.min !== null && (
        <div className="rounded-3xl bg-white shadow-lg p-5 mb-5">
          <div className="relative h-5 rounded-full" style={{ background: "linear-gradient(90deg,#2e9e5b,#e0a526,#d64545)" }}>
            <div className="absolute top-0 h-5 bg-white/30 border-x-2 border-white" style={{ left: `${pos(st.p25)}%`, width: `${pos(st.p75) - pos(st.p25)}%` }} />
            <div className="absolute -top-1 h-7 w-1 rounded bg-[#16324a]" style={{ left: `${pos(st.median_kg)}%` }} />
            <div className="absolute -top-4 -ml-3 text-2xl" style={{ left: `${pos(p.co2e_kg)}%` }} aria-label={S.you}>📍</div>
          </div>
          <div className="flex justify-between text-[13px] text-gray-500 mt-2"><span>{formatKg(st.min, lang)} kg</span><span>{formatKg(st.median_kg, lang)} kg</span><span>{formatKg(st.max, lang)} kg</span></div>
        </div>
      )}
      <div className="grid gap-3">
        {items.map((c) => {
          const self = String(c.product_id) === String(p.product_id);
          return (
            <button key={c.product_id} type="button" disabled={self} onClick={(e) => onOpenProduct(c.product_id, e.currentTarget.getBoundingClientRect())}
                    className={`text-left rounded-2xl p-4 bg-white shadow transition ${self ? "ring-2 ring-amber-400" : "hover:shadow-xl hover:-translate-y-0.5"}`}>
              <p className="text-[16px] font-semibold text-[#16324a] line-clamp-1">{self ? "📍 " : ""}{c.name}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="h-3 rounded-full" style={{ width: `${Math.max(4, (c.co2e_kg / max) * 70)}%`, background: greenColor(c.green_score), transition: "width .8s" }} />
                <span className="text-[15px] font-bold">{formatKg(c.co2e_kg, lang)} kg</span>
              </div>
              {!self && <p className="mt-1 text-[14px] text-emerald-700 font-semibold">{S.openWorld}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SceneView({ sceneKey, d, base, sim, sc, setSc, lang, S, art, onDive, onAsk, onOpenProduct }) {
  const top = topOf(sceneKey);
  const stageKey = STAGE_OF[top];
  const stages = sim?.stages || {};
  const total = sim?.total || d.product.co2e_kg || 0;
  const kg = stageKey ? stages[stageKey] : null;
  const pct = kg !== null && kg !== undefined && total ? (kg / total) * 100 : null;
  const k = (x) => formatKg(x, lang) ?? "—";
  const local = sc.origin === "VN";
  const o = ORIGINS[sc.origin] || ORIGINS.CN;
  const c = {
    kg: k(kg), pct: formatNum(pct, lang, 0), prodKg: k(stages.materials_production), origin: o[lang === "vi" ? "vi" : "en"],
    sea: formatNum(o.sea, lang, 0), road: formatNum(o.road, lang, 0), local, years: sc.years,
    kwh: formatNum(stages.use ? stages.use / GRIDS[sc.grid] : null, lang, 0), ef: formatNum(GRIDS.vn, lang, 3),
    shipKg: base?.ok ? k(simulate(base, { ...sc, mode: "sea" }).stages.transport) : "—",
    planeKg: base?.ok ? k(simulate(base, { ...sc, mode: "air" }).stages.transport) : "—",
    solarUseKg: base?.ok ? k(simulate(base, { ...sc, grid: "solar" }).stages.use) : "—",
    vnUseKg: base?.ok ? k(simulate(base, { ...sc, grid: "vn" }).stages.use) : "—",
    n: d.stats?.n ? formatNum(d.stats.n, lang, 0) : null, median: k(d.stats?.median_kg), greener: formatNum(d.stats?.greener_than_pct, lang, 0),
  };
  const lines = (S.body[sceneKey] || S.body[top] || (() => []))(c);
  const kids = sceneKey.includes("/") ? [] : (HOTSPOTS[top] || []);
  const painting = { materials: "mine", production: "factory", transport: sc.mode === "air" && !local ? "plane" : "ship", use: sc.grid === "solar" ? "solar" : "home", end_of_life: "recycle" }[top];
  const artData = { category: d.product.category, mode: sc.mode, local, originLabel: c.origin, solar: sc.grid === "solar", meter: c.kwh };
  const stageColor = { materials_production: "#2E7D4F", transport: "#3B8FD9", use: "#E0812A", end_of_life: "#7AA725" }[stageKey] || "#2E7D4F";
  const st = storyTxt(lang);
  const chainIdx = { manufacturer: 0, neighbor_average: 1, llm_estimate: 1, lifecycle_formula: 2, category_model: 2, eeio_price: 2 }[d.formula?.method] ?? 3;

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: "#f6f1e6" }}>
      {/* art (with a parallax hook for slides and drags): its own region beside / above the card */}
      <div data-parallax className={`absolute will-change-transform ${top === "formula" || top === "category" ? "inset-0" : "left-0 right-0 top-14 bottom-[46%] md:bottom-0 md:left-[470px] md:top-14"}`}
           style={{ background: BG[top] }}>
        {top === "formula" ? (
          <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 70% 30%, #23463a, #16324a 70%)" }}>
            <div className="absolute right-[4%] top-[12%] w-[46%] hidden md:block text-emerald-100/15 font-mono text-[64px] leading-tight select-none" aria-hidden>
              CO₂ = Σ … × ( ÷ )^b
            </div>
          </div>
        ) : top === "category" ? (
          <CategoryPanel d={d} lang={lang} S={S} onOpenProduct={onOpenProduct} />
        ) : (
          <SceneArt sceneKey={sceneKey} labels={S.names} onDive={onDive} data={artData} painting={painting ? art?.[painting] : null} />
        )}
      </div>

      {/* info card: left on desktop, bottom sheet on phones */}
      <section data-card className="absolute z-10 left-3 right-3 bottom-3 max-h-[46%] md:max-h-none md:right-auto md:left-6 md:top-24 md:bottom-6 md:w-[440px]
                                    overflow-y-auto rounded-3xl bg-white/95 backdrop-blur shadow-2xl border border-white p-5 md:p-6">
        <p className="text-[12px] uppercase tracking-[.18em] font-bold text-emerald-700">{S.names[top]}</p>
        <h2 className="font-serif text-[26px] md:text-[32px] leading-tight font-bold text-[#16324a]">{S.names[sceneKey]}</h2>
        {stageKey && (
          <div className="mt-3 flex items-center gap-4" data-explain={TOPIC_OF_SCENE[top]}>
            <Ring pct={pct} kg={kg} lang={lang} color={stageColor} />
            <div>
              <p className="text-[30px] font-black text-[#16324a] leading-none">{c.kg} <span className="text-[15px] font-semibold text-gray-500">kg CO₂e</span></p>
              <p className="text-[14px] text-gray-600 mt-1">{top === "materials" ? S.inProduction : `${c.pct}% ${S.ofTotal}`}</p>
              {d.lifecycle?.basis === "typical_share" && <p className="text-[12px] text-amber-700 mt-1">⚠ {S.assumedSplit}</p>}
            </div>
          </div>
        )}
        <div className="mt-3 space-y-2">
          {lines.map((line) => <p key={line} className="text-[16px] leading-relaxed text-gray-800">{line}</p>)}
        </div>
        {sceneKey === "use/grid" && <GridBars S={S} lang={lang} />}
        {top === "formula" && (
          <div className="mt-3">
            <ol className="space-y-1">
              {st.chain.map((label, i) => (
                <li key={label} className={`rounded-xl px-3 py-2 text-[15px] ${i === chainIdx ? "bg-emerald-600 text-white font-bold" : i < chainIdx ? "bg-gray-100 text-gray-400 line-through" : "bg-gray-50 text-gray-500"}`}>{i + 1}. {label}{i === chainIdx ? " ✓" : ""}</li>
              ))}
            </ol>
            <FormulaReveal steps={(d.formula?.steps || []).slice(-4)} total={d.product.co2e_kg} greenScore={d.product.green_score} lang={lang} />
          </div>
        )}
        <div className="mt-4"><Controls sceneKey={sceneKey} sc={sc} setSc={setSc} base={base} S={S} lang={lang} /></div>
        {kids.length > 0 && (
          <div className="mt-4">
            <p className="text-[13px] font-semibold text-gray-500 mb-2">👆 {S.dive}</p>
            <div className="flex flex-wrap gap-2">
              {kids.map((h) => (
                <button key={h.key} type="button" onClick={(e) => onDive(h.key, e.currentTarget.getBoundingClientRect())}
                        className="rounded-full border-2 border-emerald-200 bg-emerald-50 px-4 py-2 text-[15px] font-semibold text-[#1F5D3A] hover:bg-emerald-100 transition">
                  {S.names[h.key]} →
                </button>
              ))}
            </div>
          </div>
        )}
        <button type="button" onClick={() => onAsk(TOPIC_OF_SCENE[sceneKey] || TOPIC_OF_SCENE[top])}
                className="mt-4 w-full rounded-2xl bg-gradient-to-r from-[#1F5D3A] to-[#2E7D4F] text-white text-[16px] font-bold py-3 shadow hover:shadow-lg transition">
          {S.askHere}
        </button>
      </section>
    </div>
  );
}
