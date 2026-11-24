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
import { shortName, variantOf } from "../../../lib/shortName";
import { fold } from "../../../lib/deviceMatch";
import ProductThumb from "../common/ProductThumb";
import DevicePicker from "../common/DevicePicker";
import Icon from "../ui/Icon";

const kicker = "text-[13px] font-bold uppercase tracking-[0.12em] text-[#2E7D4F]";
const label = "mt-4 block text-[15px] font-semibold text-[#1E2B22]";
const input = "mt-1.5 h-12 w-full rounded-[12px] border border-[#DCD7C9] bg-white px-4 text-[16px] text-[#1E2B22] placeholder:text-[#8A9186] focus:border-[#2E7D4F] focus:outline-none";
const chip = (on) => `h-[44px] rounded-full border px-4 text-[15.5px] font-medium transition ${on ? "border-[#1B4332] bg-[#1B4332] text-white" : "border-[#DCD7C9] bg-white text-[#1E2B22] hover:border-[#2E7D4F]"}`;

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

  // what the search understands from the words, refreshed while typing; it fills the choices below
  const [hint, setHint] = useState({ q: "", total: null, items: [], understood: null, loading: false });
  const applied = useRef({});
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setHint({ q, total: null, items: [], understood: null, loading: false }); applied.current = {}; return undefined; }
    const ctrl = new AbortController();
    setHint((h) => ({ ...h, loading: true }));
    const t = setTimeout(() => {
      api.search({ q, has_price: true, has_co2: true, sort: priority === "price" ? "price_asc" : "co2_asc", page_size: 3 }, { signal: ctrl.signal })
        .then((d) => {
          const und = d?.understood || {};
          const cheapWords = /(^| )(re|gia re|gia thap|re nhat|cheap|cheapest|budget|pas cher)( |$)/.test(fold(q));
          setHint({ q, total: typeof d?.total === "number" ? d.total : null, items: normalizeList(d?.items), understood: und, cheap: cheapWords, loading: false });
          // fill a choice only when the words changed it, so a later tap on a chip is not overridden;
          // when the words no longer say it, a choice the words had made is undone
          if (und.category && und.category !== applied.current.category) { applied.current.category = und.category; setCategory(und.category); }
          else if (!und.category && applied.current.category) { const was = applied.current.category; applied.current.category = undefined; setCategory((c) => (c === was ? "" : c)); }
          if (und.max_price && und.max_price !== applied.current.max) { applied.current.max = und.max_price; setBudget(String(und.max_price)); }
          else if (!und.max_price && applied.current.max) { const was = String(applied.current.max); applied.current.max = undefined; setBudget((b) => (b === was ? "" : b)); }
          if (und.eco && !applied.current.eco) { applied.current.eco = true; setPriority("co2"); }
          const cheap = /(^| )(re|gia re|gia thap|re nhat|cheap|cheapest|budget|pas cher)( |$)/.test(fold(q));
          if (cheap && !applied.current.cheap) { applied.current.cheap = true; setPriority("price"); }
          else if (!cheap && applied.current.cheap) { applied.current.cheap = false; setPriority("co2"); }
          if (!und.eco) applied.current.eco = false;
        })
        .catch((e) => { if (e?.code !== "cancelled" && e?.name !== "AbortError") setHint((h) => ({ ...h, loading: false })); });
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps
  const budgetOptions = BUDGETS.includes(budget ? Number(budget) : null) || !budget ? BUDGETS : [...BUDGETS, Number(budget)].sort((a, b) => (a ?? 0) - (b ?? 0));
  const millions = (v) => formatNum(v / 1e6, lang, v % 1e6 ? 1 : 0);

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
            <span className="relative mt-1.5 block">
              <Icon name="sparkles" size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#2E7D4F]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} className={`${input} !mt-0 pl-11`}
                     placeholder={L3("Ví dụ: laptop dưới 20 triệu ít CO₂, tai nghe rẻ, iphone…", "e.g. laptop under 20 million low CO₂, cheap headphones…", "ex. portable moins de 20 millions peu de CO₂…")} />
            </span>
          </label>
          {query.trim().length >= 2 && (
            <div className="mt-2 rounded-[14px] bg-[#F6F8F3] px-3.5 py-2.5 text-[14px] text-[#33403A]" aria-live="polite">
              {hint.loading && hint.total === null ? <span className="text-[#8A9186]">{L3("Đang hiểu yêu cầu…", "Reading your request…", "Lecture…")}</span> : (
                <>
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold">{L3("Đã hiểu:", "Understood:", "Compris :")}</span>
                    {hint.understood?.category && <span className="rounded-full bg-white px-2.5 py-0.5">{catLabel(hint.understood.category)}</span>}
                    {hint.understood?.brand && <span className="rounded-full bg-white px-2.5 py-0.5">{hint.understood.brand}</span>}
                    {hint.understood?.max_price && <span className="rounded-full bg-white px-2.5 py-0.5">{L3(`dưới ${millions(hint.understood.max_price)} triệu`, `under ${millions(hint.understood.max_price)} million ₫`, `moins de ${millions(hint.understood.max_price)} millions ₫`)}</span>}
                    {hint.understood?.eco && <span className="rounded-full bg-white px-2.5 py-0.5">{L3("CO₂ thấp", "low CO₂", "CO₂ bas")}</span>}
                    {hint.cheap && <span className="rounded-full bg-white px-2.5 py-0.5">{L3("giá thấp", "low price", "prix bas")}</span>}
                    {(hint.understood?.terms || []).map((term) => <span key={term} className="rounded-full bg-white px-2.5 py-0.5">“{term}”</span>)}
                    {hint.total !== null && <span className="ml-auto text-[#55604F]">{L3(`${formatNum(hint.total, lang, 0)} sản phẩm khớp`, `${formatNum(hint.total, lang, 0)} match`, `${formatNum(hint.total, lang, 0)} produits`)}</span>}
                  </p>
                  {hint.items.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1">
                      {hint.items.map((p, i, all) => {
                        // look-alike names show their configuration, or the store when that is the only difference
                        const same = all.filter((x) => shortName(x.name) === shortName(p.name)).length > 1;
                        const label = same ? `${shortName(p.name)} · ${variantOf(p.name) || p.platform || ""}`.replace(/ · $/, "") : shortName(p.name);
                        return (
                        <li key={p.product_id} className="flex items-center justify-between gap-3">
                          <button type="button" onClick={() => setQuery(shortName(p.name))} className="min-w-0 truncate text-left hover:underline" title={p.name}>{label}</button>
                          <span className="shrink-0 text-[13px] text-[#55604F]">≈{formatKg(p.co2e_kg, lang)} kg · {formatPrice(p.price_vnd, lang)}</span>
                        </li>
                        );
                      })}
                    </ul>
                  )}
                  {hint.total === 0 && <p className="mt-1 text-[#92400e]">{L3("Chưa có sản phẩm khớp; thử bỏ bớt chữ.", "Nothing matches yet; try fewer words.", "Rien ne correspond ; moins de mots.")}</p>}
                </>
              )}
            </div>
          )}
          <p className={label}>{L3("Loại thiết bị", "Device type", "Type d'appareil")}</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group">
            <button type="button" className={chip(!category)} aria-pressed={!category} onClick={() => setCategory("")}>{L3("Tất cả", "All", "Tout")}</button>
            {[...DEVICE_SLUGS, ...(category && !DEVICE_SLUGS.includes(category) ? [category] : [])].map((s) => <button key={s} type="button" className={chip(category === s)} aria-pressed={category === s} onClick={() => setCategory(s)}>{catLabel(s)}</button>)}
          </div>
          <p className={label}>{L3("Ưu tiên", "Priority", "Priorité")}</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group">
            <button type="button" className={chip(priority === "co2")} aria-pressed={priority === "co2"} onClick={() => setPriority("co2")}>{L3("CO₂ thấp nhất", "Lowest CO₂", "CO₂ le plus bas")}</button>
            <button type="button" className={chip(priority === "price")} aria-pressed={priority === "price"} onClick={() => setPriority("price")}>{L3("Giá thấp nhất", "Lowest price", "Prix le plus bas")}</button>
          </div>
          <label className={label}>{L3("Ngân sách", "Budget", "Budget")}
            <select value={budget} onChange={(e) => setBudget(e.target.value)} className={`${input} pr-3`}>
              {budgetOptions.map((b) => <option key={String(b)} value={b ?? ""}>{b ? L3(`Dưới ${millions(b)} triệu`, `Under ${millions(b)} million ₫`, `Moins de ${millions(b)} millions ₫`) : L3("Mọi mức giá", "Any price", "Tous les prix")}</option>)}
            </select>
          </label>
        </section>
        <section className="rounded-[22px] border border-[#E8E4D8] bg-white p-6" aria-labelledby="old">
          <p id="old" className={kicker}>{L3("Máy cũ của bạn (tùy chọn)", "Your old device (optional)", "Votre ancien appareil (facultatif)")}</p>
          <p className={label}>{L3("Tìm máy hoặc loại máy của bạn", "Find your device or its type", "Cherchez votre appareil ou son type")}</p>
          <div className="mt-1.5">
            <DevicePicker value={old} onChange={(d) => setOld(d && d.kg != null ? d : d ? { ...d, kg: null } : null)}
                          placeholder={L3("Gõ vài chữ: laptop, iPhone 12, Dell XPS…", "Type a few letters: laptop, iPhone 12, Dell XPS…", "Tapez : portable, iPhone 12, Dell XPS…")} />
          </div>
          {old?.kind === "typed" && (
            <p className="mt-2 text-[14px] text-[#92400e]">{L3("Máy này chưa có số CO₂ nên AI sẽ bỏ qua bước bán lại. Hãy chọn một loại máy trong danh sách để dùng trung vị.",
              "This device has no CO₂ figure, so the AI skips the resale step. Pick a type from the list to use its median.",
              "Pas de chiffre CO₂ : l'IA ignore la revente. Choisissez un type pour sa médiane.")}</p>
          )}
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
