import { intlNumber } from "../../../lib/format";
import { memo } from "react";
import { LOCALES } from "../../../i18n/LanguageContext";

export const WORLD_W = 2400;
export const WORLD_H = 1400;

// Camera targets for each stage (centre + visible width), per route variant.
export function stageTarget(stage, sc) {
  const local = sc?.origin === "VN";
  switch (stage) {
    case "materials": return { cx: 270, cy: 660, w: 820 };
    case "materials_production": return { cx: 440, cy: 700, w: 1050 };
    case "transport":
      if (local) return { cx: 1180, cy: 1040, w: 1800 };
      return sc?.mode === "air" ? { cx: 1190, cy: 560, w: 1500 } : { cx: 1200, cy: 720, w: 1350 };
    case "use": return { cx: 2010, cy: 960, w: 1050 };
    case "end_of_life": return { cx: 1300, cy: 1180, w: 1000 };
    default: return null;
  }
}

const SEA_ROUTE = "M720 800 Q1170 560 1650 800";
const AIR_ROUTE = "M690 740 Q1180 230 1690 760";
const VN_PORT_ROAD = "M1770 830 C1830 860 1850 930 1900 975";
const LOCAL_ROAD = "M470 720 L470 1060 Q470 1100 520 1100 L1760 1100 Q1880 1100 1900 1060";
const TO_RECYCLE = "M1850 1060 Q1660 1215 1335 1222";
// back to the start: recovered materials feed new products (closes the loop)
const BACK_TO_MINE = "M1075 1236 C700 1300 250 1230 232 800";

function flowPath(sc) {
  const start = "M220 700 L455 650 L470 720";
  const back = " L1850 1060 Q1660 1215 1335 1222 L1075 1236 C700 1300 250 1230 232 800 L220 700";
  if (sc.origin === "VN") return `${start} L470 1060 Q470 1100 520 1100 L1760 1100 Q1880 1100 1900 1060${back}`;
  const middle = sc.mode === "air" ? " L690 740 Q1180 230 1690 760" : " L720 800 Q1170 560 1650 800";
  return `${start}${middle} L1770 830 C1830 860 1850 930 1900 975${back}`;
}

// Where a painted scene (frontend/public/illustrations/manifest.json) is placed: x, y, w, h.
export const ART_SLOTS = {
  mine: [40, 540, 360, 250], factory: [380, 430, 320, 290], port_origin: [600, 690, 230, 160],
  ship: [930, 560, 480, 300], plane: [930, 250, 480, 300], port_vn: [1630, 680, 230, 160],
  truck: [1700, 840, 170, 120], home: [1780, 800, 270, 270], coal_plant: [2120, 960, 270, 280],
  solar: [2120, 960, 270, 280], recycle: [1050, 1110, 300, 210], city_wefe: [1980, 440, 410, 330],
};

