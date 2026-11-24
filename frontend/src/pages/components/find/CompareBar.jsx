// The floating compare tray of Find products: what is in the comparison, remove one, go compare.
import { Link } from "react-router-dom";
import { tri, useI18n } from "../../../i18n/LanguageContext";
import { COMPARE_MAX, removeFromCompare, useCompare } from "../../../lib/compare";
import { shortName } from "../../../lib/shortName";
import Icon from "../ui/Icon";

export default function CompareBar({ note }) {
  const { lang } = useI18n();
  const L3 = tri(lang);
  const list = useCompare();
  if (!list.length) return null;
  return (
    <div className="fixed z-40 bottom-[84px] left-4 right-[96px] min-[900px]:bottom-5 min-[900px]:left-[276px] min-[900px]:right-[112px]"
         role="region" aria-label={L3("So sánh", "Compare", "Comparer")}>
      <div className="flex h-16 items-center gap-3 rounded-[20px] bg-[#1B4332] pl-4 pr-3 text-white shadow-[0_18px_40px_-16px_rgba(20,40,28,.7)]">
        <span className="flex shrink-0 items-center gap-2 text-[15px]">
          <Icon name="scale" size={18} />
          <b>{list.length}</b><span className="-ml-1 text-white/80">/{COMPARE_MAX}</span>
        </span>
        <ul className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
          {list.map((p) => (
            <li key={p.product_id} className="flex shrink-0 items-center gap-2 rounded-full bg-white/[0.13] py-1.5 pl-3.5 pr-2 text-[14.5px]">
              <span className="max-w-[180px] truncate" title={p.name}>{shortName(p.name)}</span>
              <button type="button" onClick={() => removeFromCompare(p.product_id)}
                      className="grid h-6 w-6 place-items-center rounded-full text-white/80 hover:bg-white/15 hover:text-white"
                      aria-label={L3(`Bỏ ${p.name}`, `Remove ${p.name}`, `Retirer ${p.name}`)}>×</button>
            </li>
          ))}
        </ul>
        {note && <span role="status" className="hidden md:block shrink-0 text-[13.5px] text-amber-200">{note}</span>}
        <Link to="/compare" className="grid h-11 w-14 shrink-0 place-items-center rounded-[12px] bg-white text-[#1B4332] hover:bg-[#F1F5EF]"
              aria-label={L3("Mở trang so sánh", "Open the comparison", "Ouvrir la comparaison")}>
          <Icon name="arrowRight" size={19} />
        </Link>
      </div>
    </div>
  );
}
