// Walk-in scene illustrations (viewBox 1200x700). A sub-scene is its parent's art seen through a
// tighter viewBox plus a detail layer, so diving in really zooms into the same place.
// Pictures carry no figures except the ones passed in (stored / simulated data).
import { memo } from "react";
import { HOTSPOTS } from "./sceneGraph";

export const ART_CSS = `
@keyframes sa-belt{to{transform:translateX(-120px)}}
@keyframes sa-belt-r{to{transform:translateX(120px)}}
@keyframes sa-smoke{0%{transform:translate(0,0) scale(.5);opacity:.85}100%{transform:translate(26px,-120px) scale(1.9);opacity:0}}
@keyframes sa-arm{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(16deg)}}
@keyframes sa-arm2{0%,100%{transform:rotate(18deg)}50%{transform:rotate(-12deg)}}
@keyframes sa-spin{to{transform:rotate(360deg)}}
@keyframes sa-bob{0%,100%{transform:translateY(0) rotate(-.6deg)}50%{transform:translateY(7px) rotate(.6deg)}}
@keyframes sa-wave{to{transform:translateX(-80px)}}
@keyframes sa-glint{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes sa-ring{0%{transform:scale(.7);opacity:.9}100%{transform:scale(1.9);opacity:0}}
@keyframes sa-fly{0%{transform:translate(-260px,60px)}100%{transform:translate(1400px,-40px)}}
@keyframes sa-drive{0%{offset-distance:0%}100%{offset-distance:100%}}
@keyframes sa-glow{0%,100%{opacity:.55}50%{opacity:1}}
@keyframes sa-drop{0%{transform:translateY(-30px);opacity:0}20%{opacity:1}100%{transform:translateY(60px);opacity:0}}
@keyframes sa-spark{0%,100%{opacity:0}40%,60%{opacity:1}}
@keyframes sa-lift{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}}
.sa-belt{animation:sa-belt 4s linear infinite}
.sa-belt-r{animation:sa-belt-r 5s linear infinite}
.sa-smoke{animation:sa-smoke 3.6s ease-out infinite;transform-box:fill-box;transform-origin:center}
.sa-arm{animation:sa-arm 2.6s ease-in-out infinite;transform-box:fill-box}
.sa-arm2{animation:sa-arm2 2.2s ease-in-out infinite;transform-box:fill-box}
.sa-spin{animation:sa-spin 6s linear infinite;transform-box:fill-box;transform-origin:center}
.sa-spin-fast{animation:sa-spin 1.6s linear infinite;transform-box:fill-box;transform-origin:center}
.sa-bob{animation:sa-bob 4.5s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.sa-wave{animation:sa-wave 3.5s linear infinite}
.sa-glint{animation:sa-glint 2.2s ease-in-out infinite}
.sa-ring{animation:sa-ring 1.8s ease-out infinite;transform-box:fill-box;transform-origin:center}
.sa-fly{animation:sa-fly 11s linear infinite}
.sa-glow{animation:sa-glow 1.8s ease-in-out infinite}
.sa-drop{animation:sa-drop 2.4s ease-in infinite}
.sa-spark{animation:sa-spark .9s steps(2) infinite}
.sa-lift{animation:sa-lift 3s ease-in-out infinite;transform-box:fill-box}
.sa-hot{cursor:pointer}
.sa-hot:focus{outline:none}
.sa-hot:focus-visible .sa-hot-core,.sa-hot:hover .sa-hot-core{stroke:#f59e0b;stroke-width:5}
@media (prefers-reduced-motion:reduce){.sa-belt,.sa-belt-r,.sa-smoke,.sa-arm,.sa-arm2,.sa-spin,.sa-spin-fast,.sa-bob,.sa-wave,.sa-glint,.sa-ring,.sa-fly,.sa-glow,.sa-drop,.sa-spark,.sa-lift{animation:none}}
`;

const INK = "#1E2B22";

function Smoke({ x, y, n = 4, color = "#cfd6db", r = 14 }) {
  return Array.from({ length: n }).map((_, i) => (
    <circle key={i} cx={x} cy={y} r={r} fill={color} className="sa-smoke" style={{ animationDelay: `${(i * 3.6) / n}s` }} />
  ));
}

