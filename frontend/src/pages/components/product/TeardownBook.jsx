// "Inside the machine": the parts of one laptop, read page by page in the book the CO₂ story
// already uses (components/story/Flipbook.jsx -- no new dependency, same paper and page turn).
//
// Every line comes from lib/teardown.js, which quotes a named source. A line the manufacturer
// published for the model FAMILY rather than this exact SKU is marked, so the page says how sure
// it is. No CO₂ per part is shown: nobody publishes one (see the note in lib/teardown.js).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { tri } from "../../../i18n/LanguageContext";
import { formatPrice } from "../../../lib/data";
import { formatKg } from "../../../lib/format";
import ProductThumb from "../common/ProductThumb";
import Flipbook from "../story/Flipbook";
import Icon from "../ui/Icon";

/** Label for a spec key, in the visitor's language. */
function label(k, L3) {
  return {
    size: L3("Kích thước", "Size", "Taille"),
    panel: L3("Tấm nền", "Panel", "Dalle"),
    resolution: L3("Độ phân giải", "Resolution", "Résolution"),
    refresh: L3("Tần số quét", "Refresh rate", "Fréquence"),
    gamut: L3("Dải màu", "Colour gamut", "Gamme de couleurs"),
    touch: L3("Cảm ứng", "Touch", "Tactile"),
    model: L3("Vi xử lý", "Processor", "Processeur"),
    cores: L3("Nhân / luồng", "Cores / threads", "Cœurs / threads"),
    clock: L3("Xung nhịp", "Clock", "Fréquence"),
    cache: L3("Bộ nhớ đệm", "Cache", "Cache"),
    gpu: L3("Card đồ hoạ", "Graphics", "Carte graphique"),
    npu: L3("Chip AI (NPU)", "AI engine (NPU)", "Puce IA (NPU)"),
    ram: L3("RAM", "RAM", "RAM"),
    upgrade: L3("Nâng cấp", "Upgradeable", "Évolutivité"),
    storage: L3("Lưu trữ", "Storage", "Stockage"),
    battery: L3("Pin", "Battery", "Batterie"),
    weight: L3("Cân nặng", "Weight", "Poids"),
    chassis: L3("Vỏ máy", "Chassis", "Châssis"),
    size_mm: L3("Kích thước máy", "Dimensions", "Dimensions"),
    os: L3("Hệ điều hành", "Operating system", "Système"),
  }[k] || k;
}

/** A few values are codes rather than free text, so they can be said in three languages. */
function value(v, L3) {
  return {
    no: L3("Không", "No", "Non"),
    soldered: L3("Hàn chết trên bo, không nâng cấp được", "Soldered, not upgradeable", "Soudée, non évolutive"),
    max32: L3("Tối đa 32 GB", "Up to 32 GB", "Jusqu'à 32 Go"),
    max64: L3("Tối đa 64 GB", "Up to 64 GB", "Jusqu'à 64 Go"),
    max96: L3("Tối đa 96 GB", "Up to 96 GB", "Jusqu'à 96 Go"),
  }[v] || v;
}

