import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/LanguageContext";
import { GATEWAY_URL } from "./utils/consts";
import VoiceInput from "./components/assistant/VoiceInput";
import ChartView from "./components/assistant/ChartView";
import Throbber from "./components/general/Throbber";

export default function Assistant() {
  const { t, lang, formatNumber } = useI18n();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e?.preventDefault();
    if (!message.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${GATEWAY_URL}/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, lang }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (err) {
      console.error("Assistant request failed:", err);
      setError(t("assistant.error"));
    } finally {
      setLoading(false);
    }
  };

  const formatCell = (value) =>
    typeof value === "number" ? formatNumber(value) : typeof value === "boolean" ? (value ? "✓" : "–") : value ?? "";

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-bold text-primary-500">{t("assistant.title")}</h1>
        <p className="text-gray-600">{t("assistant.subtitle")}</p>
      </section>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <textarea
          className="bg-primary-200 rounded-2xl p-3 min-h-24 outline-secondary-500 focus:outline-2"
          placeholder={t("assistant.placeholder")}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit(e);
          }}
        />
        <div className="flex gap-3 justify-end">
          <VoiceInput disabled={loading} onTranscript={(text) => setMessage((m) => (m ? `${m} ${text}` : text))} />
          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="bg-primary-500 text-white rounded-2xl px-5 py-2 font-semibold disabled:opacity-50"
          >
            {t("assistant.submit")}
          </button>
        </div>
      </form>

      {loading && (
        <div className="flex flex-col items-center gap-2">
          <Throbber />
          <p className="text-gray-600">{t("assistant.loading")}</p>
        </div>
      )}
      {error && <p className="text-red-600">{error}</p>}

      {result && !loading && (
        <>
          <section className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <h2 className="font-semibold mb-2">{t("assistant.explanation")}</h2>
            <p className="whitespace-pre-line">{result.explanation}</p>
            <p className="text-xs text-gray-500 mt-2">{t("assistant.disclaimer")}</p>
          </section>

          {result.charts?.length > 0 && (
            <section className="grid md:grid-cols-2 gap-4">
              {result.charts.map((chart, i) => (
                <ChartView key={i} title={chart.title} spec={chart.spec} />
              ))}
            </section>
          )}

          {result.table && (
            <section className="overflow-x-auto bg-white rounded-2xl shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-primary-100">
                  <tr>
                    {result.table.columns.map((c) => (
                      <th key={c} className="text-left px-3 py-2 whitespace-nowrap">{t(`assistant.col.${c}`) === `assistant.col.${c}` ? c : t(`assistant.col.${c}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.table.rows.map((row, i) => (
                    <tr key={i} className="border-t">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2">{formatCell(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="grid md:grid-cols-3 gap-4">
            {result.products?.map((p) => (
              <article key={p.product_id} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-2">
                {p.image_url && <img src={p.image_url} alt={p.name} className="h-32 object-contain" />}
                <Link to={`/product/${p.product_id}`} className="font-semibold hover:underline">{p.name}</Link>
                <p>{formatNumber(p.price_vnd)} ₫ · {p.platform}</p>
                {p.is_green && (
                  <span className="self-start bg-green-600 text-white text-xs rounded-full px-2 py-0.5">
                    {t("assistant.green")} · {p.green_score}/100
                  </span>
                )}
                <p className="text-sm">
                  {t("assistant.saved", {
                    six: formatNumber(p.co2_saved_6m_kg ?? 0),
                    twelve: formatNumber(p.co2_saved_12m_kg ?? 0),
                  })}
                </p>
                {p.reason && <p className="text-sm text-gray-700">{p.reason}</p>}
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