function Sky({ id, top = "#cfeefe", bottom = "#f3fbff" }) {
  return (
    <>
      <defs><linearGradient id={`${id}-sky`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={top} /><stop offset="1" stopColor={bottom} /></linearGradient></defs>
      <rect width="1200" height="700" fill={`url(#${id}-sky)`} />
    </>
  );
}

function Hotspot({ h, label, onDive, active }) {
  return (
    <g className="sa-hot" role="button" tabIndex={0} aria-label={label} data-hotspot={h.key}
       onClick={(e) => { e.stopPropagation(); onDive(h.key, e.currentTarget.getBoundingClientRect()); }}
       onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDive(h.key, e.currentTarget.getBoundingClientRect()); } }}>
      <circle cx={h.x} cy={h.y} r="34" fill="#fbbf24" opacity=".35" className="sa-ring" />
      <circle cx={h.x} cy={h.y} r="34" fill="#fbbf24" opacity=".35" className="sa-ring" style={{ animationDelay: ".9s" }} />
      <circle className="sa-hot-core" cx={h.x} cy={h.y} r="28" fill="#fff" stroke={active ? "#f59e0b" : "#1F5D3A"} strokeWidth="4" />
      <path d={`M${h.x - 8} ${h.y} h16 M${h.x} ${h.y - 8} v16`} stroke="#1F5D3A" strokeWidth="4" strokeLinecap="round" />
      <g transform={`translate(${h.x} ${h.y + 58})`}>
        <rect x={-(label.length * 7 + 20)} y="-21" width={label.length * 14 + 40} height="42" rx="21" fill="#1F5D3A" stroke="#fff" strokeWidth="3" />
        <text textAnchor="middle" dominantBaseline="central" fontSize="23" fontWeight="800" fill="#fff">{label}</text>
      </g>
    </g>
  );
}

// ------------------------------------------------------------------ materials: mine + refinery

