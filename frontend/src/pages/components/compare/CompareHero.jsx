// The top of the compare page (design "So sánh"): the product to choose and by how much, then
// "How it is worked out" — one card per product with its CO₂ against the category median, and the
// three subtractions behind the figures in the green card. Figures are the products' own; only
// differences and percentages are derived (lib/compareMath.js).
import { Link } from "react-router-dom";
import { tri, useI18n } from "../../../i18n/LanguageContext";
import { barScale } from "../../../lib/compareMath";
import { co2Kind, formatPrice } from "../../../lib/data";
import { formatKg, formatNum } from "../../../lib/format";
import { shortName } from "../../../lib/shortName";
import ProductThumb from "../common/ProductThumb";
import Icon from "../ui/Icon";

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const pctText = (v, lang) => `${formatNum(v, lang, 1)} %`;

function Tile({ label, value, note }) {
  return (
    <div className="rounded-[16px] bg-white/[0.09] px-4 py-3.5">
      <p className="text-[12.5px] font-bold uppercase tracking-[0.12em] text-white/70">{label}</p>
      <p className="mt-1 font-display text-[28px] font-semibold leading-tight">{value}</p>
      <p className="mt-0.5 text-[14px] leading-snug text-white/80">{note}</p>
    </div>
  );
}

/** The green "choose this one" card, or why no product is chosen. */
export function Hero({ rec, reason, catName }) {
  const { lang } = useI18n();
  const L3 = tri(lang);
  if (!rec) {
    return (
      <section className="rounded-[24px] bg-[#1B4332] p-6 text-white" role="note">
        <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-white/70">{L3("Chưa chọn hộ", "No pick yet", "Pas de choix")}</p>
        <p className="mt-2 max-w-3xl font-display text-[22px] leading-snug">{reason}</p>
      </section>
    );
  }
  const { best, runner, co2, price, cat, badges } = rec;
  const vs = shortName(runner.name);
  const k = (v) => formatKg(v, lang);
  return (
    <section className="grid gap-5 rounded-[24px] bg-[#1B4332] p-6 text-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]" aria-labelledby="pick">
      <div className="flex items-center gap-5">
        <span className="grid h-[104px] w-[108px] shrink-0 place-items-center overflow-hidden rounded-[16px] bg-[#F3EFE4]">
          <ProductThumb product={best} className="h-full w-full" rounded="rounded-[16px]" standIn={false} tone="find" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-white/70">{L3("Nên chọn", "Choose", "À choisir")}</p>
          <Link id="pick" to={`/product/${best.product_id}`} className="mt-1 block font-display text-[26px] font-semibold leading-[1.15] hover:underline">{best.name}</Link>
          <div className="mt-2.5 flex flex-wrap gap-1.5 text-[14px] font-semibold">
            {badges.lowestCo2 && <span className="rounded-full bg-white/[0.12] px-3 py-1">✓ {L3("CO₂ thấp nhất", "Lowest CO₂", "CO₂ le plus bas")}</span>}
            {badges.cheapest && <span className="rounded-full bg-white/[0.12] px-3 py-1">✓ {L3("Rẻ nhất", "Cheapest", "Le moins cher")}</span>}
            {badges.greenest && <span className="rounded-full bg-white/[0.12] px-3 py-1">✓ {L3("Điểm xanh cao nhất", "Best green score", "Meilleur score vert")}</span>}
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Tile label={L3("CO₂ giảm", "CO₂ saved", "CO₂ économisé")}
              value={co2.diff > 0 ? `−${k(co2.diff)} kg` : "0 kg"}
              note={co2.diff > 0 ? L3(`thấp hơn ${pctText(co2.pct, lang)} so với ${vs}`, `${pctText(co2.pct, lang)} lower than ${vs}`, `${pctText(co2.pct, lang)} de moins que ${vs}`)
                : L3(`bằng ${vs}`, `the same as ${vs}`, `égal à ${vs}`)} />
        <Tile label={L3("Giá", "Price", "Prix")}
              value={!price ? "—" : price.diff < 0 ? `−${formatPrice(-price.diff, lang)}` : price.diff > 0 ? `+${formatPrice(price.diff, lang)}` : formatPrice(0, lang) || "0 ₫"}
              note={!price ? L3("Thiếu giá để so", "A price is missing", "Un prix manque")
                : price.diff < 0 ? L3(`rẻ hơn ${pctText(price.pct, lang)} so với ${vs}`, `${pctText(price.pct, lang)} cheaper than ${vs}`, `${pctText(price.pct, lang)} moins cher que ${vs}`)
                : price.diff > 0 ? L3(`đắt hơn ${pctText(price.pct, lang)} so với ${vs}`, `${pctText(price.pct, lang)} dearer than ${vs}`, `${pctText(price.pct, lang)} plus cher que ${vs}`)
                : L3(`cùng giá với ${vs}`, `the same price as ${vs}`, `même prix que ${vs}`)} />
        {cat && (
          <Tile label={L3("So với danh mục", "Against the category", "Face à la catégorie")}
                value={`${cat.diff <= 0 ? "−" : "+"}${k(Math.abs(cat.diff))} kg`}
                note={cat.diff <= 0
                  ? L3(`thấp hơn ${pctText(cat.pct, lang)} so với trung vị ${catName} (${k(cat.median)} kg)`, `${pctText(cat.pct, lang)} below the ${catName} median (${k(cat.median)} kg)`, `${pctText(cat.pct, lang)} sous la médiane (${k(cat.median)} kg)`)
                  : L3(`cao hơn ${pctText(cat.pct, lang)} so với trung vị ${catName} (${k(cat.median)} kg)`, `${pctText(cat.pct, lang)} above the ${catName} median (${k(cat.median)} kg)`, `${pctText(cat.pct, lang)} au-dessus de la médiane (${k(cat.median)} kg)`)} />
        )}
      </div>
    </section>
  );
}

