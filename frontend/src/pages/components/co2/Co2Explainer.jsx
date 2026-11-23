// "CO₂ này được tính như thế nào?" — one explanation, used on Overview, CO₂ method,
// the product page and the CO₂ world, so the same product always gets the same answer.
//
// Layer 1 (always visible): the result and the formula with this product's numbers.
// Layer 2 ("Xem cách tính"): source of the data -> values used -> formula and substitution -> result.
// Every number comes from GET /api/products/{id}/co2; nothing is recomputed here.
import { useState } from "react";
import { Link } from "react-router-dom";
import { tri, useI18n } from "../../../i18n/LanguageContext";
import { co2Explanation, greenEquation, toneMap } from "../../../lib/co2Formula";
import { formatKg, formatNum } from "../../../lib/format";
import DeviceIcon from "../ui/DeviceIcon";
import ProductThumb from "../common/ProductThumb";

const TONE = {
  green: "bg-[#DCEFE0] text-[#1F5D3A]",
  blue: "bg-[#DCEBFA] text-[#1E5A96]",
  amber: "bg-[#FBEFD3] text-[#8A5A00]",
  violet: "bg-[#EADDFB] text-[#5B2E96]",
  slate: "bg-[#E8ECEF] text-[#334155]",
};

/** A formula line: plain text in the body colour, variables in their own tint. */
export function Formula({ tokens, tones = {}, className = "" }) {
  if (!tokens?.length) return null;
  return (
    <p className={`font-mono text-[15px] leading-relaxed text-[#1E2B22] break-words ${className}`}>
      {tokens.map((tk, i) => (tk.v
        ? <span key={i} className={`rounded px-1 ${tk.sup ? "align-super text-[11px]" : ""} ${TONE[tones[tk.v]] || TONE.slate}`}>{tk.text}</span>
        : <span key={i}>{tk.text}</span>))}
    </p>
  );
}

