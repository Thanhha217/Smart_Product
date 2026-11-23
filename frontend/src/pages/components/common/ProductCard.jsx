// The one product card used by search, CO2 world, Ask AI, related products and the cart page.
// Every value goes through lib/data.js: missing price, CO2, image or specs are written in words.
import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../ui/Icon";
import { useI18n } from "../../../i18n/LanguageContext";
import { co2Kind, co2Scope, formatPrice, normalizeProduct } from "../../../lib/data";
import { formatKg, formatNum, greenBg, greenColor } from "../../../lib/format";
import { addToCart } from "../../../lib/cart";
import { addToCompare, removeFromCompare, useCompare } from "../../../lib/compare";

/** "16 GB RAM", "27\" screen"... ; falls back to the raw value when no label exists. */
export function specLabel(t, spec) {
  const label = t(`spec.${spec.key}`, { value: spec.value });
  return label === `spec.${spec.key}` ? spec.value : label;
}

const CATEGORY_ICON = { laptops: "cpu", monitors: "eye", smartphones: "plug", headphones: "bell", smartwatches: "calendar", tablets: "book" };

export function ProductImage({ product, className = "h-40" }) {
  const [broken, setBroken] = useState(false);
  const { t } = useI18n();
  if (!product.image_url || broken) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-[#eef4ec] to-[#f6f3ea] grid place-items-center text-[#7aa58a]`}
           role="img" aria-label={t("common.noImage")}>
        <Icon name={CATEGORY_ICON[product.category] || "leaf"} size={44} strokeWidth={1.4} />
      </div>
    );
  }
  return <img src={product.image_url} alt={product.name} loading="lazy" onError={() => setBroken(true)}
              className={`${className} w-full rounded-xl object-contain bg-white`} />;
}

export function Co2Badge({ product, size = "sm" }) {
  const { t, lang } = useI18n();
  if (product.co2e_kg === null) {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f4f6] text-[#4b5563] px-2.5 py-1 text-[13.5px]">
      <Icon name="info" size={15} />{t("common.noCo2")}</span>;
  }
  const kind = co2Kind(product);
  const scope = co2Scope(product);
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-xl px-2.5 py-1 ${size === "lg" ? "text-base" : "text-[13.5px]"}`}
          style={{ background: greenBg(product.green_score), color: "#1E2B22" }}>
      <span className="shrink-0 inline-flex" style={{ color: greenColor(product.green_score) }}><Icon name="leaf" size={15} /></span>
      <b>{formatKg(product.co2e_kg, lang)} kg CO₂e</b>
      <span className="text-[#4b5563]">· {t(`common.scope.${scope}`)}</span>
      {product.green_score !== null && <span className="text-[#4b5563]">· {t("co2.greenScore")} {formatNum(product.green_score, lang, 1)}/5</span>}
      <span className={`rounded-full px-1.5 text-[12.5px] ${kind === "published" ? "bg-[#dcefe0] text-[#1F5D3A]" : "bg-white/70 text-[#6b7280]"}`}>
        {t(kind === "published" ? "common.co2Published" : "common.co2Estimated")}
      </span>
    </span>
  );
}

export default function ProductCard({ product: raw, reason, onAdded, showActions = true, highlight = false }) {
  const { t, lang } = useI18n();
  const compare = useCompare();
  const [note, setNote] = useState(null);
  const product = normalizeProduct(raw);
  if (!product) return null;
  const inCompare = compare.some((c) => c.product_id === product.product_id);
  const priceText = formatPrice(product.price_vnd, lang);

  const toggleCompare = () => {
    if (inCompare) { removeFromCompare(product.product_id); setNote(null); return; }
    const r = addToCompare(product);
    setNote(r === "full" ? t("compare.full") : r === "duplicate" ? t("compare.duplicate") : null);
  };

  return (
    <article className={`group flex flex-col rounded-2xl bg-white border ${highlight ? "border-[#2E7D4F] ring-2 ring-[#2E7D4F]/15" : "border-[#ebe6d8]"} p-4 shadow-sm hover:shadow-md transition-shadow`}>
      <Link to={`/product/${product.product_id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D4F] rounded-xl">
        <div className="relative">
          <ProductImage product={product} />
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            {product.platform && <span className="rounded-full bg-white/95 px-2 py-0.5 text-[12.5px] font-medium text-[#1E2B22] shadow-sm">{product.platform}</span>}
            {product.condition === "used" && <span className="rounded-full bg-[#fff4e5] px-2 py-0.5 text-[12.5px] text-[#92400e]">{t("common.used")}</span>}
          </div>
          {product.discount_pct ? <span className="absolute right-2 top-2 rounded-full bg-[#fde8e7] px-2 py-0.5 text-[12.5px] font-semibold text-[#b42318]">−{product.discount_pct}%</span> : null}
        </div>
        <h3 className="mt-3 text-[16px] font-semibold leading-snug text-[#1E2B22] line-clamp-2 group-hover:text-[#1F5D3A]">{product.name}</h3>
      </Link>
      {(product.brand || product.specs.length > 0) && (
        <p className="mt-1 text-[14px] text-[#4b5563]">
          {[product.brand, ...product.specs.map((s) => specLabel(t, s))].filter(Boolean).join(" · ")}
        </p>
      )}
      {product.accessory && <p className="mt-1 text-[13.5px] text-[#92400e]">{t("common.accessoryCo2")}</p>}
      {reason && <p className="mt-2 text-[14px] text-[#374151] bg-[#f6f3ea] rounded-lg px-2.5 py-1.5">{reason}</p>}
      <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
        {priceText
          ? <span className="text-xl font-bold text-[#1E2B22] whitespace-nowrap">{priceText}</span>
          : <span className="text-[15px] font-medium text-[#6b7280]">{t("common.noPrice")}</span>}
        {product.original_price_vnd && <s className="text-[14px] text-[#9ca3af] whitespace-nowrap">{formatPrice(product.original_price_vnd, lang)}</s>}
      </div>
      <div className="mt-2"><Co2Badge product={product} /></div>
      {showActions && (
        <div className="mt-auto pt-4 flex flex-wrap gap-2">
          <Link to={`/product/${product.product_id}`} className="btn-primary flex-1 text-center whitespace-nowrap">{t("common.details")}</Link>
          <button type="button" onClick={toggleCompare} aria-pressed={inCompare} className={inCompare ? "btn-secondary-active" : "btn-secondary"}
                  title={inCompare ? t("compare.remove") : t("compare.add")}>
            <Icon name="scale" size={17} /><span className="sr-only 2xl:not-sr-only 2xl:ml-1">{inCompare ? t("compare.added") : t("compare.add")}</span>
          </button>
          <button type="button" className="btn-secondary" aria-label={t("common.addToCart")} title={t("common.addToCart")}
                  onClick={() => { addToCart(product); setNote(t("common.addedToCart")); onAdded?.(product); }}>
            <Icon name="cart" size={17} />
          </button>
        </div>
      )}
      {note && <p role="status" className="mt-2 text-[13.5px] text-[#1F5D3A]">{note}</p>}
    </article>
  );
}
