// The "AI buys it for you" tab of the cart (design "Giỏ hàng và ví AI"): say what you want, the
// type, the priority and the budget, optionally your old device; the agent finds, compares, works out
// the trade-in saving and prepares a TEST order. Paying is never automatic: the person approves the
// order on its page, and no money is taken (test mode).
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../api/client";
import { tri, useI18n } from "../../../i18n/LanguageContext";
import { useShopText } from "../../../i18n/shop";
import { BUDGETS, DEVICE_SLUGS, planPurchase, STEPS } from "../../../lib/aiBuyer";
import { formatPrice, normalizeList } from "../../../lib/data";
import { formatKg, formatNum } from "../../../lib/format";
import { shortName } from "../../../lib/shortName";
import { CAT_OF_SLUG, PRODUCTION_SHARE } from "../../../lib/tradeIn";
import ProductThumb from "../common/ProductThumb";
import Icon from "../ui/Icon";

const kicker = "text-[13px] font-bold uppercase tracking-[0.12em] text-[#2E7D4F]";
const label = "mt-4 block text-[15px] font-semibold text-[#1E2B22]";
const input = "mt-1.5 h-12 w-full rounded-[12px] border border-[#DCD7C9] bg-white px-4 text-[16px] text-[#1E2B22] placeholder:text-[#8A9186] focus:border-[#2E7D4F] focus:outline-none";
const chip = (on) => `h-[44px] rounded-full border px-4 text-[15.5px] font-medium transition ${on ? "border-[#1B4332] bg-[#1B4332] text-white" : "border-[#DCD7C9] bg-white text-[#1E2B22] hover:border-[#2E7D4F]"}`;

