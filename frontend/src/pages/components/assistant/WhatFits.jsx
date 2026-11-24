// "What fits": a live preview of the three best matches for the taps the visitor made, read from
// the real catalogue (same search API as Find products). Every line under "Why it fits" is a fact
// the data supports — the category asked for, the CO2 rank, the budget — never an invented claim.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../api/client";
import { tri } from "../../../i18n/LanguageContext";
import { formatCount, formatPrice, normalizeList } from "../../../lib/data";
import { formatKg } from "../../../lib/format";
import { optionLabel, toSearchParams } from "../../../lib/needs";
import { addToCart } from "../../../lib/cart";
import { addToCompare } from "../../../lib/compare";
import ProductThumb from "../common/ProductThumb";

const Tick = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" className="mt-[3px] shrink-0">
    <path d="M3 8.4 6.4 11.6 13 4.6" fill="none" stroke="#1B4D31" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function usePicks(selection) {
  const base = toSearchParams(selection);
  const any = Boolean(selection?.device || selection?.budget || selection?.priority);
  const key = JSON.stringify(base);
  const [state, setState] = useState({ status: "idle", items: [], total: 0, stats: null });
  useEffect(() => {
    if (!any) { setState({ status: "idle", items: [], total: 0, stats: null }); return undefined; }
    let alive = true;
    setState((s) => ({ ...s, status: "loading" }));
    const params = { has_price: true, has_co2: true, has_image: true, ...base, sort: base.sort || "co2_asc", page_size: 3 };
    api.search(params).then(async (res) => {
      const items = normalizeList(res?.items).slice(0, 3);
      let stats = null;
      if (items[0]?.co2_category) stats = await api.getCategoryStats(items[0].co2_category, items[0].product_id).catch(() => null);
      if (alive) setState({ status: "done", items, total: Number(res?.total) || items.length, stats });
    }).catch(() => alive && setState({ status: "error", items: [], total: 0, stats: null }));
    return () => { alive = false; };
  }, [key, any]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, any, sort: base.sort || "co2_asc" };
}