/** One product: its CO₂ on a bar, with the category median marked. */
function ProductBar({ p, picked, median, scale }) {
  const { lang, t } = useI18n();
  const L3 = tri(lang);
  const has = isNum(p.co2e_kg);
  const estimated = has && co2Kind(p) !== "published";
  const price = formatPrice(p.price_vnd, lang);
  return (
    <article className={`rounded-[22px] border bg-white p-5 ${picked ? "border-2 border-[#2E7D4F]" : "border-[#E8E4D8]"}`}>
      <div className="flex items-center gap-4">
        <Link to={`/product/${p.product_id}`} className="grid h-[76px] w-[92px] shrink-0 place-items-center overflow-hidden rounded-[14px] bg-[#F3EFE4]">
          <ProductThumb product={p} className="h-full w-full" rounded="rounded-[14px]" standIn={false} tone="find" />
        </Link>
        <div className="min-w-0">
          {picked && <span className="inline-block rounded-md bg-[#1B4332] px-2 py-0.5 text-[12.5px] font-semibold text-white">{L3("Nên chọn", "Choose", "À choisir")}</span>}
          <Link to={`/product/${p.product_id}`} title={p.name} className="mt-1 block truncate text-[18px] font-semibold text-[#1E2B22] hover:underline">{shortName(p.name)}</Link>
        </div>
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-3">
        {has ? (
          <p className="flex items-baseline gap-2">
            <span className="font-display text-[40px] font-bold leading-none text-[#1B4D31]">{estimated ? "≈" : ""}{formatKg(p.co2e_kg, lang)}</span>
            <span className="text-[14px] text-[#55604F]">kg CO₂e</span>
          </p>
        ) : <p className="text-[15px] text-[#6B7468]">{L3("Chưa có số CO₂", "No CO₂ figure yet", "Pas de chiffre CO₂")}</p>}
        <span className="text-[17px] font-semibold text-[#1E2B22]">{price || <span className="text-[14px] font-normal text-[#6B7468]">{t("common.noPrice")}</span>}</span>
      </div>
      {has && (
        <>
          <div className="relative mt-4 h-3 rounded-full bg-[#ECE8DD]" aria-hidden="true">
            <div className={`h-3 rounded-full ${picked ? "bg-[#2E7D4F]" : "bg-[#A8CBB2]"}`} style={{ width: `${Math.min(100, (p.co2e_kg / scale) * 100)}%` }} />
            {isNum(median) && (
              <span className="absolute -top-1.5 -bottom-1.5 border-l-2 border-dashed border-[#C77A12]" style={{ left: `${Math.min(100, (median / scale) * 100)}%` }} />
            )}
          </div>
          {isNum(median) && (
            <p className="mt-2.5 text-[14px] font-medium text-[#A0620C]">┆ {L3("Trung vị danh mục", "Category median", "Médiane de la catégorie")} {formatKg(median, lang)} kg</p>
          )}
        </>
      )}
    </article>
  );
}

function CalcCard({ title, icon, lines, note }) {
  return (
    <article className="rounded-[22px] border border-[#E8E4D8] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#55604F]">{title}</p>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#DCD7C9] font-display text-[17px] text-[#1B4332]" aria-hidden="true">{icon}</span>
      </div>
      <div className="mt-3 space-y-1 rounded-[12px] bg-[#F6F3EA] px-3.5 py-3 font-mono text-[14.5px] text-[#1E2B22]">
        {lines.map((l) => <p key={l}>{l}</p>)}
      </div>
      {note && <p className="mt-2.5 text-[13.5px] leading-snug text-[#6B7468]">{note}</p>}
    </article>
  );
}

