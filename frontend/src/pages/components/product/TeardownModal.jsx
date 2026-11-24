// The pop-up that holds the "Inside the machine" book: Escape closes it, so does a click on the
// backdrop or the X. While it is open the page behind cannot scroll, and when it closes the
// focus goes back to the button that opened it, so a keyboard never loses its place.
import { useEffect, useRef } from "react";
import { tri } from "../../../i18n/LanguageContext";
import Icon from "../ui/Icon";
import TeardownBook, { Rows } from "./TeardownBook";
import MachineExplorer from "./MachineExplorer";

// Machines drawn as a zoomable isometric cutaway; the rest still read as a book.
const ISO_MACHINES = new Set(["660"]);

export default function TeardownModal({ product, data, lang, onClose }) {
  const L3 = tri(lang);
  const panel = useRef(null);
  const opener = useRef(typeof document !== "undefined" ? document.activeElement : null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    // the page behind must not scroll while the book is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const back = opener.current;
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
      if (back && typeof back.focus === "function") back.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button type="button" aria-label={L3("Đóng", "Close", "Fermer")} onClick={onClose}
              className="absolute inset-0 cursor-default bg-[#1E2B22]/55 backdrop-blur-[2px]" />
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${data.brand} ${data.model}`}
           className="relative flex max-h-full w-full max-w-[920px] flex-col overflow-hidden rounded-[24px] bg-[#FBF7EC] p-4 shadow-2xl outline-none sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#2E7D4F]">
              {L3("Bên trong máy", "Inside the machine", "Dans la machine")}
            </p>
            <h2 className="truncate font-display text-[21px] font-semibold text-[#1E2B22]">{data.brand} {data.model}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={L3("Đóng", "Close", "Fermer")}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#DCD6C6] bg-white text-[#1E2B22] transition hover:border-[#2E7D4F]">
            <Icon name="close" size={17} />
          </button>
        </div>
        {ISO_MACHINES.has(String(product.product_id))
          ? <MachineExplorer data={data} product={product} lang={lang} height={420} renderRows={(rows) => <Rows rows={rows} L3={L3} />} />
          : <TeardownBook product={product} data={data} lang={lang} height={420} />}
      </div>
    </div>
  );
}
