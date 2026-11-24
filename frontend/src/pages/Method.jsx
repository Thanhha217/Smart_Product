// /method — how a CO₂ number is worked out: four sources tried from the top, the first that works
// gives the figure. Try it with a real product (its real path and numbers from the API), the general
// formula, a product with a published figure, one averaged from similar products, the "no data"
// illustration, or your own numbers. Under it: the full calculation, the essentials and the
// technical details (formulas, tests, limits).
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { tri, useI18n } from "../i18n/LanguageContext";
import { METHOD, METHOD_EXTRA, NOT_IN_CATALOGUE, RESULT_SOURCE } from "../i18n/method";
import { explore } from "../i18n/explore";
import { api } from "../api/client";
import { searchCategory } from "../lib/categories";
import { normalizeList } from "../lib/data";
import { formatKg } from "../lib/format";
import { useRecent } from "../lib/recent";
import { shortName } from "../lib/shortName";
import Co2Explainer from "./components/co2/Co2Explainer";
import MethodLadder, { FBadge } from "./components/co2/MethodLadder";
import LifecycleJourney from "./components/co2/LifecycleJourney";
import AskAiDock from "./components/find/AskAiDock";
import DeviceIcon from "./components/ui/DeviceIcon";
import ProductThumb from "./components/common/ProductThumb";
import { ErrorState, InlineSpinner } from "./components/common/States";

const CASES = ["formula", "example", "published", "similar", "none"];

