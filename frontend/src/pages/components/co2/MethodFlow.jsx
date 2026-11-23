// The CO₂ method as a decision diagram: three questions asked in order, each "yes" leading to
// a way of getting the figure, all of them flowing into one result. The path the chosen product
// actually took is lit; the branches it did not take stay visible but quiet, so a visitor sees
// both the whole method and where this product landed in it.
import { useId } from "react";
import { tri, useI18n } from "../../../i18n/LanguageContext";
import { co2Explanation, greenEquation, toneMap } from "../../../lib/co2Formula";
import { formatKg, formatNum, greenColor } from "../../../lib/format";
import { Formula } from "./Co2Explainer";
import ProductThumb from "../common/ProductThumb";
import DeviceIcon from "../ui/DeviceIcon";

const ORDER = ["manufacturer", "neighbor_average", "category_model"];
const ACTIVE_OF = { manufacturer: 0, neighbor_average: 1, llm_estimate: 1, category_model: 2, lifecycle_formula: 2, eeio_price: 2 };

const CSS = `
@keyframes mf-flow { to { background-position: 28px 0; } }
@keyframes mf-flow-v { to { background-position: 0 28px; } }
@keyframes mf-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(46,125,79,.35); } 50% { box-shadow: 0 0 0 10px rgba(46,125,79,0); } }
.mf-h-on { background-image: repeating-linear-gradient(90deg,#2E7D4F 0 10px,transparent 10px 14px); background-size: 28px 3px; animation: mf-flow 1s linear infinite; }
.mf-v-on { background-image: repeating-linear-gradient(180deg,#2E7D4F 0 10px,transparent 10px 14px); background-size: 3px 28px; animation: mf-flow-v 1s linear infinite; }
.mf-off-h { background: #DCD7C9; }
.mf-off-v { background: #DCD7C9; }
.mf-pulse { animation: mf-pulse 2.2s ease-in-out infinite; }
@keyframes mf-dash { to { stroke-dashoffset: -18; } }
.mf-dash { stroke-dasharray: 9 9; animation: mf-dash .9s linear infinite; }
@media (prefers-reduced-motion: reduce) { .mf-h-on, .mf-v-on, .mf-pulse, .mf-dash { animation: none; } }
`;

function texts(lang) {
  const L3 = tri(lang);
  return {
    start: L3("Sản phẩm", "The product", "Le produit"),
    yes: L3("Có", "Yes", "Oui"),
    no: L3("Không", "No", "Non"),
    questions: [
      L3("Hãng đã công bố CO₂ cho đúng mẫu này?", "Did the maker publish CO₂ for this exact model?", "Le fabricant a-t-il publié le CO₂ de ce modèle exact ?"),
      L3("Có sản phẩm đủ giống (độ giống ≥ 0,66) đã có số của hãng?", "Are there close enough products (similarity ≥ 0.66) with a published figure?",
         "Existe-t-il des produits assez proches (similarité ≥ 0,66) avec un chiffre publié ?"),
      L3("Loại sản phẩm này có mức giữa đo từ dữ liệu?", "Does this category have a median measured from the data?",
         "Cette catégorie a-t-elle une médiane mesurée sur les données ?"),
    ],
    methods: [
      { name: L3("Số của hãng", "Manufacturer figure", "Chiffre du fabricant"), formula: L3("CO₂ = số hãng công bố", "CO₂ = published figure", "CO₂ = chiffre publié"),
        icon: "energy_label", conf: 0.9, kind: L3("công bố", "published", "publié") },
      { name: L3("Trung bình mẫu giống", "Average of similar products", "Moyenne de produits proches"), formula: "CO₂ = (CO₂₁ + … + CO₂ₙ) ÷ n",
        icon: "compare", conf: 0.5, kind: L3("ước tính", "estimate", "estimation") },
      { name: L3("Mức giữa của loại", "Category level", "Niveau de la catégorie"), formula: L3("CO₂ = M × (s ÷ s₀)ᵇ, hoặc = M", "CO₂ = M × (s ÷ s₀)ᵇ, or = M", "CO₂ = M × (s ÷ s₀)ᵇ, ou = M"),
        icon: "low_co2", conf: 0.35, kind: L3("ước tính", "estimate", "estimation") },
    ],
    none: L3("Để trống", "Left empty", "Laissé vide"),
    noneSub: L3("Không đoán, không bao giờ ghi 0", "Never guessed, never written as 0", "Jamais deviné, jamais remplacé par 0"),
    conf: L3("tin cậy", "confidence", "fiabilité"),
    here: L3("Sản phẩm này đi đường này", "This product took this path", "Ce produit a suivi ce chemin"),
    enter: L3("Bấm để bước vào", "Tap to step inside", "Touchez pour entrer"),
    hint: L3("Bấm vào bất kỳ ô nào để bước vào bên trong. Trong cảnh: ‹ › hoặc vuốt để nhảy qua lại, Esc để quay về sơ đồ.",
             "Tap any box to step inside. Inside: ‹ › or swipe to jump between scenes, Esc to come back to the diagram.",
             "Touchez une case pour entrer. À l'intérieur : ‹ › ou glisser pour passer d'une scène à l'autre, Échap pour revenir."),
    stagesTitle: L3("Bước vào từng chặng", "Step into each stage", "Entrer dans chaque étape"),
    stageNames: {
      materials: L3("Nguyên liệu", "Materials", "Matières"), production: L3("Sản xuất", "Production", "Fabrication"),
      transport: L3("Vận chuyển", "Transport", "Transport"), use: L3("Sử dụng", "Use", "Usage"),
      end_of_life: L3("Thải bỏ", "End of life", "Fin de vie"),
    },
    result: L3("Kết quả", "Result", "Résultat"),
    score: L3("Điểm xanh trong loại", "Green score in its category", "Score vert dans sa catégorie"),
    journey: L3("Chia theo vòng đời", "Spread over the lifecycle", "Réparti sur le cycle de vie"),
    journeySub: L3("tỷ lệ điển hình của loại", "typical shares of the category", "parts typiques de la catégorie"),
  };
}

