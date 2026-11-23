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
import { formatNum } from "../../../lib/format";
import Co2Explainer from "../co2/Co2Explainer";
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

  return (
    <section aria-labelledby="how-title" className="rounded-3xl bg-[#F7FBF6] border border-[#DCEBD9] p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="how-title" className="text-[24px] font-bold text-[#1E2B22]">
            🧮 {L3("CO₂ này được tính như thế nào?", "How is this CO₂ calculated?", "Comment ce CO₂ est-il calculé ?")}
          </h2>
          <p className="text-[16px] text-[#6B7468]">
            {chosenId
              ? L3("Theo sản phẩm bạn vừa xem.", "For the product you just looked at.", "Pour le produit que vous venez de voir.")
              : L3("Chưa chọn sản phẩm nào, nên đây là một sản phẩm thật trong dữ liệu, dùng làm ví dụ.",
                   "No product chosen yet, so this is a real product from the catalogue, used as an example.",
                   "Aucun produit choisi : voici un produit réel du catalogue, pris comme exemple.")}
          </p>
        </div>
        <Link to="/method" className="text-[15.5px] font-semibold text-[#1F5D3A] hover:underline">
          {L3("Trang Phương pháp", "The method page", "La page Méthode")} →
        </Link>
      </div>

      <div className="mt-4">
        {co2
          ? <Co2Explainer co2={co2} example={example} />
          : <div className="rounded-3xl bg-white border border-[#EFEBDF] p-5">
              <div className="flex items-center gap-3">
                <span className="grid place-items-center w-12 h-12 rounded-2xl bg-[#F1EEE4] text-[#55604F]"><DeviceIcon name="other" size={28} /></span>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-[#F1EEE4] animate-pulse" />
                  <div className="h-4 w-1/3 rounded bg-[#F1EEE4] animate-pulse" />
                </div>
              </div>
            </div>}
      </div>

      <button type="button" onClick={() => setMore(!more)} aria-expanded={more}
              className="mt-4 inline-flex items-center gap-1.5 text-[15.5px] font-semibold text-[#1F5D3A] hover:underline">
        {more ? L3("Ẩn các cách tính khác", "Hide the other methods", "Masquer les autres méthodes")
              : L3("Các cách tính khác và thứ tự ưu tiên", "The other methods and their order", "Les autres méthodes et leur ordre")}
        <span aria-hidden="true" className={`transition-transform ${more ? "rotate-180" : ""}`}>▾</span>
      </button>
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
