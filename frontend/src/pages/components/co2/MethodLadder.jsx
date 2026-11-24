// The CO₂ method as a ladder you can try (design "CO₂ method"): four sources tried from the top,
// the first one that works gives the number. A real product shows its real path and figures from
// the API (formula steps, references, confidence); "Formula" shows the rules with symbols; "No data"
// is a labelled illustration (in this catalogue every processed product reaches a source); "Your
// own numbers" runs the same rules on figures the visitor types, labelled as an illustration.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { tri, useI18n } from "../../../i18n/LanguageContext";
import { formatKg, formatNum } from "../../../lib/format";
import { shortName } from "../../../lib/shortName";
import Icon from "../ui/Icon";

export const RUNG_OF = { manufacturer: 0, neighbor_average: 1, llm_estimate: 1, category_model: 2, lifecycle_formula: 2, eeio_price: 2 };
const CONF = [0.9, 0.5, 0.35, null];
const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const STEP_MS = 850;

export function FBadge({ dark = false }) {
  return (
    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full font-display text-[15px] italic font-bold ${dark ? "bg-white text-[#1B4332]" : "bg-[#1B4332] text-white"}`} aria-hidden="true">f</span>
  );
}

function texts(L3) {
  return {
    q: [
      L3("Nhà sản xuất có công bố CO₂ cho đúng model này không?", "Did the manufacturer publish CO₂ for this exact model?", "Le fabricant a-t-il publié le CO₂ de ce modèle exact ?"),
      L3("Có đủ sản phẩm gần giống (độ tương đồng ≥ 0,66) có số công bố không?", "Are there close enough products (similarity ≥ 0.66) with a published figure?",
         "Existe-t-il des produits assez proches (similarité ≥ 0,66) avec un chiffre publié ?"),
      L3("Danh mục có trung vị đo từ các số công bố không?", "Does the category have a median measured from published figures?",
         "La catégorie a-t-elle une médiane mesurée sur des chiffres publiés ?"),
      L3("Không nguồn nào dùng được?", "Did no source work?", "Aucune source n'a fonctionné ?"),
    ],
    label: [
      L3("Số nhà sản xuất công bố", "Manufacturer's published figure", "Chiffre publié par le fabricant"),
      L3("Trung bình sản phẩm tương tự", "Average of similar products", "Moyenne de produits similaires"),
      L3("Mô hình danh mục", "Category model", "Modèle de catégorie"),
      L3("Để trống", "Left empty", "Laissé vide"),
    ],
    general: [
      L3("CO₂ = số nhà sản xuất công bố cho đúng model này, dùng nguyên trạng.", "CO₂ = the figure the manufacturer published for this exact model, used as is.", "CO₂ = le chiffre publié pour ce modèle exact, tel quel."),
      L3("CO₂ = (c₁ + … + cₙ) ÷ n — các sản phẩm có độ tương đồng ≥ 0,66 (OpenCLIP, ảnh và chữ) và có số công bố; tối đa 5.",
         "CO₂ = (c₁ + … + cₙ) ÷ n — products with similarity ≥ 0.66 (OpenCLIP, image and text) and a published figure; up to 5.",
         "CO₂ = (c₁ + … + cₙ) ÷ n — produits de similarité ≥ 0,66 (OpenCLIP, image et texte) avec un chiffre publié ; 5 au plus."),
      L3("CO₂ = M × (s ÷ s₀)^b — M trung vị của danh mục (hoặc của hãng khi đủ mẫu); hệ số cỡ chỉ dùng cho màn hình và laptop.",
         "CO₂ = M × (s ÷ s₀)^b — M the category median (or the brand's when it has enough); the size factor is only used for screens and laptops.",
         "CO₂ = M × (s ÷ s₀)^b — M la médiane de la catégorie (ou de la marque) ; le facteur de taille ne sert qu'aux écrans et portables."),
      L3("Không đoán số, không bao giờ ghi 0.", "No number is guessed, and none is written as 0.", "Aucun chiffre deviné, jamais remplacé par 0."),
    ],
    none: [
      L3("Chưa có số công bố cho đúng model.", "No published figure for this exact model.", "Pas de chiffre publié pour ce modèle exact."),
      L3("Không có sản phẩm nào đủ giống (≥ 0,66) có số công bố.", "No product is close enough (≥ 0.66) with a published figure.", "Aucun produit assez proche (≥ 0,66) avec un chiffre publié."),
      L3("Danh mục chưa đủ số công bố để lấy trung vị.", "The category has too few published figures for a median.", "La catégorie a trop peu de chiffres publiés pour une médiane."),
    ],
    yes: L3("Có", "Yes", "Oui"), no: L3("Không", "No", "Non"), skip: L3("Không cần", "Not needed", "Inutile"),
    checking: L3("Đang kiểm tra…", "Checking…", "Vérification…"),
    conf: L3("Độ tin cậy", "Confidence", "Fiabilité"),
  };
}

/** One case to show on the ladder: which rung answered, the figure, and what each rung found. */
function productCase(co2, L3, lang) {
  const p = co2?.product || {};
  const f = co2?.formula || {};
  const has = isNum(p.co2e_kg);
  const active = has ? (RUNG_OF[f.method] ?? 2) : null;
  const lbl = (s) => (lang === "vi" ? s.label_vi || s.label_en : s.label_en || s.label_vi) || "";
  const steps = Array.isArray(f.steps) ? f.steps : [];
  const found = [null, null, null, null];
  if (active === 0) {
    const ref = (f.detail?.reference) || lbl(steps[0] || {}).replace(/^[^:]*:\s*/, "");
    found[0] = [`${ref} → ${formatKg(p.co2e_kg, lang)} kg CO₂e`, L3("Dùng số công bố nguyên trạng, không tính thêm.", "The published figure is used as is.", "Le chiffre publié est utilisé tel quel.")];
  }
  if (active === 1) {
    const refs = steps.filter((s) => isNum(s.value_kg) && !/^(average|trung bình)/i.test(s.label_en || ""));
    const avg = steps.find((s) => /^average/i.test(s.label_en || ""));
    found[1] = [
      ...refs.map((s) => `${lbl(s).replace(/\(cosine ([\d.]+)\)/, (_, c) => `· ${L3("độ giống", "similarity", "similarité")} ${formatNum(Number(c), lang, 2)}`)} → ${formatKg(s.value_kg, lang)} kg`),
      avg?.expr ? `CO₂ = ${avg.expr}` : `CO₂ = ${formatKg(p.co2e_kg, lang)} kg`,
    ];
  }
  if (active === 2) {
    found[2] = [...steps.map((s) => `${lbl(s)}: ${s.expr}`), ...(steps.some((s) => /kết quả|result/i.test(lbl(s))) ? [] : [`CO₂ = ${formatKg(p.co2e_kg, lang)} kg`])];
    if (f.method !== "category_model") found[2].unshift(f.expression || "");
  }
  return {
    kind: has ? "product" : "uncomputed", active, kg: has ? p.co2e_kg : null,
    conf: has ? (isNum(p.co2e_confidence) ? p.co2e_confidence : CONF[active]) : null,
    published: f.method === "manufacturer", found, product: p,
  };
}

/** The same rules on numbers the visitor typed (illustration only). */
function customCase(input) {
  const pub = Number(String(input.pub).replace(",", "."));
  const refs = String(input.refs).split(/[;\s]+/).map((v) => Number(v.replace(",", "."))).filter((v) => Number.isFinite(v) && v > 0).slice(0, 5);
  const med = Number(String(input.med).replace(",", "."));
  if (Number.isFinite(pub) && pub > 0) return { active: 0, kg: pub, refs, med };
  if (refs.length) return { active: 1, kg: refs.reduce((a, b) => a + b, 0) / refs.length, refs, med };
  if (Number.isFinite(med) && med > 0) return { active: 2, kg: med, refs, med };
  return { active: 3, kg: null, refs, med };
}

function Status({ kind, T }) {
  const style = kind === "yes" ? "bg-[#1F5D3A] text-white" : kind === "no" ? "bg-[#EFEDE6] text-[#55604F]" : kind === "skip" ? "border border-[#DCD7C9] bg-white text-[#8A9186]" : "bg-[#F6F1E2] text-[#8A7A4A]";
  const label = kind === "yes" ? T.yes : kind === "no" ? T.no : kind === "skip" ? T.skip : T.checking;
  return <span className={`shrink-0 rounded-md px-2.5 py-1 text-[13px] font-semibold ${style}`}>{label}</span>;
}

function ConfBar({ value, lang, T }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="mt-3 flex items-center gap-3">
      <span className="shrink-0 text-[13px] text-[#6B7468]">{T.conf} <b className="text-[#1E2B22]">{formatNum(value, lang, 2)}</b></span>
      <span className="h-2 flex-1 rounded-full bg-[#E9E6DC]"><span className="block h-2 rounded-full bg-[#4E8F62]" style={{ width: `${value * 100}%` }} /></span>
    </div>
  );
}

export default function MethodLadder({ co2, scenario, custom, onSeeCalc, running, onRunEnd }) {
  const { lang } = useI18n();
  const L3 = tri(lang);
  const T = texts(L3);
  const [step, setStep] = useState(null);       // during "run": the rung being checked
  const timer = useRef(null);

  // the case on the ladder
  let c;
  if (scenario === "formula") c = { kind: "formula", active: null, kg: null, conf: null, found: [null, null, null, null] };
  else if (scenario === "none") c = { kind: "none", active: 3, kg: null, conf: null, found: [null, null, null, null] };
  else if (scenario === "custom" && custom) {
    const r = customCase(custom);
    const k = (v) => formatKg(v, lang);
    c = {
      kind: "custom", active: r.active, kg: r.kg, conf: CONF[r.active], published: r.active === 0,
      found: [
        r.active === 0 ? [`CO₂ = ${k(r.kg)} kg`] : null,
        r.active === 1 ? [`CO₂ = (${r.refs.map(k).join(" + ")}) ÷ ${r.refs.length} = ${k(r.kg)} kg`] : null,
        r.active === 2 ? [`CO₂ = M = ${k(r.kg)} kg`] : null,
        null,
      ],
    };
  } else c = productCase(co2, L3, lang);

  // "Run the demo": check the rungs one by one, stop at the one that answers
  useEffect(() => {
    clearTimeout(timer.current);
    if (!running) { setStep(null); return undefined; }
    const last = c.active ?? 3;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setStep(null); onRunEnd?.(); return undefined; }
    let i = 0;
    setStep(0);
    const tick = () => {
      i += 1;
      if (i > last) { setStep(null); onRunEnd?.(); return; }
      setStep(i);
      timer.current = setTimeout(tick, STEP_MS);
    };
    timer.current = setTimeout(tick, STEP_MS);
    return () => clearTimeout(timer.current);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (i) => {
    if (c.kind === "formula" || c.kind === "uncomputed") return null;
    if (step !== null) return i < step ? (i === c.active ? "yes" : "no") : i === step ? "checking" : "hidden";
    return i < c.active ? "no" : i === c.active ? "yes" : "skip";
  };
  const resultReady = step === null;
  const k = (v) => formatKg(v, lang);
  const n = c.active === null ? null : c.active + 1;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
      <ol className="flex flex-col" aria-label={L3("Các bậc của phương pháp", "The rungs of the method", "Les échelons de la méthode")}>
        {T.q.map((q, i) => {
          const a = answer(i);
          const on = a === "yes";
          const compact = a === "skip" || a === "hidden";
          return (
            <li key={q} className="relative flex gap-4 pb-4 last:pb-0">
              {i < 3 && <span aria-hidden="true" className="absolute left-[21px] top-12 bottom-0 border-l-2 border-dashed border-[#D9D3C3]" />}
              <span className={`relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-[20px] font-semibold ${on ? "bg-[#1B4332] text-white" : a === "no" ? "border-2 border-[#CFC9B8] bg-white text-[#1E2B22]" : "border-2 border-[#DCD7C9] bg-[#FBFAF5] text-[#55604F]"}`}>
                {i < 3 ? i + 1 : "∅"}
              </span>
              <div className={`min-w-0 flex-1 rounded-[18px] border bg-[#FCFBF7] p-4 transition ${on ? "border-[#2E7D4F] shadow-[0_0_0_3px_rgba(46,125,79,0.12)]" : "border-[#E6E2D6]"} ${a === "hidden" ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[16.5px] font-semibold leading-snug text-[#1E2B22]">{q}</h3>
                  {a && a !== "hidden" && <Status kind={a} T={T} />}
                </div>
                {!compact && (
                  <div className="mt-3 border-t border-[#ECE8DC] pt-3">
                    <p className="text-[14.5px] font-semibold text-[#33403A]">{T.label[i]}</p>
                    <div className="mt-2 rounded-[10px] bg-[#F1EEE5] px-3.5 py-2.5 font-mono text-[13.5px] leading-relaxed text-[#33403A]">
                      {c.kind === "formula" || c.kind === "uncomputed" ? <p>{T.general[i]}</p>
                        : a === "yes" && i < 3 && c.found[i] ? c.found[i].map((line) => <p key={line}>{line}</p>)
                        : a === "yes" ? <p>{T.general[3]}</p>
                        : <p>{i < 3 ? T.none[i] : T.general[3]}</p>}
                    </div>
                    <ConfBar value={CONF[i]} lang={lang} T={T} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <aside className="lg:sticky lg:top-[92px] rounded-[24px] bg-[#1B4332] p-6 text-white" aria-live="polite">
        <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-white/70">{L3("Kết quả", "Result", "Résultat")}</p>
        {!resultReady ? (
          <p className="mt-3 font-display text-[54px] leading-none text-white/40">…</p>
        ) : c.kind === "formula" ? (
          <>
            <p className="mt-3 font-display text-[54px] font-semibold leading-none">CO₂</p>
            <p className="mt-2 text-[15.5px] text-white/85">{L3("= số của bậc đầu tiên trả lời “Có”", "= the figure of the first rung that answers “Yes”", "= le chiffre du premier échelon qui répond « Oui »")}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-[13.5px]">
              <span className="rounded-md bg-white/12 px-2.5 py-1">{L3("Bậc 1 → 4", "Rungs 1 → 4", "Échelons 1 → 4")}</span>
              <span className="rounded-md bg-white/12 px-2.5 py-1">{L3("Tin cậy 0,9 → 0,35", "Confidence 0.9 → 0.35", "Fiabilité 0,9 → 0,35")}</span>
            </div>
          </>
        ) : c.kind === "uncomputed" ? (
          <>
            <p className="mt-3 font-display text-[54px] font-semibold leading-none">—</p>
            <p className="mt-2 text-[15.5px] text-white/85">{L3("Sản phẩm này chưa được tính CO₂ (thiếu giá bán), nên chưa đi qua thang.", "This product has not been processed yet (no price), so it has not gone down the ladder.", "Ce produit n'a pas encore été traité (sans prix).")}</p>
          </>
        ) : c.kg === null ? (
          <>
            <p className="mt-3 font-display text-[54px] font-semibold leading-none">∅</p>
            <p className="mt-2 text-[15.5px] text-white/85">{L3("Không có số — để trống, không đoán", "No figure — left empty, never guessed", "Pas de chiffre — laissé vide")}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-[13.5px]"><span className="rounded-md bg-white/12 px-2.5 py-1">{L3("Bậc 4 của 4", "Rung 4 of 4", "Échelon 4 sur 4")}</span></div>
          </>
        ) : (
          <>
            <p className="mt-3 font-display text-[60px] font-semibold leading-none">{k(c.kg)}</p>
            <p className="mt-2 text-[15.5px]"><b>kg CO₂e</b> <span className="text-white/80">· {L3("cả vòng đời", "whole lifecycle", "cycle de vie complet")}</span></p>
            <div className="mt-4 flex flex-wrap gap-2 text-[13.5px]">
              <span className="rounded-md bg-white/12 px-2.5 py-1">{c.published ? L3("Hãng công bố", "Published", "Publié") : L3("Ước tính", "Estimate", "Estimation")}</span>
              <span className="rounded-md bg-white/12 px-2.5 py-1">{L3(`Bậc ${n} của 4`, `Rung ${n} of 4`, `Échelon ${n} sur 4`)}</span>
              {isNum(c.conf) && <span className="rounded-md bg-white/12 px-2.5 py-1">{L3("Tin cậy", "Confidence", "Fiabilité")} {formatNum(c.conf, lang, 2)}</span>}
            </div>
          </>
        )}
        {c.kind === "custom" && resultReady && (
          <p className="mt-3 text-[13.5px] text-white/75">{L3("Minh họa với số bạn nhập — không phải số của sản phẩm nào.", "An illustration with your numbers — not any product's figure.", "Illustration avec vos chiffres — pas le chiffre d'un produit.")}</p>
        )}
        {c.kind === "none" && resultReady && (
          <p className="mt-3 text-[13.5px] text-white/75">{L3("Minh họa: trong danh mục hiện tại, mọi sản phẩm đã tính đều dừng ở bậc 1–3.", "Illustration: in the current catalogue every processed product stops at rungs 1–3.", "Illustration : dans le catalogue actuel, chaque produit traité s'arrête aux échelons 1–3.")}</p>
        )}
        {c.kind === "product" && (
          <div className="mt-5 flex items-center gap-2">
            <button type="button" onClick={onSeeCalc}
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white px-4 text-[15.5px] font-semibold text-[#1B4332] hover:bg-[#F1F5EF]">
              {L3("Xem phép tính đầy đủ ↓", "See the full calculation ↓", "Voir le calcul complet ↓")}
            </button>
            <Link to={`/world/${c.product.product_id}`} title={L3("Xem trong thế giới CO₂", "See it in the CO₂ world", "Voir dans le monde CO₂")}
                  aria-label={L3("Xem trong thế giới CO₂", "See it in the CO₂ world", "Voir dans le monde CO₂")}
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-[#1B4332] hover:bg-[#F1F5EF]">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor" /></svg>
            </Link>
          </div>
        )}
        {c.kind === "product" && (
          <p className="mt-3 text-[13.5px] text-white/75">
            <Link to={`/story/${c.product.product_id}`} className="inline-flex items-center gap-1.5 underline hover:text-white">
              <Icon name="book" size={14} />{L3("Đọc sách CO₂ của ", "Read the CO₂ book of ", "Lire le livre CO₂ de ")}{shortName(c.product.name)}
            </Link>
          </p>
        )}
      </aside>
    </div>
  );
}
