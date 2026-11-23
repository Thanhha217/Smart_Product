// Animated, data-driven SVG scenes for the CO2 flipbook.
// The drawings react to the real numbers (ship route length, number of trees, smoke amount...),
// and never print a number that is not passed in. All text labels stay in HTML or in props.

const C = {
  sky: "#e8f4fb", sea: "#7cc4e8", seaDeep: "#3d97c8", land: "#cfe8b8", land2: "#9fcf7a",
  ink: "#1f3b4d", factory: "#8a9aa8", smoke: "#b9c2c9", coal: "#55616b", leaf: "#2e9e5b",
  sun: "#f6c445", warm: "#e0812a", red: "#d64545",
};

export function StoryStyles() {
  return (
    <style>{`
      @keyframes sb-dash { to { stroke-dashoffset: -40; } }
      @keyframes sb-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
      @keyframes sb-smoke { 0% { transform: translate(0,0) scale(.6); opacity:.8 } 100% { transform: translate(14px,-60px) scale(1.6); opacity:0 } }
      @keyframes sb-sail { 0% { offset-distance: 0% } 100% { offset-distance: 100% } }
      @keyframes sb-spin { to { transform: rotate(360deg) } }
      @keyframes sb-pulse { 0%,100% { opacity:.55 } 50% { opacity:1 } }
      @keyframes sb-grow { from { transform: scale(0) } to { transform: scale(1) } }
      .sb-flow { stroke-dasharray: 8 12; animation: sb-dash 1.2s linear infinite; }
      .sb-float { animation: sb-float 3s ease-in-out infinite; transform-box: fill-box; }
      .sb-smoke { animation: sb-smoke 3.2s ease-out infinite; transform-box: fill-box; transform-origin: center; }
      .sb-spin { animation: sb-spin 8s linear infinite; transform-box: fill-box; transform-origin: center; }
      .sb-pulse { animation: sb-pulse 1.6s ease-in-out infinite; }
      .sb-grow { animation: sb-grow .5s ease-out both; transform-box: fill-box; transform-origin: bottom center; }
      @media (prefers-reduced-motion: reduce) { .sb-flow,.sb-float,.sb-smoke,.sb-spin,.sb-pulse,.sb-grow { animation: none } }
    `}</style>
  );
}

function Tree({ x, y, s = 1, delay = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="sb-grow" style={{ animationDelay: `${delay}s` }}>
        <rect x="-2" y="0" width="4" height="10" fill="#8b5a2b" />
        <circle cx="0" cy="-4" r="9" fill={C.leaf} />
        <circle cx="-5" cy="0" r="6" fill="#3fb36f" />
        <circle cx="5" cy="0" r="6" fill="#279150" />
      </g>
    </g>
  );
}

function Device({ category, x, y, s = 1 }) {
  const c = category || "";
  let body;
  if (c.includes("phone") || c === "smartwatch") {
    body = (<g><rect x="-14" y="-26" width="28" height="52" rx="6" fill={C.ink} /><rect x="-11" y="-21" width="22" height="40" rx="2" fill="#6ec6f0" /></g>);
  } else if (c.includes("monitor") || c === "television") {
    body = (<g><rect x="-36" y="-26" width="72" height="44" rx="3" fill={C.ink} /><rect x="-32" y="-22" width="64" height="36" fill="#6ec6f0" /><rect x="-4" y="18" width="8" height="10" fill={C.ink} /><rect x="-16" y="27" width="32" height="4" rx="2" fill={C.ink} /></g>);
  } else if (c.includes("air_condition")) {
    body = (<g><rect x="-40" y="-14" width="80" height="26" rx="6" fill="#f4f7f9" stroke={C.ink} strokeWidth="2" /><line x1="-30" y1="6" x2="30" y2="6" stroke={C.ink} strokeWidth="2" /></g>);
  } else if (c.includes("refrigerator") || c.includes("washing")) {
    body = (<g><rect x="-22" y="-40" width="44" height="76" rx="4" fill="#f4f7f9" stroke={C.ink} strokeWidth="2" /><line x1="-22" y1="-8" x2="22" y2="-8" stroke={C.ink} strokeWidth="2" /></g>);
  } else if (c.includes("headphone") || c === "speaker") {
    body = (<g><path d="M-22 6 A22 22 0 0 1 22 6" fill="none" stroke={C.ink} strokeWidth="5" /><rect x="-28" y="2" width="12" height="20" rx="4" fill={C.ink} /><rect x="16" y="2" width="12" height="20" rx="4" fill={C.ink} /></g>);
  } else {
    body = (<g><rect x="-34" y="-24" width="68" height="40" rx="3" fill={C.ink} /><rect x="-30" y="-20" width="60" height="32" fill="#6ec6f0" /><path d="M-42 16 L42 16 L36 24 L-36 24 Z" fill="#5b6d7a" /></g>);
  }
  return <g transform={`translate(${x} ${y}) scale(${s})`}>{body}</g>;
}

