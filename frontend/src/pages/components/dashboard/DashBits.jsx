import { useState } from "react";
import { Link } from "react-router-dom";
import { formatKg, formatNum, greenBg, greenColor } from "../../../lib/format";
import Icon from "../ui/Icon";

export const TONES = {
  green: ["#E4F1E6", "#2E7D4F"], amber: ["#FBF0D6", "#B7801A"], blue: ["#E2EEFA", "#2F78C4"],
  red: ["#FBE4E2", "#C2413C"], lime: ["#EEF6DF", "#5E9A33"], slate: ["#ECEEE8", "#55604F"],
};

export function Card({ title, sub, right, children, className = "", pad = "p-6" }) {
  return (
    <section className={`card ${pad} ${className}`}>
      {(title || right) && (
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-[20px] font-bold text-[#1E2B22] leading-snug">{title}</h3>}
            {sub && <p className="text-[15.5px] text-[#6B7468] mt-1">{sub}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function CardLink({ to, children }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-[15.5px] font-semibold text-[#2E7D4F] hover:underline whitespace-nowrap">
      {children} <Icon name="arrowRight" size={14} />
    </Link>
  );
}

export function IconTile({ icon, tone = "green", size = 44 }) {
  const [bg, fg] = TONES[tone] || TONES.green;
  return (
    <span className="grid place-items-center rounded-2xl shrink-0" style={{ width: size, height: size, background: bg, color: fg }}>
      <Icon name={icon} size={Math.round(size * 0.48)} />
    </span>
  );
}

export function StatCard({ icon, tone, label, value, unit, sub, loading }) {
  const [, fg] = TONES[tone] || TONES.green;
  return (
    <div className="card p-5 flex items-center gap-3.5">
      <IconTile icon={icon} tone={tone} size={50} />
      <div className="min-w-0">
        <p className="text-[15.5px] leading-snug text-[#55604F] font-medium">{label}</p>
        {loading ? <div className="h-7 w-20 rounded-lg bg-[#ECE8DC] animate-pulse my-1" />
            : <p className="text-[28px] leading-tight font-extrabold text-[#1E2B22]">{value}{unit && <span className="ml-1 text-base font-semibold text-[#6B7468]">{unit}</span>}</p>}
        {sub && <p className="text-[14.5px] leading-snug font-semibold mt-0.5" style={{ color: fg }}>{sub}</p>}
      </div>
    </div>
  );
}

export function Ring({ value = 0, size = 132, stroke = 12, label, sub, color = "#2E7D4F" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ECE8DC" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
                  strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: "stroke-dashoffset 1s ease" }} />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-2xl font-extrabold text-[#1E2B22]">{Math.round(v)}%</span>
      </div>
      {label && <p className="text-sm font-bold text-center">{label}</p>}
      {sub && <p className="text-xs text-[#6B7468] text-center -mt-1">{sub}</p>}
    </div>
  );
}

export function Bar({ pct, color = "#2E7D4F" }) {
  return (
    <div className="h-2 rounded-full bg-[#ECE8DC] overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: color, transition: "width .8s ease" }} />
    </div>
  );
}

export function StatusPill({ ok, labels }) {
  return ok
    ? <span className="pill bg-[#E4F1E6] text-[#2E7D4F]"><span className="w-1.5 h-1.5 rounded-full bg-[#2E7D4F]" />{labels[0]}</span>
    : <span className="pill bg-[#FBE4E2] text-[#C2413C]"><span className="w-1.5 h-1.5 rounded-full bg-[#C2413C]" />{labels[1]}</span>;
}

// Horizontal range bars on a log scale: min–max track, p25–p75 band, median tick.
export function RangeBars({ rows, label, lang }) {
  const lo = 1, hi = 10000;
  const x = (v) => `${(Math.log10(Math.max(lo, v)) / Math.log10(hi)) * 100}%`;
  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <div key={r.category} className="grid grid-cols-[120px_1fr_84px] items-center gap-3 text-[16px]">
          <span className="truncate font-semibold text-[#1E2B22]">{label(r.category)}</span>
          <div className="relative h-3 rounded-full bg-[#F1EEE4]">
            <div className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-[#CFC9B8]" style={{ left: x(r.min_kg), width: `calc(${x(r.max_kg)} - ${x(r.min_kg)})` }} />
            <div className="absolute top-0 h-3 rounded-full" style={{ left: x(r.p25), width: `calc(${x(r.p75)} - ${x(r.p25)})`, background: "linear-gradient(90deg,#9ccf7d,#2E7D4F)" }} />
            <div className="absolute -top-1 h-5 w-[3px] rounded bg-[#1E2B22]" style={{ left: x(r.median_kg) }} />
          </div>
          <span className="text-right font-bold">{formatKg(r.median_kg, lang)} kg</span>
        </div>
      ))}
      <div className="grid grid-cols-[120px_1fr_84px] gap-3 text-[13.5px] text-[#7d8579]">
        <span />
        <div className="flex justify-between"><span>1</span><span>10</span><span>100</span><span>1.000</span><span>10.000</span></div>
        <span />
      </div>
    </div>
  );
}

export function SourceStack({ rows, labels, lang }) {
  const total = rows.reduce((n, r) => n + r.n, 0) || 1;
  const colors = { manufacturer: "#1F5D3A", neighbor_average: "#4E9A5C", category_model: "#9ccf7d", lifecycle_formula: "#3B8FD9", eeio_price: "#E0A526", none: "#D9D3C2" };
  return (
    <div>
      <div className="flex h-5 rounded-full overflow-hidden">
        {rows.map((r) => <div key={r.source} title={labels[r.source] || r.source} style={{ width: `${(100 * r.n) / total}%`, background: colors[r.source] || "#bbb" }} />)}
      </div>
      <ul className="mt-4 grid sm:grid-cols-2 gap-2.5 text-[15.5px]">
        {rows.map((r) => (
          <li key={r.source} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ background: colors[r.source] || "#bbb" }} />
            <span className="flex-1">{labels[r.source] || r.source}</span>
            <b>{formatNum((100 * r.n) / total, lang, 1)}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChartTabs({ tabs, children }) {
  const [i, setI] = useState(0);
  return (
    <div>
      <div className="mb-5 inline-flex flex-wrap rounded-full bg-[#F1EEE4] p-1 text-[15.5px] font-semibold">
        {tabs.map((tab, k) => (
          <button key={tab} type="button" onClick={() => setI(k)}
                  className={`rounded-full px-4 py-2 transition ${i === k ? "bg-[#1F5D3A] text-white shadow" : "text-[#55604F] hover:text-[#1E2B22]"}`}>{tab}</button>
        ))}
      </div>
      {children[i]}
    </div>
  );
}

export function GreenCard({ product, category, lang }) {
  if (!product) return null;
  const score = product.green_score;
  return (
    <Link to={`/world/${product.product_id}`} className="group rounded-2xl border border-[#E7E2D4] bg-[#FBFAF5] p-4 hover:border-[#9ccf7d] hover:bg-white transition flex flex-col gap-2 min-w-0">
      <span className="text-[13.5px] font-bold uppercase tracking-wider text-[#6B7468]">{category}</span>
      <span className="text-[15.5px] font-semibold leading-snug line-clamp-3 min-h-[4.2em]" title={product.name}>{product.name}</span>
      <span className="text-xl font-extrabold text-[#1E2B22] mt-auto">{formatKg(product.co2e_kg, lang)} <span className="text-xs font-semibold text-[#6B7468]">kg CO₂e</span></span>
      {score !== null && score !== undefined && (
        <span className="pill self-start" style={{ color: greenColor(score), background: greenBg(score) }}>🍃 {formatNum(score, lang, 1)}/5</span>
      )}
    </Link>
  );
}

// Small illustrated preview of the CO2 world, like the field map of the template.
export function MiniWorld({ onClick, labels = ["Production", "Use", "Transport"] }) {
  return (
    <button type="button" onClick={onClick} className="relative block w-full overflow-hidden rounded-2xl text-left" aria-label="CO2 world">
      <svg viewBox="0 0 640 300" className="block w-full h-auto">
        <defs>
          <linearGradient id="mw-sea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#7cc4e8" /><stop offset="1" stopColor="#3d97c8" /></linearGradient>
          <linearGradient id="mw-land" x1="0" x2="1"><stop offset="0" stopColor="#a9d68a" /><stop offset="1" stopColor="#7cbf62" /></linearGradient>
          <pattern id="mw-wave" width="40" height="14" patternUnits="userSpaceOnUse"><path d="M0 7 Q10 1 20 7 T40 7" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="2" /></pattern>
        </defs>
        <rect width="640" height="300" fill="url(#mw-sea)" />
        <rect width="640" height="300" fill="url(#mw-wave)" />
        <path d="M0 0 H210 Q240 80 200 150 Q170 220 210 300 H0Z" fill="url(#mw-land)" />
        <path d="M470 0 H640 V300 H450 Q490 220 460 150 Q430 80 470 0Z" fill="url(#mw-land)" />
        <path d="M150 150 C260 60 390 60 500 150" fill="none" stroke="#fff" strokeWidth="4" strokeDasharray="10 12">
          <animate attributeName="stroke-dashoffset" from="0" to="-44" dur="1.4s" repeatCount="indefinite" />
        </path>
        <g transform="translate(320 92)"><path d="M-22 0 L22 0 L16 10 L-16 10Z" fill="#1E2B22" /><rect x="-12" y="-11" width="9" height="11" fill="#E0812A" /><rect x="0" y="-11" width="9" height="11" fill="#3B8FD9" />
          <animateTransform attributeName="transform" type="translate" values="230 120; 320 92; 410 120" dur="6s" repeatCount="indefinite" /></g>
        <g transform="translate(90 120)"><rect x="0" y="20" width="70" height="40" rx="4" fill="#8a9aa8" /><rect x="48" y="-8" width="10" height="30" fill="#6b7a84" />
          <circle cx="53" cy="-16" r="8" fill="#c9ced2"><animate attributeName="cy" values="-12;-34" dur="2.4s" repeatCount="indefinite" /><animate attributeName="opacity" values=".9;0" dur="2.4s" repeatCount="indefinite" /></circle></g>
        <g transform="translate(520 150)"><path d="M0 22 L34 0 L68 22Z" fill="#c0563b" /><rect x="6" y="22" width="56" height="36" fill="#fdf3e1" /><rect x="22" y="32" width="24" height="14" rx="2" fill="#1E2B22" /></g>
        {[[200, 60, 30, "#E0A526", labels[0]], [600, 95, 30, "#D9534F", labels[1]], [330, 222, 22, "#6FB04A", labels[2]]].map(([cx, cy, r, c, label]) => (
          <g key={cx}>
            <circle cx={cx} cy={cy} r={r} fill="#fff" fillOpacity=".92" stroke={c} strokeWidth="4" />
            <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={r > 25 ? 15 : 12} fontWeight="800" fill={c}>CO₂</text>
            <text x={cx} y={cy + r + 16} textAnchor="middle" fontSize="13" fontWeight="700" fill="#1E2B22" stroke="#fff" strokeWidth="3" paintOrder="stroke">{label}</text>
          </g>
        ))}
      </svg>
      <span className="absolute right-3 top-3 grid place-items-center w-9 h-9 rounded-xl bg-white/90 text-[#1F5D3A] shadow"><Icon name="arrowRight" size={18} /></span>
    </button>
  );
}