/** A node of the diagram. With an explorer around it, it is a door: the scene grows out of it. */
function Hit({ to, onEnter, title, className = "", children }) {
  if (!onEnter) return <div className={className}>{children}</div>;
  return (
    <button type="button" title={title} onClick={(e) => onEnter(to, e.currentTarget.getBoundingClientRect())}
            className={`block w-full text-left rounded-2xl transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E7D4F]/30 ${className}`}>
      {children}
    </button>
  );
}

/** One question: a diamond badge and the question, lit when the product passed through it. */
function Question({ text, state, index }) {
  const on = state !== "off";
  return (
    <div className={`relative flex items-center gap-3 rounded-2xl border-2 px-3 py-3 bg-white transition ${
      state === "yes" ? "border-[#2E7D4F] shadow-md" : state === "no" ? "border-[#9CCF7D]" : "border-[#EFEBDF] opacity-60"}`}>
      <span className={`grid place-items-center w-9 h-9 shrink-0 rotate-45 rounded-lg ${on ? "bg-[#1F5D3A]" : "bg-[#D9D3C2]"}`}>
        <span className="-rotate-45 text-[14px] font-extrabold text-white">{index + 1}</span>
      </span>
      <p className={`text-[15px] leading-snug font-semibold ${on ? "text-[#1E2B22]" : "text-[#6B7468]"}`}>{text}</p>
    </div>
  );
}

