import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "../i18n/LanguageContext";
import { api } from "../api/client";
import { formatKg, formatNum, formatVnd, greenColor } from "../lib/format";
import { addToCart } from "../lib/cart";
import { GreenBadge, SectionCard, Skeleton, SourceLabel } from "./components/co2/Co2Bits";

const MAX = 4;

// /compare?ids=a,b,c — 2-4 products side by side; the list lives in the URL.
export default function Compare() {
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const ids = (params.get("ids") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX);
  const idsKey = ids.join(",");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!idsKey) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .compare(idsKey.split(","))
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError(t("compare.error")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [idsKey, t]);

  const setIds = (next) => setParams(next.length ? { ids: next.join(",") } : {});
  const remove = (id) => setIds(ids.filter((x) => x !== id));
  const add = (id) => !ids.includes(String(id)) && ids.length < MAX && setIds([...ids, String(id)]);

  const products = data?.products || [];
  const rows = data?.rows || ["price_vnd", "co2e_kg", "green_score", "co2e_source", "co2e_confidence", "annual_kwh", "electricity_vnd_year"];

  const cell = (p, row) => {
    const v = p[row];
    switch (row) {
      case "price_vnd":
      case "electricity_vnd_year":
        return v != null ? formatVnd(v, lang) : "–";
      case "co2e_kg":
        return formatKg(v, lang) !== null ? `${formatKg(v, lang)} kg` : t("co2.none");
      case "green_score":
        return v != null && p.co2e_kg != null ? <GreenBadge score={v} /> : "–";
      case "co2e_source":
        return p.co2e_kg != null ? <SourceLabel source={v} /> : "–";
      case "co2e_confidence":
      case "annual_kwh":
        return v != null ? formatNum(v, lang, 2) : "–";
      default:
        return v ?? "–";
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-4">
      <h1 className="text-[36px] font-bold text-[#1E2B22] leading-tight">⚖️ {t("compare.title")}</h1>
      <p className="text-gray-600">{t("compare.subtitle")}</p>

      {ids.length < MAX && <ProductPicker onPick={add} exclude={ids} />}
      {!ids.length && <p className="text-gray-600">{t("compare.empty")}</p>}
      {error && <p className="text-red-600">{error}</p>}
      {loading && <Skeleton className="h-64" />}

      {!loading && products.length > 0 && (
        <>
          <div className="overflow-x-auto bg-white rounded-2xl shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-primary-100">
                  <th className="text-left px-3 py-2 w-40">{t("compare.product")}</th>
                  {products.map((p) => (
                    <th key={p.product_id} className="text-left px-3 py-2 align-top min-w-44">
                      <div className="flex flex-col gap-1">
                        {p.image_url && <img src={p.image_url} alt={p.name} className="h-20 object-contain" />}
                        <Link to={`/product/${p.product_id}`} className="font-semibold hover:underline line-clamp-2">{p.name}</Link>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => addToCart(p, 1)} className="text-[14px] font-semibold text-primary-500 hover:underline">
                            🛒 {t("cart.addTest")}
                          </button>
                          <button type="button" onClick={() => remove(p.product_id)} className="text-[14px] font-semibold text-red-600 hover:underline" aria-label={t("compare.remove")}>
                            ✕ {t("compare.remove")}
                          </button>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row} className="border-t border-primary-100">
                    <th scope="row" className="text-left px-3 py-2 font-medium text-gray-600">{t(`compare.row.${row}`)}</th>
                    {products.map((p) => {
                      const best = data.best?.[row] === p.product_id;
                      return (
                        <td
                          key={p.product_id}
                          className={`px-3 py-2 ${best ? "font-bold bg-green-50" : ""}`}
                          style={best && row === "co2e_kg" ? { color: greenColor(p.green_score) } : undefined}
                        >
                          {cell(p, row)} {best && <span className="text-green-700" title={t("compare.best")}>★</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-t border-primary-100">
                  <th scope="row" className="text-left px-3 py-2 font-medium text-gray-600">{t("compare.row.method")}</th>
                  {products.map((p) => (
                    <td key={p.product_id} className="px-3 py-2.5 text-[14px] leading-relaxed">
                      {p.formula ? (lang === "vi" ? p.formula.title_vi : p.formula.title_en) : "–"}
                      {p.formula?.expression && <div className="text-gray-500">{p.formula.expression}</div>}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-primary-100">
                  <th scope="row" className="text-left px-3 py-2 font-medium text-gray-600">{t("compare.row.stages")}</th>
                  {products.map((p) => (
                    <td key={p.product_id} className="px-3 py-2">
                      {p.lifecycle?.stages?.length ? (
                        <div className="flex h-3 w-full rounded-full overflow-hidden bg-gray-100" title={p.lifecycle.stages.map((s) => `${lang === "vi" ? s.label_vi : s.label_en}: ${formatNum(s.pct, lang)}%`).join(" · ")}>
                          {p.lifecycle.stages.map((s, i) => (
                            <div key={s.key} style={{ width: `${s.pct}%`, backgroundColor: ["#1B5B7E", "#329AD2", "#d97706", "#7AA725"][i % 4] }} />
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">{t("lifecycle.noSplit")}</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {data.conclusion && (
            <SectionCard title={`✅ ${t("compare.conclusion")}`}>
              <p>{data.conclusion}</p>
            </SectionCard>
          )}
        </>
      )}
    </main>
  );
}

function ProductPicker({ onPick, exclude }) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const search = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    try {
      setResults(await api.searchProducts(q.trim(), 8));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm flex flex-col gap-2">
      <form onSubmit={search} className="flex gap-2">
        <label htmlFor="cmp-search" className="sr-only">{t("compare.add")}</label>
        <input
          id="cmp-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("compare.addPlaceholder")}
          className="flex-1 bg-primary-200 rounded-xl px-3 py-2"
        />
        <button type="submit" className="bg-primary-500 text-white rounded-xl px-4 py-2 font-semibold" disabled={loading}>
          {t("compare.add")}
        </button>
      </form>
      {results.length > 0 && (
        <ul className="flex flex-col divide-y divide-primary-100 max-h-64 overflow-y-auto">
          {results
            .filter((r) => !exclude.includes(String(r.product_id)))
            .map((r) => (
              <li key={r.product_id} className="flex items-center justify-between gap-2 py-1">
                <span className="text-sm line-clamp-1">
                  {r.name} · {formatVnd(r.price_vnd, lang)} · {formatKg(r.co2e_kg, lang) ? `${formatKg(r.co2e_kg, lang)} kg` : t("co2.none")}
                </span>
                <button type="button" onClick={() => onPick(r.product_id)} className="text-sm text-primary-500 font-semibold whitespace-nowrap">
                  + {t("compare.add")}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