/** Section 1: one card per product, then the three subtractions behind the green card. */
export function HowWorked({ products, rec, medianOf, statsOf, sameCategory }) {
  const { lang } = useI18n();
  const L3 = tri(lang);
  const k = (v) => formatKg(v, lang);
  const ordered = rec ? [rec.best, ...products.filter((p) => p.product_id !== rec.best.product_id)] : products;
  const shared = sameCategory ? barScale([...products.map((p) => p.co2e_kg), medianOf(products[0])]) : null;
  const cols = ordered.length === 3 ? "lg:grid-cols-3" : "md:grid-cols-2";
  const st = rec ? statsOf(rec.best) : null;

  const cards = [];
  if (rec) {
    const { best, runner, co2, price, cat } = rec;
    const vs = shortName(runner.name), me = shortName(best.name);
    cards.push(<CalcCard key="co2" icon="−" title={L3("Chênh lệch CO₂", "CO₂ difference", "Écart de CO₂")}
      lines={[`${k(runner.co2e_kg)} − ${k(best.co2e_kg)} = ${k(co2.diff)} kg`, `${k(co2.diff)} ÷ ${k(runner.co2e_kg)} = ${pctText(co2.pct, lang)}`]}
      note={L3(`${vs} trừ ${me}, chia cho số của ${vs}.`, `${vs} minus ${me}, divided by ${vs}'s figure.`, `${vs} moins ${me}, divisé par le chiffre de ${vs}.`)} />);
    cards.push(<CalcCard key="price" icon="₫" title={L3("Chênh lệch giá", "Price difference", "Écart de prix")}
      lines={price
        ? [`${formatPrice(runner.price_vnd, lang)} − ${formatPrice(best.price_vnd, lang)} = ${price.diff <= 0 ? "" : "−"}${formatPrice(Math.abs(price.diff), lang)}`,
           `${formatPrice(Math.abs(price.diff), lang)} ÷ ${formatPrice(runner.price_vnd, lang)} = ${pctText(price.pct, lang)}`]
        : [L3("Thiếu giá của một món", "One price is missing", "Un prix manque")]}
      note={L3("Giá đang bán tại cửa hàng, lúc lấy dữ liệu.", "The store price when the data was collected.", "Le prix en magasin lors de la collecte.")} />);
    cards.push(<CalcCard key="cat" icon="M" title={L3("So với trung vị danh mục", "Against the category median", "Face à la médiane")}
      lines={cat
        ? [`${k(cat.median)} − ${k(best.co2e_kg)} = ${cat.diff <= 0 ? "" : "−"}${k(Math.abs(cat.diff))} kg`, `${k(Math.abs(cat.diff))} ÷ ${k(cat.median)} = ${pctText(cat.pct, lang)}`]
        : [L3("Chưa có trung vị của danh mục", "No category median yet", "Pas encore de médiane")]}
      note={st?.n ? L3(`Trung vị của ${formatNum(st.n, lang, 0)} sản phẩm cùng loại có số CO₂.`, `The median of the ${formatNum(st.n, lang, 0)} products of the category with a CO₂ figure.`, `Médiane des ${formatNum(st.n, lang, 0)} produits de la catégorie avec un chiffre CO₂.`) : null} />);
  }

  return (
    <section aria-labelledby="how" className="flex flex-col gap-4">
      <h2 id="how" className="flex items-center gap-3 font-display text-[26px] font-semibold text-[#1E2B22]">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#1B4332] font-sans text-[15px] font-bold text-white">1</span>
        {L3("Tính như thế nào", "How it is worked out", "Comment c'est calculé")}
      </h2>
      <div className={`grid gap-4 ${cols}`}>
        {ordered.map((p) => {
          const median = medianOf(p);
          const scale = shared ?? barScale([p.co2e_kg, median]);
          return <ProductBar key={p.product_id} p={p} picked={rec?.best.product_id === p.product_id} median={median} scale={scale} />;
        })}
      </div>
      {cards.length > 0 && <div className="grid gap-4 lg:grid-cols-3">{cards}</div>}
      {!sameCategory && (
        <p className="flex items-start gap-2 text-[14px] text-[#7c4a03]"><Icon name="info" size={16} className="mt-0.5 shrink-0" />
          {L3("Mỗi thẻ dùng thang và trung vị của loại riêng nó; không so độ dài thanh giữa các loại.", "Each card uses its own category's scale and median; do not compare bar lengths across types.", "Chaque fiche a l'échelle et la médiane de sa catégorie.")}
        </p>
      )}
    </section>
  );
}