const Materials = memo(function Materials({ sub }) {
  return (
    <g>
      <Sky id="ma" top="#d8efff" bottom="#fbf6ea" />
      <path d="M0 330 L160 190 L300 290 L460 160 L640 300 L820 180 L1000 280 L1200 200 V700 H0Z" fill="#c9d9c2" opacity=".7" />
      <rect y="400" width="1200" height="300" fill="#cdb68f" />
      {/* open pit */}
      <ellipse cx="360" cy="500" rx="330" ry="150" fill="#b99a6c" />
      <ellipse cx="360" cy="510" rx="270" ry="118" fill="#a98858" />
      <ellipse cx="360" cy="520" rx="205" ry="88" fill="#967648" />
      <ellipse cx="360" cy="530" rx="140" ry="58" fill="#7d6038" />
      {[[250, 520, "#d4a017"], [420, 545, "#c4652d"], [330, 490, "#9fb7c9"], [470, 500, "#d4a017"], [300, 560, "#4fb3a0"], [205, 480, "#c4652d"]].map(([x, y, c], i) => (
        <circle key={i} cx={x} cy={y} r="9" fill={c} className="sa-glint" style={{ animationDelay: `${i * 0.35}s` }} />
      ))}
      {/* excavator */}
      <g transform="translate(470 420)">
        <rect x="0" y="20" width="90" height="40" rx="6" fill="#f2b632" /><rect x="10" y="0" width="45" height="28" rx="4" fill="#f2b632" />
        <rect x="16" y="6" width="22" height="16" fill="#cfe9f7" /><rect x="-6" y="58" width="110" height="16" rx="8" fill={INK} />
        <g className="sa-arm" style={{ transformOrigin: "70px 26px" }}>
          <path d="M70 26 L150 -30 L185 10" fill="none" stroke="#f2b632" strokeWidth="12" strokeLinecap="round" />
          <path d="M178 2 l26 6 l-10 26 l-28 -8z" fill={INK} />
        </g>
      </g>
      {/* dump truck on the ramp */}
      <g style={{ offsetPath: "path('M120 560 Q260 420 560 400 L720 400')", animation: "sa-drive 7s ease-in-out infinite alternate", offsetRotate: "0deg" }}>
        <g transform="translate(-45 -40)"><rect x="0" y="10" width="64" height="32" rx="4" fill="#e07b39" /><rect x="64" y="18" width="28" height="24" rx="4" fill="#f2b632" /><circle cx="18" cy="46" r="9" fill={INK} /><circle cx="72" cy="46" r="9" fill={INK} /></g>
      </g>
      {/* conveyor to the refinery */}
      <g><path d="M640 420 L860 330" stroke="#5b6d7a" strokeWidth="16" strokeLinecap="round" />
        <path d="M640 420 L860 330" stroke="#9aa9b3" strokeWidth="6" strokeDasharray="14 18" className="sa-belt" /></g>
      {/* refinery */}
      <g>
        <rect x="830" y="250" width="290" height="160" rx="8" fill="#8a9aa8" /><rect x="830" y="236" width="290" height="22" fill="#6f7f8b" />
        <rect x="900" y="140" width="30" height="100" fill="#6b7a84" /><rect x="1010" y="120" width="34" height="120" fill="#6b7a84" />
        <Smoke x={915} y={130} n={4} color="#bcc4c9" r={16} /><Smoke x={1027} y={110} n={4} color="#bcc4c9" r={18} />
        <rect x="870" y="300" width="90" height="70" rx="6" fill="#3b2a24" /><rect x="880" y="310" width="70" height="50" rx="4" fill="#ff8a3d" className="sa-glow" />
        <path d="M985 330 h100 v30 h-100z" fill="#e8ebee" /><path d="M990 340 q45 -26 90 0" fill="none" stroke="#ffb347" strokeWidth="6" className="sa-glow" />
      </g>
      {sub === "materials/ore" && (
        <g>
          <rect x="140" y="270" width="560" height="320" rx="24" fill="#fff" opacity=".0" />
          {[["Cu", 200, 330, "#c4652d"], ["Au", 290, 300, "#d4a017"], ["Li", 380, 330, "#4fb3a0"], ["Co", 470, 300, "#3b6fd9"], ["Ni", 560, 330, "#7c8b96"], ["REE", 650, 300, "#9a62c9"]].map(([s, x, y, c], i) => (
            <g key={s} className="sa-lift" style={{ animationDelay: `${i * 0.25}s` }}>
              <circle cx={x} cy={y} r="34" fill={c} stroke="#fff" strokeWidth="5" />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={s.length > 2 ? 17 : 22} fontWeight="800" fill="#fff">{s}</text>
            </g>
          ))}
        </g>
      )}
      {sub === "materials/refining" && (
        <g>
          {[0, 1, 2, 3].map((i) => <circle key={i} cx={918 + i * 10} cy={336} r="6" fill="#ffd27a" className="sa-drop" style={{ animationDelay: `${i * 0.6}s` }} />)}
          <rect x="1000" y="372" width="90" height="26" rx="5" fill="#d7dde2" stroke="#9aa9b3" strokeWidth="3" />
          <rect x="1000" y="372" width="90" height="26" rx="5" fill="#ffb347" opacity=".5" className="sa-glow" />
        </g>
      )}
    </g>
  );
});

// ------------------------------------------------------------------ production: factory floor

function Laptop({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-30" y="-34" width="60" height="38" rx="3" fill={INK} /><rect x="-26" y="-30" width="52" height="30" fill="#6ec6f0" />
      <path d="M-38 4 H38 L32 12 H-32Z" fill="#5b6d7a" />
    </g>
  );
}