/** Old device box: type a model or a type; pick a category median or a catalogue product. */
function OldDevice({ value, onChange }) {
  const { lang } = useI18n();
  const L3 = tri(lang);
  const st = useShopText();
  const [q, setQ] = useState("");
  const [cats, setCats] = useState([]);
  const [hits, setHits] = useState([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { api.getCategories().then((d) => setCats((d?.categories || []).filter((c) => CAT_OF_SLUG[c.category] && typeof c.median_kg === "number"))).catch(() => {}); }, []);
  useEffect(() => {
    const v = q.trim();
    if (v.length < 2) { setHits([]); return undefined; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api.search({ q: v, has_co2: true, page_size: 5 }, { signal: ctrl.signal })
        .then((d) => setHits(normalizeList(d?.items).filter((p) => p.co2e_kg !== null && PRODUCTION_SHARE[p.co2_category] !== undefined)))
        .catch(() => {});
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);
  const catLabel = (slug) => { const l = st(`cat.${slug}`); return l === `cat.${slug}` ? slug : l; };
  const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const catHits = cats.filter((c) => !q.trim() || fold(catLabel(c.category)).includes(fold(q.trim())) || fold(c.category).includes(fold(q.trim())));

  if (value) {
    return (
      <div className="mt-2 flex items-center justify-between gap-3 rounded-[14px] border border-[#2E7D4F] bg-[#F3F8F1] px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold text-[#1E2B22]">{value.name}</p>
          <p className="text-[14px] text-[#55604F]">≈{formatKg(value.kg, lang)} kg CO₂e · {value.median ? L3("trung vị danh mục", "category median", "médiane") : L3("số của sản phẩm", "the product's figure", "chiffre du produit")}</p>
        </div>
        <button type="button" onClick={() => { onChange(null); setQ(""); }} className="shrink-0 text-[14.5px] font-medium text-[#1B4332] underline">{L3("Đổi", "Change", "Changer")}</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
             placeholder={L3("Ví dụ: laptop, iPhone 12, Dell XPS…", "e.g. laptop, iPhone 12, Dell XPS…", "ex. portable, iPhone 12, Dell XPS…")} className={input}
             role="combobox" aria-expanded={open} aria-controls="old-list" aria-autocomplete="list" />
      {open && (catHits.length > 0 || hits.length > 0) && (
        <ul id="old-list" role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-[12px] border border-[#E6E2D6] bg-white py-1 shadow-lg">
          {catHits.map((c) => (
            <li key={c.category} role="option" aria-selected="false" onMouseDown={(e) => { e.preventDefault(); onChange({ name: catLabel(c.category), kg: c.median_kg, category: CAT_OF_SLUG[c.category], median: true }); }}
                className="flex cursor-pointer justify-between gap-3 px-4 py-2 hover:bg-[#F3F8F1]">
              <span className="text-[15px]">{catLabel(c.category)} <span className="text-[#6B7468]">({L3("trung vị danh mục", "category median", "médiane")})</span></span>
              <span className="text-[14px] text-[#55604F]">≈{formatKg(c.median_kg, lang)} kg</span>
            </li>
          ))}
          {hits.map((p) => (
            <li key={p.product_id} role="option" aria-selected="false" onMouseDown={(e) => { e.preventDefault(); onChange({ name: shortName(p.name), kg: p.co2e_kg, category: p.co2_category, median: false }); }}
                className="flex cursor-pointer justify-between gap-3 px-4 py-2 hover:bg-[#F3F8F1]" title={p.name}>
              <span className="truncate text-[15px]">{shortName(p.name)}</span>
              <span className="shrink-0 text-[14px] text-[#55604F]">≈{formatKg(p.co2e_kg, lang)} kg</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AiBuyer() {
  const { lang } = useI18n();
  const L3 = tri(lang);
  const st = useShopText();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("co2");
  const [budget, setBudget] = useState("");
  const [old, setOld] = useState(null);
  const [steps, setSteps] = useState({});
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const stepsRef = useRef(null);

  const catLabel = (slug) => { const l = st(`cat.${slug}`); return l === `cat.${slug}` ? slug : l; };
  const run = async () => {
    if (running) return;
    setRunning(true); setResult(null); setSteps({});
    stepsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const pace = () => new Promise((r) => setTimeout(r, 450));   // let each step be seen
    const r = await planPurchase(
      { query, category, priority, maxPrice: budget ? Number(budget) : null, old },
      {
        search: async (p) => { await pace(); const d = await api.search(p); return { ...d, items: normalizeList(d?.items) }; },
        getCo2: (id) => api.getProductCo2(id),
        createOrder: async (b) => { await pace(); return api.createTestOrder(b); },
      },
      (step, state, detail) => setSteps((s) => ({ ...s, [step]: { state, ...detail } })),
    );
    setResult(r);
    setRunning(false);
  };

  const k = (v) => formatKg(v, lang);
  const titles = {
    search: L3("Tìm sản phẩm", "Find products", "Trouver des produits"),
    compare: L3("So sánh giá và CO₂", "Compare price and CO₂", "Comparer prix et CO₂"),
    tradein: L3("Tính CO₂ giảm khi bán máy cũ", "Work out the trade-in saving", "Calculer l'économie de la reprise"),
    order: L3("Tạo đơn thử", "Prepare a test order", "Préparer une commande test"),
    approve: L3("Chờ bạn duyệt thanh toán", "Wait for your approval", "Attendre votre accord"),
  };
  const detail = (step) => {
    const s = steps[step];
    if (!s) return null;
    if (s.state === "running") return step === "approve" ? null : L3("Đang làm…", "Working…", "En cours…");
    if (s.state === "skipped") return L3("Bỏ qua: bạn chưa nhập máy cũ.", "Skipped: no old device given.", "Ignoré : pas d'ancien appareil.");
    if (s.state === "failed") {
      return s.reason === "none" ? L3("Không có sản phẩm nào khớp (có giá và có số CO₂). Thử bỏ bớt điều kiện hoặc nới ngân sách.", "Nothing matches (with a price and a CO₂ figure). Remove a condition or raise the budget.", "Rien ne correspond. Retirez une condition ou augmentez le budget.")
        : s.reason === "order_failed" ? L3("Chưa tạo được đơn thử. Thử lại sau.", "The test order could not be created. Try again later.", "La commande test n'a pas pu être créée.")
        : L3("Tìm kiếm đang tạm gián đoạn.", "Search is unavailable right now.", "Recherche indisponible.");
    }
    if (step === "search") return L3(`${formatNum(s.total, lang, 0)} sản phẩm có giá và số CO₂ khớp yêu cầu.`, `${formatNum(s.total, lang, 0)} products with a price and a CO₂ figure match.`, `${formatNum(s.total, lang, 0)} produits correspondent.`);
    if (step === "compare") return null;
    if (step === "tradein") {
      const t = s.trade;
      return t ? L3(`Bán lại ${s.old.name} (≈${k(s.old.kg)} kg) giúp tránh ≈${k(t.resaleCredit)} kg CO₂e; tính theo cùng công thức trang Thu cũ đổi mới.`,
                    `Reselling ${s.old.name} (≈${k(s.old.kg)} kg) avoids ≈${k(t.resaleCredit)} kg CO₂e, with the same formula as the Trade-in page.`,
                    `Revendre ${s.old.name} évite ≈${k(t.resaleCredit)} kg CO₂e.`) : null;
    }
    if (step === "order") return L3("Đơn thử đã sẵn sàng, chưa trừ tiền.", "The test order is ready; nothing is charged.", "La commande test est prête ; rien n'est débité.");
    return null;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="rounded-[22px] border border-[#E8E4D8] bg-white p-6" aria-labelledby="want">
          <p id="want" className={kicker}>{L3("Bạn muốn AI mua gì?", "What should the AI buy?", "Que doit acheter l'IA ?")}</p>
          <label className={label}>{L3("Gõ điều bạn cần", "Type what you need", "Ce dont vous avez besoin")}
            <input value={query} onChange={(e) => setQuery(e.target.value)} className={input}
                   placeholder={L3("Ví dụ: macbook, tai nghe, iphone…", "e.g. macbook, headphones, iphone…", "ex. macbook, casque, iphone…")} />
          </label>
          <p className={label}>{L3("Loại thiết bị", "Device type", "Type d'appareil")}</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group">
            <button type="button" className={chip(!category)} aria-pressed={!category} onClick={() => setCategory("")}>{L3("Tất cả", "All", "Tout")}</button>
            {DEVICE_SLUGS.map((s) => <button key={s} type="button" className={chip(category === s)} aria-pressed={category === s} onClick={() => setCategory(s)}>{catLabel(s)}</button>)}
          </div>
          <p className={label}>{L3("Ưu tiên", "Priority", "Priorité")}</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group">
            <button type="button" className={chip(priority === "co2")} aria-pressed={priority === "co2"} onClick={() => setPriority("co2")}>{L3("CO₂ thấp nhất", "Lowest CO₂", "CO₂ le plus bas")}</button>
            <button type="button" className={chip(priority === "price")} aria-pressed={priority === "price"} onClick={() => setPriority("price")}>{L3("Giá thấp nhất", "Lowest price", "Prix le plus bas")}</button>
          </div>
          <label className={label}>{L3("Ngân sách", "Budget", "Budget")}
            <select value={budget} onChange={(e) => setBudget(e.target.value)} className={`${input} pr-3`}>
              {BUDGETS.map((b) => <option key={String(b)} value={b ?? ""}>{b ? L3(`Dưới ${b / 1e6} triệu`, `Under ${b / 1e6} million ₫`, `Moins de ${b / 1e6} millions ₫`) : L3("Mọi mức giá", "Any price", "Tous les prix")}</option>)}
            </select>
          </label>
        </section>
        <section className="rounded-[22px] border border-[#E8E4D8] bg-white p-6" aria-labelledby="old">
          <p id="old" className={kicker}>{L3("Máy cũ của bạn (tùy chọn)", "Your old device (optional)", "Votre ancien appareil (facultatif)")}</p>
          <p className={label}>{L3("Tìm máy hoặc loại máy của bạn", "Find your device or its type", "Cherchez votre appareil ou son type")}</p>
          <OldDevice value={old} onChange={setOld} />
          <p className="mt-4 text-[15px] leading-relaxed text-[#55604F]">{L3("Có máy cũ thì AI tính thêm mức CO₂ giảm khi bạn bán lại.", "With an old device, the AI also works out the CO₂ saved by reselling it.", "Avec un ancien appareil, l'IA calcule aussi le CO₂ évité en le revendant.")}</p>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[15px] text-[#55604F]">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
          {L3("Thanh toán luôn cần bạn duyệt. Đơn thử, không thu tiền thật.", "Paying always needs your approval. Test orders, no real payment.", "Le paiement exige toujours votre accord. Commandes test.")}
        </p>
        <button type="button" onClick={run} disabled={running}
                className="h-[52px] rounded-[14px] bg-[#1B4332] px-7 text-[16.5px] font-semibold text-white hover:bg-[#143D26] disabled:cursor-wait disabled:opacity-60">
          {running ? L3("AI đang làm…", "The AI is working…", "L'IA travaille…") : L3("Giao cho AI", "Hand it to the AI", "Confier à l'IA")}
        </button>
      </div>

      <section ref={stepsRef} className="scroll-mt-24 rounded-[22px] border border-[#E8E4D8] bg-white p-6" aria-live="polite" aria-label={L3("Các bước của AI", "The AI's steps", "Les étapes de l'IA")}>
        <ol className="flex flex-col">
          {STEPS.map((step, i) => {
            const s = steps[step];
            const state = s?.state;
            const on = state === "done" || (step === "approve" && state === "running");
            return (
              <li key={step} className="relative flex gap-4 pb-5 last:pb-0">
                {i < STEPS.length - 1 && <span aria-hidden="true" className="absolute left-[17px] top-10 bottom-0 border-l-2 border-[#E1DCCD]" />}
                <span className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 text-[15px] font-semibold ${
                  state === "failed" ? "border-[#b42318] bg-[#FDECEA] text-[#b42318]"
                    : on ? "border-[#1B4332] bg-[#1B4332] text-white"
                    : state === "running" ? "animate-pulse border-[#2E7D4F] bg-[#E4F0E6] text-[#1B4332]"
                    : "border-[#D6D0C0] bg-white text-[#8A9186]"}`}>
                  {state === "done" ? <Icon name="check" size={16} /> : state === "failed" ? "!" : i + 1}
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <p className={`text-[17px] font-semibold ${state ? "text-[#1E2B22]" : "text-[#8A9186]"}`}>{titles[step]}</p>
                  {detail(step) && <p className={`mt-0.5 text-[14.5px] ${state === "failed" ? "text-[#b42318]" : "text-[#55604F]"}`}>{detail(step)}</p>}
                  {step === "compare" && state === "done" && (
                    <ul className="mt-2 grid gap-2 sm:grid-cols-3">
                      {s.shortlist.map((p) => {
                        const pick = p.product_id === s.pick.product_id;
                        return (
                          <li key={p.product_id} className={`flex items-center gap-3 rounded-[14px] border p-2.5 ${pick ? "border-2 border-[#2E7D4F]" : "border-[#E6E2D6]"}`}>
                            <span className="h-14 w-16 shrink-0 overflow-hidden rounded-[10px] bg-[#F3EFE4]"><ProductThumb product={p} className="h-full w-full" rounded="rounded-[10px]" standIn={false} tone="find" /></span>
                            <span className="min-w-0">
                              {pick && <span className="mb-0.5 inline-block rounded bg-[#1B4332] px-1.5 text-[11.5px] font-semibold text-white">{L3("AI chọn", "AI's pick", "Choix de l'IA")}</span>}
                              <span className="block truncate text-[14.5px] font-semibold" title={p.name}>{shortName(p.name)}</span>
                              <span className="block text-[13px] text-[#55604F]">≈{k(p.co2e_kg)} kg · {formatPrice(p.price_vnd, lang)}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {step === "compare" && state === "done" && result?.rec && result.rec.best.product_id === s.pick.product_id && result.rec.co2.diff > 0 && (
                    <p className="mt-2 text-[14.5px] text-[#55604F]">
                      {L3(`Chọn ${shortName(s.pick.name)}: ít hơn ${k(result.rec.co2.diff)} kg CO₂e (${formatNum(result.rec.co2.pct, lang, 1)} %) so với ${shortName(result.rec.runner.name)}.`,
                          `${shortName(s.pick.name)}: ${k(result.rec.co2.diff)} kg CO₂e less (${formatNum(result.rec.co2.pct, lang, 1)} %) than ${shortName(result.rec.runner.name)}.`,
                          `${shortName(s.pick.name)} : ${k(result.rec.co2.diff)} kg CO₂e de moins que ${shortName(result.rec.runner.name)}.`)}
                    </p>
                  )}
                  {step === "approve" && state === "running" && s.order && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 rounded-[14px] bg-[#F3F8F1] p-3">
                      <p className="flex-1 text-[14.5px] text-[#1E2B22]">
                        {L3("Đơn thử đang chờ bạn. Mở đơn để xem lại và bấm xác nhận; AI không tự xác nhận và không trừ tiền.",
                            "The test order waits for you. Open it to review and confirm; the AI cannot confirm it and nothing is charged.",
                            "La commande test vous attend ; l'IA ne peut pas la confirmer.")}
                      </p>
                      <Link to={`/orders/${encodeURIComponent(s.order.id)}`} className="inline-flex h-11 items-center rounded-[12px] bg-[#1B4332] px-5 text-[15px] font-semibold text-white hover:bg-[#143D26]">
                        {L3("Xem và duyệt đơn", "Review and approve", "Voir et approuver")}
                      </Link>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