export function Rows({ rows, L3 }) {
  return (
    <dl className="mt-4 divide-y divide-[#EDE6D5]">
      {rows.map((r) => (
        <div key={r.k} className="grid grid-cols-[minmax(96px,34%)_1fr] gap-3 py-2.5">
          <dt className="text-[14px] text-[#8b7f66]">{label(r.k, L3)}</dt>
          <dd className="text-[15.5px] font-semibold leading-snug text-[#2a2316]">
            {value(r.v, L3)}
            {r.approx && (
              <span className="ml-1.5 whitespace-nowrap rounded-full bg-[#F1EADB] px-1.5 py-0.5 text-[11.5px] font-medium text-[#8b7f66]"
                    title={L3("Hãng công bố cho dòng máy, không riêng mã máy này",
                              "Published for the model family, not for this exact SKU",
                              "Publié pour la gamme, pas pour cette référence exacte")}>
                {L3("theo dòng máy", "model family", "gamme")}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Head({ eyebrow, title }) {
  return (
    <>
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#a8976f]">{eyebrow}</p>
      <h3 className="mt-1 font-display text-[26px] font-semibold leading-tight text-[#2a2316]">{title}</h3>
    </>
  );
}

/** Wide enough for a two-page spread? Same breakpoint Flipbook itself uses. */
function useWide() {
  const q = "(min-width: 900px)";
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

/** The six pages, built from one teardown entry. */
export function buildPages({ product, data, lang }) {
  const L3 = tri(lang);
  const n = (i) => L3(`Trang ${i} / 6`, `Page ${i} of 6`, `Page ${i} / 6`);

  return [
    <div key="cover" className="flex h-full flex-col items-center justify-center text-center">
      <div className="w-full max-w-[260px] overflow-hidden rounded-2xl bg-[#F3EFE4]">
        <ProductThumb product={product} className="h-40" rounded="rounded-2xl" standIn={false} />
      </div>
      <p className="mt-5 text-[12px] font-bold uppercase tracking-[0.16em] text-[#a8976f]">
        {L3("Bên trong máy", "Inside the machine", "Dans la machine")}
      </p>
      <h2 className="mt-1 font-display text-[27px] font-semibold leading-tight text-[#2a2316]">{data.brand} {data.model}</h2>
      <p className="mt-3 text-[15px] text-[#6b6354]">
        {product.price_vnd ? formatPrice(product.price_vnd, lang) : null}
        {product.price_vnd && product.co2e_kg !== null && product.co2e_kg !== undefined ? " · " : null}
        {product.co2e_kg !== null && product.co2e_kg !== undefined ? `${formatKg(product.co2e_kg, lang)} kg CO₂e` : null}
      </p>
      <p className="mt-5 text-[14px] text-[#8b7f66]">
        {L3("Lật trang để xem từng bộ phận.", "Turn the page to see each part.", "Tournez la page pour voir chaque pièce.")}
      </p>
    </div>,

    <div key="screen">
      <Head eyebrow={n(2)} title={L3("Màn hình", "The screen", "L'écran")} />
      <Rows rows={data.screen} L3={L3} />
    </div>,

    <div key="cpu">
      <Head eyebrow={n(3)} title={L3("Vi xử lý & đồ hoạ", "Processor & graphics", "Processeur & graphismes")} />
      <Rows rows={data.cpu} L3={L3} />
    </div>,

    <div key="memory">
      <Head eyebrow={n(4)} title={L3("Bộ nhớ & lưu trữ", "Memory & storage", "Mémoire & stockage")} />
      <Rows rows={data.memory} L3={L3} />
      <p className="mt-4 rounded-xl bg-[#F6F1E3] px-3 py-2 text-[13.5px] leading-snug text-[#6b6354]">
        {L3("RAM hàn chết nghĩa là không thể nâng thêm sau này — muốn dùng lâu thì nên chọn dung lượng dư ngay từ đầu.",
            "Soldered RAM cannot be added to later — if you want the machine to last, buy enough of it now.",
            "Une RAM soudée ne peut pas être augmentée plus tard : prévoyez large dès l'achat.")}
      </p>
    </div>,

    <div key="power">
      <Head eyebrow={n(5)} title={L3("Pin & vỏ máy", "Battery & body", "Batterie & châssis")} />
      <Rows rows={data.power} L3={L3} />
    </div>,

    <div key="sources">
      <Head eyebrow={n(6)} title={L3("Số liệu lấy từ đâu", "Where these figures come from", "D'où viennent ces chiffres")} />
      <ul className="mt-4 space-y-2.5">
        {data.sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer" className="text-[15px] font-semibold text-[#1F5D3A] underline">{s.label}</a>
          </li>
        ))}
      </ul>
      <p className="mt-5 rounded-xl bg-[#F6F1E3] px-3 py-2.5 text-[13.5px] leading-relaxed text-[#6b6354]">
        {L3("Trang này chỉ liệt kê cấu hình, không chia CO₂ theo từng bộ phận: không hãng nào công bố con số đó, và tự chia ra sẽ thành số bịa.",
            "These pages list the configuration only. They do not split the CO₂ across parts: no manufacturer publishes such a number, and splitting it here would be a made-up figure.",
            "Ces pages listent la configuration seulement : aucun fabricant ne publie le CO₂ par pièce, et le répartir ici serait un chiffre inventé.")}
      </p>
      <p className="mt-4">
        <Link to={`/story/${product.product_id}`} className="text-[15px] font-semibold text-[#1F5D3A] underline">
          {L3("Xem CO₂ book của máy này", "See this machine's CO₂ book", "Voir le livre CO₂ de cette machine")} →
        </Link>
      </p>
    </div>,
  ];
}

export default function TeardownBook({ product, data, lang, height }) {
  const L3 = tri(lang);
  const [index, setIndex] = useState(0);
  const pages = buildPages({ product, data, lang });
  const wide = useWide();
  // On a wide screen the book shows a spread and ignores the odd index (target = index - index % 2),
  // so stepping by one looked like "the page did not change". Step by the spread, and name it.
  const step = wide ? 2 : 1;
  const left = wide ? index - (index % 2) : index;
  const last = pages.length - 1;
  const atEnd = left + step > last;
  const where = wide
    ? `${left + 1}–${Math.min(left + 2, pages.length)} / ${pages.length}`
    : `${index + 1} / ${pages.length}`;

  // Flipbook's own root is `mx-auto` with no width of its own, so it must sit in normal block
  // flow. As a flex child the auto margins beat `stretch` and the book collapses to its spine.
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Flipbook pages={pages} index={index} onIndex={setIndex} height={height} />
      <div className="mt-3 flex items-center justify-center gap-3">
        <button type="button" onClick={() => setIndex(Math.max(0, left - step))} disabled={left === 0}
                className="grid h-10 w-10 place-items-center rounded-full border border-[#DCD6C6] bg-white text-[#1E2B22] transition hover:border-[#2E7D4F] disabled:opacity-35"
                aria-label={L3("Trang trước", "Previous page", "Page précédente")}>
          <Icon name="arrowRight" size={17} className="rotate-180" />
        </button>
        <p className="min-w-[96px] text-center text-[14px] font-semibold text-[#6b6354]" aria-live="polite">
          {where}
        </p>
        <button type="button" onClick={() => setIndex(Math.min(last, left + step))} disabled={atEnd}
                className="grid h-10 w-10 place-items-center rounded-full border border-[#DCD6C6] bg-white text-[#1E2B22] transition hover:border-[#2E7D4F] disabled:opacity-35"
                aria-label={L3("Trang sau", "Next page", "Page suivante")}>
          <Icon name="arrowRight" size={17} />
        </button>
      </div>
    </div>
  );
}