const Production = memo(function Production({ sub }) {
  return (
    <g>
      <rect width="1200" height="700" fill="#eef3f6" />
      <rect y="0" width="1200" height="120" fill="#dfe7ec" />
      {[100, 300, 500, 700, 900, 1100].map((x) => (
        <g key={x}><rect x={x - 70} y="20" width="140" height="70" rx="6" fill="#c9e7f7" /><rect x={x - 3} y="20" width="6" height="70" fill="#dfe7ec" /></g>
      ))}
      {[200, 600, 1000].map((x) => <g key={x}><rect x={x - 40} y="118" width="80" height="10" fill="#9aa9b3" /><rect x={x - 30} y="128" width="60" height="6" fill="#fff8c8" className="sa-glow" /></g>)}
      <rect y="560" width="1200" height="140" fill="#d5dde2" />
      {/* main conveyor */}
      <rect x="0" y="520" width="1200" height="34" fill="#5b6d7a" />
      <g className="sa-belt">{Array.from({ length: 13 }).map((_, i) => <Laptop key={i} x={60 + i * 120} y={512} s={0.8} />)}</g>
      {[100, 300, 500, 700, 900, 1100].map((x) => <rect key={x} x={x - 6} y="554" width="12" height="40" fill="#46525a" />)}
      {/* chip clean room */}
      <g>
        <rect x="120" y="230" width="260" height="190" rx="14" fill="#f8fbff" stroke="#9fd3ee" strokeWidth="4" />
        <circle cx="250" cy="360" r="56" fill="#cfd9e2" stroke="#8fa3b3" strokeWidth="4" />
        <g className="sa-spin"><circle cx="250" cy="360" r="46" fill="#9fb3c4" />
          {Array.from({ length: 6 }).map((_, i) => Array.from({ length: 6 }).map((__, j) => (
            <rect key={`${i}-${j}`} x={222 + i * 9.5} y={332 + j * 9.5} width="7" height="7" fill={(i + j) % 3 ? "#5e7f99" : "#e5b94e"} />
          )))}
        </g>
        <g className="sa-arm" style={{ transformOrigin: "150px 250px" }}><path d="M150 250 L215 300" stroke="#e8eef2" strokeWidth="14" strokeLinecap="round" /><circle cx="215" cy="300" r="10" fill="#f59e0b" /></g>
      </g>
      {/* screen line */}
      <g>
        <rect x="420" y="250" width="210" height="170" rx="12" fill="#f4f6f8" stroke="#c2ccd4" strokeWidth="3" />
        <g className="sa-lift"><rect x="455" y="275" width="140" height="88" rx="6" fill={INK} /><rect x="463" y="283" width="124" height="72" fill="#7fd0f5" opacity=".9" /></g>
        <rect x="470" y="380" width="110" height="12" rx="6" fill="#9aa9b3" />
      </g>
      {/* battery line */}
      <g>
        <rect x="680" y="250" width="220" height="170" rx="12" fill="#f4f6f8" stroke="#c2ccd4" strokeWidth="3" />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}><rect x={705 + i * 38} y="300" width="28" height="80" rx="6" fill="#4b6475" />
            <rect x={709 + i * 38} y={344 - i * 6} width="20" height={32 + i * 6} rx="3" fill="#6FB04A" className="sa-glow" style={{ animationDelay: `${i * 0.3}s` }} /></g>
        ))}
      </g>
      {/* assembly robots */}
      <g>
        <rect x="920" y="380" width="200" height="40" rx="8" fill="#c2ccd4" />
        <g className="sa-arm2" style={{ transformOrigin: "960px 380px" }}><rect x="952" y="300" width="16" height="82" rx="8" fill="#f2b632" /><circle cx="960" cy="300" r="12" fill="#e07b39" /></g>
        <g className="sa-arm" style={{ transformOrigin: "1080px 380px" }}><rect x="1072" y="300" width="16" height="82" rx="8" fill="#f2b632" /><circle cx="1080" cy="300" r="12" fill="#e07b39" /></g>
        <Laptop x={1020} y={372} s={1} />
        {[0, 1, 2].map((i) => <circle key={i} cx={1000 + i * 18} cy={350} r="4" fill="#ffd27a" className="sa-spark" style={{ animationDelay: `${i * 0.3}s` }} />)}
      </g>
      {/* roof vents: CO2 */}
      <Smoke x={300} y={10} n={3} color="#c9d1d6" r={16} /><Smoke x={880} y={10} n={3} color="#c9d1d6" r={16} />
      {sub === "production/screen" && (
        <g>{["#d9e6ee", "#7fd0f5", "#b6e3a3", "#f5d27f"].map((c, i) => (
          <rect key={c} x={470 + i * 10} y={284 + i * 10} width="120" height="70" rx="4" fill={c} opacity=".85" className="sa-lift" style={{ animationDelay: `${i * 0.2}s` }} />
        ))}</g>
      )}
      {sub === "production/battery" && (
        <g>{[["Li", 735, "#4fb3a0"], ["Co", 790, "#3b6fd9"], ["Ni", 845, "#7c8b96"]].map(([s, x, c]) => (
          <g key={s} className="sa-lift"><circle cx={x} cy={270} r="22" fill={c} stroke="#fff" strokeWidth="4" />
            <text x={x} y={270} textAnchor="middle" dominantBaseline="central" fontSize="16" fontWeight="800" fill="#fff">{s}</text></g>
        ))}</g>
      )}
      {sub === "production/assembly" && (
        <g>{[[-26, -10], [26, -10], [0, 18]].map(([dx, dy], i) => (
          <rect key={i} x={1000 + dx} y={330 + dy} width="40" height="10" rx="3" fill={["#9aa9b3", "#6ec6f0", "#6FB04A"][i]} className="sa-lift" style={{ animationDelay: `${i * 0.3}s` }} />
        ))}</g>
      )}
    </g>
  );
});