export function CoverArt({ category, score }) {
  const ring = score === null || score === undefined ? "#9ca3af" : `hsl(${Math.round((Math.max(0, Math.min(5, score)) / 5) * 120)},70%,42%)`;
  return (
    <svg viewBox="0 0 320 220" className="w-full h-auto" role="img" aria-label="Earth and product">
      <circle cx="160" cy="112" r="86" fill={C.sea} />
      <path d="M95 80 q25 -30 60 -10 q20 15 5 35 q-25 15 -45 0 q-25 -5 -20 -25z" fill={C.land2} />
      <path d="M175 135 q30 -20 55 5 q5 25 -25 30 q-30 0 -30 -35z" fill={C.land2} />
      <circle cx="160" cy="112" r="94" fill="none" stroke={ring} strokeWidth="8" strokeDasharray="10 8" className="sb-flow" />
      <g className="sb-float"><Device category={category} x={160} y={112} s={1.25} /></g>
      <Tree x={62} y={190} s={1.2} /><Tree x={258} y={190} s={1.2} delay={0.2} /><Tree x={282} y={196} s={0.9} delay={0.4} />
    </svg>
  );
}

// The journey: 5 clickable stations on a flowing path.
export function JourneyMap({ stations, onPick, active }) {
  const pts = [[40, 170], [110, 70], [190, 150], [250, 60], [300, 160]];
  const path = "M40 170 C 70 90, 90 70, 110 70 S 170 160, 190 150 S 230 50, 250 60 S 290 150, 300 160";
  const icons = ["⛏️", "🏭", "🚢", "🔌", "♻️"];
  return (
    <svg viewBox="0 0 340 220" className="w-full h-auto" role="group" aria-label="Lifecycle journey">
      <rect x="0" y="0" width="340" height="220" rx="16" fill={C.sky} />
      <path d={path} fill="none" stroke="#c9dfe9" strokeWidth="10" strokeLinecap="round" />
      <path d={path} fill="none" stroke={C.leaf} strokeWidth="4" strokeLinecap="round" className="sb-flow" />
      <circle r="6" fill={C.warm} style={{ offsetPath: `path('${path}')`, animation: "sb-sail 6s linear infinite" }} />
      {stations.map((st, i) => {
        const [x, y] = pts[i];
        const isActive = active === i;
        return (
          <g key={st.key} transform={`translate(${x} ${y})`} style={{ cursor: "pointer" }} onClick={() => onPick(i)}
             role="button" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPick(i)} aria-label={st.label}>
            <circle r={isActive ? 25 : 22} fill="#fff" stroke={isActive ? C.warm : C.ink} strokeWidth={isActive ? 4 : 2} className={isActive ? "sb-pulse" : ""} />
            <text textAnchor="middle" dominantBaseline="central" fontSize="20">{icons[i]}</text>
            <text y="38" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.ink}>{st.label}</text>
            {st.value && <text y="51" textAnchor="middle" fontSize="10" fill="#4b5563">{st.value}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function FactoryScene({ intensity = 0.5 }) {
  const puffs = Math.max(2, Math.min(8, Math.round(2 + intensity * 6)));
  return (
    <svg viewBox="0 0 320 180" className="w-full h-auto" role="img" aria-label="Mine and factory">
      <rect width="320" height="180" rx="14" fill={C.sky} />
      <path d="M0 150 L50 80 L90 120 L130 70 L170 150 Z" fill="#b9a58a" />
      <circle cx="78" cy="118" r="5" fill="#e6b422" /><circle cx="120" cy="110" r="4" fill="#9aa4ad" /><circle cx="100" cy="135" r="4" fill="#c46b3c" />
      <rect x="0" y="150" width="320" height="30" fill={C.land} />
      <g>
        <rect x="185" y="95" width="110" height="55" fill={C.factory} />
        <path d="M185 95 L205 80 L205 95 L225 80 L225 95 L245 80 L245 95 Z" fill="#76858f" />
        <rect x="262" y="45" width="14" height="50" fill="#6b7a84" /><rect x="240" y="60" width="12" height="35" fill="#6b7a84" />
        {Array.from({ length: puffs }).map((_, i) => (
          <circle key={i} cx={i % 2 ? 269 : 246} cy={i % 2 ? 40 : 55} r="9" fill={C.smoke} className="sb-smoke" style={{ animationDelay: `${(i * 3.2) / puffs}s` }} />
        ))}
        {[200, 222, 244, 266].map((x) => <rect key={x} x={x} y="112" width="12" height="12" fill="#f6e7a1" />)}
      </g>
      <path d="M150 140 L185 130" stroke={C.ink} strokeWidth="3" className="sb-flow" />
    </svg>
  );
}

export function ShipScene({ originCode = "CN", distanceKm, mode }) {
  // Route length grows with distance; Vietnam-made products only travel by road.
  const local = originCode === "VN" || mode === "road";
  const len = local ? 0 : Math.max(0.35, Math.min(1, (distanceKm || 2000) / 3000));
  const startX = 290 - 230 * len;
  const route = `M${startX} 70 Q ${(startX + 270) / 2} 20, 270 110`;
  return (
    <svg viewBox="0 0 320 180" className="w-full h-auto" role="img" aria-label="Shipping route to Vietnam">
      <rect width="320" height="180" rx="14" fill={C.sea} />
      <path d="M250 60 q20 10 25 30 q-5 30 10 55 l-30 10 q-15 -40 -10 -95z" fill={C.land2} />
      <text x="262" y="170" fontSize="11" fontWeight="700" fill={C.ink}>Việt Nam</text>
      {!local && <>
        <path d={`M0 0 L${startX + 10} 0 L${startX + 30} 50 L${startX - 10} 90 L0 90 Z`} fill={C.land2} opacity=".9" />
        <path d={route} fill="none" stroke="#fff" strokeWidth="3" className="sb-flow" />
        <g style={{ offsetPath: `path('${route}')`, animation: "sb-sail 7s ease-in-out infinite", offsetRotate: "0deg" }}>
          <path d="M-16 0 L16 0 L11 8 L-11 8 Z" fill={C.ink} /><rect x="-8" y="-9" width="6" height="9" fill={C.warm} /><rect x="0" y="-9" width="6" height="9" fill="#329AD2" />
        </g>
      </>}
      {local && <g className="sb-float"><rect x="230" y="120" width="34" height="18" rx="3" fill={C.warm} /><circle cx="238" cy="140" r="4" fill={C.ink} /><circle cx="258" cy="140" r="4" fill={C.ink} /></g>}
      <path d="M0 150 Q 80 140 160 152 T 320 148" fill="none" stroke={C.seaDeep} strokeWidth="3" opacity=".6" />
    </svg>
  );
}

export function GridScene({ category }) {
  return (
    <svg viewBox="0 0 320 180" className="w-full h-auto" role="img" aria-label="Vietnam power grid to home">
      <rect width="320" height="180" rx="14" fill={C.sky} />
      <circle cx="285" cy="30" r="14" fill={C.sun} />
      <rect x="0" y="150" width="320" height="30" fill={C.land} />
      <g><rect x="20" y="95" width="60" height="55" fill={C.coal} /><rect x="30" y="55" width="12" height="40" fill="#46525a" /><rect x="55" y="65" width="10" height="30" fill="#46525a" />
        {[0, 1, 2, 3].map((i) => <circle key={i} cx={i % 2 ? 60 : 36} cy={i % 2 ? 60 : 50} r="8" fill="#8f979d" className="sb-smoke" style={{ animationDelay: `${i * 0.8}s` }} />)}
      </g>
      <g><rect x="95" y="122" width="34" height="18" fill="#2f6db5" transform="skewX(-15)" /><rect x="101" y="140" width="3" height="10" fill={C.ink} /></g>
      <line x1="88" y1="80" x2="88" y2="150" stroke={C.ink} strokeWidth="3" /><line x1="190" y1="80" x2="190" y2="150" stroke={C.ink} strokeWidth="3" />
      <path d="M80 82 Q 135 100 190 82 Q 215 92 228 100" fill="none" stroke={C.warm} strokeWidth="3" className="sb-flow" />
      <g><path d="M215 100 L265 70 L315 100 Z" fill="#c0563b" /><rect x="222" y="100" width="86" height="50" fill="#fdf3e1" />
        <Device category={category} x={265} y={128} s={0.42} /></g>
    </svg>
  );
}

export function RecycleScene() {
  return (
    <svg viewBox="0 0 320 180" className="w-full h-auto" role="img" aria-label="End of life and recycling">
      <rect width="320" height="180" rx="14" fill={C.sky} />
      <rect x="0" y="150" width="320" height="30" fill={C.land} />
      <g transform="translate(110 100)"><g className="sb-spin">
        {[0, 120, 240].map((a) => (
          <path key={a} d="M0 -42 A42 42 0 0 1 36 -21" fill="none" stroke={C.leaf} strokeWidth="9" strokeLinecap="round" transform={`rotate(${a})`} />
        ))}
      </g><text textAnchor="middle" dominantBaseline="central" fontSize="26">♻️</text></g>
      <g transform="translate(230 105)"><rect x="-26" y="-20" width="52" height="56" rx="4" fill="#5b8f3a" /><rect x="-30" y="-28" width="60" height="10" rx="3" fill="#467a2b" />
        <text textAnchor="middle" y="14" fontSize="18">🔋</text></g>
    </svg>
  );
}

export function TreesScene({ trees }) {
  const n = Math.max(1, Math.min(40, Math.round(trees || 1)));
  return (
    <svg viewBox="0 0 320 150" className="w-full h-auto" role="img" aria-label={`${n} trees`}>
      <rect width="320" height="150" rx="14" fill={C.sky} />
      <rect x="0" y="125" width="320" height="25" fill={C.land} />
      {Array.from({ length: n }).map((_, i) => {
        const row = Math.floor(i / 10), col = i % 10;
        return <Tree key={i} x={24 + col * 30 + (row % 2) * 12} y={118 - row * 26} s={0.9} delay={i * 0.04} />;
      })}
    </svg>
  );
}

export function CityScene() {
  const items = [["💧", 50], ["⚡", 125], ["🌾", 200], ["🌳", 275]];
  return (
    <svg viewBox="0 0 320 180" className="w-full h-auto" role="img" aria-label="Smart city and the WEFE nexus">
      <rect width="320" height="180" rx="14" fill={C.sky} />
      {[[20, 70, 30], [55, 50, 25], [85, 85, 30], [190, 60, 28], [225, 40, 32], [262, 75, 30]].map(([x, h, w], i) => (
        <rect key={i} x={x} y={150 - h} width={w} height={h} fill={i % 2 ? "#9db3c4" : "#b9cad6"} />
      ))}
      <rect x="0" y="150" width="320" height="30" fill={C.land} />
      <path d="M50 40 L125 40 L200 40 L275 40" fill="none" stroke={C.leaf} strokeWidth="3" className="sb-flow" />
      {items.map(([icon, x]) => (
        <g key={x} transform={`translate(${x} 40)`}><circle r="18" fill="#fff" stroke={C.ink} strokeWidth="2" /><text textAnchor="middle" dominantBaseline="central" fontSize="16">{icon}</text></g>
      ))}
    </svg>
  );
}
