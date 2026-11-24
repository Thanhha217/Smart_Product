// "Inside the machine" as a zoomable isometric view instead of a book.
//
// The camera is the one the CO₂ world runs on (world/useCamera.js): it writes the viewBox
// directly, so dragging and pinching never re-render React. What this file adds is SEMANTIC
// zoom -- the drawing does not merely get bigger, it starts saying more:
//
//   level 1  the machine, its zones named
//   level 2  each zone also shows its headline figure
//   level 3  reserved for the exploded view (next step)
//
// Clicking a zone flies the camera to it and opens that zone's rows from lib/teardown.js.
import { useCallback, useMemo, useRef, useState } from "react";
import { tri } from "../../../i18n/LanguageContext";
import { useCamera } from "../world/useCamera";
import IsoMachine, { ISO_H, ISO_W, iso } from "./IsoMachine";
import PhotoMachine, { HOTSPOTS, PHOTO } from "./PhotoMachine";

// Where the camera sits when a zone is picked: centre in page units, plus the width to show.
// A gentle move, not a dive: the machine has to stay recognisable after the camera lands, so a
// pick shows about three quarters of the world rather than filling the frame with one panel.
const TARGET = {
  screen: { at: [150, 12, 150], w: 590 },
  base: { at: [178, 150, 20], w: 590 },
};

/** Which rows of the teardown a zone stands for. The drawing has two zones, the photo three. */
const SECTIONS = {
  screen: ["screen"],
  base: ["cpu", "memory", "power"],
  deck: ["cpu", "memory"],
  body: ["power"],
};

/** Where the camera lands over the photo, per hotspot. */
const PHOTO_TARGET = Object.fromEntries(HOTSPOTS.map((h) => {
  const [l, t, r, b] = h.box;
  return [h.part, { cx: PHOTO.x + ((l + r) / 2) * PHOTO.size, cy: PHOTO.y + ((t + b) / 2) * PHOTO.size, w: 590 }];
}));

const levelOf = (w) => (w > ISO_W * 0.8 ? 1 : w > ISO_W * 0.4 ? 2 : 3);