function MethodCard({ m, active, dim, ex, tones, lang, T }) {
  return (
    <div className={`relative rounded-2xl border-2 p-3 transition ${active ? "border-[#2E7D4F] bg-[#F3F8F1] mf-pulse" : "border-[#EFEBDF] bg-white"} ${dim ? "opacity-55" : ""}`}>
      <div className="flex items-start gap-2.5">
        <span className={`grid place-items-center w-9 h-9 rounded-xl shrink-0 ${active ? "bg-[#1F5D3A] text-white" : "bg-[#F1EEE4] text-[#55604F]"}`}>
          <DeviceIcon name={m.icon} size={20} tint={false} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[15.5px] font-bold ${active ? "text-[#1F5D3A]" : "text-[#1E2B22]"}`}>{m.name}</p>
          <p className="text-[12.5px] text-[#6B7468]">{m.kind} · {T.conf} {formatNum(m.conf, lang, 2)}</p>
        </div>
      </div>
      {active && ex ? (
        <div className="mt-2 rounded-xl bg-white border border-[#DCEBD9] px-2.5 py-1.5">
          <Formula tokens={ex.symbolic} tones={tones} className="!text-[13.5px] text-[#55604F]" />
          {ex.filled && <Formula tokens={ex.filled} tones={tones} className="!text-[13.5px]" />}
        </div>
      ) : (
        <p className="mt-2 font-mono text-[13px] text-[#6B7468]">{m.formula}</p>
      )}
      {active && <p className="mt-1.5 text-[12.5px] font-semibold text-[#1F5D3A]">✓ {T.here}</p>}
    </div>
  );
}

const ON = "#2E7D4F";
const OFF = "#D6D0C0";

/** One straight arrow, horizontal or vertical, with a proper arrowhead at its tip. */
function Arrow({ on, vertical = false, length = "100%", className = "" }) {
  const id = `mf-head-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const color = on ? ON : OFF;
  const box = vertical ? { width: 14, height: "100%" } : { width: length, height: 14 };
  return (
    <svg className={className} style={box} aria-hidden="true" overflow="visible">
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" fill={color} />
        </marker>
      </defs>
      {vertical
        ? <line x1="7" y1="0" x2="7" y2="100%" stroke={color} strokeWidth="2.5" strokeLinecap="round"
                className={on ? "mf-dash" : ""} markerEnd={`url(#${id})`} />
        : <line x1="0" y1="7" x2="100%" y2="7" stroke={color} strokeWidth="2.5" strokeLinecap="round"
                className={on ? "mf-dash" : ""} markerEnd={`url(#${id})`} />}
    </svg>
  );
}

/** "Có →" between a question and its method (wide screens). */
function YesArrow({ on, label }) {
  return (
    <div className="hidden lg:flex flex-col items-stretch justify-center px-2" aria-hidden="true">
      <span className={`text-center text-[12px] font-bold ${on ? "text-[#1F5D3A]" : "text-[#B8B2A2]"}`}>{label}</span>
      <Arrow on={on} />
    </div>
  );
}

/** "Không ↓" under a question. */
function NoArrow({ on, label }) {
  return (
    <div className="flex items-stretch gap-2 pl-[19px] h-10" aria-hidden="true">
      <Arrow on={on} vertical />
      {label && <span className={`self-center text-[12px] font-bold ${on ? "text-[#4E9A5C]" : "text-[#B8B2A2]"}`}>{label}</span>}
    </div>
  );
}

const STAGE_SCENES = [["materials", "battery"], ["production", "pc_component"], ["transport", "e_bike"], ["use", "smart_plug"], ["end_of_life", "recycle"]];

export default function MethodFlow({ co2, onSeeCalc, links, onEnter }) {
  const { lang, t } = useI18n();
  const T = texts(lang);
  const product = co2?.product;
  const ex = co2Explanation(co2, lang);
  const tones = ex ? toneMap(ex.inputs) : {};
  const green = greenEquation(co2?.green_score_formula, lang);
  const method = co2?.formula?.method;
  const hasFigure = product && product.co2e_kg !== null && product.co2e_kg !== undefined;
  const active = hasFigure ? (ACTIVE_OF[method] ?? 3) : 3;   // 3 = left empty

  const qState = (i) => (i < active ? "no" : i === active ? "yes" : "off");

  return (
    <section aria-label={T.questions[0]} className="rounded-3xl border border-[#DCEBD9] bg-gradient-to-br from-[#F7FBF6] via-white to-[#FBFAF5] p-4 sm:p-6 overflow-hidden">
      <style>{CSS}</style>

      {/* start: the product being followed */}
      {product && (
        <div className="flex items-center gap-3 rounded-2xl bg-white border border-[#EFEBDF] px-3 py-2.5 w-fit max-w-full shadow-sm">
          <ProductThumb product={product} size={44} standIn={false} />
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#2E7D4F]">{T.start}</p>
            <p className="text-[15.5px] font-bold text-[#1E2B22] line-clamp-1">{product.name}</p>
          </div>
        </div>
      )}
      {onEnter && <p className="mt-2 text-[14px] font-semibold text-[#C2620B]">👆 {T.hint}</p>}
      <NoArrow on label="" />

      <div className="grid gap-x-3 lg:grid-cols-[minmax(0,1.05fr)_90px_minmax(0,1fr)_minmax(0,0.95fr)]">
        {/* left: questions and methods, row by row */}
        <div className="lg:col-span-3 flex flex-col">
          {ORDER.map((key, i) => (
            <div key={key}>
              <div className="grid gap-2 lg:grid-cols-[minmax(0,1.05fr)_90px_minmax(0,1fr)] items-center">
                <Hit to="formula" onEnter={onEnter} title={T.enter}><Question text={T.questions[i]} state={qState(i)} index={i} /></Hit>
                <YesArrow on={i === active} label={T.yes} />
                <div className="lg:pl-0 pl-8 relative">
                  <span className={`lg:hidden block text-[12px] font-bold mb-1 ${i === active ? "text-[#1F5D3A]" : "text-[#B8B2A2]"}`}>{T.yes} →</span>
                  <Hit to="formula" onEnter={onEnter} title={T.enter}>
                    <MethodCard m={T.methods[i]} active={i === active} dim={i > active} ex={i === active ? ex : null} tones={tones} lang={lang} T={T} />
                  </Hit>
                  <span className="hidden lg:block absolute top-1/2 -translate-y-1/2 -right-[27px] w-[24px]">
                    <Arrow on={i === active} length={24} />
                  </span>
                </div>
              </div>
              <NoArrow on={i < active} label={T.no} />
            </div>
          ))}
          <div className={`flex items-center gap-3 rounded-2xl border-2 border-dashed px-3 py-3 w-full lg:w-[52%] ${active === 3 ? "border-[#C2413C] bg-[#FBE4E2]" : "border-[#E2DDCF] opacity-60"}`}>
            <span className="grid place-items-center w-9 h-9 rounded-full bg-white text-[18px] font-bold text-[#9B2F2A]">∅</span>
            <div>
              <p className="text-[15.5px] font-bold text-[#1E2B22]">{T.none}</p>
              <p className="text-[13px] text-[#6B7468]">{T.noneSub}</p>
            </div>
          </div>
        </div>

        {/* right: everything flows into one result */}
        <div className="mt-5 lg:mt-0 lg:pl-3 lg:border-l-[3px] lg:border-dashed lg:border-[#CFE6D5] flex flex-col gap-3 justify-center">
          <div className="rounded-3xl bg-[#1F5D3A] text-white p-4 shadow-lg">
            <p className="text-[12.5px] font-bold uppercase tracking-wider text-[#BFE3C9]">{T.result}</p>
            {hasFigure ? (
              <>
                <p className="mt-1 text-[40px] leading-none font-extrabold">{formatKg(product.co2e_kg, lang)}</p>
                <p className="text-[15px] text-[#D7EEDD]">kg CO₂e · {t(`common.scope.${ex?.scopeKey || "cradle_to_grave"}`)}</p>
                {ex && <p className="mt-1 inline-block rounded-full bg-white/15 px-2 py-0.5 text-[12.5px]">
                  {t(ex.kind === "published" ? "common.co2Published" : "common.co2Estimated")}</p>}
              </>
            ) : <p className="mt-1 text-[22px] font-bold">{T.none}</p>}
            {onSeeCalc && hasFigure && (
              <button type="button" onClick={onSeeCalc} className="mt-3 w-full rounded-full bg-white text-[#1F5D3A] px-3 py-2 text-[14.5px] font-bold hover:bg-[#E4F1E6]">
                {tri(lang)("Xem phép tính đầy đủ ↓", "See the full calculation ↓", "Voir le calcul complet ↓")}
              </button>
            )}
          </div>

          {green && (
            <Hit to="category" onEnter={onEnter} title={T.enter}>
            <div className="rounded-2xl bg-white border border-[#EFEBDF] p-3">
              <p className="text-[12.5px] font-bold uppercase tracking-wider text-[#2E7D4F]">{T.score}</p>
              <p className="mt-0.5 flex items-baseline gap-2">
                <span className="text-[26px] font-extrabold" style={{ color: greenColor(green.score) }}>{formatNum(green.score, lang, 1)}</span>
                <span className="text-[14px] text-[#6B7468]">/ 5</span>
              </p>
              <Formula tokens={green.symbolic} tones={{ u: "slate", l: "slate" }} className="!text-[12.5px] text-[#55604F]" />
            </div>
            </Hit>
          )}

          {onEnter && (
            <div className="rounded-2xl bg-white border border-[#EFEBDF] p-3">
              <p className="text-[12.5px] font-bold uppercase tracking-wider text-[#2E7D4F]">{T.stagesTitle}</p>
              <div className="mt-2 grid grid-cols-5 gap-1.5">
                {STAGE_SCENES.map(([key, icon]) => (
                  <button key={key} type="button" title={T.stageNames[key]}
                          onClick={(e) => onEnter(key, e.currentTarget.getBoundingClientRect())}
                          className="flex flex-col items-center gap-1 rounded-xl bg-[#F3F8F1] border border-[#DCEBD9] px-1 py-2 text-[11.5px] font-semibold text-[#1F5D3A] hover:bg-[#E4F1E6] hover:-translate-y-0.5 transition">
                    <DeviceIcon name={icon} size={22} />
                    <span className="leading-tight text-center">{T.stageNames[key]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {links}
        </div>
      </div>
    </section>
  );
}