// ------------------------------------------------------------------ transport: open sea

const Transport = memo(function Transport({ sub, mode, local, originLabel }) {
  const air = mode === "air" && !local;
  return (
    <g>
      <Sky id="tr" top="#bfe6fb" bottom="#e9f7ff" />
      <circle cx="140" cy="110" r="56" fill="#ffd66b" opacity=".9" />
      {[[300, 120], [620, 80], [900, 150]].map(([x, y]) => <g key={x} opacity=".9"><ellipse cx={x} cy={y} rx="70" ry="22" fill="#fff" /><ellipse cx={x + 40} cy={y - 12} rx="44" ry="20" fill="#fff" /></g>)}
      <defs><linearGradient id="tr-sea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#5fb5e3" /><stop offset="1" stopColor="#2b7fb8" /></linearGradient>
        <pattern id="tr-w" width="80" height="24" patternUnits="userSpaceOnUse"><path d="M0 12 Q20 2 40 12 T80 12" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="3" /></pattern></defs>
      <rect y="380" width="1200" height="320" fill="url(#tr-sea)" />
      <g className="sa-wave"><rect y="380" width="1300" height="320" fill="url(#tr-w)" /></g>
      {/* container ship */}
      <g className="sa-bob" opacity={air ? 0.35 : 1}>
        <path d="M300 400 L980 400 L940 470 L345 470Z" fill="#20384a" /><rect x="300" y="392" width="680" height="12" fill="#c0563b" />
        <rect x="860" y="300" width="80" height="92" rx="4" fill="#f4f6f8" /><rect x="868" y="312" width="64" height="16" fill="#7fc3e8" /><rect x="890" y="262" width="12" height="40" fill="#46525a" />
        {Array.from({ length: 9 }).map((_, i) => Array.from({ length: 3 }).map((__, j) => (
          <rect key={`${i}-${j}`} x={330 + i * 58} y={368 - j * 30} width="54" height="28" rx="2"
                fill={["#E0812A", "#3B8FD9", "#6FB04A", "#D9534F", "#E0A526", "#7b61c9"][(i + j * 2) % 6]} stroke="#1b2a35" strokeOpacity=".25" />
        )))}
        <path d="M980 430 q40 10 70 40" stroke="#fff" strokeWidth="5" fill="none" opacity=".7" />
      </g>
      {air && (
        <g className="sa-fly"><g transform="translate(0 200)">
          <path d="M0 30 Q60 18 180 22 L210 30 L180 38 Q60 42 0 30Z" fill="#f4f6f8" stroke="#9aa9b3" strokeWidth="2" />
          <path d="M80 30 L120 -10 L140 -10 L118 30Z" fill="#c2ccd4" /><path d="M80 30 L120 70 L140 70 L118 30Z" fill="#c2ccd4" />
          <path d="M10 30 L-4 6 L10 6 L28 28Z" fill="#c2ccd4" />
          <path d="M-10 32 h-160" stroke="#fff" strokeWidth="5" strokeDasharray="20 14" opacity=".8" />
        </g></g>
      )}
      {/* route inset */}
      <g>
        <rect x="790" y="30" width="390" height="230" rx="20" fill="#fff" opacity=".93" stroke="#d7e6ef" strokeWidth="3" />
        <path d="M820 60 q60 -10 110 30 q20 60 -30 110 l-80 20z" fill="#cfe7bf" />
        <path d="M1100 80 q30 40 20 90 q-10 40 20 70 l-40 8 q-30 -40 -20 -90z" fill="#cfe7bf" />
        <circle cx={local ? 1110 : 900} cy={local ? 120 : 120} r="9" fill="#E0812A" />
        <circle cx="1118" cy="200" r="9" fill="#2E7D4F" />
        {!local && <path d={air ? "M900 120 Q1010 40 1118 200" : "M900 120 Q1000 230 1118 200"} fill="none" stroke={air ? "#D9534F" : "#3B8FD9"} strokeWidth="5" strokeDasharray="12 10" className="sa-belt-r" />}
        <text x="900" y="150" textAnchor="middle" fontSize="16" fontWeight="700" fill={INK}>{originLabel}</text>
        <text x="1118" y="232" textAnchor="middle" fontSize="16" fontWeight="700" fill={INK}>Việt Nam</text>
      </g>
      {sub === "transport/mode" && !local && (
        <g>
          <rect x="330" y="140" width="290" height="70" rx="16" fill="#fff" opacity=".95" />
          <text x="475" y="175" textAnchor="middle" dominantBaseline="central" fontSize="24" fontWeight="800" fill={air ? "#D9534F" : "#2E7D4F"}>{air ? "✈️ 0,6" : "🚢 0,016"} kg/t·km</text>
        </g>
      )}
    </g>
  );
});

