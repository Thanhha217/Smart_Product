// The CO₂ method as a ladder (design page 5): four sources, tried in order. The rung the product
// stopped on is open, with its formula typeset and filled with the product's own numbers; the
// rungs above say "No", the rungs below say "Not needed". The right column holds the result, the
// green score, the doors into each lifecycle scene, and the book and world for this product.
import { Link } from "react-router-dom";
import { tri, useI18n } from "../../../i18n/LanguageContext";
import { co2Explanation } from "../../../lib/co2Formula";
import { formatKg, formatNum } from "../../../lib/format";
import DeviceIcon from "../ui/DeviceIcon";
import { CO2, Frac, Pill, V } from "./MathBits";

const ACTIVE_OF = { manufacturer: 0, neighbor_average: 1, llm_estimate: 1, category_model: 2, lifecycle_formula: 2, eeio_price: 2 };
const STAGES = [["materials", "battery"], ["production", "pc_component"], ["transport", "e_bike"], ["use", "smart_plug"], ["end_of_life", "recycle"]];
const isNum = (x) => typeof x === "number" && Number.isFinite(x);

function texts(lang) {
  const L3 = tri(lang);
  return {
    q: [
      L3("Hãng đã công bố CO₂ cho đúng mẫu này?", "Did the maker publish CO₂ for this exact model?", "Le fabricant a-t-il publié le CO₂ de ce modèle exact ?"),
      L3("Có sản phẩm đủ giống (độ giống ≥ 0,66) đã có số của hãng?", "Are there close enough products (similarity ≥ 0.66) with a published figure?",
         "Existe-t-il des produits assez proches (similarité ≥ 0,66) avec un chiffre publié ?"),
      L3("Loại sản phẩm này có mức giữa đo từ dữ liệu?", "Does this category have a median measured from the data?",
         "Cette catégorie a-t-elle une médiane mesurée sur les données ?"),
    ],
    names: [
      L3("Số của hãng", "Manufacturer figure", "Chiffre du fabricant"),
      L3("Trung bình sản phẩm giống", "Average of similar products", "Moyenne de produits proches"),
      L3("Mức giữa của loại", "Category level", "Niveau de la catégorie"),
    ],
    conf: [0.9, 0.5, 0.35],
    yes: L3("Có", "Yes", "Oui"), no: L3("Không", "No", "Non"), notNeeded: L3("Không cần", "Not needed", "Inutile"),
    confidence: L3("Tin cậy", "Confidence", "Fiabilité"),
    estimate: L3("Ước tính", "Estimate", "Estimation"), published: L3("Hãng công bố", "Published", "Publié"),
    pubFig: L3("số hãng công bố", "published figure", "chiffre publié"),
    stop: L3("Sản phẩm này đi đường này, nên dừng ở bậc này", "This product took this path, so the ladder stops here",
             "Ce produit a suivi ce chemin : l'échelle s'arrête ici"),
    empty: L3("Không tìm được? Để trống.", "Nothing found? Left empty.", "Rien trouvé ? Laissé vide."),
    emptySub: L3("Không đoán, không bao giờ ghi 0.", "Never guessed, never written as 0.", "Jamais deviné, jamais remplacé par 0."),
    result: L3("Kết quả", "Result", "Résultat"),
    rung: (n) => L3(`Bậc ${n} / 4`, `Rung ${n} of 4`, `Échelon ${n} sur 4`),
    seeCalc: L3("Xem phép tính đầy đủ", "See the full calculation", "Voir le calcul complet"),
    score: L3("Điểm xanh trong loại", "Green score in its category", "Score vert dans sa catégorie"),
    scoreNote: L3("U, L — cận trên và cận dưới CO₂ của loại. CO₂ thấp hơn thì điểm cao hơn.",
                  "U, L — the upper and lower CO₂ bounds of the category. Lower CO₂ gives a higher score.",
                  "U, L — bornes haute et basse du CO₂ de la catégorie. Moins de CO₂ donne un meilleur score."),
    stepInto: L3("Bước vào từng chặng", "Step into each stage", "Entrer dans chaque étape"),
    stages: {
      materials: L3("Nguyên liệu", "Materials", "Matières"), production: L3("Sản xuất", "Production", "Fabrication"),
      transport: L3("Vận chuyển", "Transport", "Transport"), use: L3("Sử dụng", "Use", "Usage"), end_of_life: L3("Thải bỏ", "End of life", "Fin de vie"),
    },
    book: L3("Đọc sách CO₂ của món này", "Read its CO₂ book", "Lire son livre CO₂"),
    world: L3("Vào thế giới CO₂ của nó", "Enter its CO₂ world", "Entrer dans son monde CO₂"),
    legendRefs: (n) => L3(`n — số mẫu vượt ngưỡng 0,66 — ở đây là ${n}`, `n — how many passed the 0.66 bar — here, ${n}`, `n — combien passent le seuil 0,66 — ici ${n}`),
    legendC: L3("CO₂ của sản phẩm giống thứ i", "CO₂ of similar product i", "CO₂ du produit proche i"),
    legendM: L3("M trung vị của loại · s ÷ s₀ cỡ so với cỡ chuẩn · b mức CO₂ tăng theo cỡ",
                "M category median · s ÷ s₀ size against the category's reference · b how CO₂ grows with size",
                "M médiane · s ÷ s₀ taille par rapport à la référence · b croissance du CO₂ avec la taille"),
    or: L3("hoặc", "or", "ou"),
  };
}

