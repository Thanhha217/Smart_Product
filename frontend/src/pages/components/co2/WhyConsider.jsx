// "Vì sao đáng cân nhắc?" — a short, specific reason to consider one product, from the
// figures the catalogue already holds (POST /api/explain, topic "insight").
//
// It never invents a saving: the comparison is against the median of the product's own
// category, and when there is no category data it says so instead of praising the product.
// Without an AI key the text is written from the same data by the backend's rules and is
// labelled as such — it is never passed off as an AI answer.
import { useEffect, useRef, useState } from "react";
import { api } from "../../../api/client";
import { tri, useI18n } from "../../../i18n/LanguageContext";

export default function WhyConsider({ productId, need = null, compact = false, className = "", title }) {
  const { lang } = useI18n();
  const L3 = tri(lang);
  const [state, setState] = useState({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  // while the answer in a new language loads, keep the card's height: nothing below jumps
  const box = useRef(null);
  const [holdH, setHoldH] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!productId) return undefined;
    setHoldH(box.current ? box.current.offsetHeight : null);
    setState({ status: "loading" });
    api.explain({ product_id: productId, topic: "insight", lang, question: need || null })
      .then((r) => alive && setState({ status: r?.answer ? "ok" : "empty", r }))
      .catch(() => alive && setState({ status: "error" }))
      .finally(() => alive && setHoldH(null));
    return () => { alive = false; };
  }, [productId, lang, need, nonce]);

  if (!productId) return null;
  const r = state.r;
  const byRules = r?.model === "rule-based" || r?.model === "rule-based (mock)";

  return (
    <section aria-live="polite" ref={box} style={holdH ? { minHeight: holdH } : undefined}
             className={`rounded-2xl border border-[#CFE6D5] bg-gradient-to-br from-[#F3F8F1] to-[#E9F3EC] ${compact ? "p-3" : "p-4"} ${className}`}>
      <p className="text-[12.5px] font-bold uppercase tracking-wider text-[#2E7D4F]">
        ✨ {title || L3("Vì sao đáng cân nhắc?", "Why it is worth considering", "Pourquoi le considérer")}
        {r?.model && (
          <span className="ml-1.5 font-medium normal-case tracking-normal text-[#6B7468]">
            · {byRules ? L3("soạn từ dữ liệu, chưa bật AI", "written from the data, no AI key set", "rédigé d'après les données, sans clé IA") : r.model}
          </span>
        )}
      </p>

      {state.status === "loading" && (
        <div className="mt-2 space-y-1.5" aria-label={L3("Đang xem dữ liệu", "Reading the data", "Lecture des données")}>
          <div className="h-3 rounded bg-white/80 animate-pulse" />
          <div className="h-3 w-4/5 rounded bg-white/80 animate-pulse" />
        </div>
      )}

      {state.status === "error" && (
        <p className="mt-1 text-[14.5px] text-[#55604F]">
          {L3("Chưa lấy được nhận định.", "The reason could not be loaded.", "Impossible de charger l'explication.")}{" "}
          <button type="button" className="underline text-[#1E5A96]" onClick={() => setNonce((n) => n + 1)}>
            {L3("Thử lại", "Try again", "Réessayer")}
          </button>
        </p>
      )}

      {state.status === "ok" && (
        <>
          {r.title && <p className="mt-1 text-[15.5px] font-bold text-[#1E2B22]">{r.title}</p>}
          <p className="mt-0.5 text-[15px] leading-relaxed text-[#1f2937]">{r.answer}</p>
          {r.bullets?.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {r.bullets.slice(0, compact ? 2 : 3).map((b, i) => (
                <li key={i} className="flex gap-1.5 text-[14px] text-[#374151]">
                  <span className="text-[#2E7D4F]" aria-hidden="true">✓</span><span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
