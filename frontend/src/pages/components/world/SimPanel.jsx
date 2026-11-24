import { formatKg } from "../../../lib/format";
import { useTween } from "./useCamera";

function Seg({ value, options, onChange, disabled }) {
  return (
    <div className="grid gap-1 p-1 rounded-xl bg-gray-100" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map(([v, label]) => (
        <button key={v} type="button" disabled={disabled} onClick={() => onChange(v)} aria-pressed={value === v}
                className={`rounded-lg px-2 py-1.5 text-[13.5px] font-semibold transition ${value === v ? "bg-white shadow text-emerald-800" : "text-gray-600 hover:text-gray-900"} disabled:opacity-40`}>
          {label}
        </button>
      ))}
    </div>
  );
}

export default function SimPanel({ open, onToggle, sc, setSc, base, sim, lang, T, onAsk, onReset, origins, measured = false, hideToggle = false }) {
  const total = useTween(sim?.total ?? null);
  const delta = base.total !== null && sim?.total !== undefined ? sim.total - base.total : 0;
  const changed = Math.abs(delta) > 0.05;
  return (
    <div className={`absolute z-20 left-3 w-[min(340px,calc(100%-24px))] flex flex-col-reverse items-start ${hideToggle ? "top-3" : "bottom-[72px] md:bottom-4"}`}>
      {!hideToggle && <button type="button" onClick={onToggle} aria-expanded={open}
              className="rounded-full bg-[#16324a] text-white px-4 py-2.5 text-sm font-bold shadow-lg hover:bg-[#1d4466]">{T.sim} {open ? "▾" : "▴"}</button>}
      {open && (
        <div className="mb-2 w-full rounded-3xl bg-white shadow-2xl border border-emerald-100 p-4 space-y-3 max-h-[62vh] overflow-y-auto"
             data-explain="what_if" style={{ animation: "wx-sim-in .3s ease-out" }}>
          <style>{`@keyframes wx-sim-in{from{transform:translateY(16px)}to{transform:none}}`}</style>
          <p className="font-extrabold text-[#16324a]">{T.simTitle}</p>
          {!base.ok ? <p className="text-sm text-gray-600">{T.noSplit}</p> : <>
            <label className="block text-xs font-semibold text-gray-500">{T.origin}
              <Seg value={sc.origin} onChange={(v) => setSc({ ...sc, origin: v })} options={["CN", "VN", "TH"].map((o) => [o, (origins[o][lang] ?? origins[o].en)])} />
            </label>
            <label className="block text-xs font-semibold text-gray-500">{T.mode}
              <Seg value={sc.origin === "VN" ? "sea" : sc.mode} disabled={sc.origin === "VN"} onChange={(v) => setSc({ ...sc, mode: v })} options={[["sea", T.ship], ["air", T.plane]]} />
              {sc.origin === "VN" && <span className="block mt-1 font-normal text-gray-400">{T.planeLocal}</span>}
            </label>
            <label className="block text-xs font-semibold text-gray-500">{T.grid}
              <Seg value={sc.grid} onChange={(v) => setSc({ ...sc, grid: v })} options={[["vn", `⚡ ${T.gridVn}`], ["solar", `☀️ ${T.gridSolar}`]]} />
              {sc.grid === "solar" && <span className="block mt-1 font-normal text-gray-400">{T.gridNote}</span>}
            </label>
            <label className="block text-xs font-semibold text-gray-500">{T.years}: <b className="text-gray-800">{T.yearsN(sc.years)}</b>
              <input type="range" min="1" max="12" step="1" value={sc.years} onChange={(e) => setSc({ ...sc, years: Number(e.target.value) })} className="w-full accent-emerald-600" />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={sc.refurbished} onChange={(e) => setSc({ ...sc, refurbished: e.target.checked })} className="w-4 h-4 accent-emerald-600" />{T.refurb}
            </label>
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3">
              <p className="text-xs text-emerald-800 font-semibold">{T.scenarioTotal}</p>
              <p className="text-3xl font-black text-[#16324a]">{formatKg(total, lang)} <span className="text-base font-semibold text-gray-500">kg CO₂e</span></p>
              {changed && (
                <p className={`text-sm font-bold ${delta < 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {delta < 0 ? "−" : "+"}{formatKg(Math.abs(delta), lang)} kg ({delta < 0 ? "−" : "+"}{formatKg((Math.abs(delta) / base.total) * 100, lang)}%)
                </p>
              )}
              <p className="text-[13.5px] text-gray-500 mt-1">{T.scenarioNote(formatKg(base.total, lang))}</p>
              {!measured && <p className="text-[12.5px] text-amber-700 mt-1">⚠ {T.simOnShares}</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onReset} disabled={!changed} className="flex-1 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-40">{T.reset}</button>
              <button type="button" onClick={onAsk} className="flex-1 rounded-xl bg-emerald-600 text-white px-3 py-2 text-sm font-semibold">{T.askScenario}</button>
            </div>
          </>}
        </div>
      )}
    </div>
  );
}
