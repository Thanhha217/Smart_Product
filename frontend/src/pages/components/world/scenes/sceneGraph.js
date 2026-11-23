// The places of the CO2 world you can "walk into". A key is a path: "production", "production/chip".
// Top-level scenes are siblings (swipe / ← → between them); sub-scenes dive from hotspots.

export const TOP = ["materials", "production", "transport", "use", "end_of_life", "formula", "category"];
export const JOURNEY = ["materials", "production", "transport", "use", "end_of_life"];

// Stored lifecycle stage behind each scene (materials are counted inside production).
export const STAGE_OF = {
  materials: "materials_production", production: "materials_production", transport: "transport",
  use: "use", end_of_life: "end_of_life",
};

// World/explain topic -> scene (clicking that object on the overview walks into the scene).
export const SCENE_OF_TOPIC = {
  materials: "materials", factory: "production", transport: "transport", use: "use", grid: "use/grid",
  end_of_life: "end_of_life", formula: "formula", category: "category", greener_alternative: "category",
};
export const SCENE_OF_STAGE = {
  materials: "materials", materials_production: "production", transport: "transport", use: "use", end_of_life: "end_of_life",
  formula: "formula",
};
// explain topic used by "Hỏi AI về chỗ này" in each scene
export const TOPIC_OF_SCENE = {
  materials: "materials", production: "factory", transport: "transport", use: "use", end_of_life: "end_of_life",
  formula: "formula", category: "category",
  "materials/ore": "materials", "materials/refining": "materials",
  "production/chip": "factory", "production/screen": "factory", "production/battery": "factory", "production/assembly": "factory",
  "transport/mode": "transport", "transport/route": "transport",
  "use/grid": "grid", "use/years": "use",
  "end_of_life/ewaste": "end_of_life", "end_of_life/recover": "end_of_life",
};

// Hotspots of each top scene: where they sit in the scene art (viewBox 1200x700) and the
// part of the art a dive zooms into (sub-scenes reuse the parent art with a closer viewBox).
export const HOTSPOTS = {
  materials: [
    { key: "materials/ore", x: 360, y: 470, view: [120, 250, 600, 350] },
    { key: "materials/refining", x: 930, y: 330, view: [640, 120, 560, 330] },
  ],
  production: [
    { key: "production/chip", x: 250, y: 360, view: [60, 170, 420, 250] },
    { key: "production/screen", x: 520, y: 330, view: [330, 150, 420, 250] },
    { key: "production/battery", x: 790, y: 360, view: [600, 170, 420, 250] },
    { key: "production/assembly", x: 1010, y: 470, view: [760, 300, 440, 260] },
  ],
  transport: [
    { key: "transport/mode", x: 640, y: 330, view: [330, 120, 620, 370] },
    { key: "transport/route", x: 1010, y: 150, view: [760, 20, 440, 260] },
  ],
  use: [
    { key: "use/grid", x: 1030, y: 230, view: [800, 60, 400, 240] },
    { key: "use/years", x: 300, y: 300, view: [100, 150, 480, 290] },
  ],
  end_of_life: [
    { key: "end_of_life/ewaste", x: 250, y: 420, view: [40, 230, 480, 290] },
    { key: "end_of_life/recover", x: 900, y: 430, view: [660, 250, 520, 310] },
  ],
};

export function parentOf(key) {
  if (!key) return null;
  const i = key.lastIndexOf("/");
  return i < 0 ? null : key.slice(0, i);
}
export function topOf(key) {
  return key ? key.split("/")[0] : null;
}
export function isValid(key) {
  if (!key) return false;
  if (TOP.includes(key)) return true;
  const top = topOf(key);
  return (HOTSPOTS[top] || []).some((h) => h.key === key);
}
export function siblingsOf(key) {
  const p = parentOf(key);
  return p ? (HOTSPOTS[p] || []).map((h) => h.key) : TOP;
}
export function hotspotOf(key) {
  const p = parentOf(key);
  return p ? (HOTSPOTS[p] || []).find((h) => h.key === key) : null;
}
/** How to animate from a to b: enter | exit | deeper | up | slide (+dir) | swap. */
export function relation(a, b) {
  if (!a && b) return { kind: "enter" };
  if (a && !b) return { kind: "exit" };
  if (a === b) return { kind: "none" };
  if (b.startsWith(`${a}/`)) return { kind: "deeper" };
  if (a.startsWith(`${b}/`)) return { kind: "up" };
  if (parentOf(a) === parentOf(b)) {
    const s = siblingsOf(a);
    return { kind: "slide", dir: s.indexOf(b) > s.indexOf(a) ? 1 : -1 };
  }
  return { kind: "swap" };
}