function SourceBadge({ kind, t }) {
  const published = kind === "published";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[12.5px] font-medium ${published ? "bg-[#DCEFE0] text-[#1F5D3A]" : "bg-[#F1EEE4] text-[#55604F]"}`}>
      {t(published ? "common.co2Published" : "common.co2Estimated")}
    </span>
  );
}

function Step({ n, title, children, last = false }) {
  return (
    <li className="relative pl-9 pb-4 last:pb-0">
      <span className="absolute left-0 top-0 grid place-items-center w-7 h-7 rounded-full bg-[#1F5D3A] text-white text-[13px] font-bold">{n}</span>
      {!last && <span className="absolute left-[13px] top-8 bottom-0 w-px bg-[#DCEBD9]" aria-hidden="true" />}
      <p className="text-[13px] font-bold uppercase tracking-wide text-[#2E7D4F] pt-1">{title}</p>
      <div className="mt-1.5 space-y-2">{children}</div>
    </li>
  );
}

/**
 * @param co2       GET /api/products/{id}/co2 payload
 * @param example   true = this product is only an illustration (no product chosen yet)
 * @param open      start with the walk-through open
 * @param compact   hide the product header (the page already shows the product)
 */
export default function Co2Explainer({ co2, example = false, open = false, compact = false, className = "" }) {
  const { t, lang } = useI18n();
  const L3 = tri(lang);
  const [shown, setShown] = useState(open);
  const product = co2?.product;
  const ex = co2Explanation(co2, lang);

  if (!product) return null;
  if (!ex) {
    return (
      <section className={`rounded-3xl bg-white border border-[#EFEBDF] p-5 ${className}`}>
        <h2 className="text-[19px] font-bold text-[#1E2B22]">{L3("Chưa đủ dữ liệu CO₂", "Not enough CO₂ data", "Pas assez de données CO₂")}</h2>
        <p className="mt-1 text-[15.5px] text-[#55604F]">
          {L3("Không có căn cứ đáng tin cho sản phẩm này, nên hệ thống để trống thay vì đoán. Số 0 cũng không được điền vào.",
              "There is no reliable basis for this product, so the system leaves the figure empty instead of guessing. It is never filled with 0.",
              "Aucune base fiable pour ce produit : le système laisse le chiffre vide au lieu de deviner. Jamais remplacé par 0.")}
        </p>
      </section>
    );
  }

  const tones = toneMap(ex.inputs);
  const green = greenEquation(co2.green_score_formula, lang);

  return (
    <section className={`rounded-3xl bg-white border border-[#EFEBDF] overflow-hidden ${className}`}>
      {!compact && (
        <header className="flex flex-wrap items-start gap-3 p-4 sm:p-5 bg-[#F7FBF6] border-b border-[#EFEBDF]">
          <ProductThumb product={product} size={56} />
          <div className="flex-1 min-w-[180px]">
            {example && (
              <span className="inline-block rounded-full bg-[#FBEFD3] px-2 py-0.5 text-[12.5px] font-semibold text-[#8A5A00]">
                {L3("Ví dụ minh họa", "Worked example", "Exemple illustré")}
              </span>
            )}
            <Link to={`/product/${product.product_id}`} className="block text-[17px] font-bold leading-snug text-[#1E2B22] hover:underline line-clamp-2">
              {product.name}
            </Link>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-[#55604F]">
              <SourceBadge kind={ex.kind} t={t} />
              <span>{ex.title}</span>
              <span>· {t(`common.scope.${ex.scopeKey}`)}</span>
            </p>
          </div>
          <p className="text-right">
            <b className="block text-[26px] leading-none font-extrabold text-[#1F5D3A]">{formatKg(ex.resultKg, lang)}</b>
            <span className="text-[13.5px] text-[#55604F]">kg CO₂e</span>
          </p>
        </header>
      )}

      <div className="p-4 sm:p-5">
        {/* layer 1: the formula with this product's numbers, never hidden behind a button */}
        <div className="rounded-2xl bg-[#F7FBF6] border border-[#DCEBD9] px-4 py-3">
          <Formula tokens={ex.symbolic} tones={tones} className="text-[#55604F]" />
          {ex.filled && <Formula tokens={ex.filled} tones={tones} />}
          <p className="font-mono text-[15px] text-[#1F5D3A] font-bold">= {formatKg(ex.resultKg, lang)} kg CO₂e</p>
        </div>

        <button type="button" onClick={() => setShown(!shown)} aria-expanded={shown}
                className="mt-3 inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#1F5D3A] hover:underline">
          {shown ? L3("Thu gọn", "Hide the steps", "Masquer les étapes") : L3("Xem cách tính", "See how it is calculated", "Voir le calcul")}
          <span aria-hidden="true" className={`transition-transform ${shown ? "rotate-180" : ""}`}>▾</span>
        </button>

        {shown && (
          <ol className="mt-4">
            <Step n={1} title={L3("Nguồn dữ liệu", "Where the data comes from", "D'où viennent les données")}>
              <p className="text-[15.5px] leading-relaxed text-[#374151]">{ex.why}</p>
              {ex.sources.length > 0 && (
                <ul className="space-y-1">
                  {ex.sources.slice(0, 5).map((s, i) => (
                    <li key={i} className="text-[14.5px] text-[#374151] flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">{s.name}</span>
                      {s.kg !== null && s.kg !== undefined && <span className="text-[#1F5D3A] font-semibold">{formatKg(s.kg, lang)} kg</span>}
                      {s.cosine !== null && s.cosine !== undefined && s.cosine < 1 && (
                        <span className="text-[#6B7468]">{L3("giống", "similarity", "similarité")} {formatNum(s.cosine, lang, 2)}</span>
                      )}
                      {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="text-[#1E5A96] underline">{L3("báo cáo", "report", "rapport")}</a>}
                    </li>
                  ))}
                </ul>
              )}
            </Step>

            <Step n={2} title={L3("Các giá trị được dùng", "The values used", "Les valeurs utilisées")}>
              <dl className="grid gap-2 sm:grid-cols-2">
                {ex.inputs.map((input) => (
                  <div key={input.key} className="rounded-xl border border-[#EFEBDF] bg-[#FBFAF5] px-3 py-2">
                    <dt className={`inline-block rounded px-1.5 py-0.5 text-[13px] font-semibold ${TONE[tones[input.key]] || TONE.slate}`}>{input.label}</dt>
                    <dd className="mt-1 text-[16px] font-bold text-[#1E2B22]">
                      {input.value}{input.unit && <span className="ml-1 text-[13.5px] font-medium text-[#6B7468]">{input.unit}</span>}
                    </dd>
                    {input.note && <dd className="text-[13.5px] leading-snug text-[#6B7468]">{input.note}</dd>}
                  </div>
                ))}
              </dl>
            </Step>

            <Step n={3} title={L3("Công thức và phép thay số", "The formula, with the numbers put in", "La formule et la substitution")}>
              <div className="rounded-xl border border-[#EFEBDF] bg-[#FBFAF5] px-3 py-2">
                <Formula tokens={ex.symbolic} tones={tones} className="text-[#55604F]" />
                {ex.filled
                  ? <Formula tokens={ex.filled} tones={tones} />
                  : <p className="text-[14px] text-[#6B7468]">{L3("Không có phép tính: con số được dùng nguyên như hãng công bố.",
                                                                 "No arithmetic: the published figure is used as it is.",
                                                                 "Aucun calcul : le chiffre publié est repris tel quel.")}</p>}
                <p className="font-mono text-[15px] font-bold text-[#1F5D3A]">= {formatKg(ex.resultKg, lang)} kg CO₂e</p>
              </div>
            </Step>

            <Step n={4} last title={L3("Kết quả và giới hạn", "The result and its limits", "Le résultat et ses limites")}>
              <p className="text-[15.5px] leading-relaxed text-[#374151]">
                <b>{formatKg(ex.resultKg, lang)} kg CO₂e</b> · {t(`common.scope.${ex.scopeKey}`)} ·{" "}
                {ex.kind === "published"
                  ? L3("số do hãng công bố.", "published by the manufacturer.", "publié par le fabricant.")
                  : L3("là số ước tính, không phải số đo.", "an estimate, not a measurement.", "une estimation, pas une mesure.")}
              </p>
              <p className="text-[14.5px] leading-relaxed text-[#6B7468]">{ex.limits}</p>
              {green && (
                <div className="rounded-xl border border-[#EFEBDF] bg-[#FBFAF5] px-3 py-2">
                  <p className="text-[13px] font-bold uppercase tracking-wide text-[#2E7D4F]">
                    {L3("Điểm xanh trong cùng loại", "Green score within the category", "Score vert dans la catégorie")}
                  </p>
                  <Formula tokens={green.symbolic} tones={{ u: "slate", l: "slate" }} className="text-[#55604F]" />
                  <Formula tokens={green.filled} tones={{ u: "slate", l: "slate" }} />
                  <p className="font-mono text-[15px] font-bold text-[#1F5D3A]">= {formatNum(green.score, lang, 1)}/5</p>
                  <p className="mt-1 text-[13.5px] text-[#6B7468]">
                    {L3(`L và U (${formatNum(green.low, lang, 0)}–${formatNum(green.high, lang, 0)} kg) là khoảng hợp lý của loại này. Điểm chỉ so trong cùng loại, không so giữa các loại khác nhau.`,
                        `L and U (${formatNum(green.low, lang, 0)}–${formatNum(green.high, lang, 0)} kg) are the plausible range of this category. The score compares within one category only, never across categories.`,
                        `L et U (${formatNum(green.low, lang, 0)}–${formatNum(green.high, lang, 0)} kg) sont la plage plausible de cette catégorie. Le score compare au sein d'une seule catégorie.`)}
                  </p>
                </div>
              )}
              <p className="flex flex-wrap gap-3 pt-1">
                <Link to={`/world/${product.product_id}`} className="text-[15px] font-semibold text-[#1F5D3A] hover:underline">
                  {L3("Xem hành trình sản phẩm", "See the product's journey", "Voir le parcours du produit")} →
                </Link>
                <Link to="/method" className="text-[15px] font-semibold text-[#1F5D3A] hover:underline">
                  {L3("Các cách tính khác", "The other methods", "Les autres méthodes")} →
                </Link>
              </p>
            </Step>
          </ol>
        )}
      </div>
    </section>
  );
}

/** Small inline version for lists: formula on one line, no steps. */
export function Co2FormulaLine({ co2, className = "" }) {
  const { lang } = useI18n();
  const ex = co2Explanation(co2, lang);
  if (!ex) return null;
  const tones = toneMap(ex.inputs);
  return (
    <div className={className}>
      <Formula tokens={ex.symbolic} tones={tones} className="text-[#55604F]" />
      {ex.filled && <Formula tokens={ex.filled} tones={tones} />}
      <p className="font-mono text-[15px] font-bold text-[#1F5D3A]">= {formatKg(ex.resultKg, lang)} kg CO₂e</p>
    </div>
  );
}

export { DeviceIcon };
