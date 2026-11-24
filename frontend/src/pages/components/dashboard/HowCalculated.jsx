// "CO₂ này được tính như thế nào?" on the Overview.
//
// It follows one real product: the last one the visitor opened, or — when there is none yet —
// a real product from the catalogue, clearly marked as a worked example. The formula and its
// terms are visible straight away; the walk-through and the other methods open on a click.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../api/client";
import { tri, useI18n } from "../../../i18n/LanguageContext";
import { useRecent } from "../../../lib/recent";
import { formatKg, formatNum } from "../../../lib/format";
import Co2Explainer from "../co2/Co2Explainer";
import ThreeSteps, { threeSteps } from "../co2/ThreeSteps";
import DeviceIcon from "../ui/DeviceIcon";

/** The chain, short: tried top to bottom, first one that yields a number wins. */
function Chain({ lang, active }) {
  const L3 = tri(lang);
  const steps = [
    ["manufacturer", 0.9, L3("Số của hãng", "Manufacturer figure", "Chiffre du fabricant"),
      L3("có báo cáo cho đúng mẫu", "a report exists for this exact model", "un rapport existe pour ce modèle")],
    ["neighbor_average", 0.5, L3("Trung bình mẫu giống", "Average of similar products", "Moyenne de produits proches"),
      L3("các mẫu giống nhất đã có số của hãng", "the closest products that do have a figure", "les produits proches qui ont un chiffre")],
    ["category_model", 0.35, L3("Mức giữa của loại", "Category level", "Niveau de la catégorie"),
      L3("trung vị của loại, chỉnh theo cỡ nếu có", "the category median, size-adjusted where it applies", "médiane de la catégorie, ajustée à la taille si applicable")],
    ["none", null, L3("Chưa đủ dữ liệu", "Not enough data", "Pas assez de données"),
      L3("để trống, không bao giờ điền 0", "left empty, never filled with 0", "laissé vide, jamais rempli par 0")],
  ];
  return (
    <ol className="space-y-2">
      {steps.map(([key, conf, name, when], i) => {
        const on = key === active;
        return (
          <li key={key} className={`flex items-start gap-3 rounded-xl px-3 py-2 ${on ? "bg-[#E4F1E6] border border-[#CFE6D5]" : ""}`}>
            <span className={`grid place-items-center w-7 h-7 shrink-0 rounded-full text-[13px] font-bold ${on ? "bg-[#1F5D3A] text-white" : "bg-[#F1EEE4] text-[#55604F]"}`}>{i + 1}</span>
            <p className="flex-1 text-[15.5px] leading-snug">
              <b className={on ? "text-[#1F5D3A]" : "text-[#1E2B22]"}>{name}</b>
              <span className="text-[#6B7468]"> · {when}</span>
              {on && <span className="ml-2 rounded-full bg-[#1F5D3A] px-2 py-0.5 text-[12.5px] font-semibold text-white">
                {L3("đang dùng cho sản phẩm này", "used for this product", "utilisée pour ce produit")}</span>}
            </p>
            {conf !== null && (
              <span className="shrink-0 rounded-full bg-white border border-[#EFEBDF] px-2 py-0.5 text-[12.5px] text-[#55604F]">
                {L3("tin cậy", "confidence", "fiabilité")} {formatNum(conf, lang, 2)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Chevron({ open }) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}>
      <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function HowCalculated({ fallbackIds = [] }) {
  const { lang } = useI18n();
  const L3 = tri(lang);
  const recent = useRecent();
  const [co2, setCo2] = useState(null);
  const [example, setExample] = useState(true);
  const [more, setMore] = useState(false);

  const chosenId = recent[0]?.product_id || null;

  const pool = chosenId ? [chosenId] : fallbackIds.slice(0, 8);
  const poolKey = pool.join(",");

  useEffect(() => {
    let alive = true;
    if (!pool.length) return undefined;
    setCo2(null);
    setExample(!chosenId);
    Promise.all(pool.map((pid) => api.getProductCo2(pid).catch(() => null)))
      .then((rows) => {
        if (!alive) return;
        const usable = rows.filter((r) => r?.product?.co2e_kg !== null && r?.product?.co2e_kg !== undefined && r?.formula?.method);
        // for the example, prefer one whose formula actually has several terms to show
        const score = (r) => (r.formula.steps || []).filter((st) => typeof st.value_kg === "number").length;
        setCo2(chosenId ? usable[0] || null : usable.sort((a, b) => score(b) - score(a))[0] || null);
      });
    return () => { alive = false; };
  }, [poolKey, chosenId]); // eslint-disable-line react-hooks/exhaustive-deps

  const steps = co2 ? threeSteps(co2, lang) : null;
  const list = steps?.list || [];
  const [showList, setShowList] = useState(false);
  const refs = co2?.references || [];

  return (
    <section aria-labelledby="how-title" className="rounded-[30px] bg-[#FAF8F2] border border-[#ECE7DA] p-5 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.14em] text-[#2E7D4F]">
            <span aria-hidden="true">🧮</span>{L3("Phương pháp, 3 bước", "The method, in 3 steps", "La méthode, en 3 étapes")}
          </p>
          <h2 id="how-title" className="mt-1 font-display text-[34px] sm:text-[40px] font-semibold leading-tight text-[#1E2B22]">
            {L3("CO₂ này được tính như thế nào?", "How is this CO₂ calculated?", "Comment ce CO₂ est-il calculé ?")}
          </h2>
          <p className="mt-1 text-[16.5px] text-[#6B7468]">
            {chosenId
              ? L3("Theo sản phẩm bạn vừa xem.", "For the product you just looked at.", "Pour le produit que vous venez de voir.")
              : L3("Chưa chọn sản phẩm nào, nên đây là một sản phẩm thật trong dữ liệu, dùng làm ví dụ.",
                   "No product chosen yet, so this is a real product from the catalogue, used as an example.",
                   "Aucun produit choisi : voici un produit réel du catalogue, pris comme exemple.")}
          </p>
        </div>
        <Link to={co2 ? `/method?product=${co2.product.product_id}` : "/method"} className="text-[16px] font-semibold text-[#1F5D3A] hover:underline">
          {L3("Trang Phương pháp", "The method page", "La page Méthode")} →
        </Link>
      </div>

      <div className="mt-5">
        {!co2 && (
          <div className="rounded-[26px] bg-white border border-[#EFEBDF] p-6">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center w-14 h-14 rounded-2xl bg-[#F1EEE4] text-[#55604F]"><DeviceIcon name="other" size={28} /></span>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded bg-[#F1EEE4] animate-pulse" />
                <div className="h-4 w-1/3 rounded bg-[#F1EEE4] animate-pulse" />
              </div>
            </div>
            <div className="mt-5 h-56 rounded-2xl bg-[#F6F3EA] animate-pulse" />
          </div>
        )}
        {co2 && (steps ? <ThreeSteps co2={co2} example={example} /> : <Co2Explainer co2={co2} example={example} />)}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {list.length > 0 && (
          <button type="button" onClick={() => setShowList(!showList)} aria-expanded={showList}
                  className="inline-flex items-center gap-2 rounded-full bg-[#1B4332] px-5 py-3 text-[15.5px] font-semibold text-white hover:bg-[#245740]">
            {list.length > 1
              ? L3(`Xem ${list.length} sản phẩm giống`, `See the ${list.length} similar products`, `Voir les ${list.length} produits proches`)
              : L3("Xem báo cáo được dùng", "See the report used", "Voir le rapport utilisé")}
            <Chevron open={showList} />
          </button>
        )}
        <button type="button" onClick={() => setMore(!more)} aria-expanded={more}
                className="inline-flex items-center gap-2 rounded-full bg-white border border-[#DCD7C9] px-5 py-3 text-[15.5px] font-semibold text-[#1E2B22] hover:border-[#2E7D4F]">
          {L3("Các cách tính khác và thứ tự", "The other methods and their order", "Les autres méthodes et leur ordre")}
          <Chevron open={more} />
        </button>
      </div>

      {showList && list.length > 0 && (
        <ol className="mt-3 rounded-2xl bg-white border border-[#EFEBDF] divide-y divide-[#F1EEE4]">
          {list.map((row, i) => {
            const ref = refs[i] || {};
            return (
              <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-[15px]">
                <span className="w-24 text-[#6B7468]">{L3(`Mẫu ${i + 1}`, `Product ${i + 1}`, `Produit ${i + 1}`)}</span>
                <span className="flex-1 min-w-[200px] font-medium text-[#1E2B22]">{ref.name || row.name || "—"}</span>
                <b className="text-[#1F5D3A]">{formatKg(row.kg, lang)} kg</b>
                {typeof ref.cosine === "number" && ref.cosine < 1 && (
                  <span className="text-[#6B7468]">{L3("giống", "similarity", "similarité")} {formatNum(ref.cosine, lang, 2)}</span>
                )}
                {ref.url && <a href={ref.url} target="_blank" rel="noreferrer" className="text-[#1E5A96] underline">{L3("báo cáo", "report", "rapport")}</a>}
              </li>
            );
          })}
        </ol>
      )}
      {more && (
        <div className="mt-3 rounded-2xl bg-white border border-[#EFEBDF] p-4">
          <p className="mb-3 text-[15px] text-[#6B7468]">
            {L3("Hệ thống thử lần lượt từ trên xuống và dừng ở cách đầu tiên ra được số.",
                "The system tries them from top to bottom and stops at the first one that gives a number.",
                "Le système les essaie de haut en bas et s'arrête à la première qui donne un chiffre.")}
          </p>
          <Chain lang={lang} active={co2?.formula?.method} />
        </div>
      )}
    </section>
  );
}