export default function MachineExplorer({ data, product, lang, height = 420, renderRows }) {
  const L3 = tri(lang);
  const photo = product?.image_url || null;
  // The real photograph whenever the catalogue has one. The drawing stays in the code because
  // only a drawing can be opened up (level 3), but it is not offered as a choice here.
  const usePhoto = Boolean(photo);
  const [focus, setFocus] = useState(null);
  const [level, setLevel] = useState(1);
  // The camera reports every frame of a drag. Re-rendering that often would stutter, so only a
  // change of LEVEL is pushed into React state; the viewBox itself is the camera's own business.
  const levelRef = useRef(1);
  const onChange = useCallback((c) => {
    const next = levelOf(c.w);
    if (next !== levelRef.current) { levelRef.current = next; setLevel(next); }
  }, []);
  const camera = useCamera({ width: ISO_W, height: ISO_H, minW: 220, margin: 160, onChange });
  const clear = useCallback((e) => {
    if (!camera.wasDrag() && !e.target.closest("[data-part]")) setFocus(null);
  }, [camera]);

  const pick = useCallback((part) => {
    setFocus(part);
    if (usePhoto) {
      const t = PHOTO_TARGET[part];
      if (t) camera.flyTo(t, 650);
      return;
    }
    const t = TARGET[part];
    if (!t) return;
    const [cx, cy] = iso(...t.at);
    camera.flyTo({ cx, cy, w: t.w }, 650);
  }, [camera, usePhoto]);

  const head = useMemo(() => {
    const first = (section, keys) => {
      const row = (data[section] || []).find((r) => keys.includes(r.k));
      return row ? row.v : null;
    };
    const screen = [first("screen", ["size"]), first("screen", ["refresh"])].filter(Boolean).join(" · ");
    const cpu = first("cpu", ["model"]);
    const power = first("power", ["battery"]);
    return { screen: screen || null, cpu, power };
  }, [data]);

  const labels = {
    aria: L3(`Hình mổ ${data.brand} ${data.model}`, `Cutaway of the ${data.brand} ${data.model}`,
             `Vue éclatée du ${data.brand} ${data.model}`),
    screen: L3("Màn hình", "Screen", "Écran"),
    board: L3("Bo mạch & vi xử lý", "Board & processor", "Carte & processeur"),
    body: L3("Thân máy & pin", "Body & battery", "Châssis & batterie"),
  };

  const rows = focus ? (SECTIONS[focus] || []).flatMap((s) => data[s] || []) : [];
  const title = { screen: labels.screen, base: labels.board, deck: labels.board, body: labels.body }[focus] || null;

  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <div className="relative min-w-0 flex-1 overflow-hidden rounded-[18px] border border-[#E3DFD3] bg-[#F7F5EF]"
           style={{ height }}>
        {usePhoto
          ? <PhotoMachine svgRef={camera.svgRef} src={photo} level={level} focus={focus} head={head} labels={labels}
                          onPick={pick} onClick={clear} />
          : <IsoMachine svgRef={camera.svgRef} level={level} focus={focus} head={head} labels={labels}
                        onPick={pick} onClick={clear} />}

        <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[12.5px] font-semibold text-[#55604F] shadow-sm">
          {level === 1 ? L3("Phóng to để xem rõ hơn", "Zoom in to see more", "Zoomez pour en voir plus")
            : level === 2 ? L3("Mức 2 — có thông số chính", "Level 2 — headline figures", "Niveau 2 — chiffres clés")
            : L3("Mức 3 — mổ máy (đang làm)", "Level 3 — opened up (coming)", "Niveau 3 — vue éclatée (à venir)")}
        </div>

        <div className="absolute right-3 top-3 flex gap-1.5">
          <button type="button" onClick={() => camera.zoomBy(0.8)} aria-label={L3("Phóng to", "Zoom in", "Zoom avant")}
                  className="grid h-9 w-9 place-items-center rounded-full border border-[#DCD6C6] bg-white text-[17px] font-bold text-[#1E2B22] hover:border-[#2E7D4F]">+</button>
          <button type="button" onClick={() => camera.zoomBy(1.25)} aria-label={L3("Thu nhỏ", "Zoom out", "Zoom arrière")}
                  className="grid h-9 w-9 place-items-center rounded-full border border-[#DCD6C6] bg-white text-[17px] font-bold text-[#1E2B22] hover:border-[#2E7D4F]">−</button>
          <button type="button" onClick={() => { setFocus(null); camera.overview(); }} aria-label={L3("Nhìn toàn máy", "Whole machine", "Machine entière")}
                  className="grid h-9 w-9 place-items-center rounded-full border border-[#DCD6C6] bg-white text-[#1E2B22] hover:border-[#2E7D4F]">⤢</button>
        </div>
      </div>

      <aside className="w-full shrink-0 overflow-y-auto rounded-[18px] border border-[#E3DFD3] bg-white p-4 lg:w-[300px]"
             style={{ maxHeight: height }} aria-live="polite">
        {focus ? (
          <>
            <h3 className="font-display text-[20px] font-semibold text-[#1E2B22]">{title}</h3>
            {renderRows(rows)}
          </>
        ) : (
          <>
            <h3 className="font-display text-[20px] font-semibold text-[#1E2B22]">
              {L3("Bấm vào một bộ phận", "Tap a part", "Touchez une pièce")}
            </h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[#55604F]">
              {L3("Bấm màn hình hoặc thân máy để xem thông số. Kéo để xoay quanh, lăn chuột để phóng to.",
                  "Tap the screen or the body to read its specs. Drag to move around, scroll to zoom.",
                  "Touchez l'écran ou le châssis pour lire ses caractéristiques. Faites glisser, molette pour zoomer.")}
            </p>
          </>
        )}
      </aside>
    </div>
  );
}
