// The journey of one product: materials and manufacturing, transport, use, end of life.
//
// Honesty rule: the catalogue stores ONE total per product, not a measured split. When the
// backend says `basis: "typical_share"` the shares are what a product of this category
// typically looks like, so this component shows them as an illustration of the category and
// never prints "this product emitted X kg at the factory". Only `basis: "formula"` — where
// the stages really were computed for this product — gets per-stage kilograms.
import { useState } from "react";
import { tri, useI18n } from "../../../i18n/LanguageContext";
import { lifecycle as readLifecycle, stagePct } from "../../../lib/co2Formula";
import { STAGE_COLOR, STAGE_ICON, stageShareLine, stageText } from "../../../lib/lifecycleText";
import { formatKg, formatNum } from "../../../lib/format";
import DeviceIcon from "../ui/DeviceIcon";

export default function LifecycleJourney({ lifecycle, className = "", compact = false }) {
  const { lang } = useI18n();
  const L3 = tri(lang);
  const lc = readLifecycle(lifecycle);
  const [openKey, setOpenKey] = useState(null);

  if (lc.basis === "none" || !lc.parts.length) {
    return (
      <section className={`rounded-3xl bg-white border border-[#EFEBDF] p-5 ${className}`}>
        <h2 className="text-[19px] font-bold text-[#1E2B22]">
          {L3("Hành trình của sản phẩm", "The product's journey", "Le parcours du produit")}
        </h2>
        <p className="mt-1 text-[15.5px] text-[#55604F]">
          {L3("Chưa có số liệu từng giai đoạn cho sản phẩm này.", "No per-stage data for this product yet.",
              "Pas encore de données par étape pour ce produit.")}
        </p>
      </section>
    );
  }

  const measured = lc.measured;

  return (
    <section className={`rounded-3xl bg-white border border-[#EFEBDF] p-4 sm:p-5 ${className}`} aria-labelledby="journey-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="journey-title" className="text-[19px] font-bold text-[#1E2B22]">
            {L3("Hành trình của sản phẩm", "The product's journey", "Le parcours du produit")}
          </h2>
          <p className="text-[14.5px] text-[#6B7468]">
            {measured
              ? L3("Số của từng giai đoạn được tính riêng cho sản phẩm này.",
                   "Each stage was computed for this product.", "Chaque étape a été calculée pour ce produit.")
              : L3("Bấm từng giai đoạn để xem đó là gì và bạn làm được gì.",
                   "Tap a stage to see what it is and what you can do.", "Touchez une étape pour voir ce que c'est et ce que vous pouvez faire.")}
          </p>
        </div>
        {!measured && (
          <span className="rounded-full bg-[#FBEFD3] px-2.5 py-1 text-[12.5px] font-semibold text-[#8A5A00]">
            {L3("Minh họa vòng đời", "Lifecycle illustration", "Illustration du cycle de vie")}
          </span>
        )}
      </div>

      {!measured && (
        <p className="mt-2 rounded-xl bg-[#FBFAF5] border border-[#EFEBDF] px-3 py-2 text-[14px] leading-snug text-[#55604F]">
          {L3("Dữ liệu chỉ có một con số tổng cho sản phẩm này. Tỷ lệ dưới đây là mức điển hình của loại, dùng để hình dung đâu là khâu nặng nhất — không phải số đo của chính sản phẩm này.",
              "The catalogue holds one total for this product. The shares below are typical for its category and are here to show which stage usually weighs most — they are not measurements of this product.",
              "Le catalogue ne contient qu'un total pour ce produit. Les parts ci-dessous sont typiques de sa catégorie et montrent l'étape la plus lourde — ce ne sont pas des mesures de ce produit.")}
        </p>
      )}

      {/* the four stages, in order, each its own button */}
      <ol className={`mt-3 grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
        {lc.parts.map((part, i) => {
          const txt = stageText(part.key, lang, lc.route);
          const on = openKey === part.key;
          const pct = stagePct(part, lang);
          return (
            <li key={part.key} className={on && !compact ? "sm:col-span-2" : ""}>
              <button type="button" onClick={() => setOpenKey(on ? null : part.key)} aria-expanded={on}
                      className={`w-full text-left rounded-2xl border px-3 py-2.5 transition ${on ? "border-[#2E7D4F] bg-[#F7FBF6]" : "border-[#EFEBDF] bg-white hover:border-[#2E7D4F]"}`}>
                <span className="flex items-center gap-3">
                  <span className="grid place-items-center w-10 h-10 rounded-xl shrink-0"
                        style={{ background: `${STAGE_COLOR[part.key]}1A`, color: STAGE_COLOR[part.key] }}>
                    <DeviceIcon name={STAGE_ICON[part.key]} size={22} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15.5px] font-bold text-[#1E2B22]">
                      <span className="text-[#6B7468] font-semibold">{i + 1}. </span>{txt.name}
                    </span>
                    <span className="block text-[13.5px] text-[#6B7468]">
                      {stageShareLine(part.key, { measured, kgText: part.kg !== null ? formatKg(part.kg, lang) : null, pctText: pct }, lang)}
                    </span>
                  </span>
                  <span aria-hidden="true" className={`text-[#2E7D4F] transition-transform ${on ? "rotate-90" : ""}`}>›</span>
                </span>
              </button>
              {on && (
                <div className="mt-1.5 rounded-2xl bg-[#F7FBF6] border border-[#DCEBD9] p-3 space-y-2">
                  <p className="text-[14.5px] leading-relaxed text-[#1f2937]">
                    <b className="text-[#1F5D3A]">{L3("Là gì?", "What is it?", "Qu'est-ce que c'est ?")} </b>{txt.what}
                  </p>
                  <p className="text-[14.5px] leading-relaxed text-[#1f2937]">
                    <b className="text-[#1F5D3A]">{L3("Vì sao phát thải?", "Why does it emit?", "Pourquoi des émissions ?")} </b>{txt.why}
                  </p>
                  <p className="text-[14.5px] leading-relaxed text-[#1f2937]">
                    <b className="text-[#1F5D3A]">{L3("Bạn làm được gì?", "What can you do?", "Que pouvez-vous faire ?")} </b>{txt.todo}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* one bar: the shape of a typical product of this category */}
      <div className="mt-3">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#EFEBDF]" role="img"
             aria-label={lc.parts.map((p) => `${stageText(p.key, lang, lc.route).name} ${stagePct(p, lang)}`).join(", ")}>
          {lc.parts.map((p) => (
            <span key={p.key} style={{ width: `${p.pct}%`, background: STAGE_COLOR[p.key] }}
                  title={`${stageText(p.key, lang, lc.route).name} ${stagePct(p, lang)}`} />
          ))}
        </div>
        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-[#55604F]">
          {lc.parts.map((p) => (
            <span key={p.key} className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: STAGE_COLOR[p.key] }} />
              {stageText(p.key, lang, lc.route).name} {stagePct(p, lang)}
            </span>
          ))}
        </p>
        {lc.route && (
          <p className="mt-1 text-[13px] text-[#7d8579]">
            {L3("Chặng vận chuyển giả định: ", "Assumed shipping leg: ", "Trajet supposé : ")}
            {formatNum(lc.route.distance_km, lang, 0)} km
            {lc.route.assumed && ` · ${L3("giả định", "assumption", "hypothèse")}`}
          </p>
        )}
      </div>
    </section>
  );
}
