// The card that stays on screen in the CO₂ world: which product is being explored, its CO₂,
// how that figure was obtained, where it sits among products of the same category, and a way
// to switch to another product without leaving the world.
import { Link } from "react-router-dom";
import { tri, useI18n } from "../../../i18n/LanguageContext";
import { co2Explanation, toneMap } from "../../../lib/co2Formula";
import { formatKg, formatNum, greenColor } from "../../../lib/format";
import { Formula } from "../co2/Co2Explainer";
import ProductThumb from "../common/ProductThumb";
import DeviceIcon from "../ui/DeviceIcon";

/** Where this product sits inside its own category, on a plain linear scale. */
function GroupPosition({ stats, kg, lang, L3 }) {
  const lo = stats?.min, hi = stats?.max, mid = stats?.median_kg;
  const ok = [lo, hi, mid, kg].every((x) => typeof x === "number" && Number.isFinite(x)) && hi > lo;
  if (!ok) {
    return <p className="text-[13.5px] text-[#6B7468]">{L3("Chưa đủ dữ liệu cùng loại để so sánh.",
      "Not enough data in this category to compare.", "Pas assez de données dans la catégorie pour comparer.")}</p>;
  }
  const at = (value) => Math.min(98, Math.max(2, ((value - lo) / (hi - lo)) * 100));
  const better = typeof stats.greener_than_pct === "number" ? Math.round(stats.greener_than_pct) : null;
  return (
    <div>
      <div className="relative h-2.5 rounded-full bg-[#EFEBDF]">
        <span className="absolute top-0 h-2.5 w-[2px] bg-[#9CA3AF]" style={{ left: `${at(mid)}%` }}
              title={L3("trung vị của loại", "category median", "médiane de la catégorie")} />
        <span className="absolute -top-1 h-4.5 w-[4px] rounded" style={{ left: `${at(kg)}%`, height: 18, background: "#1F5D3A" }} />
      </div>
      <div className="mt-1 flex justify-between text-[12.5px] text-[#6B7468]">
        <span>{formatKg(lo, lang)}</span>
        <span>{L3("trung vị", "median", "médiane")} {formatKg(mid, lang)}</span>
        <span>{formatKg(hi, lang)}</span>
      </div>
      <p className="text-[13px] leading-snug text-[#55604F]">
        {L3("So với sản phẩm cùng nhóm", "Compared with products in the same category", "Comparé aux produits de la même catégorie")}
        {better !== null && ` · ${L3(`ít CO₂ hơn ${better}% số đó`, `lower CO₂ than ${better}% of them`, `CO₂ plus bas que ${better} % d'entre eux`)}`}
      </p>
    </div>
  );
}

export default function WorldHeader({ d, onTopic, onChangeProduct, compact = false }) {
  const { t, lang } = useI18n();
  const L3 = tri(lang);
  const product = d.product;
  const ex = co2Explanation(d, lang);
  const tones = ex ? toneMap(ex.inputs) : {};

  return (
    <div className="rounded-3xl bg-white/95 backdrop-blur shadow-xl border border-white p-3 md:p-4">
      <div className="flex items-start gap-3">
        <ProductThumb product={product} size={56} standIn={false} />
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] uppercase tracking-widest text-[#2E7D4F] font-semibold">
            {L3("Đang khám phá", "Now exploring", "En exploration")}
          </p>
          <Link to={`/product/${product.product_id}`}
                className="block font-extrabold text-[#16324a] leading-tight text-[17px] md:text-[18px] line-clamp-2 hover:underline">
            {product.name}
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13.5px] text-[#55604F]">
            <span className="inline-flex items-center gap-1"><DeviceIcon name={product.category} size={16} tint={false} />{product.category}</span>
            {ex && <span className={`rounded-full px-2 py-0.5 text-[12.5px] ${ex.kind === "published" ? "bg-[#DCEFE0] text-[#1F5D3A]" : "bg-[#F1EEE4] text-[#55604F]"}`}>
              {t(ex.kind === "published" ? "common.co2Published" : "common.co2Estimated")}
            </span>}
          </p>
        </div>
        <button type="button" onClick={onChangeProduct}
                className="shrink-0 rounded-full border border-[#E7E2D4] bg-white px-3 py-1.5 text-[13.5px] font-semibold text-[#1F5D3A] hover:border-[#2E7D4F]">
          {L3("Đổi sản phẩm", "Change product", "Changer de produit")}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" data-explain="co2e_total" onClick={() => onTopic("co2e_total")}
                className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-[16px] font-bold text-white hover:shadow">
          {product.co2e_kg !== null ? `${formatKg(product.co2e_kg, lang)} kg CO₂e` : L3("Chưa có số CO₂", "No CO₂ figure", "Pas de chiffre CO₂")}
        </button>
        {product.green_score !== null && product.green_score !== undefined && (
          <button type="button" data-explain="green_score" onClick={() => onTopic("green_score")}
                  className="rounded-full px-3.5 py-1.5 text-[15px] font-semibold text-white hover:shadow"
                  style={{ background: greenColor(product.green_score) }}>
            {L3("Điểm xanh", "Green score", "Score vert")} {formatNum(product.green_score, lang, 1)}/5
          </button>
        )}
        <span className="text-[13.5px] text-[#55604F]">{t(`common.scope.${ex?.scopeKey || "cradle_to_grave"}`)}</span>
      </div>

      {/* on a phone the card has to stay small, so the comparison moves inside the details */}
      {d.stats && product.co2e_kg !== null && !compact && (
        <div className="mt-3">
          <GroupPosition stats={d.stats} kg={product.co2e_kg} lang={lang} L3={L3} />
        </div>
      )}

      <p className="mt-2 rounded-xl bg-[#FFF4DA] px-3 py-1.5 text-[13.5px] font-semibold text-[#8A4B00]">
        👆 {L3("Bấm ⊕ trên bản đồ để bước vào · ‹ › để nhảy qua lại", "Tap ⊕ on the map to step in · ‹ › to jump between places",
               "Touchez ⊕ pour entrer · ‹ › pour passer d'un lieu à l'autre")}
      </p>

      {ex && (
        <details className="mt-3 rounded-2xl bg-[#F7FBF6] border border-[#DCEBD9] px-3 py-2" open={!compact}>
          <summary className="cursor-pointer list-none text-[13px] font-bold uppercase tracking-wide text-[#2E7D4F]">
            🧮 {ex.title} <span className="font-medium normal-case tracking-normal text-[#55604F]">· {L3("bấm để xem công thức", "tap for the formula", "voir la formule")}</span>
          </summary>
          <div className="mt-1.5">
            {compact && d.stats && product.co2e_kg !== null && (
              <div className="mb-2"><GroupPosition stats={d.stats} kg={product.co2e_kg} lang={lang} L3={L3} /></div>
            )}
            <Formula tokens={ex.symbolic} tones={tones} className="text-[#55604F]" />
            {ex.filled && <Formula tokens={ex.filled} tones={tones} />}
            <p className="font-mono text-[15px] font-bold text-[#1F5D3A]">= {formatKg(ex.resultKg, lang)} kg CO₂e</p>
            <p className="mt-1.5 flex flex-wrap gap-3 text-[13.5px] font-semibold">
              <button type="button" data-explain="formula" onClick={() => onTopic("formula")} className="text-[#1E5A96] underline">
                {L3("Xem cách tính", "See how it is calculated", "Voir le calcul")}
              </button>
              <Link to={`/story/${product.product_id}`} className="text-[#1E5A96] underline">
                📖 {L3("Sách CO₂", "CO₂ book", "Livre CO₂")}
              </Link>
              <Link to={`/product/${product.product_id}#co2`} className="text-[#1E5A96] underline">
                {L3("Trang sản phẩm", "Product page", "Fiche produit")}
              </Link>
              <Link to={`/method?product=${product.product_id}`} className="text-[#1E5A96] underline">{L3("Phương pháp", "Method", "Méthode")}</Link>
            </p>
          </div>
        </details>
      )}
    </div>
  );
}
