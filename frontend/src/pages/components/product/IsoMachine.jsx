// The machine drawn in isometric: a real laptop, not a block -- individual keys, a hinge, the
// ports down the right flank, the vent grille, the lid badge and a lit screen.
//
// Geometry is in millimetres of the real product (Acer Predator Helios Neo 16: 357 × 276 × 27 mm,
// 16" display), projected 2:1-ish, so the proportions are the machine's own rather than eyeballed.
//
// What the drawing SAYS depends on the zoom level, not only on its scale:
//   1  the zones are named
//   2  each zone also shows its headline figure
//   3  reserved for the exploded view

export const ISO_W = 760;
export const ISO_H = 700;

const BASE = { w: 357, d: 276, h: 20 };
const LID = { w: 357, d: 11, h: 232 };

const OX = 320;
const OY = 300;

/** (x, y, z) in mm -> a point on the page. x runs right-down, y left-down, z up. */
export function iso(x, y, z) {
  return [(x - y) * 0.866 + OX, (x + y) * 0.5 - z + OY];
}
const pts = (list) => list.map(([x, y, z]) => iso(x, y, z).join(",")).join(" ");

function Box({ x, y, z, w, d, h, top, left, right, stroke = "#0E1318", sw = 1.3 }) {
  const t = [[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]];
  const l = [[x, y + d, z + h], [x + w, y + d, z + h], [x + w, y + d, z], [x, y + d, z]];
  const r = [[x + w, y, z + h], [x + w, y + d, z + h], [x + w, y + d, z], [x + w, y, z]];
  return (
    <>
      <polygon points={pts(l)} fill={left} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      <polygon points={pts(r)} fill={right} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      <polygon points={pts(t)} fill={top} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
    </>
  );
}

/** A flat patch lying on a horizontal surface. */
function Deck({ x, y, w, d, z, fill, stroke = "none", sw = 0 }) {
  return <polygon points={pts([[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]])}
                  fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
}

/** A flat patch standing on the lid's front face. */
function Face({ x1, x2, z1, z2, y, fill, stroke = "none", sw = 0 }) {
  return <polygon points={pts([[x1, y, z1], [x2, y, z1], [x2, y, z2], [x1, y, z2]])}
                  fill={fill} stroke={stroke} strokeWidth={sw} />;
}

/** A keycap: a small slab standing 1.6 mm proud of the deck, so it catches the light. */
function Key({ x, y, w, d, z }) {
  return <Box x={x} y={y} z={z} w={w} d={d} h={1.6} top="#4A5564" left="#232B34" right="#303945" stroke="#171D24" sw={0.7} />;
}

// Six rows of a real 16" keyboard: a number row, three letter rows, a modifier row, arrows.
const KB = { x: 30, y: 44, w: 232, rowD: 15.5, gap: 2.2 };
const ROWS = [
  { n: 14, pad: 0 },
  { n: 14, pad: 0 },
  { n: 13, pad: 6 },
  { n: 13, pad: 10 },
  { n: 11, pad: 0 },
  { n: 8, pad: 0 },
];

function Keyboard({ z }) {
  return (
    <>
      <Deck x={KB.x - 6} y={KB.y - 6} w={KB.w + 12} d={ROWS.length * (KB.rowD + KB.gap) + 10} z={z + 0.3} fill="#1B222B" />
      {ROWS.map((row, r) => {
        const y = KB.y + r * (KB.rowD + KB.gap);
        const kw = (KB.w - row.pad - (row.n - 1) * 2) / row.n;
        return Array.from({ length: row.n }, (_, i) => (
          <Key key={`${r}-${i}`} x={KB.x + row.pad + i * (kw + 2)} y={y} w={kw} d={KB.rowD} z={z + 0.6} />
        ));
      })}
    </>
  );
}

/** The ports along the right flank (the x = w face): USB-C, USB-A, HDMI, RJ-45. */
function Ports({ x, z }) {
  const slot = (y, d, h, fill) => (
    <polygon key={`${y}`} points={pts([[x, y, z + h], [x, y + d, z + h], [x, y + d, z], [x, y, z]])}
             fill={fill} stroke="#0E1318" strokeWidth="0.6" />
  );
  return (
    <>
      {slot(58, 11, 4.2, "#11161C")}
      {slot(78, 14, 6.5, "#11161C")}
      {slot(100, 17, 7.5, "#11161C")}
      {slot(126, 16, 8, "#11161C")}
    </>
  );
}

function Tag({ at, dx, dy, title, note, on }) {
  const [px, py] = iso(...at);
  const w = Math.max(title.length, (note || "").length * 0.92) * 7.6 + 26;
  const h = note ? 42 : 28;
  // Clamp the box inside the drawing: an offset that looked fine for "Screen" pushed
  // "Board & processor" off the right edge and "Body & battery" off the left one.
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
  const bx = clamp(dx < 0 ? px + dx - w : px + dx, 8, ISO_W - w - 8);
  const by = clamp(py + dy - h / 2, 8, ISO_H - h - 8);
  // the leader points at whichever side of the box faces the part
  const ex = px < bx ? bx : px > bx + w ? bx + w : px;
  const ey = clamp(py, by, by + h);
  return (
    <g style={{ pointerEvents: "none" }}>
      <line x1={px} y1={py} x2={ex} y2={ey} stroke="#1F5D3A" strokeWidth="1.6" />
      <circle cx={px} cy={py} r="4.5" fill="#1F5D3A" stroke="#fff" strokeWidth="1.4" />
      <rect x={bx} y={by} width={w} height={h} rx={note ? 11 : 14}
            fill={on ? "#1F5D3A" : "#FFFFFF"} stroke="#1F5D3A" strokeWidth="1.6" />
      <text x={bx + 13} y={by + (note ? 17 : 19)} fontSize="14.5" fontWeight="700"
            fill={on ? "#FFFFFF" : "#1E2B22"}>{title}</text>
      {note && <text x={bx + 13} y={by + 34} fontSize="12.5" fontWeight="600"
                     fill={on ? "#BFE0C8" : "#55604F"}>{note}</text>}
    </g>
  );
}

