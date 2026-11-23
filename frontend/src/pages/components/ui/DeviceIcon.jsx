// One icon per device category, from the project's icon set (see deviceIconPaths.js).
// Used wherever a product has no usable photo, and on category chips and lifecycle stages.
import { DEVICE_ICON_PATHS } from "./deviceIconPaths";

// Catalogue categories (co2e_category) and a few loose spellings -> icon key.
const ALIAS = {
  laptops: "laptop", gaming_laptop: "laptop", notebook: "laptop",
  monitors: "computer_monitor", monitor: "computer_monitor", screen: "computer_monitor",
  smartphones: "smartphone", phone: "smartphone", feature_phone: "smartphone",
  tablets: "tablet", headphones: "headphone", earphones: "earphone",
  smartwatches: "smartwatch", watch: "smartwatch", wearables: "wearable",
  tv: "television", televisions: "television", speakers: "speaker",
  pc: "desktop", desktops: "desktop", computer_peripherals: "computer_peripheral",
  pc_components: "pc_component", cameras: "camera", console: "gaming_console",
  router: "networking", fan: "electric_fan", lights: "lighting", fridge: "refrigerator",
};

export function iconKeyFor(category) {
  const c = String(category || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!c) return "other";
  if (DEVICE_ICON_PATHS[c]) return c;
  if (ALIAS[c]) return ALIAS[c];
  const hit = Object.keys(DEVICE_ICON_PATHS).find((k) => c.includes(k));
  return hit || "other";
}

/**
 * @param name   icon key or a category name (resolved through iconKeyFor)
 * @param tint   draw the soft background layer (off below 20px, as the icon set says)
 */
export default function DeviceIcon({ name, size = 24, tint = true, className = "", title, strokeWidth = 1.6 }) {
  const key = DEVICE_ICON_PATHS[name] ? name : iconKeyFor(name);
  const icon = DEVICE_ICON_PATHS[key] || DEVICE_ICON_PATHS.other;
  const withTint = tint && size >= 20 && icon.tint;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} role={title ? "img" : undefined}
         aria-hidden={title ? undefined : "true"} aria-label={title || undefined} fill="none">
      {title && <title>{title}</title>}
      {withTint && <path d={icon.tint} fill="currentColor" opacity="0.16" />}
      <path d={icon.line} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Icon in a rounded tile, the way the icon sheet shows it on cards and chips. */
export function DeviceTile({ name, size = 44, className = "", tone = "green", title }) {
  const tones = {
    green: "bg-[#E4F1E6] text-[#1F5D3A]", amber: "bg-[#FBEFD3] text-[#8A5A00]",
    red: "bg-[#F9E0DE] text-[#9B2F2A]", slate: "bg-[#E8ECEF] text-[#334155]",
    plain: "bg-[#F1EEE4] text-[#4b5563]",
  };
  return (
    <span className={`grid place-items-center rounded-2xl shrink-0 ${tones[tone] || tones.green} ${className}`}
          style={{ width: size, height: size }}>
      <DeviceIcon name={name} size={Math.round(size * 0.58)} title={title} />
    </span>
  );
}

/** Tone from the category's CO2 level, as the icon sheet defines it (low / medium / high). */
export function co2Tone(kg) {
  if (kg === null || kg === undefined || Number.isNaN(Number(kg))) return "plain";
  const n = Number(kg);
  return n < 25 ? "green" : n <= 250 ? "amber" : "red";
}
