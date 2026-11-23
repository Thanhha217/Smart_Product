// Right panel of the CO2 world: three everyday choices that close the loop, the AI's short
// buying insight for this product (POST /api/explain, topic "insight") and the circular loop.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../api/client";
import { tri } from "../../../i18n/LanguageContext";
import { formatKg } from "../../../lib/format";
import { simulate } from "./worldModel";

function Option({ icon, title, sub, onClick, open, children, to }) {
  const cls = "w-full flex items-center gap-3 rounded-2xl bg-white border border-[#DCEBD9] px-3 py-2 text-left shadow-sm hover:border-[#2E7D4F] hover:shadow transition";
  const body = (
    <>
      <span className="text-[22px] leading-none" aria-hidden="true">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15.5px] font-bold text-[#16324a]">{title}</span>
        {sub && <span className="block text-[13px] text-[#4b5563] truncate">{sub}</span>}
      </span>
      <span className={`text-[#2E7D4F] text-lg transition ${open ? "rotate-90" : ""}`} aria-hidden="true">›</span>
    </>
  );
  return (
    <div>
      {to ? <Link to={to} className={cls}>{body}</Link>
          : <button type="button" onClick={onClick} aria-expanded={open ?? undefined} className={cls}>{body}</button>}
      {open && children}
    </div>
  );
}

