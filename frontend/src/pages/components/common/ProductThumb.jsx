// The product picture used everywhere: the real photo when the catalogue has one, otherwise a
// labelled stand-in from a comparable product, otherwise the category's device icon.
// See lib/standInImage.js and docs/IMAGE_REPLACEMENTS.md — display only, never algorithm input.
import { useEffect, useState } from "react";
import { useI18n, tri } from "../../../i18n/LanguageContext";
import { findStandIn } from "../../../lib/standInImage";
import DeviceIcon, { iconKeyFor } from "../ui/DeviceIcon";

const GENERIC = /^(điện|thoại|máy|tính|bảng|laptop|tablet|màn|hình|tai|nghe|đồng|hồ|thông|minh|smartwatch|monitor)$/i;

/** "Điện thoại Samsung Galaxy A14 4GB/128GB" -> "Galaxy A14": a short name for the stand-in tag. */
export function shortModel(name = "") {
  const words = String(name).replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim().split(" ").filter((w) => w && !GENERIC.test(w));
  const out = words.slice(1, 3).join(" ") || words.slice(0, 2).join(" ");
  return out.length > 22 ? `${out.slice(0, 21)}…` : out;
}

/**
 * Store CDNs refuse an image when the request names our page as referrer (403, then ERR_BLOCKED_BY_ORB),
 * so the <img> tags send no referrer.
 * @param standIn  look for a comparable product's photo when this one has none (default true)
 * @param size     square size in px; when null the picture fills `className`
 */
export default function ProductThumb({ product, size = null, className = "h-40", standIn = true, rounded = "rounded-xl", tone = "default" }) {
  const soft = tone === "soft" || tone === "find";   // "find": the beige photo box of the Find products cards
  const { lang } = useI18n();
  const L3 = tri(lang);
  const own = product?.image_url || null;
  const [broken, setBroken] = useState(false);
  const [alt, setAlt] = useState(null);             // {url, name} of a comparable product
  const needsAlt = standIn && (!own || broken);

  useEffect(() => {
    let alive = true;
    setBroken(false);
    setAlt(null);
    if (!needsAlt || !product) return undefined;
    findStandIn(product).then((hit) => { if (alive) setAlt(hit); });
    return () => { alive = false; };
  }, [product?.product_id, needsAlt]); // eslint-disable-line react-hooks/exhaustive-deps

  const box = size ? { width: size, height: size } : undefined;
  const frame = `${size ? "" : className} ${rounded} relative overflow-hidden shrink-0`;

  if (own && !broken) {
    return (
      <div className={frame} style={box}>
        <img src={own} alt={product.name || ""} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)}
             className={`w-full h-full object-contain ${soft ? "p-3 mix-blend-multiply" : "bg-white"}`} />
      </div>
    );
  }
  if (alt?.url) {
    const label = L3("Ảnh minh họa", "Illustrative photo", "Photo d'illustration");
    return (
      <div className={frame} style={box}
           title={L3(`Ảnh của ${alt.name}, một sản phẩm tương đương. Sản phẩm này chưa có ảnh.`,
                     `Photo of ${alt.name}, a comparable product. This one has no photo yet.`,
                     `Photo de ${alt.name}, un produit comparable. Celui-ci n'a pas encore de photo.`)}>
        <img src={alt.url} alt={label} loading="lazy" referrerPolicy="no-referrer" onError={() => setAlt(null)}
             className={`w-full h-full object-contain ${soft ? "p-3 mix-blend-multiply opacity-95" : "bg-white opacity-90"}`} />
        {soft && !(size && size < 96)
          ? <span className="absolute left-2.5 bottom-2.5 max-w-[85%] truncate rounded-md bg-[#FBE7B5] px-1.5 py-0.5 text-[11.5px] font-medium text-[#6B4E00]">
              {L3("Ảnh", "Photo", "Photo")}: {shortModel(alt.name)}
            </span>
          : size && size < 96
          ? <span className="absolute right-0.5 bottom-0.5 grid place-items-center w-4 h-4 rounded-full bg-[#1E2B22]/75 text-[10px] font-bold text-white"
                  aria-label={label}>i</span>
          : <span className="absolute inset-x-0 bottom-0 bg-[#1E2B22]/70 px-1.5 py-0.5 text-center text-[11px] font-medium text-white">{label}</span>}
      </div>
    );
  }
  return (
    <div className={`${frame} grid place-items-center ${tone === "find" ? "bg-[#F3EFE4] text-[#7FA88C]" : soft ? "bg-[#F1F3EE] text-[#2B3A30]" : "bg-gradient-to-br from-[#eef4ec] to-[#f6f3ea] text-[#4E9A5C]"}`} style={box}
         role="img" aria-label={L3("Chưa có ảnh sản phẩm", "No product photo yet", "Pas encore de photo")}>
      <DeviceIcon name={iconKeyFor(product?.category)} size={size ? Math.round(size * 0.55) : soft ? 64 : 46} />
    </div>
  );
}