function ConfBar({ value, lang, T, muted }) {
  return (
    <div className="w-[150px] shrink-0">
      <p className="text-right text-[12.5px] text-[#6B7468]">{T.confidence} <b className="text-[#1E2B22]">{formatNum(value, lang, 2)}</b></p>
      <div className="mt-1 h-2 rounded-full bg-[#E9E6DC]">
        <div className={`h-2 rounded-full ${muted ? "bg-[#A9C4B1]" : "bg-[#3F8A5A]"}`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

function Status({ kind, T }) {
  const style = kind === "yes" ? "bg-[#1F5D3A] text-white" : kind === "no" ? "bg-[#EFEDE6] text-[#55604F]" : "bg-white border border-[#DCD7C9] text-[#6B7468]";
  const label = kind === "yes" ? T.yes : kind === "no" ? T.no : T.notNeeded;
  return <span className={`shrink-0 rounded-md px-2.5 py-1 text-[13px] font-semibold ${style}`}>{label}</span>;
}

/** The numbered circle on the ladder's rail. */
function Bead({ label, state }) {
  const cls = state === "on" ? "bg-[#1B4332] text-white ring-8 ring-[#E3F0E5]"
    : state === "passed" ? "bg-white text-[#1E2B22] border-2 border-[#DCD7C9]"
      : "bg-[#FAF8F2] text-[#9a9487] border-2 border-dashed border-[#D6D0C0]";
  return <span className={`relative z-10 grid place-items-center w-14 h-14 rounded-full font-display text-[24px] ${cls}`}>{label}</span>;
}

/** The formula of the rung the product stopped on, with its own numbers. */
function ActiveFormula({ method, co2, ex, lang, T }) {
  const kg = co2.product.co2e_kg;
  const k = (x) => formatKg(x, lang);
  if (method === "manufacturer") {
    return (
      <p className="flex flex-wrap items-center gap-2 text-[24px] text-[#1E2B22]">
        <CO2 /> <span>=</span> <span className="font-display italic">{T.pubFig}</span> <span>=</span>
        <Pill dark className="text-[20px] font-display">{k(kg)} <span className="text-[13px] font-sans">kg CO₂e</span></Pill>
      </p>
    );
  }
  if (method === "neighbor_average" || method === "llm_estimate") {
    const vals = (co2.formula?.steps || []).filter((s) => isNum(s.value_kg) && s.label_en !== "Average").map((s) => s.value_kg);
    const n = vals.length;
    return (
      <>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3 text-[26px] text-[#1E2B22]">
          <CO2 /> <span>=</span>
          <Frac top={<><V s="1">c</V> + <V s="2">c</V> + … + <V s="n">c</V></>} bottom={<V>n</V>} />
          <span>=</span>
          <Frac top={<span className="inline-flex flex-wrap items-center gap-1.5 text-[18px]">
                       {vals.map((v, i) => <span key={i} className="inline-flex items-center gap-1.5">{i > 0 && <span>+</span>}<Pill>{k(v)}</Pill></span>)}
                     </span>}
                bottom={<span className="text-[20px]">{n}</span>} />
          <span>=</span>
        </div>
        <p className="mt-3"><Pill dark className="!px-3 !py-1.5 text-[24px] font-display">{k(kg)} <span className="text-[13px] font-sans">kg CO₂e</span></Pill></p>
        <p className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[14px] text-[#55604F]">
          <span><V s="i">c</V> &nbsp;{T.legendC}</span>
          <span><V>n</V> &nbsp;{T.legendRefs(n).replace(/^n — /, "")}</span>
        </p>
      </>
    );
  }
  // category level, and the appliance / price methods, read through the shared explanation
  return (
    <div className="space-y-1 text-[20px] text-[#1E2B22]">
      <p className="font-display">{(ex?.symbolic || []).map((t) => t.text).join("")}</p>
      {ex?.filled && <p className="font-display">{ex.filled.map((t) => t.text).join("")}</p>}
      <p><Pill dark className="!px-3 !py-1.5 text-[22px] font-display">{k(kg)} <span className="text-[13px] font-sans">kg CO₂e</span></Pill></p>
    </div>
  );
}

export default function MethodFlow({ co2, onSeeCalc, onEnter }) {
  const { lang, t } = useI18n();
  const T = texts(lang);
  const product = co2?.product;
  const ex = co2Explanation(co2, lang);
  const method = co2?.formula?.method;
  const hasFigure = product && isNum(product.co2e_kg);
  const active = hasFigure ? (ACTIVE_OF[method] ?? 3) : 3;
  const g = co2?.green_score_formula;
  const score = isNum(g?.score) ? g.score : isNum(product?.green_score) ? product.green_score : null;

  const state = (i) => (i === active ? "on" : i < active ? "passed" : "off");
  const status = (i) => (i === active ? "yes" : i < active ? "no" : "skip");

  const rungBody = (i) => {
    if (i === 0) {
      return (
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-[#EFEBDF] pt-3">
          <div>
            <p className="text-[15px] font-semibold text-[#1E2B22]">{T.names[0]}</p>
            <p className="text-[18px] text-[#33403A]"><CO2 /> = <span className="font-display italic">{T.pubFig}</span></p>
          </div>
          <ConfBar value={T.conf[0]} lang={lang} T={T} muted={i !== active} />
        </div>
      );
    }
    if (i === 1) {
      return (
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-[#EFEBDF] pt-3">
          <div>
            <p className="text-[15px] font-semibold text-[#1E2B22]">{T.names[1]}</p>
            <p className="text-[18px] text-[#33403A] flex items-center gap-2"><CO2 /> =
              <Frac top={<><V s="1">c</V> + … + <V s="n">c</V></>} bottom={<V>n</V>} className="text-[16px]" /></p>
          </div>
          <ConfBar value={T.conf[1]} lang={lang} T={T} muted />
        </div>
      );
    }
    return (
      <div className="mt-3 border-t border-[#EFEBDF] pt-3">
        <p className="text-[15px] font-semibold text-[#1E2B22]">{T.names[2]}</p>
        <p className="text-[18px] text-[#33403A]">
          <CO2 /> = <V>M</V> × (<V>s</V> ÷ <V s="0">s</V>)<sup className="font-display italic">b</sup>
          <span className="mx-2 text-[14px] text-[#6B7468]">{T.or}</span> <CO2 /> = <V>M</V>
        </p>
        <p className="text-[13.5px] text-[#6B7468] italic">{T.legendM}</p>
        <div className="mt-2"><ConfBar value={T.conf[2]} lang={lang} T={T} muted={i !== active} /></div>
      </div>
    );
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px] items-start">
      {/* the ladder */}
      <ol className="relative">
        <span className="absolute left-7 top-8 bottom-8 border-l-2 border-dashed border-[#D6D0C0]" aria-hidden="true" />
        {[0, 1, 2].map((i) => {
          const on = i === active;
          return (
            <li key={i} className="relative grid grid-cols-[56px_minmax(0,1fr)] gap-4 pb-5">
              <div className="pt-2"><Bead label={i + 1} state={state(i)} /></div>
              <div className={`rounded-[22px] bg-white transition ${on ? "border-2 border-[#2E7D4F] shadow-[0_14px_30px_-20px_rgba(31,93,58,.6)]" : "border border-[#E8E4D8]"} ${state(i) === "off" ? "opacity-70" : ""}`}>
                <button type="button" onClick={(e) => onEnter?.("formula", e.currentTarget.getBoundingClientRect())}
                        className="w-full text-left px-5 pt-4 pb-4 rounded-[22px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E7D4F]/25">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[17px] font-semibold leading-snug text-[#1E2B22]">{T.q[i]}</p>
                    <Status kind={status(i)} T={T} />
                  </div>
                  {!on && rungBody(i)}
                  {on && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="grid place-items-center w-12 h-12 rounded-xl bg-[#1B4332] text-white">
                          <DeviceIcon name={i === 0 ? "energy_label" : i === 1 ? "compare" : "low_co2"} size={24} tint={false} />
                        </span>
                        <div>
                          <p className="font-display text-[24px] font-semibold text-[#1E2B22] leading-tight">{T.names[i]}</p>
                          <p className="text-[14px] text-[#6B7468]">{ex?.kind === "published" ? T.published : T.estimate}</p>
                        </div>
                      </div>
                      <ConfBar value={T.conf[i]} lang={lang} T={T} />
                    </div>
                  )}
                </button>
                {on && (
                  <>
                    <div className="mx-0 border-t border-[#E3EDE4] bg-[#F7FAF5] px-5 py-5">
                      <ActiveFormula method={method} co2={co2} ex={ex} lang={lang} T={T} />
                    </div>
                    <p className="flex items-center gap-2 rounded-b-[20px] bg-[#E3F0E5] px-5 py-2.5 text-[14.5px] font-semibold text-[#1F5D3A]">
                      ✓ {T.stop}
                    </p>
                  </>
                )}
              </div>
            </li>
          );
        })}
        <li className="relative grid grid-cols-[56px_minmax(0,1fr)] gap-4">
          <div className="pt-1"><Bead label="∅" state={active === 3 ? "on" : "off"} /></div>
          <div className={`flex items-center justify-between gap-3 rounded-[22px] px-5 py-4 ${active === 3 ? "border-2 border-[#C2413C] bg-[#FBE4E2]" : "border border-[#E8E4D8] bg-[#FAF8F2]"}`}>
            <div>
              <p className="text-[17px] font-semibold text-[#55604F]">{T.empty}</p>
              <p className="text-[14px] text-[#7d8579]">{T.emptySub}</p>
            </div>
            <Status kind={active === 3 ? "yes" : "skip"} T={T} />
          </div>
        </li>
      </ol>

      {/* right column */}
      <aside className="flex flex-col gap-4">
        <div className="relative overflow-hidden rounded-[24px] bg-[#1B4332] p-5 text-white">
          <p className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-[#BFD8C6]">{T.result}</p>
          {hasFigure ? (
            <>
              <p className="mt-1 font-display text-[64px] leading-none font-semibold">{formatKg(product.co2e_kg, lang)}</p>
              <p className="mt-1 text-[15px] text-[#D7EBDD]"><b className="text-white">kg CO₂e</b> · {t(`common.scope.${ex?.scopeKey || "cradle_to_grave"}`)}</p>
              <p className="mt-3 flex flex-wrap gap-2 text-[13px]">
                <span className="rounded-md bg-white/15 px-2 py-0.5 first-letter:uppercase">{t(ex?.kind === "published" ? "common.co2Published" : "common.co2Estimated")}</span>
                <span className="rounded-md bg-white/15 px-2 py-0.5">{T.rung(active + 1)}</span>
              </p>
            </>
          ) : <p className="mt-2 font-display text-[28px]">{T.empty}</p>}
          {hasFigure && onSeeCalc && (
            <button type="button" onClick={onSeeCalc}
                    className="relative z-10 mt-4 w-full rounded-full bg-white px-4 py-2.5 text-[15px] font-semibold text-[#1B4332] hover:bg-[#E3F0E5]">
              {T.seeCalc} ↓
            </button>
          )}
          <svg className="pointer-events-none absolute -right-10 -bottom-12 w-44 h-44 opacity-15" viewBox="0 0 200 200" aria-hidden="true">
            <path d="M20 180 C 60 120, 140 160, 120 90 S 60 20, 180 30" fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" />
          </svg>
        </div>

        {score !== null && (
          <button type="button" onClick={(e) => onEnter?.("category", e.currentTarget.getBoundingClientRect())}
                  className="text-left rounded-[22px] bg-white border border-[#E8E4D8] p-5 hover:border-[#2E7D4F] transition">
            <p className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-[#55604F]">{T.score}</p>
            <div className="mt-1 flex items-center gap-3">
              <p className="font-display text-[40px] leading-none text-[#1F5D3A]">{formatNum(score, lang, 1)}<span className="text-[20px] text-[#6B7468]"> / 5</span></p>
              <div className="flex flex-1 gap-1">
                {[1, 2, 3, 4, 5].map((s) => <span key={s} className={`h-2 flex-1 rounded-full ${s <= Math.round(score) ? "bg-[#2E7D4F]" : "bg-[#E9E6DC]"}`} />)}
              </div>
            </div>
            <p className="mt-3 rounded-xl bg-[#F6F4EE] px-3 py-2.5 text-[17px] text-[#1E2B22] flex items-center gap-2">
              <span className="font-display">score</span> = 5 ×
              <Frac top={<span className="font-display">ln(<V>U</V> ÷ <CO2 />)</span>} bottom={<span className="font-display">ln(<V>U</V> ÷ <V>L</V>)</span>} className="text-[15px]" />
            </p>
            <p className="mt-2 text-[13.5px] text-[#6B7468]">{T.scoreNote}</p>
          </button>
        )}

        {onEnter && (
          <div className="rounded-[22px] bg-white border border-[#E8E4D8] p-4">
            <p className="px-1 text-[12.5px] font-bold uppercase tracking-[0.14em] text-[#55604F]">{T.stepInto}</p>
            <ul className="mt-2">
              {STAGES.map(([key, icon]) => (
                <li key={key}>
                  <button type="button" onClick={(e) => onEnter(key, e.currentTarget.getBoundingClientRect())}
                          className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left hover:bg-[#F3F8F1]">
                    <span className="grid place-items-center w-9 h-9 rounded-lg bg-[#F1F5EF] text-[#2E7D4F]"><DeviceIcon name={icon} size={20} tint={false} /></span>
                    <span className="flex-1 text-[15.5px] font-medium text-[#1E2B22]">{T.stages[key]}</span>
                    <span aria-hidden="true" className="text-[#6B7468]">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {product && (
          <div className="grid grid-cols-2 gap-3">
            <Link to={`/story/${product.product_id}`} className="rounded-[18px] bg-white border border-[#E8E4D8] p-4 hover:border-[#2E7D4F]">
              <span className="text-[#2E7D4F]" aria-hidden="true">📖</span>
              <p className="mt-2 text-[15px] font-semibold leading-snug text-[#1E2B22]">{T.book}</p>
            </Link>
            <Link to={`/world/${product.product_id}`} className="rounded-[18px] bg-white border border-[#E8E4D8] p-4 hover:border-[#2E7D4F]">
              <span className="text-[#2E7D4F]" aria-hidden="true">🌏</span>
              <p className="mt-2 text-[15px] font-semibold leading-snug text-[#1E2B22]">{T.world}</p>
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
