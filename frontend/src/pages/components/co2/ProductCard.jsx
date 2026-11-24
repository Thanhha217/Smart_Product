import { Link } from "react-router-dom";
import { useI18n } from "../../../i18n/LanguageContext";
import { formatVnd } from "../../../lib/format";
import { addToCart } from "../../../lib/cart";
import { Co2Value, GreenBadge, SourceLabel } from "./Co2Bits";

// ProductCard (api-contract.md) rendered as a card. `reason` optional, `highlight` adds a border.
export default function ProductCard({ product, reason, highlight = false, compact = false, onAdd }) {
  const { t, lang } = useI18n();
  if (!product) return null;
  const add = () => {
    addToCart(product, 1);
    onAdd?.(product);
  };
  return (
    <article
      className={`bg-white rounded-2xl p-3 shadow-sm flex flex-col gap-2 border-2 ${
        highlight ? "border-secondary-500" : "border-transparent"
      }`}
    >
      {product.image_url && !compact && (
        <img src={product.image_url} alt={product.name} referrerPolicy="no-referrer" className="h-32 w-full object-contain bg-primary-100 rounded-xl" />
      )}
      <Link to={`/product/${product.product_id}`} className="font-semibold hover:underline line-clamp-2">
        {product.name}
      </Link>
      <p className="text-orange-500 font-bold">
        {formatVnd(product.price_vnd, lang)}
        {product.platform && <span className="text-gray-500 font-normal text-sm"> · {product.platform}</span>}
      </p>
      <Co2Value kg={product.co2e_kg} className="text-sm" />
      <div className="flex flex-wrap gap-1">
        <GreenBadge score={product.green_score} product={product} />
        {product.co2e_kg !== null && product.co2e_kg !== undefined && (
          <SourceLabel source={product.co2e_source} confidence={product.co2e_confidence} />
        )}
      </div>
      {reason && <p className="text-sm text-gray-700">{reason}</p>}
      {!compact && (
        <button
          type="button"
          onClick={add}
          className="mt-auto self-start text-sm bg-primary-200 text-primary-800 rounded-xl px-3 py-1 font-semibold hover:bg-primary-500 hover:text-white"
        >
          🛒 {t("cart.addTest")}
        </button>
      )}
    </article>
  );
}
