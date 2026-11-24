// The one product card used by search, CO2 world, Ask AI, related products and the cart page.
// Every value goes through lib/data.js: missing price, CO2, image or specs are written in words.
import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../ui/Icon";
import ProductThumb from "./ProductThumb";
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

/** Kept as a named export for the pages that used it before ProductThumb existed. */
export function ProductImage({ product, className = "h-40" }) {
  return <ProductThumb product={product} className={className} />;
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

/** Short "where the CO2 number comes from" label for a card; the full wording lives on the product page. */
const SRC_SHORT = {
  manufacturer: ["báo cáo của hãng", "manufacturer report", "rapport du fabricant"],
  neighbor_average: ["sản phẩm tương tự", "similar products", "produits similaires"],
  category_model: ["mô hình theo loại", "category model", "modèle de catégorie"],
  lifecycle_formula: ["công thức điện năng", "energy formula", "formule énergie"],
  eeio_price: ["ước tính thô theo giá", "rough, from price", "approx. par le prix"],
  llm_estimate: ["AI chỉnh (thí nghiệm)", "AI-adjusted (test)", "ajusté par IA (test)"],
};
const LANG_IDX = { vi: 0, en: 1, fr: 2 };

/** True when the card has everything the design calls "full info": a price, a CO2 figure and its own photo. */
export function hasFullInfo(product) {
  return Boolean(product?.price_vnd && product.co2e_kg !== null && product.image_url);
}

/** @param to  where the card opens; defaults to the product page, but the CO2 world's product
 *            picker sends it straight to that product's Overview instead. */
export default function ProductCard({ product: raw, reason, onAdded, showActions = true, highlight = false, to = null }) {
  const { t, lang } = useI18n();
  const compare = useCompare();
  const [note, setNote] = useState(null);
  const product = normalizeProduct(raw);
  if (!product) return null;
  const inCompare = compare.some((c) => c.product_id === product.product_id);
  const priceText = formatPrice(product.price_vnd, lang);
  const li = LANG_IDX[lang] ?? 1;
  const full = hasFullInfo(product);
  const src = product.co2e_source && SRC_SHORT[product.co2e_source] ? SRC_SHORT[product.co2e_source][li] : null;

  const toggleCompare = () => {
    if (inCompare) { removeFromCompare(product.product_id); setNote(null); return; }
    const r = addToCompare(product);
    setNote(r === "full" ? t("compare.full") : r === "duplicate" ? t("compare.duplicate") : null);
  };

  return (
    <article className={`group flex flex-col overflow-hidden rounded-[22px] bg-white border ${highlight ? "border-[#2E7D4F] ring-2 ring-[#2E7D4F]/15" : "border-[#E6E2D6]"} shadow-[0_1px_2px_rgba(30,43,34,0.04)] hover:shadow-md transition-shadow`}>
      <Link to={to || `/product/${product.product_id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2E7D4F]">
        <div className="relative bg-[#F1F3EE]">
          <ProductThumb product={product} className="h-44" rounded="rounded-none" tone="soft" />
          {full && (
            <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[12px] font-medium text-[#1E2B22] shadow-sm">
              <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.4 4.7 9 10 3.3" fill="none" stroke="#1B4D31" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {["Đủ thông tin", "Full info", "Infos complètes"][li]}
            </span>
          )}
          <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1">
            {product.discount_pct ? <span className="rounded-full bg-[#fde8e7] px-2 py-0.5 text-[12px] font-semibold text-[#b42318]">−{product.discount_pct}%</span> : null}
            {product.condition === "used" && <span className="rounded-full bg-[#fff4e5] px-2 py-0.5 text-[12px] text-[#92400e]">{t("common.used")}</span>}
          </div>
        </div>
      </Link>
      <div className="flex flex-1 flex-col px-4 pt-3 pb-4">
        <p className="text-[12.5px] uppercase tracking-[0.04em] text-[#6B7468] truncate">{product.platform || "—"}</p>
        <Link to={to || `/product/${product.product_id}`} className="mt-1 focus-visible:outline-none focus-visible:underline">
          <h3 className="text-[15.5px] font-semibold leading-snug text-[#1E2B22] line-clamp-2 group-hover:text-[#1F5D3A]">{product.name}</h3>
        </Link>
        {product.accessory && <p className="mt-1 text-[13px] text-[#92400e]">{t("common.accessoryCo2")}</p>}
        {reason && <p className="mt-2 text-[13.5px] text-[#374151] bg-[#f6f3ea] rounded-lg px-2.5 py-1.5">{reason}</p>}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {product.co2e_kg !== null ? (
            <>
              <span className="inline-flex items-baseline gap-1 rounded-full px-2.5 py-0.5" style={{ background: greenBg(product.green_score) }}
                    title={t(co2Kind(product) === "published" ? "common.co2Published" : "common.co2Estimated")}>
                <b className="text-[15px] text-[#1E2B22]">{formatKg(product.co2e_kg, lang)}</b>
                <span className="text-[11.5px] text-[#4b5563]">kg CO₂e</span>
              </span>
              {src && <span className="text-[12.5px] text-[#6B7468]">{src}</span>}
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f4f6] px-2.5 py-0.5 text-[13px] text-[#4b5563]">
              <Icon name="info" size={14} />{t("common.noCo2")}
            </span>
          )}
        </div>
        <div className="mt-auto pt-4 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            {priceText
              ? <span className="block text-[17px] font-bold text-[#1E2B22] whitespace-nowrap truncate">{priceText}</span>
              : <span className="block text-[14px] font-medium text-[#6b7280]">{t("common.noPrice")}</span>}
            {product.original_price_vnd && <s className="block text-[12.5px] text-[#9ca3af] whitespace-nowrap">{formatPrice(product.original_price_vnd, lang)}</s>}
          </div>
          {showActions && (
            <>
              <button type="button" onClick={toggleCompare} aria-pressed={inCompare}
                      className={`grid place-items-center w-9 h-9 rounded-full border transition ${inCompare ? "bg-[#E4F0E6] border-[#2E7D4F] text-[#1B4D31]" : "bg-white border-[#DCD7C9] text-[#1E2B22] hover:border-[#2E7D4F]"}`}
                      aria-label={inCompare ? t("compare.remove") : t("compare.add")} title={inCompare ? t("compare.remove") : t("compare.add")}>
                <Icon name="scale" size={16} />
              </button>
              <button type="button" className="grid place-items-center w-9 h-9 rounded-full bg-[#1B4D31] text-white hover:bg-[#143D26] transition"
                      aria-label={t("common.addToCart")} title={t("common.addToCart")}
                      onClick={() => { addToCart(product); setNote(t("common.addedToCart")); onAdded?.(product); }}>
                <Icon name="cart" size={16} />
              </button>
            </>
          )}
        </div>
        {note && <p role="status" className="mt-2 text-[13px] text-[#1F5D3A]">{note}</p>}
      </div>
    </article>
  );
}
