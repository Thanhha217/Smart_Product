// /story without a product (design page 4): a hero with a search box, a shelf of CO₂ books
// already "written" for real products, and the categories to start from.
// Every book and figure comes from the catalogue (/api/overview, /api/categories, stats).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../api/client";
import { tri, useI18n } from "../../../i18n/LanguageContext";
import { explore } from "../../../i18n/explore";
import { byCategoryOrder, canonicalCategory, searchCategory } from "../../../lib/categories";
import { formatCount } from "../../../lib/data";
import { formatKg } from "../../../lib/format";
import DeviceIcon from "../ui/DeviceIcon";

const COVERS = [
  { bg: "linear-gradient(135deg,#235C3B,#123824)", spine: "#0E2C1C" },
  { bg: "linear-gradient(135deg,#25457A,#152B51)", spine: "#0F1F3B" },
  { bg: "linear-gradient(135deg,#8A2F1E,#5A1B10)", spine: "#43130A" },
];
const SHELF_ORDER = ["laptop", "tablet", "computer_monitor", "smartphone", "headphone", "smartwatch"];
const CATEGORY_WORDS = /^(laptop|máy tính bảng|màn hình|điện thoại|tai nghe( chụp tai)?|đồng hồ thông minh|máy tính xách tay)\s+/i;

