import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../../i18n/LanguageContext";
import { greenBg, greenColor } from "../../../lib/format";
import { getProductHighlights, getRecommendationReason, getCo2SourceKey, localizeReason } from "../../utils/helpers";
import Icon from "../ui/Icon";

// Shown when the shop gave no picture (or it fails to load): a soft tile with the category's device.
export function ProductImage({ src, alt, className = "h-44" }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`${className} w-full rounded-xl grid place-items-center`} style={{ background: "radial-gradient(circle at 30% 20%, #ffffff, #E4F1E6 70%)" }} aria-label={alt}>
        <svg viewBox="0 0 120 80" className="w-24 h-auto opacity-80" aria-hidden="true">
          <rect x="18" y="10" width="84" height="50" rx="5" fill="#1F5D3A" /><rect x="23" y="15" width="74" height="40" rx="2" fill="#9ccf7d" />
          <path d="M8 62 H112 L104 70 H16 Z" fill="#6B7468" />
          <path d="M60 22 C52 30 52 40 60 46 C68 40 68 30 60 22Z" fill="#fff" opacity=".8" />
        </svg>
      </div>
    );
  }
  return <img className={`${className} w-full rounded-xl object-contain bg-white`} src={src} alt={alt} onError={() => setFailed(true)} />;
}

export default function ProductSlot({ product, image_url, platform_name }) {
  const navigate = useNavigate();
  const { t, lang, formatNumber } = useI18n();
  const highlights = getProductHighlights(product);
  const reason = localizeReason(getRecommendationReason(product, platform_name, t), lang);
  const discount = product.original_price && product.original_price !== product.final_price
    ? 100 - Math.floor((product.final_price / product.original_price) * 100) : null;
  const hasCo2 = product.co2e_kg !== null && product.co2e_kg !== undefined;
  const score = product.green_score;

  return (
    <button type="button" onClick={() => navigate(`/product/${product.id}`, { state: { product } })}
            className="card text-left p-4 flex flex-col gap-3 transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(23,63,40,.45)] hover:border-[#9ccf7d] min-w-0">
      <div className="relative">
        <ProductImage src={image_url} alt={product.name} />
        {platform_name && <span className="pill absolute left-2 top-2 bg-white/95 border border-[#E7E2D4] text-[#1E2B22]">{platform_name}</span>}
        {discount > 0 && <span className="pill absolute right-2 top-2 bg-[#FBE4E2] text-[#C2413C]">-{discount}%</span>}
      </div>
      <p className="line-clamp-2 min-h-[2.7em] font-semibold text-[16.5px] leading-snug text-[#1E2B22]" title={product.name}>{product.name}</p>
      {highlights.length > 0 && (
        <ul className="text-[14.5px] leading-snug text-[#6B7468] space-y-0.5 min-h-[36px]">
          {highlights.slice(0, 2).map((hl, idx) => <li key={idx} className="line-clamp-1">• {hl}</li>)}
        </ul>
      )}
      {reason && <p className="rounded-lg bg-[#FBF0D6] text-[#8a5d10] px-2.5 py-1.5 text-[14.5px] font-medium line-clamp-2">✨ {reason}</p>}
      <div className="mt-auto flex items-end justify-between gap-2">
        <p className="text-[22px] font-extrabold text-[#1F5D3A]">{formatNumber(product.final_price)}₫</p>
        <p className="text-[14.5px] text-[#6B7468] whitespace-nowrap">★ {product.review_count ? `${formatNumber(Math.round(product.product_rating * 50) / 10)} (${product.review_count})` : t("product.noRating")}</p>
      </div>
      {hasCo2 ? (
        <span className="pill self-start max-w-full" style={{ color: greenColor(score), background: greenBg(score) }}
              title={`${t("product.greenScore")}: ${score ?? "–"}/5 · ${t(getCo2SourceKey(product.co2e_source))}`}>
          <Icon name="leaf" size={14} /> <span className="truncate">{formatNumber(product.co2e_kg)} kg CO₂e{score !== null && score !== undefined ? ` · ${formatNumber(score)}/5` : ""}</span>
        </span>
      ) : (
        <span className="pill self-start bg-[#ECEEE8] text-[#55604F]">{t("product.co2ShortUnavailable")}</span>
      )}
    </button>
  );
}
