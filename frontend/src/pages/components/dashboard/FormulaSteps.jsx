// Overview: how every stored CO2 number is calculated. Each step shows its formula with the terms
// coloured and explained, then one worked example from the catalogue (real product, real numbers).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../api/client";
import { tri } from "../../../i18n/LanguageContext";
import { formatKg, formatNum } from "../../../lib/format";
import { greenEquation, lifecycleParts, methodEquation } from "../../../lib/co2Formula";

const TERM = {
  green: "bg-[#DCEFE0] text-[#1F5D3A]",
  blue: "bg-[#DCEBFA] text-[#1E5A96]",
  amber: "bg-[#FBEFD3] text-[#8A5A00]",
  rose: "bg-[#F9E0DE] text-[#9B2F2A]",
  slate: "bg-[#E8ECEF] text-[#334155]",
};
const STAGE_COLOR = { materials_production: "#2E7D4F", transport: "#3B8FD9", use: "#E0A526", end_of_life: "#8B5CF6" };

function T({ c, children }) {
  return <span className={`rounded-md px-1.5 py-0.5 font-semibold ${TERM[c]}`}>{children}</span>;
}

function Legend({ items }) {
  return (
    <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-[#55604F]">
      {items.map(([c, sym, text]) => (
        <li key={sym} className="flex items-center gap-1.5"><span className={`rounded px-1 font-mono text-[13px] ${TERM[c]}`}>{sym}</span>{text}</li>
      ))}
    </ul>
  );
}

function steps(L3) {
  return [
    { key: "manufacturer", conf: 0.9, title: L3("Số của hãng", "Manufacturer figure", "Chiffre du fabricant"),
      when: L3("Có báo cáo cho đúng mẫu này", "A report exists for this exact model", "Un rapport existe pour ce modèle exact"),
      formula: <>CO₂ = <T c="green">PCF</T></>,
      legend: [["green", "PCF", L3("số CO₂ hãng đo và công bố", "CO₂ the manufacturer measured and published", "CO₂ mesuré et publié par le fabricant")]] },
    { key: "neighbor_average", conf: 0.5, title: L3("Trung bình mẫu giống", "Similar products", "Produits similaires"),
      when: L3("Không có báo cáo: tìm mẫu giống bằng AI hình ảnh + chữ", "No report: find look-alikes with image + text AI", "Pas de rapport : chercher des modèles proches (IA image + texte)"),
      formula: <>CO₂ = ( <T c="blue">CO₂₁</T> + <T c="blue">CO₂₂</T> + … + <T c="blue">CO₂ₙ</T> ) ÷ <T c="amber">n</T></>,
      legend: [["blue", "CO₂ᵢ", L3("số của hãng cho mẫu giống thứ i", "manufacturer figure of look-alike i", "chiffre fabricant du modèle proche i")],
               ["amber", "n", L3("số mẫu có độ giống ≥ 0,66 (tối đa 5)", "look-alikes with similarity ≥ 0.66 (max 5)", "modèles avec similarité ≥ 0,66 (5 max)")]] },
    { key: "category_model", conf: 0.35, title: L3("Mức giữa của loại", "Category level", "Niveau de catégorie"),
      when: L3("Không có mẫu đủ giống", "No look-alike is close enough", "Aucun modèle assez proche"),
      formula: <>CO₂ = <T c="green">M</T> × ( <T c="blue">inch</T> ÷ <T c="slate">inch₀</T> )<sup><T c="amber">b</T></sup></>,
      legend: [["green", "M", L3("trung vị của hãng hoặc của loại", "median of the brand or the category", "médiane de la marque ou de la catégorie")],
               ["blue", "inch", L3("cỡ màn hình", "screen size", "taille d'écran")],
               ["slate", "inch₀", L3("cỡ chuẩn của loại", "reference size", "taille de référence")],
               ["amber", "b", L3("0,53 laptop · 0,81 màn hình", "0.53 laptops · 0.81 monitors", "0,53 portables · 0,81 écrans")]] },
    { key: "none", conf: null, title: L3("Chưa có số", "No figure", "Pas de chiffre"),
      when: L3("Không đủ căn cứ", "Not enough evidence", "Pas assez d'éléments"),
      formula: <>CO₂ = <T c="rose">{L3("để trống", "left empty", "laissé vide")}</T></>,
      legend: [["rose", "∅", L3("không đoán, không ghi 0", "never guessed, never 0", "jamais deviné, jamais 0")]] },
  ];
}

/** One real product from the catalogue, with every term of its formula filled in. */
function Example({ ids, lang }) {
  const L3 = tri(lang);
  const [ex, setEx] = useState(null);
  const key = ids.join(",");
  useEffect(() => {
    let alive = true;
    if (!ids.length) return undefined;
    Promise.all(ids.slice(0, 6).map((id) => api.getProductCo2(id).catch(() => null)))
      .then((rows) => {
        const ok = rows.filter((r) => r?.product?.co2e_kg !== null && r?.product?.co2e_kg !== undefined);
        const best = ok.find((r) => (methodEquation(r.formula, r.product, "en")?.terms.length || 0) >= 3) || ok[0] || null;
        if (alive) setEx(best);
      });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ex) return null;
  const p = ex.product;
  const eq = methodEquation(ex.formula, p, lang);
  const parts = lifecycleParts(ex.lifecycle);
  const g = greenEquation(ex.green_score_formula, lang);
  const stageName = {
    materials_production: L3("Sản xuất", "Production", "Fabrication"), transport: L3("Vận chuyển", "Transport", "Transport"),
    use: L3("Sử dụng", "Use", "Usage"), end_of_life: L3("Thải bỏ", "End of life", "Fin de vie"),
  };
  return (
    <div className="mt-4 rounded-2xl border-2 border-[#CFE6D5] bg-[#F7FBF6] p-4">
      <p className="text-[13.5px] font-bold uppercase tracking-wider text-[#2E7D4F]">{L3("Ví dụ thật trong dữ liệu", "A real example from the catalogue", "Un exemple réel du catalogue")}</p>
      <Link to={`/world/${p.product_id}`} className="text-[17px] font-bold text-[#1E2B22] hover:underline">{p.name}</Link>
      {eq && (
        <div className="mt-2 font-mono text-[15px] text-[#1E2B22]">
          <p className="text-[#55604F]">{eq.symbolic}</p>
          <p>{eq.filled ? <>= {eq.filled} </> : null}<b className="text-[#1F5D3A]">= {formatKg(eq.resultKg, lang)} kg CO₂e</b></p>
        </div>
      )}
      {parts.length > 0 && (
        <div className="mt-3">
          <p className="text-[14.5px] font-semibold text-[#1E2B22]">
            {L3("Chia theo chặng", "Split by stage", "Par étape")}: {parts.map((s, i) => (
              <span key={s.key}>{i > 0 && " + "}<span style={{ color: STAGE_COLOR[s.key] }}>{stageName[s.key]} {formatKg(s.kg, lang)}</span></span>
            ))} = {formatKg(p.co2e_kg, lang)} kg
          </p>
          <div className="mt-1.5 flex h-4 w-full overflow-hidden rounded-full bg-[#EFEBDF]" role="img"
               aria-label={parts.map((s) => `${stageName[s.key]} ${formatNum(s.pct, lang, 0)}%`).join(", ")}>
            {parts.map((s) => <span key={s.key} style={{ width: `${s.pct ?? 0}%`, background: STAGE_COLOR[s.key] }} title={`${stageName[s.key]} ${formatNum(s.pct, lang, 0)}%`} />)}
          </div>
          {ex.lifecycle?.basis === "typical_share" && (
            <p className="mt-1 text-[13px] text-[#6B7468]">{L3("Tỷ lệ từng chặng là mức điển hình của loại (giả định); tổng không đổi.", "Stage shares are typical for the category (assumption); the total does not change.", "Les parts par étape sont typiques de la catégorie (hypothèse) ; le total ne change pas.")}</p>
          )}
        </div>
      )}
      {g && (
        <p className="mt-3 font-mono text-[15px] text-[#1E2B22]">
          {L3("Điểm xanh", "Green score", "Score vert")} = {g.symbolic} = {g.filled} = <b className="text-[#1F5D3A]">{formatNum(g.score, lang, 1)}/5</b>
        </p>
      )}
    </div>
  );
}

export default function FormulaSteps({ lang, exampleIds = [] }) {
  const L3 = tri(lang);
  return (
    <div className="mt-5 rounded-2xl border border-[#EFEBDF] p-4">
      <p className="text-[16.5px] font-bold">{L3("Cách tính mỗi số CO₂", "How each CO₂ number is calculated", "Comment chaque chiffre CO₂ est calculé")}</p>
      <p className="text-[14.5px] text-[#6B7468]">{L3("Thử lần lượt từ trên xuống, dừng ở cách đầu tiên ra số.", "Tried from top to bottom; the first one that gives a number wins.", "Essayées de haut en bas ; la première qui donne un chiffre l'emporte.")}</p>
      <ol className="mt-3 space-y-3">
        {steps(L3).map((s, i) => (
          <li key={s.key} className="flex items-start gap-3">
            <span className="grid place-items-center w-7 h-7 shrink-0 rounded-full bg-[#1F5D3A] text-white text-[13.5px] font-bold">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] leading-snug">
                <b>{s.title}</b> <span className="text-[#6B7468]">· {s.when}</span>
                {s.conf !== null && <span className="ml-2 pill bg-[#E4F1E6] text-[#1F5D3A]">{L3("tin cậy", "confidence", "fiabilité")} {formatNum(s.conf, lang, 2)}</span>}
              </p>
              <p className="mt-1 font-mono text-[16px] text-[#1E2B22] leading-loose">{s.formula}</p>
              <Legend items={s.legend} />
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 rounded-2xl bg-[#FBFAF5] border border-[#EFEBDF] p-3 font-mono text-[15px] text-[#1E2B22] space-y-1.5">
        <p><b className="font-sans">{L3("Sau đó", "Then", "Ensuite")}:</b> {L3("Tổng", "Total", "Total")} = <T c="green">{L3("Sản xuất", "Production", "Fabrication")}</T> + <T c="blue">{L3("Vận chuyển", "Transport", "Transport")}</T> + <T c="amber">{L3("Sử dụng", "Use", "Usage")}</T> + <T c="slate">{L3("Thải bỏ", "End of life", "Fin de vie")}</T></p>
        <p>{L3("Sử dụng", "Use", "Usage")} = kWh/{L3("năm", "yr", "an")} × {L3("số năm", "years", "années")} × <T c="amber">{formatNum(0.681, lang, 3)}</T> <span className="font-sans text-[13.5px] text-[#6B7468]">{L3("(kg CO₂/kWh, lưới điện Việt Nam 2024)", "(kg CO₂/kWh, Vietnam grid 2024)", "(kg CO₂/kWh, réseau vietnamien 2024)")}</span></p>
        <p>{L3("Điểm xanh", "Green score", "Score vert")} = 5 × ln(<T c="slate">U</T> ÷ CO₂) ÷ ln(<T c="slate">U</T> ÷ <T c="slate">L</T>) <span className="font-sans text-[13.5px] text-[#6B7468]">{L3("(L, U: khoảng hợp lý của loại)", "(L, U: plausible range of the category)", "(L, U : plage plausible de la catégorie)")}</span></p>
      </div>
      <Example ids={exampleIds} lang={lang} />
    </div>
  );
}
