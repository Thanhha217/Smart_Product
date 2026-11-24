// "Change product" on the Overview: type a few letters, pick a product, the map swaps to it.
// It searches in place (GET /api/search) instead of sending the visitor to another page.
//
// Only products that already have a CO2 figure are offered: the Overview has no world to draw
// for a product without one.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../api/client";
import { tri } from "../../../i18n/LanguageContext";
import { formatKg } from "../../../lib/format";
import { useRecent } from "../../../lib/recent";
import ProductThumb from "../common/ProductThumb";

const LIMIT = 8;

function Row({ product, onPick, lang }) {
  return (
    <button type="button" onClick={() => onPick(product.product_id)}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-[#F1F7EF]">
      <ProductThumb product={product} size={40} rounded="rounded-lg" standIn={false} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold text-[#1E2B22]">{product.name}</span>
        <span className="block truncate text-[12.5px] text-[#6B7468]">{product.platform || "—"}</span>
      </span>
      {product.co2e_kg !== null && product.co2e_kg !== undefined && (
        <span className="shrink-0 rounded-full bg-[#E4F1E6] px-2 py-0.5 text-[12.5px] font-bold text-[#1F5D3A]">
          {formatKg(product.co2e_kg, lang)} kg
        </span>
      )}
    </button>
  );
}

export default function ProductPicker({ lang, currentId }) {
  const L3 = tri(lang);
  const navigate = useNavigate();
  const recent = useRecent();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [state, setState] = useState({ status: "idle", items: [] });
  const box = useRef(null);
  const input = useRef(null);

  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  // close on Escape or a click outside
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown);
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("pointerdown", onDown); };
  }, [open]);

  // search as you type; a newer keystroke cancels the request still in flight
  useEffect(() => {
    const text = q.trim();
    if (!open || text.length < 2) { setState({ status: "idle", items: [] }); return undefined; }
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, status: "loading" }));
      api.search({ q: text, has_co2: true, page_size: LIMIT, sort: "relevance" }, { signal: ctl.signal })
        .then((r) => setState({ status: "ok", items: (r?.items || []).filter((p) => String(p.product_id) !== String(currentId)) }))
        .catch((e) => { if (e?.code !== "cancelled") setState({ status: "error", items: [] }); });
    }, 300);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [q, open, currentId]);

  const pick = (id) => { setOpen(false); setQ(""); navigate(`/world/${id}`); };

  // nothing typed yet: offer the products this visitor already looked at
  const suggestions = recent.filter((p) => String(p.product_id) !== String(currentId)).slice(0, 5);
  const typing = q.trim().length >= 2;

  return (
    <div ref={box} className="relative shrink-0">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog"
              className="inline-flex items-center gap-2 rounded-full border border-[#DCD6C6] bg-white px-4 py-2 text-[14.5px] font-semibold text-[#1E2B22] transition hover:border-[#2E7D4F] hover:text-[#1F5D3A]">
        <span aria-hidden="true">🔍</span>
        {L3("Đổi sản phẩm", "Change product", "Changer de produit")}
      </button>

      {open && (
        <div role="dialog" aria-label={L3("Chọn sản phẩm", "Choose a product", "Choisir un produit")}
             className="absolute right-0 z-30 mt-2 w-[min(420px,calc(100vw-32px))] rounded-[20px] border border-[#E8E4D8] bg-white p-3 shadow-2xl">
          <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder={L3("Gõ tên sản phẩm, ví dụ Dell", "Type a product name, e.g. Dell", "Tapez un nom, p. ex. Dell")}
                 className="w-full rounded-xl border border-[#E7E2D4] px-3.5 py-2.5 text-[15px] text-[#1E2B22] outline-none focus:border-[#2E7D4F] focus:ring-2 focus:ring-[#2E7D4F]/20" />

          <div className="mt-2 max-h-[46vh] overflow-y-auto">
            {!typing && suggestions.length > 0 && (
              <>
                <p className="px-2.5 py-1 text-[12px] font-bold uppercase tracking-[0.12em] text-[#8A9186]">
                  {L3("Vừa xem", "Recently viewed", "Vus récemment")}
                </p>
                {suggestions.map((p) => <Row key={p.product_id} product={p} onPick={pick} lang={lang} />)}
              </>
            )}
            {!typing && suggestions.length === 0 && (
              <p className="px-2.5 py-3 text-[14px] text-[#6B7468]">
                {L3("Gõ ít nhất 2 chữ để tìm.", "Type at least 2 letters to search.", "Tapez au moins 2 lettres.")}
              </p>
            )}

            {typing && state.status === "loading" && (
              <p className="flex items-center gap-2 px-2.5 py-3 text-[14px] text-[#6B7468]">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2E7D4F] border-t-transparent" aria-hidden="true" />
                {L3("Đang tìm…", "Searching…", "Recherche…")}
              </p>
            )}
            {typing && state.status === "error" && (
              <p className="px-2.5 py-3 text-[14px] text-[#B4532F]">
                {L3("Không tìm được. Thử lại sau.", "The search did not answer. Try again.", "La recherche n'a pas répondu.")}
              </p>
            )}
            {typing && state.status === "ok" && state.items.length === 0 && (
              <p className="px-2.5 py-3 text-[14px] text-[#6B7468]">
                {L3(`Không có sản phẩm nào khớp "${q.trim()}" mà đã có số CO₂.`,
                    `No product with a CO₂ figure matches "${q.trim()}".`,
                    `Aucun produit avec un chiffre CO₂ ne correspond à « ${q.trim()} ».`)}
              </p>
            )}
            {typing && state.status === "ok" && state.items.map((p) => (
              <Row key={p.product_id} product={p} onPick={pick} lang={lang} />
            ))}
          </div>

          <Link to="/world?explore=1" onClick={() => setOpen(false)}
                className="mt-1 block border-t border-[#EFEBDF] px-2.5 pt-2.5 text-[14px] font-semibold text-[#1F5D3A] hover:underline">
            {L3("Xem tất cả sản phẩm", "Browse all products", "Voir tous les produits")} →
          </Link>
        </div>
      )}
    </div>
  );
}