/** One painted vignette: rounded, shadowed, with a white frame. */
function ArtCard({ name, url, topic, opacity = 1 }) {
  const [x, y, w, h] = ART_SLOTS[name];
  const id = `wx-clip-${name}`;
  return (
    <g data-explain={topic} className="wx-fade" style={{ opacity }}>
      <clipPath id={id}><rect x={x} y={y} width={w} height={h} rx="26" /></clipPath>
      <rect x={x} y={y} width={w} height={h} rx="26" fill="#fff" filter="url(#wx-shadow)" />
      <image href={url} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`} />
      <rect x={x} y={y} width={w} height={h} rx="26" fill="none" stroke="#fff" strokeWidth="6" />
    </g>
  );
}

/** Vector art unless a painted scene exists for it. */
function Art({ art, name, topic, children, opacity = 1 }) {
  return art?.[name] ? <ArtCard name={name} url={art[name]} topic={topic} opacity={opacity} /> : children;
}

// The leg of the flow highlighted during the guided tour.
export function legPath(stage, sc) {
  switch (stage) {
    case "materials": return "M220 700 L455 650";
    case "materials_production": return "M455 650 L470 720 L720 800";
    case "transport": return sc.origin === "VN" ? LOCAL_ROAD : sc.mode === "air" ? AIR_ROUTE : SEA_ROUTE;
    case "use": return "M1770 830 C1830 860 1850 930 1900 975 M2160 1110 Q2090 1070 2005 1035";
    case "end_of_life": return `${TO_RECYCLE} M1075 1236 C700 1300 250 1230 232 800`;
    default: return null;
  }
}

const STYLE = `
.wx [data-explain]{cursor:pointer;transition:filter .2s}
.wx [data-explain]:hover{filter:drop-shadow(0 0 14px rgba(255,214,90,.95))}
.wx.ask [data-explain]{cursor:help}
@keyframes wx-spin{to{transform:rotate(360deg)}}
@keyframes wx-spin-r{to{transform:rotate(-360deg)}}
@keyframes wx-smoke{0%{transform:translate(0,0) scale(.5);opacity:.85}100%{transform:translate(30px,-140px) scale(2.2);opacity:0}}
@keyframes wx-wave{from{transform:translateX(0)}to{transform:translateX(-160px)}}
@keyframes wx-cloud{from{transform:translateX(-300px)}to{transform:translateX(2700px)}}
@keyframes wx-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
@keyframes wx-path{from{offset-distance:0%}to{offset-distance:100%}}
@keyframes wx-pulse{0%,100%{opacity:.25;transform:scale(.92)}50%{opacity:.8;transform:scale(1.06)}}
@keyframes wx-blink{0%,100%{opacity:.95}50%{opacity:.35}}
@keyframes wx-dash{to{stroke-dashoffset:-60}}
.wx-spin{animation:wx-spin 6s linear infinite;transform-box:fill-box;transform-origin:center}
.wx-spin-fast{animation:wx-spin 2.4s linear infinite;transform-box:fill-box;transform-origin:center}
.wx-spin-r{animation:wx-spin-r 6s linear infinite;transform-box:fill-box;transform-origin:center}
.wx-smoke{animation:wx-smoke 4.5s ease-out infinite;transform-box:fill-box;transform-origin:center}
.wx-wave{animation:wx-wave 6s linear infinite}
.wx-cloud{animation:wx-cloud 90s linear infinite}
.wx-bob{animation:wx-bob 4s ease-in-out infinite;transform-box:fill-box}
.wx-pulse{animation:wx-pulse 1.8s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.wx-blink{animation:wx-blink 3s ease-in-out infinite}
.wx-dash{stroke-dasharray:18 24;animation:wx-dash 1.4s linear infinite}
.wx-fade{transition:opacity .8s ease}
@media (prefers-reduced-motion: reduce){.wx *{animation:none!important}}
`;

const Defs = memo(function Defs() {
  return (
    <defs>
      <linearGradient id="wx-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9fd8ff" /><stop offset="1" stopColor="#eaf7ff" /></linearGradient>
      <linearGradient id="wx-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5ab6e6" /><stop offset="1" stopColor="#2a7fb8" /></linearGradient>
      <linearGradient id="wx-land" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9eaa5" /><stop offset="1" stopColor="#8cc96a" /></linearGradient>
      <linearGradient id="wx-land2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b5df8e" /><stop offset="1" stopColor="#79b85a" /></linearGradient>
      <linearGradient id="wx-mount" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b7c9dd" /><stop offset="1" stopColor="#d9e6f2" /></linearGradient>
      <linearGradient id="wx-rock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c8a77d" /><stop offset="1" stopColor="#8f6c48" /></linearGradient>
      <linearGradient id="wx-steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a6b4c0" /><stop offset="1" stopColor="#6e7d89" /></linearGradient>
      <linearGradient id="wx-flow" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ffd25a" /><stop offset=".5" stopColor="#57d38c" /><stop offset="1" stopColor="#ff9e4a" /></linearGradient>
      <radialGradient id="wx-bubble" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#ffffff" /><stop offset=".55" stopColor="#eef3f1" /><stop offset="1" stopColor="#bcc9c4" /></radialGradient>
      <radialGradient id="wx-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fff3b0" /><stop offset=".6" stopColor="#ffd54a" /><stop offset="1" stopColor="#ffd54a" stopOpacity="0" /></radialGradient>
      <filter id="wx-shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#16324a" floodOpacity=".25" /></filter>
      <marker id="wx-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 Z" fill="#ffffff" />
      </marker>
      <filter id="wx-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9" /></filter>
    </defs>
  );
});

const Background = memo(function Background() {
  return (
    <g>
      <rect x="-1400" y="-700" width={WORLD_W + 2800} height={1220} fill="#9fd8ff" />
      <rect x="-1400" width={WORLD_W + 2800} height={520} fill="url(#wx-sky)" />
      <circle cx="2150" cy="150" r="170" fill="url(#wx-sun)" />
      <circle cx="2150" cy="150" r="62" fill="#ffd54a" />
      {[[200, 120, 1], [900, 80, 1.3], [1600, 170, 0.9]].map(([x, y, s], i) => (
        <g key={i} className="wx-cloud" style={{ animationDelay: `${-i * 30}s` }}>
          <g transform={`translate(${x - 900} ${y}) scale(${s})`} fill="#fff" opacity=".9">
            <ellipse cx="0" cy="0" rx="90" ry="34" /><ellipse cx="60" cy="-22" rx="60" ry="40" /><ellipse cx="-50" cy="-12" rx="50" ry="30" />
          </g>
        </g>
      ))}
      <path d="M-1400 500 L-700 420 L-400 400 L-200 470 L0 500 L180 380 L330 470 L520 330 L700 470 L900 400 L1100 480 L1300 380 L1500 470 L1700 360 L1900 460 L2100 390 L2400 480 L2700 400 L3100 490 L3800 470 L3800 520 L-1400 520 Z" fill="url(#wx-mount)" opacity=".8" />
      <rect x="-1400" y="480" width={WORLD_W + 2800} height={WORLD_H - 480 + 800} fill="url(#wx-sea)" />
      {[560, 660, 760, 880, 980].map((y, i) => (
        <g key={y} className="wx-wave" style={{ animationDuration: `${5 + i}s` }} opacity=".35">
          <path d={`M600 ${y} ${Array.from({ length: 14 }).map((_, j) => `q40 -14 80 0 t80 0`).join(" ")}`} fill="none" stroke="#e6f6ff" strokeWidth="4" strokeLinecap="round" />
        </g>
      ))}
    </g>
  );
});

const Lands = memo(function Lands() {
  return (
    <g filter="url(#wx-shadow)">
      {/* origin landmass */}
      <path d="M-1400 500 L560 488 Q690 500 740 590 Q790 700 730 830 Q670 930 560 990 L540 1090 L-1400 1090 Z" fill="url(#wx-land)" stroke="#6faa4f" strokeWidth="4" />
      {/* land bridge along the bottom (mainland Asia) */}
      <path d="M-1400 1060 Q500 1030 900 1085 Q1250 1130 1600 1070 Q2000 1010 2400 1060 L3800 1060 L3800 2200 L-1400 2200 Z" fill="url(#wx-land2)" stroke="#6faa4f" strokeWidth="4" />
      {/* Vietnam */}
      <path d="M1700 488 L3800 488 L3800 1080 L1660 1080 Q1600 1000 1660 930 Q1730 850 1680 770 Q1620 680 1680 600 Q1720 540 1700 488 Z" fill="url(#wx-land)" stroke="#6faa4f" strokeWidth="4" />
    </g>
  );
});

function Tree({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-5" y="0" width="10" height="26" rx="3" fill="#8a5a33" />
      <circle cx="0" cy="-12" r="24" fill="#2f9e5b" /><circle cx="-16" cy="0" r="16" fill="#3db36d" /><circle cx="16" cy="0" r="16" fill="#258a4d" />
    </g>
  );
}

const Trees = memo(function Trees() {
  const spots = [[60, 900, 1.2], [140, 980, 1], [300, 960, 1.1], [620, 560, 0.9], [90, 600, 0.9], [2330, 900, 1.1], [2260, 980, 0.9], [1750, 1010, 0.9], [900, 1150, 1], [1500, 1310, 0.9], [760, 1350, 1], [120, 1350, 1.1], [1700, 1330, 1], [2380, 1330, 1]];
  return <g>{spots.map(([x, y, s], i) => <Tree key={i} x={x} y={y} s={s} />)}</g>;
});

function Smoke({ x, y, n = 4, color = "#c9d1d6", scale = 1 }) {
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => (
        <circle key={i} cx={x} cy={y} r={16 * scale} fill={color} className="wx-smoke" style={{ animationDelay: `${(i * 4.5) / n}s` }} />
      ))}
    </g>
  );
}

function Mine() {
  return (
    <g data-explain="materials">
      <path d="M90 760 L180 610 L250 650 L330 590 L400 760 Z" fill="url(#wx-rock)" />
      <path d="M140 760 L190 690 L270 700 L330 760 Z" fill="#7a5a3a" />
      <path d="M160 740 h150 M175 715 h120" stroke="#a5835d" strokeWidth="6" />
      <circle cx="210" cy="664" r="9" fill="#ffd23f" /><circle cx="285" cy="640" r="7" fill="#9aa4ad" /><circle cx="245" cy="700" r="8" fill="#d06d3c" />
      {/* excavator */}
      <g transform="translate(300 705)"><rect x="-30" y="0" width="60" height="26" rx="5" fill="#f2b632" /><rect x="-22" y="-22" width="28" height="24" rx="4" fill="#f2b632" /><circle cx="-18" cy="30" r="9" fill="#2b3a44" /><circle cx="18" cy="30" r="9" fill="#2b3a44" />
        <path d="M6 -10 L46 -46 L66 -20" fill="none" stroke="#d99a1a" strokeWidth="9" strokeLinecap="round" /></g>
    </g>
  );
}

function Conveyor() {
  return (
    <g data-explain="materials">
      <path d="M330 690 L420 655" stroke="#4a5761" strokeWidth="14" strokeLinecap="round" />
      <path d="M330 690 L420 655" stroke="#ffd23f" strokeWidth="6" className="wx-dash" />
    </g>
  );
}

function Factory({ originLabel }) {
  return (
    <g data-explain="factory">
      <rect x="400" y="590" width="200" height="130" rx="6" fill="url(#wx-steel)" />
      <path d="M400 590 L440 555 L440 590 L480 555 L480 590 L520 555 L520 590 Z" fill="#5f6d78" />
      <rect x="540" y="470" width="26" height="120" fill="#55636d" /><rect x="500" y="500" width="22" height="90" fill="#55636d" />
      <Smoke x={553} y={460} n={5} /><Smoke x={511} y={492} n={4} />
      {[420, 455, 490, 525].map((x) => <rect key={x} x={x} y="620" width="24" height="24" rx="3" fill="#ffe9a3" className="wx-blink" style={{ animationDelay: `${x / 200}s` }} />)}
      <g transform="translate(570 680)"><g className="wx-spin"><circle r="26" fill="#f2b632" /><circle r="10" fill="#7a5a1a" />
        {Array.from({ length: 8 }).map((_, i) => <rect key={i} x="-6" y="-36" width="12" height="14" fill="#f2b632" transform={`rotate(${i * 45})`} />)}</g></g>
      <g transform="translate(440 690)"><g className="wx-spin-r"><circle r="16" fill="#e39a1d" /><circle r="6" fill="#7a5a1a" />
        {Array.from({ length: 6 }).map((_, i) => <rect key={i} x="-4" y="-23" width="8" height="10" fill="#e39a1d" transform={`rotate(${i * 60})`} />)}</g></g>
      <g transform="translate(470 528)">
        <rect x={-(originLabel.length * 6.4 + 26)} y="-38" width={originLabel.length * 12.8 + 52} height="40" rx="20" fill="#16324a" opacity=".9" />
        <text textAnchor="middle" y="-11" fontSize="20" fontWeight="700" fill="#fff">🏭 {originLabel}</text>
      </g>
    </g>
  );
}

function Port({ x, y, label, flip = false }) {
  return (
    <g data-explain="transport" transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}>
      <rect x="-70" y="10" width="140" height="22" fill="#8a7a66" />
      <path d="M-40 10 L-40 -90 L30 -90" fill="none" stroke="#e25d3c" strokeWidth="8" />
      <path d="M-40 -60 L-10 -90" stroke="#e25d3c" strokeWidth="6" />
      <line x1="20" y1="-90" x2="20" y2="-40" stroke="#2b3a44" strokeWidth="3" />
      <rect x="6" y="-40" width="30" height="16" fill="#3a8fd8" />
      {[[-60, -6, "#e25d3c"], [-30, -6, "#3a8fd8"], [0, -6, "#f2b632"], [-45, -24, "#4caf50"], [-15, -24, "#e25d3c"]].map(([cx, cy, c], i) => (
        <rect key={i} x={cx} y={cy} width="28" height="16" fill={c} stroke="#00000022" />
      ))}
      {label && <text x="0" y="62" textAnchor="middle" fontSize="20" fontWeight="700" fill="#16324a" transform={flip ? "scale(-1 1)" : undefined}>{label}</text>}
    </g>
  );
}

function Ship({ route, show }) {
  return (
    <g data-explain="transport" className="wx-fade" style={{ opacity: show ? 1 : 0, pointerEvents: show ? "auto" : "none" }}>
      <path d={route} fill="none" stroke="#ffffff" strokeOpacity=".55" strokeWidth="6" className="wx-dash" />
      <g style={{ offsetPath: `path('${route}')`, animation: "wx-path 14s linear infinite", offsetRotate: "0deg" }}>
        <path d="M-70 0 L70 0 L52 30 L-52 30 Z" fill="#1d3b53" />
        <rect x="-50" y="-26" width="28" height="26" fill="#e25d3c" /><rect x="-20" y="-26" width="28" height="26" fill="#3a8fd8" />
        <rect x="10" y="-26" width="28" height="26" fill="#f2b632" /><rect x="-36" y="-50" width="28" height="24" fill="#4caf50" />
        <rect x="42" y="-40" width="18" height="40" fill="#f4f7f9" />
      </g>
    </g>
  );
}

function Plane({ route, show }) {
  return (
    <g data-explain="transport" className="wx-fade" style={{ opacity: show ? 1 : 0, pointerEvents: show ? "auto" : "none" }}>
      <path d={route} fill="none" stroke="#ffffff" strokeOpacity=".8" strokeWidth="5" strokeDasharray="4 16" strokeLinecap="round" />
      <g style={{ offsetPath: `path('${route}')`, animation: "wx-path 7s ease-in-out infinite", offsetRotate: "auto" }}>
        <path d="M-50 0 L40 -6 Q60 0 40 6 Z" fill="#f4f7f9" stroke="#1d3b53" strokeWidth="3" />
        <path d="M0 -4 L-18 -42 L-6 -42 L22 -4 Z M0 4 L-18 42 L-6 42 L22 4 Z" fill="#3a8fd8" />
        <path d="M-44 -2 L-56 -20 L-48 -20 L-36 -2 Z" fill="#e25d3c" />
      </g>
    </g>
  );
}

function Truck({ road, duration = 9 }) {
  return (
    <g data-explain="transport">
      <path d={road} fill="none" stroke="#6b6f73" strokeWidth="30" strokeLinecap="round" />
      <path d={road} fill="none" stroke="#f7f3e3" strokeWidth="3" strokeDasharray="20 22" />
      <g style={{ offsetPath: `path('${road}')`, animation: `wx-path ${duration}s linear infinite`, offsetRotate: "auto" }}>
        <rect x="-36" y="-16" width="46" height="28" rx="3" fill="#e25d3c" /><rect x="10" y="-12" width="24" height="24" rx="4" fill="#f2b632" />
        <circle cx="-22" cy="14" r="7" fill="#1d2b33" /><circle cx="22" cy="14" r="7" fill="#1d2b33" />
      </g>
    </g>
  );
}

function DeviceIcon({ category }) {
  const c = category || "";
  if (c.includes("phone") || c === "smartwatch") return <g><rect x="-16" y="-30" width="32" height="58" rx="7" fill="#1d3b53" /><rect x="-12" y="-24" width="24" height="44" rx="2" fill="#6ec6f0" /></g>;
  if (c.includes("air_condition")) return <g><rect x="-48" y="-18" width="96" height="34" rx="8" fill="#f4f7f9" stroke="#1d3b53" strokeWidth="3" /><path d="M-36 8 h72" stroke="#1d3b53" strokeWidth="3" /></g>;
  if (c.includes("refrigerator") || c.includes("washing")) return <g><rect x="-26" y="-50" width="52" height="96" rx="5" fill="#f4f7f9" stroke="#1d3b53" strokeWidth="3" /><path d="M-26 -12 h52" stroke="#1d3b53" strokeWidth="3" /></g>;
  if (c.includes("monitor") || c === "television") return <g><rect x="-46" y="-34" width="92" height="56" rx="4" fill="#1d3b53" /><rect x="-41" y="-29" width="82" height="46" fill="#6ec6f0" /><rect x="-5" y="22" width="10" height="12" fill="#1d3b53" /><rect x="-20" y="33" width="40" height="5" rx="2" fill="#1d3b53" /></g>;
  return <g><rect x="-42" y="-30" width="84" height="50" rx="4" fill="#1d3b53" /><rect x="-37" y="-25" width="74" height="40" fill="#6ec6f0" /><path d="M-52 20 L52 20 L44 30 L-44 30 Z" fill="#5b6d7a" /></g>;
}

function House({ category }) {
  return (
    <g data-explain="use">
      <path d="M1800 900 L1910 820 L2020 900 Z" fill="#c0563b" />
      <rect x="1815" y="900" width="190" height="150" fill="#fdf3e1" stroke="#c9b48f" strokeWidth="4" />
      <rect x="1830" y="915" width="160" height="120" fill="#f6e3c2" />
      <rect x="1880" y="1000" width="90" height="10" fill="#9a6b42" /><rect x="1890" y="1010" width="8" height="25" fill="#9a6b42" /><rect x="1952" y="1010" width="8" height="25" fill="#9a6b42" />
      <g transform="translate(1925 965) scale(.62)"><DeviceIcon category={category} /></g>
      <path d="M1965 1000 C1985 1010 1990 1020 1995 1030" fill="none" stroke="#1d3b53" strokeWidth="3" />
      <rect x="1990" y="1024" width="10" height="14" rx="2" fill="#1d3b53" />
      <text x="1910" y="1080" textAnchor="middle" fontSize="20" fontWeight="700" fill="#16324a">🏠</text>
    </g>
  );
}

function PowerPlant({ solar, labels }) {
  return (
    <g data-explain="grid">
      <path d="M2005 1035 Q2090 1070 2160 1110" fill="none" stroke="#2b3a44" strokeWidth="3" />
      <path d="M2005 1035 Q2090 1070 2160 1110" fill="none" stroke="#ffc93c" strokeWidth="5" className="wx-dash" />
      <g className="wx-fade" style={{ opacity: solar ? 0 : 1 }}>
        <rect x="2160" y="1110" width="190" height="120" rx="6" fill="#4d5a63" />
        <rect x="2190" y="1010" width="30" height="100" fill="#3b464e" /><rect x="2260" y="1030" width="26" height="80" fill="#3b464e" />
        <Smoke x={2205} y={1000} n={5} color="#7d868c" scale={1.3} /><Smoke x={2273} y={1022} n={4} color="#7d868c" scale={1.1} />
        <text x="2255" y="1180" textAnchor="middle" fontSize="20" fontWeight="700" fill="#fff">⚡ {labels?.coal || "Coal power"}</text>
      </g>
      <g className="wx-fade" style={{ opacity: solar ? 1 : 0 }}>
        {[0, 1, 2].map((i) => <g key={i} transform={`translate(${2160 + i * 70} 1170) skewX(-18)`}><rect width="60" height="40" fill="#2f5d9c" stroke="#cfe3ff" strokeWidth="2" /><path d="M0 20 h60 M20 0 v40 M40 0 v40" stroke="#cfe3ff" strokeWidth="1.5" /></g>)}
        {[2200, 2320].map((x) => (
          <g key={x}><rect x={x - 4} y="1040" width="8" height="110" fill="#e6edf2" />
            <g transform={`translate(${x} 1040)`}><g className="wx-spin-fast">{[0, 120, 240].map((a) => <path key={a} d="M0 0 L-6 -60 Q0 -66 6 -60 Z" fill="#f4f7f9" stroke="#9fb0bd" transform={`rotate(${a})`} />)}<circle r="7" fill="#9fb0bd" /></g></g></g>
        ))}
      </g>
    </g>
  );
}

function Recycle() {
  return (
    <g data-explain="end_of_life" transform="translate(-310 0)">
      <rect x="1400" y="1170" width="220" height="110" rx="8" fill="#5e9e45" />
      <rect x="1400" y="1150" width="220" height="26" rx="6" fill="#4c8738" />
      <g transform="translate(1510 1225)"><g className="wx-spin">{[0, 120, 240].map((a) => <path key={a} d="M0 -38 A38 38 0 0 1 33 -19" fill="none" stroke="#f4f7f9" strokeWidth="10" strokeLinecap="round" transform={`rotate(${a})`} />)}</g></g>
      {[[1420, "#3a8fd8"], [1580, "#f2b632"]].map(([x, c]) => <rect key={x} x={x} y="1250" width="26" height="30" rx="3" fill={c} />)}
    </g>
  );
}

/** Thick white arrow of the closed loop (use -> recycle -> back to materials). */
function LoopArrow({ d, topic }) {
  return (
    <g data-explain={topic}>
      <path d={d} fill="none" stroke="#2f7d4f" strokeOpacity=".25" strokeWidth="40" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#ffffff" strokeWidth="22" strokeLinecap="round" markerEnd="url(#wx-arrow)" />
      <path d={d} fill="none" stroke="#57b77a" strokeWidth="6" strokeLinecap="round" className="wx-dash" />
    </g>
  );
}

function Pill({ x, y, text, topic }) {
  const w = Math.max(200, text.length * 13.5 + 48);
  return (
    <g data-explain={topic} transform={`translate(${x} ${y})`}>
      <rect x={-w / 2} y="-30" width={w} height="60" rx="30" fill="#ffffff" stroke="#bfe3c9" strokeWidth="3" filter="url(#wx-shadow)" />
      <text textAnchor="middle" y="9" fontSize="25" fontWeight="700" fill="#1F5D3A">{text}</text>
    </g>
  );
}

/** Numbered stage of the loop: (1) Manufacture, (2) Transport, (3) Use, (4) Return & Recycle. */
function StageBadge({ x, y, n, label, topic }) {
  const w = label.length * 15 + 96;
  return (
    <g data-explain={topic} transform={`translate(${x} ${y})`}>
      <rect x={-w / 2} y="-30" width={w} height="60" rx="30" fill="#1F5D3A" filter="url(#wx-shadow)" />
      <circle cx={-w / 2 + 32} cy="0" r="21" fill="#ffffff" />
      <text x={-w / 2 + 32} y="9" textAnchor="middle" fontSize="25" fontWeight="800" fill="#1F5D3A">{n}</text>
      <text x={-w / 2 + 64} y="9" fontSize="27" fontWeight="700" fill="#ffffff">{label}</text>
    </g>
  );
}

/**
 * A stage bubble. `value` is already worded by the caller: this product's own kilograms when
 * the backend really split them, otherwise the share a product of this category typically has.
 */
function Bubble({ x, y, value, r, label, topic, focused, note }) {
  return (
    <g data-explain={topic} transform={`translate(${x} ${y})`}>
      <g className="wx-bob" style={{ animationDelay: `${(x % 7) * 0.3}s` }}>
        {focused && <circle r={r + 22} fill="none" stroke="#ffd25a" strokeWidth="8" className="wx-pulse" />}
        <circle r={r} fill="url(#wx-bubble)" stroke="#8aa39a" strokeWidth="3" opacity=".96" />
        <text textAnchor="middle" y={note ? -r * 0.12 : -r * 0.05} fontSize={Math.max(20, r * 0.36)} fontWeight="800" fill="#1d3b53">{value ?? "—"}</text>
        <text textAnchor="middle" y={note ? r * 0.26 : r * 0.4} fontSize={Math.max(15, r * 0.19)} fontWeight="600" fill="#4b6470">{label}</text>
        {note && <text textAnchor="middle" y={r * 0.56} fontSize={Math.max(13, r * 0.155)} fontWeight="600" fill="#8a9aa4">{note}</text>}
      </g>
    </g>
  );
}

/** The whole world. `sim.stages` holds the (tweened) kg per stage of the current scenario. */
export default function WorldScene({ svgRef, category, sc, sim, maxStage, focus, labels, ask, lang, onClick, art, leg, stageValue, stageNote }) {
  const local = sc.origin === "VN";
  const air = !local && sc.mode === "air";
  const flow = flowPath(sc);
  const r = (kg) => (kg ? 46 + 80 * Math.sqrt(Math.max(0, kg) / (maxStage || 1)) : 46);
  const tBubble = local ? [1150, 1110] : air ? [1180, 330] : [1180, 590];
  const st = sim?.stages || {};
  return (
    <svg ref={svgRef} className={`wx w-full h-full touch-none select-none ${ask ? "ask" : ""}`}
         preserveAspectRatio="xMidYMid meet" onClick={onClick} role="application" aria-label={labels.aria}>
      <style>{STYLE}</style>
      <Defs />
      <Background />
      <Lands />
      <Trees />
      <text x="60" y="560" fontSize="30" fontWeight="800" fill="#2d5a3a" opacity=".6">{labels.originLand}</text>
      <text x="1745" y="560" fontSize="34" fontWeight="800" fill="#2d5a3a" opacity=".7">{labels.vietnam || "Vietnam"}</text>

      {/* glowing flow of emissions */}
      <path d={flow} fill="none" stroke="url(#wx-flow)" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" opacity=".35" filter="url(#wx-glow)" />
      <path d={flow} fill="none" stroke="url(#wx-flow)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity=".8" className="wx-dash" />
      {Array.from({ length: 6 }).map((_, i) => (
        <circle key={i} r="10" fill="#ffd25a" stroke="#fff" strokeWidth="3"
                style={{ offsetPath: `path('${flow}')`, animation: "wx-path 16s linear infinite", animationDelay: `${-i * 2.7}s` }} />
      ))}

      <Art art={art} name="mine" topic="materials"><Mine /></Art>
      <Conveyor />
      <Art art={art} name="factory" topic="factory"><Factory originLabel={labels.factory} /></Art>
      {art?.factory && (
        <g data-explain="factory" transform="translate(540 470)"><rect x="-130" y="-30" width="260" height="44" rx="22" fill="#16324a" opacity=".92" />
          <text textAnchor="middle" y="0" fontSize="21" fontWeight="700" fill="#fff">🏭 {labels.factory}</text></g>
      )}
      <g className="wx-fade" style={{ opacity: local ? 0.35 : 1 }}><Art art={art} name="port_origin" topic="transport"><Port x={700} y={790} label={labels.originPort} /></Art></g>
      <Art art={art} name="port_vn" topic="transport"><Port x={1720} y={800} label={labels.vnPort} flip /></Art>
      {art?.ship && <Art art={art} name="ship" topic="transport" opacity={!local && !air ? 1 : 0} />}
      {art?.plane && <Art art={art} name="plane" topic="transport" opacity={air ? 1 : 0} />}
      <Ship route={SEA_ROUTE} show={!local && !air} />
      <Plane route={AIR_ROUTE} show={air} />
      {local ? <Truck road={LOCAL_ROAD} duration={16} /> : <Truck road={VN_PORT_ROAD} duration={6} />}
      <Art art={art} name="home" topic="use"><House category={category} /></Art>
      {art?.coal_plant || art?.solar ? (<>
        <Art art={art} name="coal_plant" topic="grid" opacity={sc.grid === "solar" ? 0 : 1}><g /></Art>
        <Art art={art} name="solar" topic="grid" opacity={sc.grid === "solar" ? 1 : 0}><g /></Art>
      </>) : <PowerPlant solar={sc.grid === "solar"} labels={labels} />}
      <LoopArrow d={TO_RECYCLE} topic="end_of_life" />
      <LoopArrow d={BACK_TO_MINE} topic="end_of_life" />
      <Art art={art} name="recycle" topic="end_of_life"><Recycle /></Art>
      <Pill x={600} y={1205} topic="end_of_life" text={`♻ ${labels.loop?.recovered || "Recovered materials for new products"}`} />

      {leg && (
        <g pointerEvents="none">
          <path d={leg} fill="none" stroke="#ffd25a" strokeWidth="34" strokeLinecap="round" opacity=".45" filter="url(#wx-glow)" />
          <path d={leg} fill="none" stroke="#fff6c9" strokeWidth="8" strokeLinecap="round" className="wx-dash" />
          {Array.from({ length: 5 }).map((_, i) => (
            <circle key={i} r="14" fill="#ff9e4a" stroke="#fff" strokeWidth="4"
                    style={{ offsetPath: `path('${leg.split(" M")[0]}')`, animation: "wx-path 3.2s linear infinite", animationDelay: `${-i * 0.64}s` }} />
          ))}
        </g>
      )}

      <Bubble x={500} y={915} value={stageValue("materials_production")} note={stageNote} r={r(st.materials_production)} label={labels.stages.materials_production} topic="factory" focused={focus === "materials_production" || focus === "materials"} />
      <Bubble x={tBubble[0]} y={tBubble[1]} value={stageValue("transport")} note={stageNote} r={r(st.transport)} label={labels.stages.transport} topic="transport" focused={focus === "transport"} />
      <Bubble x={2150} y={880} value={stageValue("use")} note={stageNote} r={r(st.use)} label={labels.stages.use} topic="use" focused={focus === "use"} />
      <Bubble x={1450} y={1120} value={stageValue("end_of_life")} note={stageNote} r={r(st.end_of_life)} label={labels.stages.end_of_life} topic="end_of_life" focused={focus === "end_of_life"} />

      <StageBadge x={330} y={445} n={1} label={labels.loop?.make || "Manufacture"} topic="factory" />
      <StageBadge x={tBubble[0]} y={tBubble[1] - r(st.transport) - 46} n={2} label={labels.loop?.move || "Transport"} topic="transport" />
      <StageBadge x={1910} y={775} n={3} label={labels.loop?.use || "Use"} topic="use" />
      <StageBadge x={1200} y={1110} n={4} label={labels.loop?.back || "Return & Recycle"} topic="end_of_life" />
    </svg>
  );
}