// ------------------------------------------------------------------ use: a home in Vietnam

function Device({ category, x, y }) {
  const c = category || "";
  if (c.includes("phone") || c === "smartwatch") {
    return <g transform={`translate(${x} ${y})`}><rect x="-22" y="-80" width="44" height="80" rx="8" fill={INK} /><rect x="-18" y="-74" width="36" height="66" rx="3" fill="#7fd0f5" className="sa-glow" /></g>;
  }
  if (c.includes("monitor") || c === "television" || c === "desktop") {
    return <g transform={`translate(${x} ${y})`}><rect x="-90" y="-120" width="180" height="108" rx="6" fill={INK} /><rect x="-82" y="-112" width="164" height="92" fill="#7fd0f5" className="sa-glow" /><rect x="-8" y="-12" width="16" height="12" fill={INK} /><rect x="-40" y="-2" width="80" height="6" rx="3" fill={INK} /></g>;
  }
  return <g transform={`translate(${x} ${y})`}><rect x="-70" y="-84" width="140" height="80" rx="5" fill={INK} /><rect x="-63" y="-78" width="126" height="66" fill="#7fd0f5" className="sa-glow" /><path d="M-86 -4 H86 L74 8 H-74Z" fill="#5b6d7a" /></g>;
}

const Use = memo(function Use({ sub, category, solar, meter }) {
  return (
    <g>
      <rect width="1200" height="700" fill="#fbf3e4" />
      <rect y="520" width="1200" height="180" fill="#d9b88f" />
      {Array.from({ length: 12 }).map((_, i) => <rect key={i} x={i * 100} y="520" width="4" height="180" fill="#c9a77d" />)}
      {/* window with the power source outside */}
      <defs><clipPath id="use-win"><rect x="835" y="75" width="320" height="260" rx="8" /></clipPath></defs>
      <g>
        <rect x="830" y="70" width="330" height="270" rx="10" fill="#bfe6fb" />
        <g clipPath="url(#use-win)">
        <rect x="840" y="250" width="310" height="80" fill="#a9d68a" />
        {solar ? (
          <g>
            {[0, 1, 2].map((i) => <rect key={i} x={860 + i * 95} y="205" width="80" height="40" fill="#2f5d9a" stroke="#cfe3f5" strokeWidth="3" transform={`skewX(-12)`} />)}
            <g transform="translate(1080 150)"><rect x="-3" y="0" width="6" height="100" fill="#e8eef2" /><g className="sa-spin-fast"><path d="M0 0 L0 -50 M0 0 L43 25 M0 0 L-43 25" stroke="#e8eef2" strokeWidth="7" strokeLinecap="round" /></g></g>
            <circle cx="900" cy="110" r="26" fill="#ffd66b" />
          </g>
        ) : (
          <g>
            <rect x="880" y="180" width="130" height="80" fill="#55616b" /><rect x="900" y="110" width="22" height="70" fill="#46525a" /><rect x="960" y="125" width="22" height="55" fill="#46525a" />
            <Smoke x={911} y={104} n={4} color="#8f979d" r={14} /><Smoke x={971} y={118} n={3} color="#8f979d" r={12} />
            <path d="M1010 200 L1150 170" stroke={INK} strokeWidth="3" />
          </g>
        )}
        </g>
        <rect x="830" y="70" width="330" height="270" rx="10" fill="none" stroke="#8a6a48" strokeWidth="10" />
        <rect x="990" y="70" width="10" height="270" fill="#8a6a48" />
      </g>
      {/* cable from the window to the socket */}
      <path d="M840 300 C760 330 720 460 640 470" stroke="#f59e0b" strokeWidth="5" fill="none" strokeDasharray="12 10" className="sa-belt" />
      {/* socket + meter */}
      <g transform="translate(560 420)">
        <rect x="0" y="0" width="150" height="110" rx="12" fill="#f4f6f8" stroke="#9aa9b3" strokeWidth="3" />
        <rect x="14" y="16" width="122" height="44" rx="6" fill="#16324a" />
        <text x="75" y="38" textAnchor="middle" dominantBaseline="central" fontSize="22" fontWeight="800" fill="#7ef0a6" fontFamily="monospace">{meter}</text>
        <text x="75" y="84" textAnchor="middle" fontSize="16" fontWeight="700" fill="#46525a">kWh</text>
      </g>
      {/* desk + device */}
      <rect x="120" y="440" width="420" height="20" rx="6" fill="#8a6a48" /><rect x="150" y="460" width="16" height="70" fill="#7a5c3c" /><rect x="494" y="460" width="16" height="70" fill="#7a5c3c" />
      <Device category={category} x={320} y={440} />
      <path d="M380 440 C430 470 520 480 560 470" stroke={INK} strokeWidth="4" fill="none" />
      {/* lamp, plant, sofa */}
      <g><rect x="40" y="300" width="8" height="220" fill="#7a5c3c" /><path d="M10 300 h68 l-14 -50 h-40z" fill="#f6d36b" className="sa-glow" /></g>
      <g transform="translate(760 500)"><rect x="-26" y="0" width="52" height="40" rx="8" fill="#c0563b" /><path d="M0 0 C-30 -40 -10 -70 0 -90 C10 -70 30 -40 0 0" fill="#3fa365" /></g>
      {sub === "use/years" && (
        <g>{Array.from({ length: 6 }).map((_, i) => (
          <g key={i} className="sa-lift" style={{ animationDelay: `${i * 0.2}s` }}><rect x={150 + i * 62} y="160" width="50" height="56" rx="6" fill="#fff" stroke="#c0563b" strokeWidth="3" /><rect x={150 + i * 62} y="160" width="50" height="14" rx="4" fill="#c0563b" /></g>
        ))}</g>
      )}
    </g>
  );
});

