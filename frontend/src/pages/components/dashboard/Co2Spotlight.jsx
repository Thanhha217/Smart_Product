// The first thing on the site: CO₂ is the subject. A real product's CO₂ book lies open on the
// right — its figure, its green score and its journey — and one click opens the full flipbook.
// The product is the last one the visitor opened, or the lowest-CO₂ product of a category,
// marked as an example; nothing on this card is typed in by hand.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../api/client";
import { tri, useI18n } from "../../../i18n/LanguageContext";
import { lifecycle as readLifecycle, stagePct } from "../../../lib/co2Formula";
import { STAGE_COLOR, STAGE_ICON, stageText } from "../../../lib/lifecycleText";
import { formatKg, formatNum, greenColor } from "../../../lib/format";
import { useRecent } from "../../../lib/recent";
import { CoverArt, StoryStyles } from "../story/Illustrations";
import DeviceIcon from "../ui/DeviceIcon";

const CSS = `
@keyframes sp-float { 0%,100% { transform: rotateY(-8deg) rotateX(4deg) translateY(0); } 50% { transform: rotateY(-8deg) rotateX(4deg) translateY(-6px); } }
@keyframes sp-corner { 0%,100% { transform: scale(1); } 50% { transform: scale(1.18); } }
.sp-book { transform-style: preserve-3d; animation: sp-float 6s ease-in-out infinite; }
.sp-book:hover { animation-play-state: paused; }
.sp-corner { animation: sp-corner 1.8s ease-in-out infinite; transform-origin: bottom right; }
@media (prefers-reduced-motion: reduce) { .sp-book, .sp-corner { animation: none; } }
`;

