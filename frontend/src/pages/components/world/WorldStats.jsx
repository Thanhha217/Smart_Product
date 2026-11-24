// The five tiles under the product name on the Overview (the CO2 world): the whole-life figure,
// how it sits against its category, the green score, the biggest stage and the confidence.
//
// Every number is read from GET /api/products/{id}/co2 and the category stats; nothing is
// recomputed except the share against the median, which is written out in the tile itself.
import { Link } from "react-router-dom";
import { tri } from "../../../i18n/LanguageContext";
import { formatKg, formatNum, greenColor } from "../../../lib/format";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

function Tile({ label, badge, dark = false, accent = false, onClick, children, className = "" }) {
  const Box = onClick ? "button" : "section";
  return (
    <Box {...(onClick ? { type: "button", onClick } : {})}
         className={`relative min-w-0 rounded-[18px] border px-4 py-3.5 ${onClick ? "text-left transition hover:border-[#2E7D4F] hover:shadow-sm" : ""} ${
      dark ? "border-transparent bg-[#17422C] text-white"
           : accent ? "border-[#2E7D4F] bg-white" : "border-[#E8E4D8] bg-white"} ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <p title={label} className={`truncate text-[11.5px] font-bold uppercase tracking-[0.12em] ${dark ? "text-[#9FC9AC]" : "text-[#8A9186]"}`}>{label}</p>
        {badge}
      </div>
      {children}
    </Box>
  );
}

/** A thin rule under a tile's number: how far along its own scale this product sits. */
function Meter({ pct, color = "#2E7D4F", track = "#EFEBDF" }) {
  return (
    <span className="mt-2.5 block h-1.5 w-full rounded-full" style={{ background: track }} aria-hidden="true">
      <span className="block h-1.5 rounded-full" style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: color }} />
    </span>
  );
}

export default function WorldStats({ d, lc, lang, t, stages, onFormula, onCategory }) {
  const L3 = tri(lang);
  const p = d.product;
  const stats = d.stats;
  const kg = p?.co2e_kg;
  const published = d.formula?.method === "manufacturer";
  const confidence = d.formula?.confidence;

  // vs. the category: the share above or below the median, and whether it is the lowest of all
  const median = isNum(stats?.median_kg) ? stats.median_kg : null;
  const delta = isNum(kg) && median ? ((kg - median) / median) * 100 : null;
  const lowest = isNum(kg) && isNum(stats?.min) && kg <= stats.min + 0.05;
  const span = isNum(stats?.min) && isNum(stats?.max) && stats.max > stats.min;
  const place = span && isNum(kg) ? ((kg - stats.min) / (stats.max - stats.min)) * 100 : null;

  // the heaviest stage of the lifecycle, named in the visitor's language
  const top = lc.parts.length ? lc.parts.reduce((a, b) => ((b.pct ?? 0) > (a.pct ?? 0) ? b : a)) : null;

  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
      <Tile dark label={L3("CO₂ cả vòng đời", "Whole-life CO₂", "CO₂ cycle de vie")}>
        {isNum(kg) ? (
          <p className="mt-1 font-display leading-none">
            <span className="text-[34px] font-bold">{formatKg(kg, lang)}</span>
            <span className="ml-1.5 text-[14px] font-semibold text-[#C7E0CE]">kg CO₂e</span>
          </p>
        ) : (
          <p className="mt-1.5 text-[16px] font-semibold text-[#C7E0CE]">{L3("Chưa có số", "No figure", "Pas de chiffre")}</p>
        )}
        <span className={`mt-2.5 inline-block rounded-full px-2 py-0.5 text-[12px] font-semibold ${
          published ? "bg-[#DCEFE0] text-[#17422C]" : "bg-white/15 text-white"}`}>
          {t(published ? "common.co2Published" : "common.co2Estimated")}
        </span>
      </Tile>

      <Tile accent={lowest} onClick={onCategory} label={L3("So với cùng loại", "Vs. its category", "Vs. sa catégorie")}
            badge={lowest && isNum(stats?.n) ? (
              <span className="shrink-0 rounded-full bg-[#FBEFD3] px-2 py-0.5 text-[11.5px] font-bold text-[#8A5A00]">
                {L3(`Thấp nhất trong ${formatNum(stats.n, lang, 0)}`, `Lowest of ${formatNum(stats.n, lang, 0)}`, `Le plus bas sur ${formatNum(stats.n, lang, 0)}`)}
              </span>
            ) : null}>
        {delta === null ? (
          <p className="mt-1.5 text-[15px] text-[#6B7468]">{L3("Chưa so sánh được", "Nothing to compare with", "Rien à comparer")}</p>
        ) : (
          <>
            <p className={`mt-1 font-display text-[34px] font-bold leading-none ${delta <= 0 ? "text-[#1F6B43]" : "text-[#B4532F]"}`}>
              {delta <= 0 ? "−" : "+"}{formatNum(Math.abs(delta), lang, 0)}%
            </p>
            <p className="mt-1 text-[12.5px] leading-snug text-[#55604F]">
              {delta <= 0 ? L3("dưới mức giữa của loại", "below the category median", "sous la médiane de la catégorie")
                          : L3("trên mức giữa của loại", "above the category median", "au-dessus de la médiane")}
              {" "}{L3("là", "of", "de")} {formatKg(median, lang)} kg
            </p>
            {place !== null && <Meter pct={place} color={delta <= 0 ? "#2E7D4F" : "#D08A2C"} />}
          </>
        )}
      </Tile>

      <Tile label={L3("Điểm xanh", "Green score", "Score vert")}>
        {isNum(p?.green_score) ? (
          <>
            <p className="mt-1 font-display leading-none" style={{ color: greenColor(p.green_score) }}>
              <span className="text-[34px] font-bold">{formatNum(p.green_score, lang, 1)}</span>
              <span className="ml-1 text-[16px] font-semibold text-[#8A9186]">/ 5</span>
            </p>
            <p className="mt-1 text-[12.5px] text-[#55604F]">{L3("trong cùng loại", "in its category", "dans sa catégorie")}</p>
            <span className="mt-2.5 flex gap-1" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="h-1.5 flex-1 rounded-full bg-[#EFEBDF] overflow-hidden">
                  <span className="block h-1.5 rounded-full"
                        style={{ width: `${Math.max(0, Math.min(1, p.green_score - i)) * 100}%`, background: greenColor(p.green_score) }} />
                </span>
              ))}
            </span>
          </>
        ) : <p className="mt-1.5 text-[15px] text-[#6B7468]">—</p>}
      </Tile>

      <Tile label={L3("Chặng nặng nhất", "Biggest source", "Étape dominante")}>
        {top ? (
          <>
            <p className="mt-1 font-display text-[22px] font-semibold leading-tight text-[#1E2B22]">{stages[top.key] || top.key}</p>
            <p className="mt-0.5 text-[12.5px] text-[#55604F]">
              {isNum(top.kg) && <b className="text-[#1F6B43]">{formatKg(top.kg, lang)} kg</b>}
              {isNum(top.kg) && " · "}
              {L3(`${formatNum(top.pct, lang, 0)}% của tổng`, `${formatNum(top.pct, lang, 0)}% of the total`, `${formatNum(top.pct, lang, 0)}% du total`)}
            </p>
            <Meter pct={top.pct ?? 0} color="#1F6B43" />
          </>
        ) : <p className="mt-1.5 text-[15px] text-[#6B7468]">—</p>}
      </Tile>

      <Tile label={L3("Độ tin cậy", "Confidence", "Fiabilité")}>
        {isNum(confidence) ? (
          <>
            <p className="mt-1 font-display text-[34px] font-bold leading-none text-[#1E2B22]">{formatNum(confidence * 100, lang, 0)}%</p>
            {onFormula
              ? <button type="button" onClick={onFormula} className="mt-1 inline-block text-[12.5px] font-semibold text-[#1F5D3A] hover:underline">
                  {L3("Cách tính ra số này", "How it's calculated", "Comment c'est calculé")} →
                </button>
              : <Link to={`/method?product=${p.product_id}`} className="mt-1 inline-block text-[12.5px] font-semibold text-[#1F5D3A] hover:underline">
                  {L3("Cách tính ra số này", "How it's calculated", "Comment c'est calculé")} →
                </Link>}
            <Meter pct={confidence * 100} color={confidence >= 0.7 ? "#2E7D4F" : confidence >= 0.45 ? "#D08A2C" : "#C2613C"} />
          </>
        ) : <p className="mt-1.5 text-[15px] text-[#6B7468]">—</p>}
      </Tile>
    </div>
  );
}

/** The four doors out of the Overview, as on the design: book, method, catalogue, assistant. */
export function GoFurther({ productId, lang, listed }) {
  const L3 = tri(lang);
  const cards = [
    { to: `/story/${productId}`, icon: "📖", title: L3("Sách CO₂", "CO₂ book", "Livre CO₂"),
      sub: L3("Câu chuyện của sản phẩm này, từng trang một", "This product's story, page by page", "L'histoire de ce produit, page par page") },
    { to: `/method?product=${productId}`, icon: "🧮", title: L3("Phương pháp CO₂", "CO₂ method", "Méthode CO₂"),
      sub: L3("Công thức đằng sau con số", "The formula behind the figure", "La formule derrière le chiffre") },
    { to: "/search", icon: "🔍", title: L3("Tìm sản phẩm", "Find products", "Trouver des produits"),
      sub: isNum(listed)
        ? L3(`${formatNum(listed, lang, 0)} sản phẩm từ các cửa hàng Việt Nam`, `${formatNum(listed, lang, 0)} products from Vietnamese stores`, `${formatNum(listed, lang, 0)} produits de magasins vietnamiens`)
        : L3("Sản phẩm từ các cửa hàng Việt Nam", "Products from Vietnamese stores", "Produits de magasins vietnamiens") },
    { to: "/assistant", icon: "✨", title: L3("Hỏi AI", "Ask AI", "Demander à l'IA"),
      sub: L3("Nói bạn cần gì, nhận gợi ý ít CO₂", "Say what you need, get a low-CO₂ pick", "Dites ce qu'il vous faut, obtenez un choix sobre") },
  ];
  return (
    <section aria-label={L3("Đi tiếp", "Go further", "Aller plus loin")}>
      <h2 className="font-display text-[22px] font-semibold text-[#1E2B22]">{L3("Đi tiếp", "Go further", "Aller plus loin")}</h2>
      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.to} to={c.to}
                className="flex items-start gap-3 rounded-[18px] border border-[#E8E4D8] bg-white px-4 py-3.5 transition hover:border-[#2E7D4F] hover:shadow-sm">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F1F7EF] text-[18px]" aria-hidden="true">{c.icon}</span>
            <span className="min-w-0">
              <span className="block text-[15.5px] font-bold text-[#1E2B22]">{c.title}</span>
              <span className="block text-[13px] leading-snug text-[#55604F]">{c.sub}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