// ------------------------------------------------------------------ end of life: recycling plant

const EndOfLife = memo(function EndOfLife({ sub }) {
  const items = [["#5b6d7a", 32, 22], ["#16324a", 20, 34], ["#9aa9b3", 40, 18]];
  return (
    <g>
      <rect width="1200" height="700" fill="#eef4ec" />
      <rect y="0" width="1200" height="110" fill="#dde8d9" />
      <g transform="translate(600 60)"><g className="sa-spin">{[0, 120, 240].map((a) => <path key={a} d="M0 -40 A40 40 0 0 1 35 -20" fill="none" stroke="#2E7D4F" strokeWidth="10" strokeLinecap="round" transform={`rotate(${a})`} />)}</g></g>
      <rect y="560" width="1200" height="140" fill="#c9d3c4" />
      {/* drop-off pile */}
      <g>
        <rect x="90" y="360" width="320" height="200" rx="14" fill="#5b8f3a" /><rect x="80" y="340" width="340" height="30" rx="8" fill="#467a2b" />
        {Array.from({ length: 9 }).map((_, i) => {
          const [c, w, h] = items[i % 3];
          return <rect key={i} x={110 + (i % 5) * 58} y={430 - Math.floor(i / 5) * 40} width={w} height={h} rx="4" fill={c} transform={`rotate(${(i * 23) % 30 - 15} ${130 + (i % 5) * 58} ${440 - Math.floor(i / 5) * 40})`} />;
        })}
      </g>
      {/* conveyor into the shredder */}
      <rect x="410" y="470" width="330" height="28" fill="#5b6d7a" />
      <g className="sa-belt">{Array.from({ length: 6 }).map((_, i) => <rect key={i} x={420 + i * 120} y="446" width={items[i % 3][1]} height={items[i % 3][2]} rx="4" fill={items[i % 3][0]} />)}</g>
      <g><rect x="700" y="380" width="130" height="150" rx="10" fill="#7c8b96" /><g transform="translate(765 455)"><g className="sa-spin-fast"><path d="M-30 0 H30 M0 -30 V30 M-21 -21 L21 21 M-21 21 L21 -21" stroke="#2c3a44" strokeWidth="8" /></g></g></g>
      {/* magnet crane */}
      <g><rect x="820" y="140" width="12" height="160" fill="#46525a" /><rect x="820" y="140" width="220" height="12" fill="#46525a" />
        <g className="sa-lift"><rect x="1000" y="152" width="4" height="90" fill="#46525a" /><path d="M980 242 h44 v14 h-10 v-8 h-24 v8 h-10z" fill="#D9534F" /></g></g>
      {/* output bins */}
      {[["Cu", 860, "#c4652d"], ["Al", 950, "#9aa9b3"], ["Au", 1040, "#d4a017"], ["Nhựa", 1130, "#3B8FD9"]].map(([s, x, c]) => (
        <g key={s}><rect x={x - 38} y="440" width="76" height="110" rx="8" fill={c} opacity=".9" /><text x={x} y="495" textAnchor="middle" dominantBaseline="central" fontSize={s.length > 2 ? 18 : 24} fontWeight="800" fill="#fff">{s}</text></g>
      ))}
      {sub === "end_of_life/ewaste" && (
        <g>{[["Pb", 150, "#5b6d7a"], ["Hg", 250, "#9a62c9"], ["Cd", 350, "#c4652d"]].map(([s, x, c], i) => (
          <g key={s} className="sa-lift" style={{ animationDelay: `${i * 0.3}s` }}>
            <path d={`M${x} 250 l30 52 h-60z`} fill="#ffd24d" stroke={INK} strokeWidth="3" />
            <text x={x} y="285" textAnchor="middle" dominantBaseline="central" fontSize="18" fontWeight="800" fill={INK}>{s}</text>
            <circle cx={x} cy="330" r="6" fill={c} className="sa-drop" />
          </g>
        ))}</g>
      )}
      {sub === "end_of_life/recover" && (
        <g>{[860, 950, 1040, 1130].map((x, i) => <circle key={x} cx={x} cy="420" r="10" fill="#7ef0a6" className="sa-drop" style={{ animationDelay: `${i * 0.4}s` }} />)}</g>
      )}
    </g>
  );
});

const ART = { materials: Materials, production: Production, transport: Transport, use: Use, end_of_life: EndOfLife };

/** The art of a scene key (top or sub). Hotspots only on top-level scenes. */
export default function SceneArt({ sceneKey, labels, onDive, data, painting }) {
  const top = sceneKey.split("/")[0];
  const Art = ART[top];
  if (!Art) return null;
  const isSub = sceneKey.includes("/");
  const h = isSub ? (HOTSPOTS[top] || []).find((x) => x.key === sceneKey) : null;
  const view = h ? h.view.join(" ") : "0 0 1200 700";
  return (
    <svg viewBox={view} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full" role="img" aria-label={labels[sceneKey]}>
      {painting && <image href={painting} x="0" y="0" width="1200" height="700" preserveAspectRatio="xMidYMid slice" opacity=".9" />}
      <g opacity={painting ? 0.55 : 1}><Art sub={isSub ? sceneKey : null} {...data} /></g>
      {!isSub && (HOTSPOTS[top] || []).map((spot) => <Hotspot key={spot.key} h={spot} label={labels[spot.key]} onDive={onDive} />)}
    </svg>
  );
}
