// The same explorer, but over the product's REAL photo instead of a drawing.
//
// The picture is the one the catalogue already stores for this product (product.image_url, the
// shop's own shot) and the one the cards already show -- nothing new is fetched or re-hosted.
// Over it sit three transparent hotspots: the display, the keyboard deck and the chassis.
//
// Hotspots are written as fractions of the picture, so they survive a change of resolution; they
// were measured against the 512 x 512 shot of the Acer Predator Helios Neo 16 and are per-product
// by nature -- another photo, another angle, another set of numbers.
import { ISO_H, ISO_W } from "./IsoMachine";

// Where the square photo sits inside the shared world, so one camera serves both views.
export const PHOTO = { x: (ISO_W - 512) / 2, y: (ISO_H - 512) / 2, size: 512 };

const frac = (fx, fy) => [PHOTO.x + fx * PHOTO.size, PHOTO.y + fy * PHOTO.size];

/** left, top, right, bottom as fractions of the picture. */
export const HOTSPOTS = [
  { part: "screen", box: [0.17, 0.19, 0.84, 0.62], tag: [0.5, 0.20], dx: -112, dy: -46 },
  { part: "deck", box: [0.14, 0.655, 0.87, 0.775], tag: [0.80, 0.70], dx: 92, dy: -10 },
  { part: "body", box: [0.11, 0.775, 0.89, 0.875], tag: [0.18, 0.86], dx: -96, dy: 56 },
];

function Spot({ box, part, on, onPick }) {
  const [x1, y1] = frac(box[0], box[1]);
  const [x2, y2] = frac(box[2], box[3]);
  return (
    <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} rx="8"
          data-part={part} data-on={on ? "1" : "0"}
          fill={on ? "rgba(224,165,38,.16)" : "transparent"}
          stroke={on ? "#E0A526" : "transparent"} strokeWidth={on ? 3 : 2}
          onClick={(e) => { e.stopPropagation(); onPick?.(part); }} />
  );
}

function Tag({ at, dx, dy, title, note, on }) {
  const [px, py] = frac(at[0], at[1]);
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
.photoz [data-part]{cursor:pointer}
.photoz [data-part]:hover{fill:rgba(31,93,58,.12);stroke:#1F5D3A}
`;

export default function PhotoMachine({ svgRef, src, level, focus, head = {}, labels, onPick, onClick }) {
  const deep = level >= 2;
  const title = { screen: labels.screen, deck: labels.board, body: labels.body };
  const note = { screen: head.screen, deck: head.cpu, body: head.power };

  return (
    <svg ref={svgRef} className="photoz w-full h-full touch-none select-none"
         preserveAspectRatio="xMidYMid meet" onClick={onClick} role="application" aria-label={labels.aria}>
      <style>{STYLE}</style>
      {/* The shop's shot comes on a white card. `multiply` drops that white into whatever the
          panel behind is, so the machine sits on the page instead of in a white box. */}
      <image href={src} x={PHOTO.x} y={PHOTO.y} width={PHOTO.size} height={PHOTO.size}
             preserveAspectRatio="xMidYMid meet" style={{ mixBlendMode: "multiply" }} />
      {HOTSPOTS.map((h) => <Spot key={h.part} box={h.box} part={h.part} on={focus === h.part} onPick={onPick} />)}
      {HOTSPOTS.map((h) => (
        <Tag key={h.part} at={h.tag} dx={h.dx} dy={h.dy}
             title={title[h.part]} note={deep ? note[h.part] : null} on={focus === h.part} />
      ))}
    </svg>
  );
}