export default function Co2Spotlight({ fallbackIds = [] }) {
  const { lang, t } = useI18n();
  const L3 = tri(lang);
  const recent = useRecent();
  const chosenId = recent[0]?.product_id || null;
  const id = chosenId || fallbackIds.find(Boolean) || null;
  const [co2, setCo2] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!id) return undefined;
    api.getProductCo2(id).then((d) => alive && setCo2(d)).catch(() => alive && setCo2(null));
    return () => { alive = false; };
  }, [id]);

  const p = co2?.product;
  const lc = readLifecycle(co2?.lifecycle);

  return (
    <section aria-labelledby="spot-title"
             className="relative overflow-hidden rounded-[28px] border border-[#CFE6D5] bg-gradient-to-br from-[#E9F4EC] via-[#F6FAF3] to-[#FFF6E6] p-5 sm:p-8">
      <style>{CSS}</style>
      <StoryStyles />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center">
        <div>
          <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#2E7D4F]">
            {L3("CO₂ của từng sản phẩm", "The CO₂ of every product", "Le CO₂ de chaque produit")}
          </p>
          <h1 id="spot-title" className="mt-2 text-[34px] sm:text-[44px] font-bold leading-[1.08] text-[#1E2B22]">
            {L3("Mỗi thiết bị mang một câu chuyện CO₂", "Every device carries a CO₂ story", "Chaque appareil porte une histoire de CO₂")}
          </h1>
          <p className="mt-3 text-[17.5px] leading-relaxed text-[#55604F] max-w-xl">
            {L3("Từ mỏ khoáng sản, nhà máy, con tàu, đến nhà bạn rồi về điểm tái chế. Lật từng trang để thấy con số ở đâu ra, tính bằng công thức nào, và bạn làm được gì để nó nhỏ lại.",
                "From the mine and the factory to the ship, your home and the recycling point. Turn the pages to see where the figure comes from, which formula produced it, and what you can do to make it smaller.",
                "De la mine et de l'usine au navire, à votre maison puis au recyclage. Tournez les pages pour voir d'où vient le chiffre, quelle formule l'a produit et comment le réduire.")}
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link to={id ? `/story/${id}` : "/story"}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 text-[16.5px] font-extrabold text-white shadow-lg hover:scale-[1.03] transition">
              📖 {L3("Mở sách CO₂", "Open the CO₂ book", "Ouvrir le livre CO₂")}
            </Link>
            <Link to={id ? `/world/${id}` : "/world"} className="btn-primary !py-3 !text-[16px]">
              🌏 {L3("Vào thế giới CO₂", "Enter the CO₂ world", "Entrer dans le monde CO₂")}
            </Link>
            <Link to={id ? `/method?product=${id}` : "/method"} className="btn-secondary !py-3 !text-[16px]">
              🧮 {L3("Xem công thức", "See the formula", "Voir la formule")}
            </Link>
          </div>
        </div>

        {/* the open book: a real product, two pages */}
        <Link to={id ? `/story/${id}` : "/story"} aria-label={L3("Mở sách CO₂", "Open the CO₂ book", "Ouvrir le livre CO₂")}
              className="block [perspective:1400px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E7D4F]/30 rounded-3xl">
          <div className="sp-book relative grid grid-cols-2 rounded-3xl bg-[#FFFDF7] shadow-[0_30px_60px_-20px_rgba(30,43,34,.45)] border border-[#EFE6D2] min-h-[330px]">
            <span className="pointer-events-none absolute left-1/2 top-3 bottom-3 w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-[#E3D8BF] to-transparent" />
            {/* left page: the figure */}
            <div className="p-4 sm:p-5 flex flex-col">
              {!chosenId && p && (
                <span className="self-start rounded-full bg-[#FBEFD3] px-2 py-0.5 text-[11.5px] font-semibold text-[#8A5A00]">
                  {L3("Ví dụ thật trong dữ liệu", "A real catalogue example", "Exemple réel du catalogue")}
                </span>
              )}
              <p className="mt-1 text-[13.5px] font-bold leading-snug text-[#1E2B22] line-clamp-2">{p?.name || "…"}</p>
              <div className="my-2 mx-auto w-full max-w-[150px]">{p && <CoverArt category={p.category} score={p.green_score} />}</div>
              {p && p.co2e_kg !== null ? (
                <>
                  <p className="text-[36px] leading-none font-extrabold text-[#1F5D3A]">{formatKg(p.co2e_kg, lang)}</p>
                  <p className="text-[13px] text-[#55604F]">kg CO₂e · {t(`common.scope.${co2?.formula?.method === "eeio_price" ? "cradle_to_shelf" : "cradle_to_grave"}`)}</p>
                  {p.green_score !== null && p.green_score !== undefined && (
                    <span className="mt-2 self-start rounded-full px-2.5 py-0.5 text-[12.5px] font-bold text-white" style={{ background: greenColor(p.green_score) }}>
                      {L3("Điểm xanh", "Green score", "Score vert")} {formatNum(p.green_score, lang, 1)}/5
                    </span>
                  )}
                </>
              ) : <div className="h-16 rounded-xl bg-[#F1EEE4] animate-pulse" />}
            </div>
            {/* right page: the journey */}
            <div className="p-4 sm:p-5 flex flex-col">
              <p className="text-[12px] font-bold uppercase tracking-wider text-[#2E7D4F]">
                {L3("Hành trình", "The journey", "Le parcours")}
              </p>
              <ol className="mt-2 space-y-2">
                {(lc.parts.length ? lc.parts : ["materials_production", "transport", "use", "end_of_life"].map((key) => ({ key }))).map((part) => (
                  <li key={part.key} className="flex items-center gap-2">
                    <span className="grid place-items-center w-8 h-8 rounded-lg shrink-0"
                          style={{ background: `${STAGE_COLOR[part.key]}1F`, color: STAGE_COLOR[part.key] }}>
                      <DeviceIcon name={STAGE_ICON[part.key]} size={18} />
                    </span>
                    <span className="flex-1 min-w-0 text-[13px] font-semibold text-[#1E2B22] leading-tight">{stageText(part.key, lang)?.name}</span>
                    {part.pct !== undefined && <span className="text-[12.5px] font-bold" style={{ color: STAGE_COLOR[part.key] }}>{stagePct(part, lang)}</span>}
                  </li>
                ))}
              </ol>
              {lc.parts.length > 0 && !lc.measured && (
                <p className="mt-2 text-[11.5px] leading-snug text-[#8A5A00]">
                  {L3("tỷ lệ điển hình của loại", "typical shares for the category", "parts typiques de la catégorie")}
                </p>
              )}
              <p className="mt-auto pt-3 text-right text-[13px] font-bold text-[#C2620B]">
                {L3("Lật trang", "Turn the page", "Tourner la page")} →
              </p>
              <span className="sp-corner pointer-events-none absolute right-0 bottom-0 w-10 h-10 rounded-br-3xl bg-gradient-to-tl from-[#E9DDC2] to-transparent" />
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}
