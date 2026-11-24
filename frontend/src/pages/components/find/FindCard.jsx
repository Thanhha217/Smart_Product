// A Find products card: photo, short name, the CO₂ figure in large type, price, and two actions —
// open the product's CO₂ book, or add it to the comparison. Values come from lib/data.js; a missing
// price or CO₂ figure is shown as missing, never guessed.
import { useState } from "react";
import { Link } from "react-router-dom";
import { tri, useI18n } from "../../../i18n/LanguageContext";
import { addToCompare, removeFromCompare, useCompare } from "../../../lib/compare";
import { co2Kind, formatPrice, normalizeProduct } from "../../../lib/data";
import { formatKg } from "../../../lib/format";
import { shortName, variantOf } from "../../../lib/shortName";
import { teardownOf } from "../../../lib/teardown";
import TeardownModal from "../product/TeardownModal";
import ProductThumb from "../common/ProductThumb";
import Icon from "../ui/Icon";

export default function FindCard({ product: raw, onCompareFull }) {
  const { lang } = useI18n();
  const L3 = tri(lang);
  const compare = useCompare();
  const p = normalizeProduct(raw);
  if (!p) return null;
  const inCompare = compare.some((c) => c.product_id === p.product_id);
  const price = formatPrice(p.price_vnd, lang);
  const hasCo2 = p.co2e_kg !== null;
  const estimated = hasCo2 && co2Kind(p) !== "published";
  const name = shortName(p.name);
  // only the demo machines have a teardown; the button stays hidden for the rest
  const teardown = teardownOf(p.product_id);
  const [bookOpen, setBookOpen] = useState(false);
  const variant = variantOf(p.name);

  const toggle = () => {
    if (inCompare) { removeFromCompare(p.product_id); return; }
    if (addToCompare(p) === "full") onCompareFull?.();
  };

  return (
    <article className="flex flex-col rounded-[22px] bg-white border border-[#E8E4D8] p-3 shadow-[0_1px_2px_rgba(30,43,34,0.04)] hover:shadow-md transition-shadow">
      <Link to={`/product/${p.product_id}`} title={p.name}
            className="block h-[164px] rounded-[16px] overflow-hidden bg-[#F3EFE4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D4F]">
        <ProductThumb product={p} className="h-full" rounded="rounded-[16px]" standIn={false} tone="find" />
      </Link>
      <div className="flex flex-1 flex-col px-2 pt-4">
        <Link to={`/product/${p.product_id}`} title={p.name} className="min-w-0 hover:underline focus-visible:outline-none focus-visible:underline">
          <h3 className="truncate text-[17px] font-semibold text-[#1E2B22]">{name}</h3>
        </Link>
        {variant && <p className="truncate text-[13px] text-[#8A9186]">{variant}</p>}
        {hasCo2 ? (
          <p className="mt-2 flex items-baseline gap-1.5"
             title={estimated ? L3("Số ước tính", "Estimated figure", "Chiffre estimé") : L3("Số hãng công bố", "Published figure", "Chiffre publié")}>
            <span className="font-display text-[34px] font-bold leading-none text-[#1B4D31]">{estimated ? "≈" : ""}{formatKg(p.co2e_kg, lang)}</span>
            <span className="text-[13px] text-[#6B7468]">kg CO₂e</span>
          </p>
        ) : (
          <p className="mt-2 text-[15px] text-[#6B7468]">{L3("Chưa có số CO₂", "No CO₂ figure yet", "Pas encore de chiffre CO₂")}</p>
        )}
        <p className="mt-2 text-[15.5px] font-bold text-[#1E2B22]">{price || "—"}</p>
        <div className="mt-auto flex gap-2 pt-3">
          {hasCo2 ? (
            <Link to={`/story/${p.product_id}`}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[12px] bg-[#1B4332] text-[15.5px] font-semibold text-white hover:bg-[#143D26] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D4F] focus-visible:ring-offset-2">
              <Icon name="book" size={17} />CO₂ book
            </Link>
          ) : (
            <span className="flex h-11 flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-[12px] bg-[#E9E6DC] text-[15.5px] font-semibold text-[#8A9186]"
                  title={L3("Chưa có số CO₂ nên chưa có sách", "No CO₂ figure, so no book yet", "Pas de chiffre CO₂, donc pas de livre")}>
              <Icon name="book" size={17} />CO₂ book
            </span>
          )}
          {teardown && (
            <button type="button" onClick={() => setBookOpen(true)}
                    aria-label={L3("Bên trong máy", "Inside the machine", "Dans la machine")}
                    title={L3("Bên trong máy", "Inside the machine", "Dans la machine")}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border border-[#1B4332] bg-white text-[#1B4332] transition hover:bg-[#F3F8F1]">
              <Icon name="cpu" size={17} />
            </button>
          )}
          <button type="button" onClick={toggle} aria-pressed={inCompare}
                  aria-label={inCompare ? L3("Bỏ khỏi so sánh", "Remove from compare", "Retirer de la comparaison") : L3("Thêm vào so sánh", "Add to compare", "Ajouter à la comparaison")}
                  title={inCompare ? L3("Bỏ khỏi so sánh", "Remove from compare", "Retirer de la comparaison") : L3("Thêm vào so sánh", "Add to compare", "Ajouter à la comparaison")}
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border transition ${inCompare ? "border-[#2E7D4F] bg-[#E4F0E6] text-[#1B4D31]" : "border-[#1B4332] bg-white text-[#1B4332] hover:bg-[#F3F8F1]"}`}>
            <Icon name="scale" size={17} />
          </button>
        </div>
      </div>
      {bookOpen && teardown && (
        <TeardownModal product={p} data={teardown} lang={lang} onClose={() => setBookOpen(false)} />
      )}
    </article>
  );
}
