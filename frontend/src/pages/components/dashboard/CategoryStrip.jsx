// "Mua gì hôm nay?" — the categories you can actually browse, in the site's own order
// (lib/categories.js), each with its own icon and its own scale.
//
// The bar under each category is the spread of THAT category only: categories answer different
// needs, so the bars are never put on one shared axis and never ranked against each other.
import { Link } from "react-router-dom";
import { tri, useI18n } from "../../../i18n/LanguageContext";
import { explore } from "../../../i18n/explore";
import { byCategoryOrder, canonicalCategory } from "../../../lib/categories";
import { formatCount } from "../../../lib/data";
import { formatKg } from "../../../lib/format";
import DeviceIcon, { co2Tone } from "../ui/DeviceIcon";
import { ErrorState, LoadingGrid } from "../common/States";

const TONE_RING = { green: "bg-[#E4F1E6] text-[#1F5D3A]", amber: "bg-[#FBEFD3] text-[#8A5A00]",
                    red: "bg-[#F9E0DE] text-[#9B2F2A]", plain: "bg-[#F1EEE4] text-[#55604F]" };

/** Where the median sits inside this category's own min–max range, on a plain linear scale. */
function MedianBar({ row, lang, label }) {
  const { min_kg: lo, max_kg: hi, median_kg: mid } = row;
  const ok = [lo, hi, mid].every((x) => typeof x === "number" && Number.isFinite(x)) && hi > lo;
  if (!ok) return null;
  const pos = Math.min(98, Math.max(2, ((mid - lo) / (hi - lo)) * 100));
  return (
    <div className="mt-2">
      <div className="relative h-2 rounded-full bg-[#EFEBDF]" aria-hidden="true">
        <span className="absolute -top-1 h-4 w-[3px] rounded bg-[#1F5D3A]" style={{ left: `${pos}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[13px] text-[#6B7468]">
        <span>{formatKg(lo, lang)}</span>
        <b className="text-[#1E2B22]">{formatKg(mid, lang)} kg</b>
        <span>{formatKg(hi, lang)}</span>
      </div>
      <p className="text-[12.5px] leading-snug text-[#7d8579]">{label}</p>
    </div>
  );
}

export default function CategoryStrip({ rows, status, onRetry, lang: langProp, title, lead }) {
  const { lang: ctx } = useI18n();
  const lang = langProp || ctx;
  const L3 = tri(lang);
  const X = explore(lang);
  const list = byCategoryOrder(rows || []);

  return (
    <section aria-labelledby="browse-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="browse-title" className="text-[24px] font-bold text-[#1E2B22]">
            {title || L3("Bạn đang tìm loại nào?", "What are you shopping for?", "Que cherchez-vous ?")}
          </h2>
          <p className="text-[16px] text-[#6B7468]">
            {lead || L3("Chọn một loại để xem sản phẩm kèm số CO₂.", "Pick a category to see its products with their CO₂.",
                        "Choisissez une catégorie pour voir ses produits et leur CO₂.")}
          </p>
        </div>
        <Link to="/search" className="text-[15.5px] font-semibold text-[#1F5D3A] hover:underline">
          {L3("Xem tất cả sản phẩm", "See all products", "Voir tous les produits")} →
        </Link>
      </div>

      <div className="mt-4">
        {status === "loading" && <LoadingGrid count={6} />}
        {status === "error" && <ErrorState compact onRetry={onRetry} />}
        {status === "ok" && (
          <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((row) => {
              const key = canonicalCategory(row.category);
              const tone = co2Tone(row.median_kg);
              return (
                <li key={row.category}>
                  <Link to={`/search?category=${encodeURIComponent(row.category)}&sort=co2_asc`}
                        className="group flex gap-3 rounded-2xl bg-white border border-[#EFEBDF] p-4 hover:border-[#2E7D4F] hover:shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D4F]">
                    <span className={`grid place-items-center w-12 h-12 rounded-2xl shrink-0 ${TONE_RING[tone]}`}>
                      <DeviceIcon name={key} size={28} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[17px] font-bold text-[#1E2B22] group-hover:text-[#1F5D3A]">
                        {X.categories[row.category] || X.categories[key] || row.category}
                      </span>
                      <span className="block text-[14px] text-[#6B7468]">
                        {X.catProducts(formatCount(row.products, lang))}
                        {typeof row.with_co2 === "number" && ` · ${X.catWithCo2(formatCount(row.with_co2, lang),
                          row.products ? `${Math.round((100 * row.with_co2) / row.products)}%` : "—")}`}
                      </span>
                      <MedianBar row={row} lang={lang}
                                 label={L3("thấp nhất – trung vị – cao nhất, chỉ trong loại này",
                                           "lowest – median – highest, within this category only",
                                           "min – médiane – max, dans cette catégorie seulement")} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="mt-2 text-[13.5px] text-[#7d8579]">
        {L3("Mỗi loại có thang đo riêng, không so CO₂ giữa các loại khác nhau: laptop và tai nghe phục vụ nhu cầu khác nhau.",
            "Each category has its own scale; CO₂ is never compared across categories, because a laptop and a headset answer different needs.",
            "Chaque catégorie a son échelle ; le CO₂ n'est pas comparé entre catégories : un portable et un casque ne servent pas au même usage.")}
      </p>
    </section>
  );
}