/** "Laptop MSI Modern 14 B11MOU-1027VN - Đã kích hoạt" -> title "MSI Modern 14", sub "B11MOU-1027VN". */
function coverTitle(name) {
  const clean = String(name || "").replace(CATEGORY_WORDS, "").split(/\s+-\s+|\s*\(|\|/)[0].trim();
  const words = clean.split(/\s+/);
  return { title: words.slice(0, 3).join(" "), sub: words.slice(3, 6).join(" ") };
}

function BooksArt() {
  return (
    <svg viewBox="0 0 200 140" className="w-[200px] h-auto" aria-hidden="true">
      <ellipse cx="100" cy="128" rx="88" ry="8" fill="#E7E0CF" />
      <rect x="28" y="26" width="26" height="100" rx="4" fill="#2C5B78" /><rect x="28" y="40" width="26" height="4" fill="#9CC0D6" opacity=".5" />
      <rect x="57" y="14" width="30" height="112" rx="4" fill="#1F5D3A" /><rect x="64" y="40" width="16" height="34" rx="2" fill="#2E7D4F" />
      <rect x="90" y="32" width="24" height="94" rx="4" fill="#C2620B" /><rect x="90" y="46" width="24" height="3" fill="#F0B36B" opacity=".6" />
      <g transform="rotate(14 140 80)"><rect x="124" y="34" width="26" height="94" rx="4" fill="#3F8A5A" /><rect x="124" y="52" width="26" height="3" fill="#BFE3C9" opacity=".6" /></g>
      <path d="M150 30 c10 -18 28 -18 30 -2 c-14 2 -22 8 -30 2z" fill="#4FA35F" />
    </svg>
  );
}

/** A 3D-ish book cover on the shelf. */
function Book({ product, no, cover, badge, lang }) {
  const { title, sub } = coverTitle(product.name);
  const L3 = tri(lang);
  return (
    <Link to={`/story/${product.product_id}`} aria-label={`${L3("Đọc sách", "Read the book", "Lire le livre")}: ${product.name}`}
          className="group relative block w-[150px] sm:w-[160px] [perspective:900px] focus-visible:outline-none">
      <div className="relative h-[210px] sm:h-[224px] rounded-r-md rounded-l-sm text-white shadow-[8px_10px_18px_-6px_rgba(40,30,10,.55)] transition-transform duration-300 group-hover:-translate-y-2 group-hover:[transform:rotateY(-12deg)] group-focus-visible:ring-4 group-focus-visible:ring-[#2E7D4F]/40"
           style={{ background: cover.bg, transformOrigin: "left center" }}>
        <span className="absolute inset-y-0 left-0 w-3 rounded-l-sm" style={{ background: cover.spine }} />
        <span className="absolute inset-y-2 left-3 w-px bg-white/15" />
        <div className="relative h-full pl-6 pr-3 pt-3 pb-3 flex flex-col">
          <p className="flex justify-between text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/70">
            <span>CO₂ book</span>{!badge && <span>No. {String(no).padStart(2, "0")}</span>}
          </p>
          <p className="mt-2 font-display text-[19px] font-semibold leading-tight line-clamp-2">{title}</p>
          {sub && <p className="mt-0.5 text-[10.5px] text-white/70 line-clamp-1">{sub}</p>}
          <div className="my-auto grid place-items-center text-[#E9D9A6]"><DeviceIcon name={product.category} size={38} tint={false} /></div>
          <span className="h-px bg-[#E9D9A6]/50" />
          <p className="mt-1.5 font-display text-[28px] leading-none font-semibold">{formatKg(product.co2e_kg, lang)}<span className="ml-1 text-[9.5px] font-sans font-bold tracking-wider text-white/75">KG CO₂e</span></p>
        </div>
        {badge && (
          <span className="absolute -right-4 -top-4 grid place-items-center w-[58px] h-[58px] rounded-full bg-gradient-to-br from-[#F4CF5A] to-[#C8941B] text-[#3B2A05] text-center shadow-md rotate-12">
            <span className="text-[7.5px] font-extrabold uppercase leading-[1.05]">{badge}</span>
          </span>
        )}
      </div>
    </Link>
  );
}

export default function BookShelf() {
  const { lang } = useI18n();
  const L3 = tri(lang);
  const X = explore(lang);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [books, setBooks] = useState(null);
  const [cats, setCats] = useState(null);

  // three real products, the lowest-CO2 one of their category, each with its category stats
  useEffect(() => {
    let alive = true;
    api.getOverview().then(async (o) => {
      const list = (o?.greenest || []).map((g) => ({ category: g.category, p: g.product })).filter((g) => g.p?.product_id);
      const ordered = SHELF_ORDER.map((c) => list.find((g) => g.category === c)).filter(Boolean).slice(0, 3);
      const withData = await Promise.all(ordered.map(async (g) => {
        const [stats, co2] = await Promise.all([
          api.getCategoryStats(g.category, g.p.product_id).catch(() => null),
          api.getProductCo2(g.p.product_id).catch(() => null),
        ]);
        return { product: { ...g.p, category: g.category }, stats, co2 };
      }));
      if (alive) setBooks(withData);
    }).catch(() => alive && setBooks([]));
    api.getCategories().then((r) => alive && setCats(byCategoryOrder(r?.categories || []))).catch(() => alive && setCats([]));
    return () => { alive = false; };
  }, []);

  const search = useCallback(async (query) => {
    const text = String(query || "").trim();
    if (!text) return;
    setBusy(true);
    try {
      const list = await api.searchProducts(text, 12);
      setResults((list || []).filter((c) => c.co2e_kg !== null && c.co2e_kg !== undefined).slice(0, 8));
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  }, []);

  const tries = useMemo(() => [
    L3("laptop Dell", "Dell laptop", "portable Dell"), "MacBook", L3("màn hình 27 inch", "27 inch monitor", "écran 27 pouces"),
    "iPhone", L3("tai nghe", "headphones", "casque"), L3("máy tính bảng", "tablet", "tablette"),
  ], [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const caption = (b) => {
    const pct = b.stats?.greener_than_pct, n = b.stats?.n;
    if (typeof pct === "number" && pct >= 99.5 && n) {
      return L3(`Thấp nhất trong ${formatCount(n, lang)} sản phẩm cùng loại`, `Lowest of ${formatCount(n, lang)} in its category`, `Le plus bas de ${formatCount(n, lang)} dans sa catégorie`);
    }
    const refs = (b.co2?.formula?.steps || []).filter((s) => typeof s.value_kg === "number" && s.label_en !== "Average").length;
    if (b.co2?.formula?.method === "neighbor_average" && refs) {
      return L3(`Trung bình ${refs} sản phẩm giống`, `Average of ${refs} similar products`, `Moyenne de ${refs} produits proches`);
    }
    return b.co2?.formula?.method === "manufacturer" ? L3("Số của hãng", "Manufacturer figure", "Chiffre du fabricant") : "";
  };

  return (
    <div className="space-y-8">
      {/* hero */}
      <section className="relative overflow-hidden rounded-[30px] bg-white border border-[#E8E4D8] px-6 sm:px-9 py-8 shadow-[0_14px_40px_-28px_rgba(30,43,34,.45)]">
        <div className="flex items-start gap-6">
          <div className="flex-1 min-w-0">
            <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.14em] text-[#2E7D4F]">
              <span aria-hidden="true">📖</span>{L3("Sách CO₂", "CO₂ book", "Livre CO₂")}
            </p>
            <h1 className="mt-1 font-display text-[36px] sm:text-[46px] font-semibold leading-[1.05] text-[#1E2B22]">
              {L3("Mỗi sản phẩm có một câu chuyện CO₂", "Every product has a CO₂ story", "Chaque produit a une histoire de CO₂")}
            </h1>
            <p className="mt-2 max-w-xl text-[17px] leading-relaxed text-[#55604F]">
              {L3("Gõ tên sản phẩm. Hệ thống dựng một cuốn sách tương tác: nơi sản xuất, đường vận chuyển, điện năng khi dùng, và vì sao chọn món ít CO₂ hơn lại quan trọng.",
                  "Type a product. The system builds an interactive book: where it was made, how it travelled, how much power it uses, and why a lower-CO₂ choice matters.",
                  "Tapez un produit. Le système compose un livre interactif : où il a été fabriqué, comment il a voyagé, combien il consomme, et pourquoi un choix plus sobre compte.")}
            </p>
            <form className="mt-5 flex max-w-2xl items-center gap-2 rounded-2xl bg-[#F4F2EC] p-1.5" onSubmit={(e) => { e.preventDefault(); search(q); }}>
              <span className="pl-3 text-[#6B7468]" aria-hidden="true">
                <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
              </span>
              <input value={q} onChange={(e) => setQ(e.target.value)}
                     aria-label={L3("Tên sản phẩm", "Product name", "Nom du produit")}
                     placeholder={L3("ví dụ: laptop Dell, màn hình 27 inch, iPhone…", "e.g. Dell laptop, 27-inch monitor, iPhone…", "ex. portable Dell, écran 27 pouces, iPhone…")}
                     className="flex-1 min-w-0 bg-transparent px-2 py-2.5 text-[16.5px] outline-none" />
              <button type="submit" disabled={busy}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#1B4332] px-5 py-3 text-[15.5px] font-bold text-white hover:bg-[#245740] disabled:opacity-60">
                {busy ? "…" : L3("Mở sách", "Open the book", "Ouvrir le livre")} <span aria-hidden="true">→</span>
              </button>
            </form>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[14px] text-[#6B7468]">{L3("Thử", "Try", "Essayer")}</span>
              {tries.map((s) => (
                <button key={s} type="button" onClick={() => { setQ(s); search(s); }}
                        className="rounded-full border border-[#E3DFD3] bg-white px-3.5 py-1.5 text-[14px] font-medium text-[#1E2B22] hover:border-[#2E7D4F]">{s}</button>
              ))}
            </div>
          </div>
          <div className="hidden lg:block pt-4"><BooksArt /></div>
        </div>

        {results && (
          <div className="mt-6 border-t border-[#EFEBDF] pt-5">
            <p className="text-[15px] font-semibold text-[#1E2B22]">
              {results.length ? L3("Chọn một sản phẩm để mở sách", "Pick a product to open its book", "Choisissez un produit pour ouvrir son livre")
                              : L3("Không tìm thấy sản phẩm có số CO₂.", "No product with a CO₂ figure was found.", "Aucun produit avec un chiffre CO₂.")}
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {results.map((c) => (
                <li key={c.product_id}>
                  <button type="button" onClick={() => navigate(`/story/${c.product_id}`)}
                          className="flex w-full items-center gap-3 rounded-2xl border border-[#E8E4D8] bg-white px-3 py-2.5 text-left hover:border-[#2E7D4F]">
                    <span className="grid place-items-center w-10 h-10 rounded-xl bg-[#EEF5EF] text-[#2E7D4F]"><DeviceIcon name={c.category} size={20} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-[#1E2B22] line-clamp-1">{c.name}</span>
                      <span className="block text-[13.5px] text-[#6B7468]">{c.platform}</span>
                    </span>
                    <b className="text-[#1F5D3A] whitespace-nowrap">{formatKg(c.co2e_kg, lang)} kg</b>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* the shelf */}
      <section aria-labelledby="shelf-title">
        <h2 id="shelf-title" className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-display text-[28px] font-semibold text-[#1E2B22]">{L3("Sẵn sàng để đọc", "Ready to read", "Prêts à lire")}</span>
          <span className="text-[15px] text-[#6B7468]">{L3("Sản phẩm thật, sách đã viết sẵn", "Real products, their books already written", "Produits réels, livres déjà écrits")}</span>
        </h2>
        <div className="mt-4 rounded-[26px] bg-[#EFE8D8] border border-[#E2D8C2] overflow-hidden">
          <div className="flex flex-wrap items-end gap-8 px-6 sm:px-8 pt-8">
            {books === null && [0, 1, 2].map((i) => <div key={i} className="w-[160px] h-[224px] rounded-md bg-[#E2D9C4] animate-pulse" />)}
            {books && books.map((b, i) => {
              const lowest = typeof b.stats?.greener_than_pct === "number" && b.stats.greener_than_pct >= 99.5 && b.stats?.n;
              return (
                <Book key={b.product.product_id} product={b.product} no={i + 1} cover={COVERS[i % COVERS.length]} lang={lang}
                      badge={lowest ? L3(`Thấp nhất ${formatCount(b.stats.n, lang)}`, `Lowest CO₂ of ${formatCount(b.stats.n, lang)}`, `Le plus bas de ${formatCount(b.stats.n, lang)}`) : null} />
              );
            })}
            <button type="button" onClick={() => document.querySelector('input[aria-label]')?.focus()}
                    className="grid w-[150px] sm:w-[160px] h-[210px] sm:h-[224px] place-items-center rounded-md border-2 border-dashed border-[#CDBF9F] px-4 text-center text-[#7A6C4E] hover:border-[#2E7D4F] hover:text-[#1F5D3A]">
              <span>
                <span className="block text-[26px] leading-none">+</span>
                <span className="mt-2 block text-[14px] font-bold">{L3("Sách của sản phẩm bạn chọn", "Your product's book", "Le livre de votre produit")}</span>
                <span className="mt-1 block text-[12.5px]">{L3("Tìm ở trên, hệ thống sẽ viết", "Search above and the system writes it", "Cherchez ci-dessus, le système l'écrit")}</span>
              </span>
            </button>
          </div>
          <div className="mt-0 h-3.5 bg-gradient-to-b from-[#C99A6A] to-[#A9784A] shadow-[0_6px_10px_-4px_rgba(70,45,20,.4)]" aria-hidden="true" />
          <div className="flex flex-wrap gap-8 px-6 sm:px-8 pt-3 pb-5">
            {books && books.map((b) => (
              <div key={b.product.product_id} className="w-[150px] sm:w-[160px]">
                <p className="text-[14px] font-semibold leading-snug text-[#1E2B22] line-clamp-2">{b.product.name}</p>
                <p className="mt-0.5 text-[12.5px] text-[#6B7468] line-clamp-2">{caption(b)}</p>
                <Link to={`/story/${b.product.product_id}`} className="mt-1 inline-block text-[13.5px] font-bold text-[#1F5D3A] hover:underline">
                  {L3("Đọc sách", "Read the book", "Lire le livre")} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* categories */}
      <section aria-labelledby="cat-title">
        <h2 id="cat-title" className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-display text-[28px] font-semibold text-[#1E2B22]">{L3("Hoặc bắt đầu từ một loại", "Or start with a category", "Ou commencez par une catégorie")}</span>
          <span className="text-[15px] text-[#6B7468]">{L3("Mức giữa CO₂ của mỗi loại; thanh cho biết vị trí trong chính loại đó", "Each category's median; the bar shows where it sits within that category", "Médiane de chaque catégorie ; la barre la situe dans sa propre plage")}</span>
        </h2>
        <ul className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
          {(cats || []).map((c) => {
            const key = canonicalCategory(c.category);
            const ok = [c.min_kg, c.max_kg, c.median_kg].every((v) => typeof v === "number") && c.max_kg > c.min_kg;
            const pos = ok ? Math.max(6, Math.min(100, ((c.median_kg - c.min_kg) / (c.max_kg - c.min_kg)) * 100)) : 0;
            return (
              <li key={c.category}>
                <button type="button" onClick={() => { const s = searchCategory(key) || c.category; navigate(`/search?category=${encodeURIComponent(s)}&has_co2=true&sort=co2_asc`); }}
                        className="w-full text-left rounded-2xl bg-white border border-[#E8E4D8] p-4 hover:border-[#2E7D4F] transition">
                  <span className="flex items-center gap-2.5">
                    <span className="grid place-items-center w-9 h-9 rounded-xl bg-[#EEF5EF] text-[#2E7D4F]"><DeviceIcon name={key} size={20} /></span>
                    <span className="text-[16px] font-bold text-[#1E2B22]">{X.categories[c.category] || X.categories[key] || c.category}</span>
                  </span>
                  <span className="mt-3 block">
                    <span className="font-display text-[25px] font-semibold text-[#1E2B22]">{formatKg(c.median_kg, lang)}</span>
                    <span className="ml-1 whitespace-nowrap text-[12.5px] text-[#6B7468]">{L3("kg trung vị", "kg median", "kg médiane")}</span>
                  </span>
                  <span className="mt-2 block h-1.5 rounded-full bg-[#EEF0EA]">
                    <span className="block h-1.5 rounded-full bg-[#1F5D3A]" style={{ width: `${pos}%` }} />
                  </span>
                  <span className="mt-2 block text-[13px] text-[#6B7468]">{X.catProducts(formatCount(c.products, lang))}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <p className="text-[13px] text-[#7d8579]">
        {L3("Mỗi loại có thang đo riêng; không so CO₂ giữa các loại khác nhau.", "Each category has its own scale; CO₂ is not compared across categories.", "Chaque catégorie a sa propre échelle ; le CO₂ n'est pas comparé entre catégories.")}
      </p>
    </div>
  );
}
