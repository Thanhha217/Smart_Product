// /trade-in — "Thu cũ đổi mới": trade your old device in and/or buy refurbished, and see how much
// CO₂ each choice avoids against buying new. The new device's figures come from the API (its
// lifecycle total and production stage); the old device is a category median, a product you looked
// at, or your own figure. The maths and its assumptions are in lib/tradeIn.js and shown on the page.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { tri, useI18n } from "../i18n/LanguageContext";
import { useShopText } from "../i18n/shop";
import { useCompare } from "../lib/compare";
import { normalizeList } from "../lib/data";
import { formatKg, formatNum } from "../lib/format";
import { useRecent } from "../lib/recent";
import { shortName } from "../lib/shortName";
import { CAT_OF_SLUG, defaultSecondLife, LIFETIME, PRODUCTION_SHARE, REUSE_EMBODIED, tradeIn } from "../lib/tradeIn";

const LANG_IDX = { vi: 0, en: 1, fr: 2 };
/** "277,2" / "277.2" / "1.234,5" / "1,234.5" -> number: the last separator is the decimal mark. */
export const toNum = (s) => {
  let t = String(s ?? "").trim().replace(/\s/g, "");
  if (!t) return null;
  const last = Math.max(t.lastIndexOf(","), t.lastIndexOf("."));
  if (last >= 0) {
    const decimals = t.length - last - 1;
    // a single separator followed by exactly three digits is a thousands mark ("1.200"), otherwise a decimal mark
    const thousands = (t.match(/[.,]/g) || []).length === 1 && decimals === 3;
    t = thousands ? t.replace(/[.,]/g, "") : `${t.slice(0, last).replace(/[.,]/g, "")}.${t.slice(last + 1)}`;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const CUSTOM_CATS = ["laptop", "smartphone", "tablet", "computer_monitor", "smartwatch", "headphone"];
const CAT_NAME = {
  laptop: ["Laptop", "Laptop", "Portable"], smartphone: ["Điện thoại", "Phone", "Téléphone"], tablet: ["Máy tính bảng", "Tablet", "Tablette"],
  computer_monitor: ["Màn hình", "Monitor", "Écran"], smartwatch: ["Đồng hồ thông minh", "Smartwatch", "Montre"], headphone: ["Tai nghe", "Headphones", "Casque"],
};

function Illustration() {
  return (
    <svg viewBox="0 0 300 140" className="h-auto w-full max-w-[300px]" aria-hidden="true">
      <ellipse cx="150" cy="126" rx="125" ry="9" fill="#2C5A44" />
      <rect x="12" y="52" width="66" height="44" rx="4" fill="#7E958A" />
      <rect x="18" y="57" width="54" height="34" rx="2" fill="#C8D6CF" />
      <path d="M4 100h82l-6 6H10z" fill="#9AAEA4" />
      <g fill="none" stroke="#9FDDB0" strokeWidth="7" strokeLinecap="round">
        <path d="M128 60a24 24 0 0 1 41-9" /><path d="M172 84a24 24 0 0 1-41 9" />
      </g>
      <path d="M170 40l2 14-14-2z" fill="#9FDDB0" /><path d="M130 104l-2-14 14 2z" fill="#9FDDB0" />
      <rect x="208" y="44" width="72" height="50" rx="4" fill="#EDF4EF" />
      <rect x="214" y="50" width="60" height="38" rx="2" fill="#2E7D4F" />
      <path d="M200 98h88l-6 7h-76z" fill="#EDF4EF" />
      <path d="M248 40c0-14 10-22 24-22-1 14-9 22-24 22z" fill="#7FCB8F" />
    </svg>
  );
}

export default function TradeIn() {
  const { lang } = useI18n();
  const L3 = tri(lang);
  const li = LANG_IDX[lang] ?? 1;
  const st = useShopText();
  const recent = useRecent();
  const compare = useCompare();

  // ---- data: category medians, and devices to upgrade to
  const [cats, setCats] = useState([]);
  const [greenest, setGreenest] = useState([]);
  useEffect(() => {
    let alive = true;
    api.getCategories().then((d) => alive && setCats((d?.categories || []).filter((c) => CAT_OF_SLUG[c.category] && typeof c.median_kg === "number"))).catch(() => {});
    api.getOverview().then((o) => alive && setGreenest(normalizeList((o?.greenest || []).map((g) => g.product)))).catch(() => {});
    return () => { alive = false; };
  }, []);
  const candidates = useMemo(() => {
    const seen = new Set();
    return [...compare, ...recent, ...greenest].filter((p) => p && p.co2e_kg !== null && !seen.has(p.product_id) && seen.add(p.product_id)).slice(0, 5);
  }, [compare, recent, greenest]);

  // ---- the old device
  const [oldKey, setOldKey] = useState("cat:laptops");
  const [oldName, setOldName] = useState("");
  const [oldKg, setOldKg] = useState("");
  const [oldCat, setOldCat] = useState("laptop");
  const [action, setAction] = useState("resell");
  const [years, setYears] = useState("");
  const catLabel = (slug) => { const l = st(`cat.${slug}`); return l === `cat.${slug}` ? slug : l; };
  const applyOld = (key) => {
    setOldKey(key);
    if (key.startsWith("cat:")) {
      const c = cats.find((x) => `cat:${x.category}` === key);
      if (!c) return;
      const cat = CAT_OF_SLUG[c.category];
      setOldCat(cat); setOldName(catLabel(c.category)); setOldKg(formatKg(c.median_kg, lang)); setYears(String(defaultSecondLife(cat)));
    } else if (key.startsWith("p:")) {
      const p = recent.find((x) => `p:${x.product_id}` === key);
      if (!p) return;
      const cat = PRODUCTION_SHARE[p.co2_category] ? p.co2_category : "laptop";
      setOldCat(cat); setOldName(shortName(p.name)); setOldKg(p.co2e_kg !== null ? formatKg(p.co2e_kg, lang) : ""); setYears(String(defaultSecondLife(cat)));
    }
  };
  // fill the form once the medians arrive (and again when the language changes the decimal mark)
  useEffect(() => { if (cats.length) applyOld(oldKey); }, [cats.length, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- the new device
  const [pick, setPick] = useState(null);                      // product id or "custom"
  useEffect(() => { if (!pick && candidates.length) setPick(candidates[0].product_id); }, [candidates, pick]);
  const [newCo2, setNewCo2] = useState(null);
  useEffect(() => {
    let alive = true;
    setNewCo2(null);
    if (!pick || pick === "custom") return undefined;
    api.getProductCo2(pick).then((d) => alive && setNewCo2(d)).catch(() => {});
    return () => { alive = false; };
  }, [pick]);
  const [custom, setCustom] = useState({ name: "", kg: "", cat: "laptop" });

  const newProduct = pick === "custom" ? null : newCo2?.product || candidates.find((c) => c.product_id === pick) || null;
  const newKg = pick === "custom" ? toNum(custom.kg) : newProduct?.co2e_kg ?? null;
  const newName = pick === "custom" ? (custom.name.trim() || L3("máy mới", "the new device", "le nouvel appareil")) : shortName(newProduct?.name || "");
  const stages = newCo2?.lifecycle?.stages || [];
  const prodStage = pick === "custom" ? null : stages.find((s) => s.key === "materials_production")?.kg ?? null;
  const newCat = pick === "custom" ? custom.cat : newProduct?.co2_category || newProduct?.category;

  const r = tradeIn({ newKg, newProductionKg: prodStage, newCategory: newCat, old: { kg: toNum(oldKg), category: oldCat, action, years: toNum(years) } });

  // ---- formatting
  const k = (v) => formatKg(v, lang);
  const signedKg = (v) => (v < 0 ? `−${k(-v)}` : k(v));
  const pct = (v) => `${formatNum(v, lang, 1)} %`;
  // the working shows up to 2 decimals, so every line can be checked with a calculator
  const k2 = (v) => formatNum(Math.round(v * 100) / 100, lang, Number.isInteger(Math.round(v * 100) / 100) ? 0 : (Math.round(v * 10) / 10 === Math.round(v * 100) / 100 ? 1 : 2));
  const s2 = (v) => (v < 0 ? `−${k2(-v)}` : k2(v));
  const bestName = { buyNew: "", tradeIn: L3("đổi máy cũ", "trading the old device in", "la reprise"), refurb: L3("mua refurbished", "buying refurbished", "le reconditionné"), both: L3("refurbished và đổi máy cũ", "refurbished plus trade-in", "reconditionné et reprise") };
  const card = "rounded-[22px] border border-[#E8E4D8] bg-white p-5";
  const fieldLabel = "mt-4 block text-[15px] font-semibold text-[#1E2B22]";
  const input = "mt-1.5 h-12 w-full rounded-[12px] border border-[#DCD7C9] bg-white px-4 text-[16px] text-[#1E2B22] focus:border-[#2E7D4F] focus:outline-none";
  const kicker = "text-[13px] font-bold uppercase tracking-[0.12em] text-[#2E7D4F]";
  const step = (n, title, id) => (
    <h2 id={id} className="flex items-center gap-3 font-display text-[26px] font-semibold text-[#1E2B22]">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-[#1B4332] font-sans text-[15px] font-bold text-white">{n}</span>{title}
    </h2>
  );
  const shareText = (cat) => `${formatNum((PRODUCTION_SHARE[cat] ?? 0.75) * 100, lang, 0)} %`;

  const results = r && [
    { key: "buyNew", title: L3("Mua mới", "Buy new", "Acheter neuf"), note: L3("Mốc so sánh", "The baseline", "La référence") },
    { key: "tradeIn", title: L3("Đổi máy cũ lấy máy mới", "Trade the old one in", "Reprise de l'ancien"),
      note: action === "resell"
        ? L3(`Giảm ${k(r.tradeIn.saved)} kg (${pct(r.tradeIn.pct)}) nhờ máy cũ được bán lại`, `${k(r.tradeIn.saved)} kg less (${pct(r.tradeIn.pct)}) because the old one is resold`, `${k(r.tradeIn.saved)} kg de moins (${pct(r.tradeIn.pct)}) grâce à la revente`)
          + (r.tradeIn.kg < 0 ? L3(": tránh được nhiều hơn phát sinh", ": more avoided than emitted", " : plus évité qu'émis") : "")
        : L3("Tái chế không trừ thêm CO₂ (xem giả định bên dưới)", "Recycling takes no CO₂ off (see the assumptions)", "Le recyclage ne retire pas de CO₂ (voir hypothèses)") },
    { key: "refurb", title: L3("Mua refurbished", "Buy refurbished", "Acheter reconditionné"),
      note: L3(`Giảm ${k(r.refurb.saved)} kg (${pct(r.refurb.pct)}) vì không phải sản xuất máy mới`, `${k(r.refurb.saved)} kg less (${pct(r.refurb.pct)}): no new device is made`, `${k(r.refurb.saved)} kg de moins (${pct(r.refurb.pct)}) : pas de fabrication neuve`) },
    { key: "both", title: L3("Refurbished và đổi máy cũ", "Refurbished plus trade-in", "Reconditionné et reprise"),
      note: r.both.kg < 0
        ? L3(`Giảm ${k(r.both.saved)} kg (${pct(r.both.pct)}): tránh được nhiều hơn phát sinh`, `${k(r.both.saved)} kg less (${pct(r.both.pct)}): more avoided than emitted`, `${k(r.both.saved)} kg de moins (${pct(r.both.pct)}) : plus évité qu'émis`)
        : L3(`Giảm ${k(r.both.saved)} kg (${pct(r.both.pct)}), kết hợp cả hai cách`, `${k(r.both.saved)} kg less (${pct(r.both.pct)}), both together`, `${k(r.both.saved)} kg de moins (${pct(r.both.pct)}), les deux ensemble`) },
  ];
  const bestSaved = r ? r[r.best].saved : 0;

  return (
    <main className="page-wrap flex max-w-[1180px] flex-col gap-7 py-7 pb-28">
      <section className="grid items-center gap-6 rounded-[26px] bg-[#1B4332] p-7 text-white lg:grid-cols-[1.1fr_1fr_1.15fr]">
        <div>
          <h1 className="font-display text-[38px] font-semibold leading-tight sm:text-[42px]">{L3("Thu cũ đổi mới", "Trade-in", "Reprise")}</h1>
          <p className="mt-2 max-w-[360px] text-[17px] leading-relaxed text-white/85">
            {L3("Đổi máy cũ lấy máy mới, hoặc chọn máy refurbished. Cách nào cũng bớt CO₂ hơn mua mới hoàn toàn.",
                "Trade your old device in, or choose a refurbished one. Either way emits less CO₂ than buying brand new.",
                "Faites reprendre l'ancien appareil ou choisissez un reconditionné : moins de CO₂ qu'un achat neuf.")}
          </p>
        </div>
        <div className="hidden justify-center lg:flex"><Illustration /></div>
        <div className="rounded-[18px] bg-white/[0.09] p-5">
          <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-white/70">{L3("Có thể giảm tới", "You could save up to", "Économie possible")}</p>
          {r && bestSaved > 0 ? (
            <>
              <p className="mt-1 flex items-baseline gap-2"><span className="font-display text-[52px] font-semibold leading-none">−{k(bestSaved)}</span><span className="text-[16px] font-semibold">kg CO₂e</span></p>
              <p className="mt-2 text-[15.5px] leading-snug text-white/85">
                {L3(`so với mua ${newName} mới, tức ${pct(r[r.best].pct)}. Cách giảm nhiều nhất: ${bestName[r.best]}.`,
                    `against buying ${newName} new, that is ${pct(r[r.best].pct)}. The biggest cut: ${bestName[r.best]}.`,
                    `par rapport à ${newName} neuf, soit ${pct(r[r.best].pct)}. Le plus efficace : ${bestName[r.best]}.`)}
                {r[r.best].pct > 100 && L3(" Vượt 100 % vì máy cũ bán lại giúp người khác khỏi mua máy mới.", " Over 100 % because your resold device spares someone else a new one.", " Plus de 100 % : votre appareil revendu évite un achat neuf à quelqu'un.")}
              </p>
            </>
          ) : <p className="mt-2 text-[15.5px] text-white/80">{L3("Chọn máy mới và nhập máy cũ để xem.", "Choose the new device and enter the old one to see.", "Choisissez le nouvel appareil et saisissez l'ancien.")}</p>}
        </div>
      </section>

      <section aria-labelledby="have" className="flex flex-col gap-4">
        {step(1, L3("Bạn đang có máy gì?", "What do you have now?", "Qu'avez-vous aujourd'hui ?"), "have")}
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className={card}>
            <p className={kicker}>{L3("Máy cũ của bạn", "Your old device", "Votre ancien appareil")}</p>
            <label className={fieldLabel}>{L3("Chọn loại máy hoặc sản phẩm", "Choose a type or a product", "Choisir un type ou un produit")}
              <select value={oldKey} onChange={(e) => applyOld(e.target.value)} className={`${input} pr-3`}>
                <optgroup label={L3("Theo loại (trung vị danh mục)", "By type (category median)", "Par type (médiane)")}>
                  {cats.map((c) => <option key={c.category} value={`cat:${c.category}`}>{catLabel(c.category)} ({L3("trung vị danh mục", "category median", "médiane")})</option>)}
                </optgroup>
                {recent.filter((p) => p.co2e_kg !== null).length > 0 && (
                  <optgroup label={L3("Sản phẩm bạn vừa xem", "Products you looked at", "Produits consultés")}>
                    {recent.filter((p) => p.co2e_kg !== null).slice(0, 6).map((p) => <option key={p.product_id} value={`p:${p.product_id}`}>{shortName(p.name)} — {k(p.co2e_kg)} kg</option>)}
                  </optgroup>
                )}
                <option value="own">{L3("Máy khác (tự nhập số)", "Another device (type the figure)", "Autre appareil (saisir)")}</option>
              </select>
            </label>
            {oldKey === "own" && (
              <label className={fieldLabel}>{L3("Loại máy", "Device type", "Type d'appareil")}
                <select value={oldCat} onChange={(e) => { setOldCat(e.target.value); setYears(String(defaultSecondLife(e.target.value))); }} className={`${input} pr-3`}>
                  {CUSTOM_CATS.map((c) => <option key={c} value={c}>{CAT_NAME[c][li]}</option>)}
                </select>
              </label>
            )}
            <label className={fieldLabel}>{L3("Tên máy của bạn", "Your device's name", "Nom de votre appareil")}
              <input value={oldName} onChange={(e) => setOldName(e.target.value)} className={input} />
            </label>
            <label className={fieldLabel}>{L3("CO₂ cả vòng đời (kg CO₂e)", "Lifecycle CO₂ (kg CO₂e)", "CO₂ du cycle de vie (kg CO₂e)")}
              <input value={oldKg} onChange={(e) => setOldKg(e.target.value)} inputMode="decimal" className={input} />
            </label>
            <p className="mt-1.5 text-[14px] text-[#6B7468]">{L3("Mặc định là trung vị của danh mục. Bạn có thể nhập số khác.", "The default is the category median. You can type another figure.", "Par défaut la médiane de la catégorie ; vous pouvez la changer.")}</p>
            <p className={`${kicker} mt-5`}>{L3("Bạn định làm gì với nó?", "What will you do with it?", "Qu'allez-vous en faire ?")}</p>
            <div className="mt-2 flex flex-wrap gap-2" role="group">
              {[["resell", L3("Bán lại", "Resell", "Revendre")], ["recycle", L3("Tái chế", "Recycle", "Recycler")]].map(([v, label]) => (
                <button key={v} type="button" aria-pressed={action === v} onClick={() => setAction(v)}
                        className={`h-[44px] rounded-full border px-5 text-[15.5px] font-semibold transition ${action === v ? "border-[#1B4332] bg-[#1B4332] text-white" : "border-[#DCD7C9] bg-white text-[#1E2B22] hover:border-[#2E7D4F]"}`}>{label}</button>
              ))}
            </div>
            {action === "resell" && (
              <label className={fieldLabel}>{L3("Người mua sau còn dùng thêm (năm)", "The next owner keeps using it for (years)", "Le prochain propriétaire l'utilise encore (ans)")}
                <input value={years} onChange={(e) => setYears(e.target.value)} inputMode="numeric" className={input} />
                {toNum(years) !== null && toNum(years) > (LIFETIME[oldCat] ?? 4) && (
                  <span role="status" className="mt-1.5 block text-[14px] font-medium text-[#92400e]">
                    {L3(`Chỉ tính tối đa ${LIFETIME[oldCat] ?? 4} năm (tuổi thọ của loại).`, `Counted as ${LIFETIME[oldCat] ?? 4} years at most (the type's service life).`, `Compté ${LIFETIME[oldCat] ?? 4} ans au plus.`)}
                  </span>
                )}
                <span className="mt-1.5 block text-[14px] font-normal text-[#6B7468]">
                  {L3(`Mặc định: nửa tuổi thọ của loại (L = ${LIFETIME[oldCat] ?? 4} năm). Tối đa ${LIFETIME[oldCat] ?? 4} năm.`,
                      `Default: half the type's service life (L = ${LIFETIME[oldCat] ?? 4} years). At most ${LIFETIME[oldCat] ?? 4}.`,
                      `Par défaut : la moitié de la durée de vie (L = ${LIFETIME[oldCat] ?? 4} ans).`)}
                </span>
              </label>
            )}
          </div>

          <div className={card}>
            <p className={kicker}>{L3("Bạn muốn lên đời máy nào?", "Which device do you want?", "Quel appareil voulez-vous ?")}</p>
            <ul className="mt-3 flex flex-col gap-2.5">
              {candidates.map((p) => {
                const on = pick === p.product_id;
                return (
                  <li key={p.product_id}>
                    <button type="button" aria-pressed={on} onClick={() => setPick(p.product_id)} title={p.name}
                            className={`flex h-[54px] w-full items-center justify-between gap-3 rounded-[12px] border px-4 text-left transition ${on ? "border-[#1B4332] bg-[#1B4332] text-white" : "border-[#DCD7C9] bg-white text-[#1E2B22] hover:border-[#2E7D4F]"}`}>
                      <span className="truncate text-[16.5px] font-semibold">{shortName(p.name)}</span>
                      <span className="shrink-0 font-display text-[20px] font-semibold">≈{k(p.co2e_kg)} kg</span>
                    </button>
                  </li>
                );
              })}
              <li>
                <button type="button" aria-pressed={pick === "custom"} onClick={() => setPick("custom")}
                        className={`flex h-[54px] w-full items-center rounded-[12px] border px-4 text-left text-[16.5px] font-semibold transition ${pick === "custom" ? "border-[#1B4332] bg-[#1B4332] text-white" : "border-[#DCD7C9] bg-white text-[#1E2B22] hover:border-[#2E7D4F]"}`}>
                  {L3("Máy khác (tự nhập)", "Another device (type it in)", "Autre appareil (saisir)")}
                </button>
              </li>
            </ul>
            {pick === "custom" && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-[14px] text-[#55604F]">{L3("Tên", "Name", "Nom")}<input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} className={input} /></label>
                <label className="text-[14px] text-[#55604F]">{L3("CO₂ (kg)", "CO₂ (kg)", "CO₂ (kg)")}<input value={custom.kg} inputMode="decimal" onChange={(e) => setCustom({ ...custom, kg: e.target.value })} className={input} /></label>
                <label className="text-[14px] text-[#55604F]">{L3("Loại", "Type", "Type")}
                  <select value={custom.cat} onChange={(e) => setCustom({ ...custom, cat: e.target.value })} className={`${input} pr-3`}>
                    {CUSTOM_CATS.map((c) => <option key={c} value={c}>{CAT_NAME[c][li]}</option>)}
                  </select>
                </label>
              </div>
            )}
            {candidates.length === 0 && pick !== "custom" && <p className="mt-3 text-[14.5px] text-[#6B7468]">{L3("Đang tải sản phẩm…", "Loading products…", "Chargement…")}</p>}
          </div>
        </div>
      </section>

      <section aria-labelledby="save" className="flex flex-col gap-4">
        {step(2, L3("Giảm được bao nhiêu CO₂?", "How much CO₂ does it save?", "Combien de CO₂ économisé ?"), "save")}
        {!r ? <p className="text-[15.5px] text-[#6B7468]">{L3("Chọn máy mới (có số CO₂) để xem kết quả.", "Choose a new device with a CO₂ figure to see the result.", "Choisissez un appareil avec un chiffre CO₂.")}</p> : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {results.map((c) => {
              const best = r.best === c.key && c.key !== "buyNew";
              const v = r[c.key].kg;
              return (
                <article key={c.key} className={`flex flex-col rounded-[22px] border bg-white p-5 ${best ? "border-2 border-[#2E7D4F]" : "border-[#E8E4D8]"}`}>
                  {best && <span className="mb-2 self-start rounded-md bg-[#1B4332] px-2 py-0.5 text-[12.5px] font-semibold text-white">{L3("Giảm nhiều nhất", "Biggest cut", "Le plus efficace")}</span>}
                  <h3 className="text-[17px] font-semibold text-[#1E2B22]">{c.title}</h3>
                  <p className="mt-2 flex items-baseline gap-1.5">
                    <span className={`font-display text-[36px] font-bold leading-none ${c.key === "buyNew" ? "text-[#55604F]" : "text-[#1B4D31]"}`}>≈{signedKg(v)}</span>
                    <span className="text-[14px] text-[#55604F]">kg CO₂e</span>
                  </p>
                  <p className="mt-2 text-[14.5px] leading-snug text-[#55604F]">{c.note}</p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {r && (
        <section aria-labelledby="how" className="flex flex-col gap-4">
          {step(3, L3("Tính như thế nào", "How it is worked out", "Comment c'est calculé"), "how")}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <ol className={`${card} flex flex-col gap-3 font-mono text-[14.5px] text-[#1E2B22]`}>
              <li><p className="font-sans text-[14px] font-semibold text-[#55604F]">{L3(`Phần sản xuất của ${newName}`, `Manufacturing share of ${newName}`, `Part fabrication de ${newName}`)}</p>
                P<sub>mới</sub> = {k2(r.prodNew)} kg {prodStage === null ? `(${k2(newKg)} × ${shareText(newCat)})` : L3("(từ phân tách vòng đời của sản phẩm)", "(from the product's lifecycle split)", "(répartition du cycle de vie)")}</li>
              <li><p className="font-sans text-[14px] font-semibold text-[#55604F]">{L3("Mua refurbished: tránh 80 % phần sản xuất", "Refurbished: 80 % of manufacturing avoided", "Reconditionné : 80 % de la fabrication évitée")}</p>
                {k2(r.prodNew)} × (1 − {formatNum(REUSE_EMBODIED, lang, 1)}) = {k2(r.refurbSaving)} kg → {k2(newKg)} − {k2(r.refurbSaving)} = {s2(r.refurb.kg)} kg</li>
              <li><p className="font-sans text-[14px] font-semibold text-[#55604F]">{L3("Phần sản xuất của máy cũ", "Manufacturing share of the old device", "Part fabrication de l'ancien")}</p>
                P<sub>cũ</sub> = {k2(r.oldKg)} × {shareText(oldCat)} = {k2(r.embOld)} kg</li>
              <li><p className="font-sans text-[14px] font-semibold text-[#55604F]">{action === "resell" ? L3("Bán lại: người mua sau khỏi mua máy mới trong R năm", "Resold: the next owner skips a new device for R years", "Revendu : le prochain propriétaire évite un neuf pendant R ans") : L3("Tái chế: không trừ thêm", "Recycled: nothing taken off", "Recyclé : rien de retiré")}</p>
                {action === "resell"
                  ? <>{k2(r.embOld)} × (1 − {formatNum(REUSE_EMBODIED, lang, 1)}) × {formatNum(r.years, lang, 0)} ÷ {r.L} = {k2(r.resaleCredit)} kg → {k2(newKg)} − {k2(r.resaleCredit)} = {s2(r.tradeIn.kg)} kg</>
                  : <>0 kg → {k2(newKg)} kg</>}</li>
              <li><p className="font-sans text-[14px] font-semibold text-[#55604F]">{L3("Cả hai cách", "Both together", "Les deux")}</p>
                {k2(newKg)} − {k2(r.refurbSaving)} − {k2(r.resaleCredit)} = {s2(r.both.kg)} kg</li>
            </ol>
            <div className={`${card} text-[14.5px] leading-relaxed text-[#374151]`}>
              <p className={kicker}>{L3("Giả định", "Assumptions", "Hypothèses")}</p>
              <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">
                <li>{L3("Máy tân trang hoặc máy cũ mang 20 % phát thải sản xuất (giả định chung của dự án, cũng dùng ở CO₂ world).", "A refurbished or second-hand device carries 20 % of the manufacturing emissions (the project's assumption, also used in the CO₂ world).", "Un appareil reconditionné porte 20 % des émissions de fabrication (hypothèse du projet).")}</li>
                <li>{L3("Phát thải sản xuất chia đều theo tuổi thọ L của loại; người mua máy cũ của bạn lẽ ra sẽ mua một máy mới cùng loại.", "Manufacturing emissions are spread over the type's service life L; whoever buys your old device would otherwise have bought a new one of the same type.", "Les émissions de fabrication sont réparties sur la durée de vie L ; l'acheteur aurait sinon acheté un neuf.")}</li>
                <li>{L3("Tái chế giữ vật liệu khỏi bãi rác, nhưng chưa có số đáng tin cho phần CO₂ thu hồi nên trang không trừ.", "Recycling keeps materials out of landfill, but there is no reliable figure for the CO₂ it recovers, so none is taken off.", "Le recyclage évite la décharge, mais sans chiffre fiable aucun CO₂ n'est retiré.")}</li>
                <li>{L3("Tỷ lệ phần sản xuất là mức điển hình của loại (laptop 75 %, điện thoại 80 %, màn hình 40 %…). Đây là ước tính để so sánh, không phải số được chứng nhận.", "Manufacturing shares are typical for the type (laptop 75 %, phone 80 %, monitor 40 %…). These are estimates for comparison, not certified figures.", "Parts de fabrication typiques du type ; estimations pour comparer.")}</li>
              </ul>
              {newProduct && (
                <p className="mt-3 flex flex-wrap gap-3 font-sans">
                  <Link to={`/story/${newProduct.product_id}`} className="btn-secondary">{L3("Sách CO₂ của máy mới", "The new device's CO₂ book", "Le livre CO₂")}</Link>
                  <Link to="/method" className="btn-secondary">{L3("Phương pháp CO₂", "CO₂ method", "Méthode CO₂")}</Link>
                </p>
              )}
            </div>
          </div>
        </section>
      )}

    </main>
  );
}