/** Pick which real product the page walks through. */
function ProductPicker({ options, current, onPick, lang }) {
  const L3 = tri(lang);
  if (!options.length) return null;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={L3("Chọn sản phẩm làm ví dụ", "Choose the example product", "Choisir le produit exemple")}>
      {options.map((p) => {
        const on = p.product_id === current;
        return (
          <button key={p.product_id} type="button" onClick={() => onPick(p.product_id)} aria-pressed={on}
                  className={`flex max-w-[260px] items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition ${on ? "border-[#2E7D4F] bg-[#F7FBF6] shadow-sm" : "border-[#EFEBDF] bg-white hover:border-[#2E7D4F]"}`}>
            <ProductThumb product={p} size={36} standIn={false} />
            <span className="min-w-0">
              <span className="line-clamp-1 block text-[14px] font-semibold text-[#1E2B22]">{p.name}</span>
              <span className="block text-[13px] text-[#6B7468]">{p.co2e_kg !== null ? `${formatKg(p.co2e_kg, lang)} kg CO₂e` : L3("chưa có số", "no figure", "pas de chiffre")}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A real product whose figure came from `source`, preferably in the same category as the example. */
async function sampleOf(source, category) {
  const ask = (params) => api.search({ co2_source: source, has_co2: true, sort: "complete", page_size: 1, ...params }).then((r) => normalizeList(r?.items)[0] || null);
  const slug = searchCategory(category);
  return (slug && await ask({ category: slug }).catch(() => null)) || ask({}).catch(() => null);
}

export default function Method() {
  const { lang, t } = useI18n();
  const L3 = tri(lang);
  const m = METHOD[lang] || METHOD.en;
  const x = METHOD_EXTRA[lang] || METHOD_EXTRA.en;
  const X = explore(lang);
  const recent = useRecent();
  const [params, setParams] = useSearchParams();

  const [options, setOptions] = useState([]);
  const [chosen, setChosen] = useState(params.get("product") || null);
  const [scenario, setScenario] = useState(CASES.includes(params.get("case")) ? params.get("case") : "example");
  const [data, setData] = useState({ example: null, published: null, similar: null });
  const [failed, setFailed] = useState(false);
  const [picking, setPicking] = useState(false);
  const [running, setRunning] = useState(false);
  const [ownOpen, setOwnOpen] = useState(false);
  const [own, setOwn] = useState({ pub: "", refs: "", med: "" });
  const [custom, setCustom] = useState(null);
  const [askOpen, setAskOpen] = useState(false);

  // the example choices: what the visitor just looked at, plus the greenest product of each category
  useEffect(() => {
    let alive = true;
    api.getOverview()
      .then((o) => {
        if (!alive) return;
        const all = [...recent.slice(0, 2), ...normalizeList((o?.greenest || []).map((g) => g.product))];
        const seen = new Set();
        setOptions(all.filter((p) => p && !seen.has(p.product_id) && seen.add(p.product_id)).slice(0, 5));
      })
      .catch(() => alive && setOptions(recent.slice(0, 3)));
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!chosen && options.length) setChosen(options[0].product_id); }, [options, chosen]);

  // the example, then a real "published" and a real "similar products" case from the same category
  useEffect(() => {
    let alive = true;
    if (!chosen) return undefined;
    setData({ example: null, published: null, similar: null });
    setFailed(false);
    api.getProductCo2(chosen)
      .then(async (example) => {
        if (!alive) return;
        setData((d) => ({ ...d, example }));
        const cat = example?.product?.category;
        const [pub, sim] = await Promise.all([sampleOf("manufacturer", cat), sampleOf("neighbor_average", cat)]);
        const [published, similar] = await Promise.all([
          pub ? api.getProductCo2(pub.product_id).catch(() => null) : null,
          sim ? api.getProductCo2(sim.product_id).catch(() => null) : null,
        ]);
        if (alive) setData((d) => ({ ...d, published, similar }));
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [chosen]);

  const syncUrl = (patch) => {
    const next = new URLSearchParams(window.location.search);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };
  const choose = (sc) => { setRunning(false); setScenario(sc); syncUrl({ case: sc === "example" || sc === "custom" ? null : sc }); };
  const pick = (id) => { setChosen(id); setRunning(false); setScenario("example"); syncUrl({ product: id, case: null }); };

  const viewed = scenario === "example" ? data.example : scenario === "published" ? data.published : scenario === "similar" ? data.similar : null;
  const product = viewed?.product;
  const exampleName = data.example?.product?.name;
  const ladderReady = scenario === "formula" || scenario === "none" || (scenario === "custom" && custom) || viewed;
  const seeCalc = () => document.getElementById("calc")?.scrollIntoView({ behavior: "smooth" });
  const toLadder = () => document.getElementById("ladder")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const chip = (on) => `inline-flex h-[42px] items-center gap-2 rounded-full border px-4 text-[15.5px] font-medium transition disabled:opacity-50 ${on ? "border-[#1B4332] bg-[#1B4332] text-white" : "border-[#DCD7C9] bg-white text-[#1E2B22] hover:border-[#2E7D4F]"}`;
  const input = "h-11 w-full rounded-[12px] border border-[#DCD7C9] bg-white px-3 text-[15px] focus:border-[#2E7D4F] focus:outline-none";

  const viewLabel = scenario === "formula" ? L3("Công thức chung", "The general formula", "La formule générale")
    : scenario === "none" ? L3("Minh họa: không có dữ liệu", "Illustration: no data", "Illustration : aucune donnée")
    : scenario === "custom" ? L3("Số liệu của bạn", "Your own numbers", "Vos propres chiffres")
    : product?.name || "…";

  return (
    <main className="page-wrap flex max-w-[1180px] flex-col gap-7 py-7 pb-28">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-[660px]">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#2E7D4F]">{L3("CO₂ method", "CO₂ method", "Méthode CO₂")}</p>
          <h1 className="mt-2 max-w-[500px] font-display text-[38px] font-semibold leading-[1.1] text-[#1E2B22] sm:text-[48px]">
            {L3("Một con số CO₂ được tính như thế nào", "How a CO₂ number is worked out", "Comment un chiffre CO₂ est calculé")}
          </h1>
          <p className="mt-3 text-[17.5px] leading-relaxed text-[#55604F]">
            {L3("Bốn nguồn, thử lần lượt từ trên xuống. Dừng ở nguồn đầu tiên dùng được. Bậc càng cao, con số càng đáng tin. Không bao giờ đoán.",
                "Four sources, tried from the top. We stop at the first one that works. The higher the rung, the more we trust the number. Nothing is ever guessed.",
                "Quatre sources, essayées du haut vers le bas. On s'arrête à la première qui fonctionne. Plus l'échelon est haut, plus le chiffre est fiable. Rien n'est deviné.")}
          </p>
          <button type="button" onClick={() => { choose("formula"); toLadder(); }}
                  className="mt-4 inline-flex h-[42px] items-center gap-2 rounded-full border border-[#2E7D4F] bg-[#EEF5EF] px-4 text-[15.5px] font-medium text-[#1B4332] hover:bg-[#E3F0E5]">
            <FBadge />{L3("Xem công thức chung", "See the general formula", "Voir la formule générale")}
          </button>
        </div>
        <div className="relative min-w-0 max-w-full">
          <div className="flex items-center gap-3 rounded-[18px] border border-[#E8E4D8] bg-white px-3 py-3 shadow-sm">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#EEF1EC] text-[#33403A]">
              {scenario === "formula" ? <FBadge /> : scenario === "none" ? <span className="font-display text-[20px]">∅</span>
                : <DeviceIcon name={product?.category || data.example?.product?.category || "other"} size={22} tint={false} />}
            </span>
            <div className="min-w-0 max-w-[230px] flex-1">
              <p className="text-[13px] text-[#6B7468]">{L3("Ví dụ đang xem", "Now showing", "Exemple affiché")}</p>
              <p className="truncate text-[15.5px] font-semibold text-[#1E2B22]" title={product?.name}>{viewLabel}</p>
            </div>
            <button type="button" onClick={() => setPicking(!picking)} aria-expanded={picking}
                    className="shrink-0 rounded-full border border-[#1B4332] px-4 py-2 text-[15px] font-semibold text-[#1B4332] hover:bg-[#F3F8F1]">
              {L3("Đổi", "Change", "Changer")}
            </button>
          </div>
          {picking && (
            <div className="absolute right-0 z-30 mt-2 w-[min(92vw,560px)] rounded-2xl border border-[#E8E4D8] bg-white p-3 shadow-xl">
              <p className="px-1 pb-2 text-[14px] text-[#6B7468]">{L3("Sản phẩm thật trong dữ liệu.", "Real products from the catalogue.", "Des produits réels du catalogue.")}</p>
              {options.length === 0
                ? <InlineSpinner label={L3("Đang tải sản phẩm", "Loading products", "Chargement des produits")} />
                : <ProductPicker options={options} current={chosen} onPick={(id) => { pick(id); setPicking(false); }} lang={lang} />}
            </div>
          )}
        </div>
      </header>

      <section className="rounded-[22px] border border-[#E6E2D6] bg-white p-5" aria-labelledby="try">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 id="try" className="mr-1 text-[18px] font-semibold text-[#1E2B22]">{L3("Thử với sản phẩm của bạn", "Try it with your product", "Essayez avec votre produit")}</h2>
          <button type="button" onClick={() => choose("formula")} aria-pressed={scenario === "formula"}
                  className={`inline-flex h-[42px] items-center gap-2 rounded-full border px-3.5 text-[15.5px] font-medium transition ${scenario === "formula" ? "border-[#1B4332] bg-[#1B4332] text-white" : "border-[#2E7D4F] bg-[#EEF5EF] text-[#1B4332] hover:bg-[#E3F0E5]"}`}>
            <FBadge dark={scenario === "formula"} />{L3("Công thức", "Formula", "Formule")}
          </button>
          <button type="button" onClick={() => choose("example")} aria-pressed={scenario === "example"} className={chip(scenario === "example")} disabled={!data.example}>
            {exampleName ? `${shortName(exampleName, 3)} ${L3("(ví dụ thật)", "(real example)", "(exemple réel)")}` : "…"}
          </button>
          <button type="button" onClick={() => choose("published")} aria-pressed={scenario === "published"} className={chip(scenario === "published")} disabled={!data.published}
                  title={data.published?.product?.name}>{L3("Có số công bố", "Published figure", "Chiffre publié")}</button>
          <button type="button" onClick={() => choose("similar")} aria-pressed={scenario === "similar"} className={chip(scenario === "similar")} disabled={!data.similar}
                  title={data.similar?.product?.name}>{L3("Có sản phẩm tương tự", "Similar products", "Produits similaires")}</button>
          <button type="button" onClick={() => choose("none")} aria-pressed={scenario === "none"} className={chip(scenario === "none")}>
            {L3("Không có dữ liệu", "No data", "Aucune donnée")}
          </button>
          {custom && (
            <button type="button" onClick={() => choose("custom")} aria-pressed={scenario === "custom"} className={chip(scenario === "custom")}>
              {L3("Số của bạn", "Your numbers", "Vos chiffres")}
            </button>
          )}
          <button type="button" onClick={() => { setRunning(false); setTimeout(() => setRunning(true), 0); toLadder(); }} disabled={running || !ladderReady || scenario === "formula"}
                  className="ml-auto inline-flex h-[44px] items-center gap-2 rounded-[12px] bg-[#1B4332] px-5 text-[15.5px] font-semibold text-white hover:bg-[#143D26] disabled:cursor-not-allowed disabled:opacity-50">
            <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2v12L14 8z" fill="currentColor" /></svg>
            {running ? L3("Đang chạy…", "Running…", "En cours…") : L3("Chạy minh họa", "Run the demo", "Lancer la démo")}
          </button>
        </div>
        <button type="button" onClick={() => setOwnOpen(!ownOpen)} aria-expanded={ownOpen}
                className="mt-4 text-[15px] font-semibold text-[#1B4332] hover:underline">
          {L3("Nhập số liệu của riêng bạn", "Enter your own numbers", "Saisir vos propres chiffres")} {ownOpen ? "▴" : ""}
        </button>
        {ownOpen && (
          <form className="mt-3 grid gap-3 md:grid-cols-[1fr_1.4fr_1fr_auto] md:items-end"
                onSubmit={(e) => { e.preventDefault(); setCustom({ ...own }); setRunning(false); setScenario("custom"); syncUrl({ case: null }); }}>
            <label className="text-[13.5px] text-[#55604F]">{L3("1 · Số hãng công bố (kg)", "1 · Published figure (kg)", "1 · Chiffre publié (kg)")}
              <input className={`${input} mt-1`} inputMode="decimal" value={own.pub} onChange={(e) => setOwn({ ...own, pub: e.target.value })} placeholder={L3("để trống nếu không có", "leave empty if none", "vide si aucun")} />
            </label>
            <label className="text-[13.5px] text-[#55604F]">{L3("2 · CO₂ sản phẩm giống (kg, tối đa 5)", "2 · CO₂ of similar products (kg, up to 5)", "2 · CO₂ de produits proches (kg, 5 max)")}
              <input className={`${input} mt-1`} value={own.refs} onChange={(e) => setOwn({ ...own, refs: e.target.value })} placeholder={L3("VD: 11; 13,5; 9", "e.g. 11; 13.5; 9", "ex. 11 ; 13,5 ; 9")} />
            </label>
            <label className="text-[13.5px] text-[#55604F]">{L3("3 · Trung vị danh mục (kg)", "3 · Category median (kg)", "3 · Médiane de catégorie (kg)")}
              <input className={`${input} mt-1`} inputMode="decimal" value={own.med} onChange={(e) => setOwn({ ...own, med: e.target.value })} placeholder="6,8" />
            </label>
            <button type="submit" className="h-11 rounded-[12px] bg-[#1B4332] px-5 text-[15px] font-semibold text-white hover:bg-[#143D26]">
              {L3("Đi qua thang", "Run the ladder", "Parcourir l'échelle")}
            </button>
            <p className="text-[13px] text-[#6B7468] md:col-span-4">
              {L3("Cùng quy tắc với hệ thống: ô đầu tiên có số sẽ quyết định. Đây là minh họa, không phải số của sản phẩm nào; độ giống ≥ 0,66 do bạn tự bảo đảm.",
                  "The same rules as the system: the first box with a number decides. This is an illustration, not any product's figure; you vouch for the ≥ 0.66 similarity.",
                  "Mêmes règles que le système : la première case remplie décide. C'est une illustration ; la similarité ≥ 0,66 est à votre charge.")}
            </p>
          </form>
        )}
      </section>

      {failed && <ErrorState body={X.errorBody} onRetry={() => setChosen((c) => c)} />}

      <section id="ladder" className="scroll-mt-24" aria-label={L3("Thang phương pháp", "The method ladder", "L'échelle de la méthode")}>
        {ladderReady
          ? <MethodLadder co2={viewed} scenario={scenario} custom={custom} onSeeCalc={seeCalc} running={running} onRunEnd={() => setRunning(false)} />
          : !failed && <div className="h-[520px] animate-pulse rounded-3xl bg-[#F1EEE4]" />}
      </section>

      {viewed && typeof product?.co2e_kg === "number" && (
        <section id="calc" className="grid scroll-mt-24 items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div>
            <h2 className="font-display text-[24px] font-semibold text-[#1E2B22]">{L3("Phép tính đầy đủ", "The full calculation", "Le calcul complet")}</h2>
            <p className="mb-3 text-[15px] text-[#55604F]">{L3("Nguồn dữ liệu, các giá trị đầu vào, phép thay số và giới hạn.", "The data source, the input values, the substitution and the limits.", "La source, les valeurs utilisées, la substitution et les limites.")}</p>
            <Co2Explainer co2={viewed} open compact />
          </div>
          <div>
            <h2 className="font-display text-[24px] font-semibold text-[#1E2B22]">{L3("Con số trải qua vòng đời", "Across the lifecycle", "Sur le cycle de vie")}</h2>
            <p className="mb-3 text-[15px] text-[#55604F]">{L3("Mỗi giai đoạn là gì, vì sao phát thải và bạn làm được gì.", "What each stage is, why it emits and what you can do.", "Ce qu'est chaque étape, pourquoi elle émet et ce que vous pouvez faire.")}</p>
            <LifecycleJourney lifecycle={viewed.lifecycle} compact />
          </div>
        </section>
      )}

      <section aria-labelledby="basics">
        <h2 id="basics" className="font-display text-[26px] font-semibold text-[#1E2B22]">{x.basicTitle}</h2>
        <dl className="mt-3 grid gap-3 md:grid-cols-2">
          {x.basics.map(([q, a]) => (
            <div key={q} className="rounded-[18px] border border-[#E8E4D8] bg-white p-5">
              <dt className="text-[16.5px] font-semibold text-[#1E2B22]">{q}</dt>
              <dd className="mt-1.5 text-[15.5px] leading-relaxed text-[#374151]">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="tech" className="flex flex-col gap-3">
        <div>
          <h2 id="tech" className="font-display text-[26px] font-semibold text-[#1E2B22]">{x.techTitle}</h2>
          <p className="text-[15.5px] text-[#55604F]">{x.techLead}</p>
        </div>
        <ul className="divide-y divide-[#EFEBDF] rounded-[20px] border border-[#E8E4D8] bg-white">
          {m.methods.map((mm) => (
            <li key={mm.key} className="flex flex-col gap-2 p-5">
              <p className="flex flex-wrap items-center gap-2">
                <b className="text-[16.5px] text-[#1E2B22]">{mm.name}</b>
                <code className="rounded-full bg-[#EEF4EC] px-2.5 py-0.5 text-[13px] text-[#1F5D3A]">{mm.label}</code>
                {NOT_IN_CATALOGUE.includes(mm.key) && <span className="rounded-full bg-[#FBEFD3] px-2.5 py-0.5 text-[12.5px] text-[#8A5A00]">{x.notUsed}</span>}
              </p>
              <p className="overflow-x-auto rounded-[10px] bg-[#F6F3EA] px-3 py-2 font-mono text-[14px]">{mm.formula}</p>
              <p className="text-[15px] text-[#374151]"><span className="font-semibold">{t("method.when")}:</span> {mm.when}</p>
              <p className="text-[14.5px] text-[#55604F]"><span className="font-semibold">{t("method.example")}:</span> {mm.example}</p>
              <p className="text-[14.5px] text-[#1F5D3A]"><span className="font-semibold">{t("method.accuracy")}:</span> {mm.accuracy}</p>
            </li>
          ))}
          <li className="flex flex-col gap-2 p-5">
            <b className="text-[16.5px] text-[#1E2B22]">{m.useTitle}</b>
            <p className="overflow-x-auto rounded-[10px] bg-[#F6F3EA] px-3 py-2 font-mono text-[14px]">{m.greenScore}</p>
            <p className="overflow-x-auto rounded-[10px] bg-[#F6F3EA] px-3 py-2 font-mono text-[14px]">{m.rrf}</p>
            <p className="text-[15px] text-[#55604F]">{m.rrfNote}</p>
            <p className="text-[15px] text-[#55604F]">{m.gridNote}</p>
          </li>
          <li className="flex flex-col gap-2 p-5">
            <b className="text-[16.5px] text-[#1E2B22]">{m.resultsTitle}</b>
            <div className="overflow-x-auto">
              <table className="min-w-full text-[14.5px]">
                <thead>
                  <tr className="bg-[#F6F3EA] text-left">{[...m.resultsHead, x.sourceCol].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {m.results.map((row, r) => (
                    <tr key={row[0]} className="border-t border-[#EFECE2] align-top">
                      {row.map((cell, i) => <td key={i} className={`px-3 py-2 ${i === 0 ? "font-semibold" : ""}`}>{cell}</td>)}
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[13px] ${RESULT_SOURCE[r] === "repo" ? "bg-[#DCEFE0] text-[#1F5D3A]" : "bg-[#F3F4F6] text-[#4B5563]"}`}>{RESULT_SOURCE[r] === "repo" ? x.fromRepo : x.fromDoc}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </li>
          <li className="flex flex-col gap-2 p-5">
            <b className="text-[16.5px] text-[#1E2B22]">{m.limitsTitle}</b>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] text-[#374151]">{m.limits.map((l) => <li key={l}>{l}</li>)}</ul>
          </li>
        </ul>
      </section>

      <p className="flex flex-wrap gap-3">
        <Link to={chosen ? `/world/${chosen}` : "/world"} className="btn-primary">{X.eyebrow}</Link>
        <Link to="/search" className="btn-secondary">{X.linkSearch}</Link>
      </p>

      <AskAiDock open={askOpen} onOpen={() => setAskOpen(true)} onClose={() => setAskOpen(false)} />
    </main>
  );
}