export default function WhatFits({ selection, lang }) {
  const L3 = tri(lang);
  const { status, items, total, stats, any, sort } = usePicks(selection);
  const [note, setNote] = useState(null);
  if (!any) return null;

  const byPrice = sort === "price_asc";
  const top = items[0];
  const lowestInCat = typeof stats?.greener_than_pct === "number" && stats.greener_than_pct >= 99.5 && stats?.n;
  const device = selection?.device ? optionLabel("device", selection.device, lang) : null;
  const purpose = selection?.purpose ? optionLabel("purpose", selection.purpose, lang) : null;
  const budget = selection?.budget ? optionLabel("budget", selection.budget, lang) : null;
  const kg = (p) => `${formatKg(p.co2e_kg, lang)} kg CO₂e`;

  const why = [];
  if (top) {
    if (device) why.push(L3(`Đúng loại bạn chọn: ${device.toLowerCase()}`, `The kind you asked for: ${device.toLowerCase()}`, `Le type demandé : ${device.toLowerCase()}`));
    if (lowestInCat) {
      why.push(L3(`Thấp nhất trong ${formatCount(stats.n, lang)} sản phẩm cùng loại về CO₂`,
                  `Lowest of ${formatCount(stats.n, lang)} in its category — the CO₂ you asked to keep low`,
                  `Le plus bas de ${formatCount(stats.n, lang)} dans sa catégorie pour le CO₂`));
    } else if (!byPrice && total > 1) {
      why.push(L3(`CO₂ thấp nhất trong ${formatCount(total, lang)} sản phẩm đủ thông tin khớp lựa chọn`,
                  `Lowest CO₂ of the ${formatCount(total, lang)} products with full information that match your taps`,
                  `CO₂ le plus bas des ${formatCount(total, lang)} produits complets correspondants`));
    }
    if (byPrice && total > 1) {
      why.push(L3(`Giá thấp nhất trong ${formatCount(total, lang)} sản phẩm khớp`, `Lowest price of the ${formatCount(total, lang)} matches`,
                  `Prix le plus bas des ${formatCount(total, lang)} correspondances`));
    }
    if (budget && top.price_vnd) {
      why.push(L3(`${formatPrice(top.price_vnd, lang)} — trong ngân sách ${budget.toLowerCase()}`,
                  `${formatPrice(top.price_vnd, lang)} — inside your ${budget.replace(/^Under /, "").toLowerCase()} budget`,
                  `${formatPrice(top.price_vnd, lang)} — dans votre budget (${budget.toLowerCase()})`));
    }
    if (purpose) {
      why.push(L3(`Bạn dùng để ${purpose.toLowerCase()}: bấm “Tìm thiết bị” để AI đọc cấu hình giúp bạn`,
                  `For ${purpose.toLowerCase()}: press “Find my device” and the assistant checks its specs`,
                  `Pour ${purpose.toLowerCase()} : « Trouver mon appareil » et l'assistant vérifie la fiche`));
    }
  }

  const rest = items.slice(1, 3);
  const ord = [L3("Lựa chọn 2", "2nd pick", "2e choix"), L3("Lựa chọn 3", "3rd pick", "3e choix")];
  const restReason = (p) => {
    if (!top) return "";
    if (byPrice && p.price_vnd && top.price_vnd) return L3(`đắt hơn ${formatPrice(p.price_vnd - top.price_vnd, lang)}`, `${formatPrice(p.price_vnd - top.price_vnd, lang)} more`, `${formatPrice(p.price_vnd - top.price_vnd, lang)} de plus`);
    if (p.co2e_kg !== null && top.co2e_kg !== null) {
      const d = p.co2e_kg - top.co2e_kg;
      if (Math.abs(d) < 0.05) return L3("cùng mức CO₂ với lựa chọn đầu", "same CO₂ as the top pick", "même CO₂ que le 1er choix");
      return L3(`hơn lựa chọn đầu ${formatKg(d, lang)} kg CO₂e`, `${formatKg(d, lang)} kg CO₂e more than the top pick`, `${formatKg(d, lang)} kg CO₂e de plus que le 1er`);
    }
    return "";
  };

  return (
    <section aria-labelledby="fits" aria-busy={status === "loading"} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="fits" className="font-display text-[26px] font-semibold text-[#1E2B22]">{L3("Món phù hợp", "What fits", "Ce qui convient")}</h2>
        <p className="text-[13.5px] text-[#6B7468]">
          {L3("Từ dữ liệu thật", "From the real catalogue", "Du vrai catalogue")} · {L3("có giá, CO₂ và ảnh thật", "with price, CO₂ and own photo", "avec prix, CO₂ et photo")} · {byPrice ? L3("giá thấp trước", "lowest price first", "prix le plus bas d'abord") : L3("CO₂ thấp trước", "lowest CO₂ first", "CO₂ le plus bas d'abord")}
        </p>
      </div>

      {status === "loading" && !top && <div className="h-[230px] rounded-[24px] bg-white border border-[#E6E2D6] animate-pulse" />}
      {status === "error" && <p className="rounded-2xl bg-white border border-[#E6E2D6] px-4 py-3 text-[15px] text-[#92400e]">{L3("Chưa tải được danh sách.", "The list could not be loaded.", "La liste n'a pas pu être chargée.")}</p>}
      {status === "done" && !top && (
        <p className="rounded-2xl bg-white border border-[#E6E2D6] px-4 py-3 text-[15px] text-[#55604F]">
          {L3("Không có sản phẩm nào khớp tất cả lựa chọn. Bỏ bớt một lựa chọn để xem thêm.",
              "Nothing in the catalogue matches all of these. Remove one choice to see more.",
              "Rien ne correspond à tous ces choix. Retirez-en un pour voir plus.")}
        </p>
      )}

      {top && (
        <article className={`grid gap-5 sm:grid-cols-[230px_minmax(0,1fr)] rounded-[24px] bg-white border-2 border-[#2E7D4F]/70 p-4 sm:p-5 ${status === "loading" ? "opacity-60" : ""}`}>
          <Link to={`/product/${top.product_id}`} className="relative block rounded-2xl bg-[#F1F3EE] overflow-hidden">
            <ProductThumb product={top} className="h-[190px] sm:h-full sm:min-h-[200px]" rounded="rounded-none" tone="soft" />
            <span className="absolute left-2.5 top-2.5 rounded-md bg-[#1B4332] px-2 py-0.5 text-[12px] font-semibold text-white">{L3("Chọn đầu", "Top pick", "1er choix")}</span>
          </Link>
          <div className="min-w-0">
            <Link to={`/product/${top.product_id}`} className="hover:underline">
              <h3 className="font-display text-[23px] font-semibold leading-tight text-[#1E2B22] line-clamp-2">{top.name}</h3>
            </Link>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[13px]">
              <span className="rounded-full bg-[#DDEFDF] px-2.5 py-0.5 font-semibold text-[#1B4D31]">{kg(top)}</span>
              {lowestInCat && <span className="rounded-full bg-[#F1EFE6] px-2.5 py-0.5 text-[#3E4A40]">{L3(`Thấp nhất ${formatCount(stats.n, lang)} cùng loại`, `Lowest of ${formatCount(stats.n, lang)} in its category`, `Le plus bas de ${formatCount(stats.n, lang)}`)}</span>}
              {top.price_vnd && <span className="rounded-full bg-[#F1EFE6] px-2.5 py-0.5 text-[#3E4A40]">{formatPrice(top.price_vnd, lang)}</span>}
              {top.platform && <span className="rounded-full bg-[#F1EFE6] px-2.5 py-0.5 text-[#3E4A40]">{top.platform}</span>}
            </div>
            {why.length > 0 && (
              <>
                <p className="mt-4 text-[11.5px] font-bold uppercase tracking-[0.12em] text-[#6B7468]">{L3("Vì sao phù hợp", "Why it fits", "Pourquoi il convient")}</p>
                <ul className="mt-1.5 space-y-1 text-[14.5px] text-[#2B3A30]">
                  {why.map((w) => <li key={w} className="flex gap-2"><Tick />{w}</li>)}
                </ul>
              </>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to={`/story/${top.product_id}`} className="rounded-full bg-[#1B4332] px-4 py-2 text-[14.5px] font-semibold text-white hover:bg-[#143D26]">
                {L3("Mở cuốn sách CO₂", "Open its CO₂ book", "Ouvrir son livre CO₂")}
              </Link>
              <button type="button" className="rounded-full border border-[#DCD7C9] bg-white px-4 py-2 text-[14.5px] font-semibold text-[#1E2B22] hover:border-[#2E7D4F]"
                      onClick={() => { const r = addToCompare(top); setNote(r === "full" ? L3("Danh sách so sánh đã đầy.", "The compare list is full.", "La liste est pleine.") : L3("Đã thêm vào so sánh.", "Added to compare.", "Ajouté à la comparaison.")); }}>
                {L3("So sánh", "Compare", "Comparer")}
              </button>
              <button type="button" className="rounded-full border border-[#DCD7C9] bg-white px-4 py-2 text-[14.5px] font-semibold text-[#1E2B22] hover:border-[#2E7D4F]"
                      onClick={() => { addToCart(top); setNote(L3("Đã thêm vào giỏ (đơn thử).", "Added to the cart (test order).", "Ajouté au panier (commande test).")); }}>
                {L3("Thêm vào giỏ", "Add to cart", "Ajouter au panier")}
              </button>
            </div>
            {note && <p role="status" className="mt-2 text-[13.5px] text-[#1F5D3A]">{note}</p>}
          </div>
        </article>
      )}

      {rest.length > 0 && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {rest.map((p, i) => (
            <Link key={p.product_id} to={`/product/${p.product_id}`}
                  className="flex min-w-0 items-center gap-3 rounded-[20px] bg-white border border-[#E6E2D6] p-3 hover:border-[#2E7D4F] transition">
              <span className="shrink-0 rounded-xl bg-[#F1F3EE] overflow-hidden"><ProductThumb product={p} size={60} rounded="rounded-xl" tone="soft" /></span>
              <span className="block min-w-0 flex-1">
                <span className="block text-[12px] text-[#6B7468]">{ord[i]}</span>
                <span className="block text-[15px] font-semibold text-[#1E2B22] truncate">{p.name}</span>
                <span className="block text-[12.5px] text-[#55604F] truncate">
                  {[kg(p), p.price_vnd ? formatPrice(p.price_vnd, lang) : null, restReason(p)].filter(Boolean).join(" · ")}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