function Insight({ productId, lang }) {
  const L3 = tri(lang);
  const [state, setState] = useState({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    api.explain({ product_id: productId, topic: "insight", lang })
      .then((r) => alive && setState({ status: r?.answer ? "ok" : "empty", r }))
      .catch(() => alive && setState({ status: "error" }));
    return () => { alive = false; };
  }, [productId, lang, nonce]);
  const r = state.r;
  return (
    <section className="rounded-2xl bg-gradient-to-br from-[#F3F8F1] to-[#E6F3EA] border border-[#CFE6D5] p-3" aria-live="polite">
      <p className="text-[12.5px] font-bold uppercase tracking-wider text-[#2E7D4F]">
        ✨ {L3("Nhận định của AI", "AI insight", "L'avis de l'IA")}
        {r?.model && <span className="ml-1 normal-case tracking-normal font-medium text-[#6b7280]">· {r.model === "rule-based" ? L3("soạn từ dữ liệu", "from the data", "d'après les données") : r.model}</span>}
      </p>
      {state.status === "loading" && (
        <div className="mt-2 space-y-1.5" aria-label={L3("Đang tải", "Loading", "Chargement")}>
          <div className="h-3 rounded bg-white/80 animate-pulse" /><div className="h-3 w-4/5 rounded bg-white/80 animate-pulse" />
        </div>
      )}
      {state.status === "error" && (
        <p className="mt-1 text-[14px] text-[#4b5563]">
          {L3("Chưa lấy được nhận định.", "The insight could not be loaded.", "Impossible de charger l'avis.")}{" "}
          <button type="button" className="underline text-sky-700" onClick={() => setNonce((n) => n + 1)}>{L3("Thử lại", "Retry", "Réessayer")}</button>
        </p>
      )}
      {state.status === "ok" && (
        <>
          <p className="mt-1 text-[15.5px] font-bold text-[#16324a]">{r.title}</p>
          <p className="mt-0.5 text-[14.5px] leading-relaxed text-[#1f2937]">{r.answer}</p>
          {r.bullets?.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {r.bullets.slice(0, 1).map((b, i) => <li key={i} className="text-[13.5px] text-[#374151] flex gap-1.5"><span className="text-[#2E7D4F]">✓</span><span>{b}</span></li>)}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

export default function GreenPanel({ d, base, sc, setSc, lang, onRecycle, className = "" }) {
  const L3 = tri(lang);
  const [openLonger, setOpenLonger] = useState(false);
  const p = d.product;
  const altRaw = d.related?.greener_alternative;
  const alt = altRaw ? (altRaw.product ? { id: altRaw.product.id, name: altRaw.product.name, kg: altRaw.product.co2e_kg } : { id: altRaw.product_id, name: altRaw.name, kg: altRaw.co2e_kg }) : null;
  const y0 = base?.years || 4;
  const y1 = y0 + 2;
  const longer = base?.ok && base.total !== null ? simulate(base, { ...sc, years: y1 }) : null;
  const now = base?.ok && base.total !== null ? simulate(base, { ...sc, years: y0 }) : null;
  const perYear = (sim, yrs) => (sim ? formatKg(sim.total / yrs, lang) : null);
  const searchTo = `/search?${new URLSearchParams({ ...(p.category ? { category: p.category } : {}), sort: "co2_asc" })}`;
  return (
    <aside className={`rounded-3xl bg-white/95 backdrop-blur shadow-xl border border-white p-3.5 space-y-2.5 overflow-y-auto ${className}`}
           aria-label={L3("Sống xanh", "Green lifestyle", "Mode de vie sobre")}>
      <div>
        <h2 className="text-[20px] font-extrabold text-[#1F5D3A]">🍃 {L3("Sống xanh", "Green Lifestyle", "Vivre plus sobre")}</h2>
        <p className="text-[14px] text-[#4b5563]">{L3("Lựa chọn nhỏ, tương lai ít carbon.", "Small choices, a lower-carbon future.", "Petits choix, avenir bas carbone.")}</p>
      </div>
      <div className="space-y-2">
        <Option icon="💻" title={L3("Chọn thiết bị ít CO₂", "Choose low-CO₂ devices", "Choisir un appareil sobre")}
                sub={alt && alt.kg !== null && alt.kg !== undefined ? `${alt.name} · ${formatKg(alt.kg, lang)} kg` : L3("Xếp cùng loại theo CO₂ thấp nhất", "Same category, lowest CO₂ first", "Même catégorie, CO₂ le plus bas d'abord")}
                to={alt?.id ? `/world/${alt.id}` : searchTo} />
        <Option icon="🔧" title={L3("Dùng lâu hơn & bảo dưỡng", "Use longer & maintain", "Utiliser plus longtemps")}
                sub={L3(`Giữ ${y1} năm thay vì ${y0}`, `Keep it ${y1} years instead of ${y0}`, `Le garder ${y1} ans au lieu de ${y0}`)}
                open={openLonger} onClick={() => setOpenLonger(!openLonger)}>
          {longer && now && (
            <div className="mt-1.5 rounded-2xl bg-[#F3F8F1] border border-[#DCEBD9] p-3 text-[14px] text-[#1f2937]">
              <p className="font-mono text-[13.5px]">{L3("CO₂ mỗi năm = tổng ÷ số năm dùng", "CO₂ per year = total ÷ years of use", "CO₂ par an = total ÷ années d'usage")}</p>
              <p className="mt-1">{y0} {L3("năm", "yrs", "ans")}: <b>{perYear(now, y0)} kg/{L3("năm", "yr", "an")}</b> → {y1} {L3("năm", "yrs", "ans")}: <b className="text-[#1F5D3A]">{perYear(longer, y1)} kg/{L3("năm", "yr", "an")}</b></p>
              <p className="mt-1 text-[12.5px] text-[#4b5563]">{L3("Mô phỏng: sản xuất đã thải một lần, chỉ phần điện tăng theo năm. Số chính thức không đổi.", "Simulation: manufacturing is emitted once, only electricity grows with the years. The official figure does not change.", "Simulation : la fabrication est émise une fois, seule l'électricité augmente avec les années. Le chiffre officiel ne change pas.")}</p>
              <button type="button" onClick={() => setSc({ ...sc, years: sc.years === y1 ? y0 : y1 })}
                      className="mt-2 rounded-full bg-[#1F5D3A] text-white px-3 py-1.5 text-[13.5px] font-semibold">
                {sc.years === y1 ? L3(`Quay lại ${y0} năm`, `Back to ${y0} years`, `Revenir à ${y0} ans`) : L3(`Xem trên bản đồ với ${y1} năm`, `Show ${y1} years on the map`, `Voir ${y1} ans sur la carte`)}
              </button>
            </div>
          )}
        </Option>
        <Option icon="♻️" title={L3("Mang đi tái chế", "Return for recycling", "Rapporter au recyclage")}
                sub={L3("Vật liệu quay lại nhà máy", "Materials go back to the factory", "Les matériaux retournent à l'usine")} onClick={onRecycle} />
      </div>
      <Insight productId={p.product_id} lang={lang} />
      <div className="flex items-center gap-3 rounded-2xl border border-[#DCEBD9] p-3">
        <span className="text-[30px] leading-none" aria-hidden="true">♻️</span>
        <p className="text-[13.5px] text-[#374151]">
          <b className="block text-[15px] text-[#1F5D3A]">{L3("Vòng tuần hoàn", "The circular loop", "La boucle circulaire")}</b>
          {L3("Sản xuất → dùng → thu hồi → tái chế → quay lại sản xuất.", "Production → use → return → recycle → back to production.", "Production → usage → retour → recyclage → retour à la production.")}
        </p>
      </div>
    </aside>
  );
}
