import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../../i18n/LanguageContext";
import { api } from "../../../api/client";
import { formatKg, formatNum, greenColor } from "../../../lib/format";
import { txt } from "./storyText";

/** Search a product with a CO2 figure and open it under `basePath` (/story or /world). */
export default function ProductPicker({ basePath, icon, title, lead }) {
  const { lang } = useI18n();
  const T = useMemo(() => txt(lang), [lang]);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);

  const search = useCallback(async (query) => {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const list = await api.searchProducts(query, 12);
      setResults((list || []).filter((c) => c.co2e_kg !== null && c.co2e_kg !== undefined).slice(0, 6));
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="max-w-3xl mx-auto text-center py-6">
      <p className="text-5xl mb-2">{icon}</p>
      <h1 className="text-3xl md:text-4xl font-black text-[#1f3b4d]">{title}</h1>
      <p className="text-gray-600 mt-3">{lead}</p>
      <form className="mt-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); search(q); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T.landingPlaceholder}
               className="flex-1 min-w-0 rounded-2xl border-2 border-emerald-200 focus:border-emerald-500 outline-none px-4 py-3 text-lg" />
        <button type="submit" disabled={busy} className="rounded-2xl bg-emerald-600 text-white font-bold px-6 disabled:opacity-50">{busy ? "…" : T.landingGo}</button>
      </form>
      <div className="flex flex-wrap justify-center gap-2 mt-3">
        {T.suggestions.map((s) => (
          <button key={s} type="button" className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-sm hover:bg-emerald-100" onClick={() => { setQ(s); search(s); }}>{s}</button>
        ))}
      </div>
      {results && (
        <div className="mt-6 text-left">
          <p className="font-semibold text-gray-700 mb-2">{results.length ? T.landingPick : T.landingNone}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {results.map((c) => (
              <button key={c.product_id} type="button" onClick={() => navigate(`${basePath}/${c.product_id}`)}
                      className="text-left rounded-xl border bg-white hover:shadow-lg hover:-translate-y-0.5 transition p-3">
                <p className="font-semibold line-clamp-2">{c.name}</p>
                <p className="text-sm text-gray-500">{c.platform}</p>
                <p className="mt-1 font-bold" style={{ color: greenColor(c.green_score) }}>{formatKg(c.co2e_kg, lang)} kg CO₂e · {formatNum(c.green_score, lang, 1)}/5</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