const STYLE = `
.isoz [data-part]{cursor:pointer}
.isoz [data-part]:hover polygon{filter:brightness(1.12)}
.isoz [data-part][data-on="1"] > polygon:first-of-type{stroke:#E0A526;stroke-width:3}
`;

export default function IsoMachine({ svgRef, level, focus, head = {}, labels, onPick, onClick }) {
  const hit = (part) => ({
    "data-part": part,
    "data-on": focus === part ? "1" : "0",
    onClick: (e) => { e.stopPropagation(); onPick?.(part); },
  });
  const deep = level >= 2;
  const topZ = BASE.h;

  return (
    <svg ref={svgRef} className="isoz w-full h-full touch-none select-none"
         preserveAspectRatio="xMidYMid meet" onClick={onClick} role="application" aria-label={labels.aria}>
      <style>{STYLE}</style>
      <defs>
        <linearGradient id="iso-wall" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#24456E" /><stop offset="0.55" stopColor="#14263F" /><stop offset="1" stopColor="#0A1522" />
        </linearGradient>
        <linearGradient id="iso-lidtop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3D4854" /><stop offset="1" stopColor="#2A323C" />
        </linearGradient>
        <radialGradient id="iso-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#1E2B22" stopOpacity="0.18" /><stop offset="1" stopColor="#1E2B22" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx={iso(178, 150, 0)[0]} cy={iso(178, 150, 0)[1] + 14} rx="250" ry="92" fill="url(#iso-glow)" />

      {/* ---------------------------------------------------------------- lid */}
      <g {...hit("screen")}>
        <Box x={0} y={0} z={topZ} w={LID.w} d={LID.d} h={LID.h}
             top="url(#iso-lidtop)" left="#1E252E" right="#2C3540" />
        {/* bezel, then the lit panel inside it */}
        <Face x1={9} x2={LID.w - 9} z1={topZ + 10} z2={topZ + LID.h - 9} y={LID.d} fill="#0D1217" />
        <Face x1={17} x2={LID.w - 17} z1={topZ + 20} z2={topZ + LID.h - 17} y={LID.d} fill="url(#iso-wall)" />
        {/* a few desktop shapes so the screen reads as switched on */}
        <Face x1={32} x2={128} z1={topZ + LID.h - 60} z2={topZ + LID.h - 32} y={LID.d + 0.1} fill="#2F5A8C" />
        <Face x1={32} x2={96} z1={topZ + LID.h - 96} z2={topZ + LID.h - 70} y={LID.d + 0.1} fill="#23466E" />
        <Face x1={140} x2={322} z1={topZ + 34} z2={topZ + 44} y={LID.d + 0.1} fill="#1B3355" />
        {/* webcam notch and the badge on the lid's back */}
        <Face x1={175} x2={183} z1={topZ + LID.h - 15} z2={topZ + LID.h - 11} y={LID.d + 0.1} fill="#39506B" />
      </g>

      {/* ---------------------------------------------------------------- hinge */}
      <Box x={96} y={LID.d} z={topZ - 5} w={56} d={9} h={7} top="#2A323C" left="#1C222A" right="#232A33" sw={0.8} />
      <Box x={205} y={LID.d} z={topZ - 5} w={56} d={9} h={7} top="#2A323C" left="#1C222A" right="#232A33" sw={0.8} />

      {/* ---------------------------------------------------------------- base */}
      <g {...hit("base")}>
        <Box x={0} y={0} z={0} w={BASE.w} d={BASE.d} h={BASE.h}
             top="#434D5A" left="#232A33" right="#333C47" />
        {/* vent grille behind the keyboard */}
        {Array.from({ length: 9 }, (_, i) => (
          <Deck key={i} x={46 + i * 28} y={24} w={18} d={12} z={topZ + 0.3} fill="#1B222B" />
        ))}
        <Keyboard z={topZ} />
        {/* trackpad, slightly recessed, with its click line */}
        <Deck x={112} y={196} w={118} d={66} z={topZ + 0.3} fill="#39424E" stroke="#232A33" sw={1.1} />
        <Deck x={170} y={240} w={2} d={20} z={topZ + 0.5} fill="#2A323C" />
        {/* power key, top right of the deck */}
        <Key x={278} y={44} w={14} d={14} z={topZ + 0.6} />
        <Ports x={BASE.w} z={4} />
      </g>

      {/* ---------------------------------------------------------------- labels */}
      {/* the screen's label goes LEFT: to the right it hid under the zoom buttons */}
      <Tag at={[18, LID.d, topZ + 150]} dx={-104} dy={-4}
           title={labels.screen} note={deep ? head.screen : null} on={focus === "screen"} />
      <Tag at={[BASE.w - 6, 128, 9]} dx={88} dy={36}
           title={labels.board} note={deep ? head.cpu : null} on={focus === "base"} />
      <Tag at={[36, BASE.d - 22, 8]} dx={-88} dy={42}
           title={labels.body} note={deep ? head.power : null} on={focus === "base"} />
    </svg>
  );
}
