// Real starting points when the visitor has no history yet: the lowest-CO2 priced product of each
// category (GET /api/overview). Nothing is added anywhere until the visitor presses a button.
import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import { useI18n } from "../../../i18n/LanguageContext";
import { normalizeProduct } from "../../../lib/data";
import ProductCard from "./ProductCard";
import { ErrorState, LoadingGrid } from "./States";

const TEXT = {
  title: { en: "Lowest CO₂ in each category", fr: "Le CO₂ le plus bas de chaque catégorie", vi: "Món ít CO₂ nhất mỗi loại" },
  lead: {
    en: "A real starting point from the catalogue: the priced product with the lowest stored CO₂ figure in each category.",
    fr: "Un vrai point de départ tiré du catalogue : le produit avec prix au chiffre CO₂ le plus bas de chaque catégorie.",
    vi: "Điểm bắt đầu lấy từ dữ liệu thật: sản phẩm có giá với số CO₂ thấp nhất của mỗi loại.",
  },
};

export default function SuggestedProducts({ limit = 4, title, exclude = [] }) {
  const { lang } = useI18n();
  const [state, setState] = useState({ status: "loading", items: [] });
  const load = () => {
    setState({ status: "loading", items: [] });
    api.getOverview()
      .then((d) => setState({ status: "ok", items: (d.greenest || []).map((g) => normalizeProduct(g.product)).filter(Boolean) }))
      .catch(() => setState({ status: "error", items: [] }));
  };
  useEffect(load, []);  // eslint-disable-line react-hooks/exhaustive-deps
  const items = state.items.filter((p) => !exclude.includes(p.product_id)).slice(0, limit);
  if (state.status === "ok" && items.length === 0) return null;
  return (
    <section aria-labelledby="suggested-title" className="mt-2">
      <h2 id="suggested-title" className="text-lg font-semibold text-[#1E2B22]">{title || TEXT.title[lang] || TEXT.title.en}</h2>
      <p className="text-[15px] text-[#4b5563]">{TEXT.lead[lang] || TEXT.lead.en}</p>
      <div className="mt-3">
        {state.status === "loading" && <LoadingGrid count={limit > 3 ? 4 : 3} />}
        {state.status === "error" && <ErrorState compact onRetry={load} />}
        {state.status === "ok" && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((p) => <ProductCard key={p.product_id} product={p} />)}
          </div>
        )}
      </div>
    </section>
  );
}
