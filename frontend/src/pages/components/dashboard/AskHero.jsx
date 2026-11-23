// The first thing on the Overview: say what you need, in words or in four taps.
// "Hỏi AI" sends the sentence to Ask AI; "Xem sản phẩm" runs the same choice as a plain search,
// for anyone who would rather look at the list themselves.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { tri, useI18n } from "../../../i18n/LanguageContext";
import { composeQuery, toSearchParams } from "../../../lib/needs";
import NeedPicker, { NeedChips } from "../assistant/NeedPicker";
import Icon from "../ui/Icon";

export default function AskHero() {
  const { lang } = useI18n();
  const L3 = tri(lang);
  const navigate = useNavigate();
  const [free, setFree] = useState("");
  const [selection, setSelection] = useState({});
  const sentence = composeQuery(selection, lang, free);
  const ready = Boolean(sentence.trim());

  const change = (key, value) => setSelection((s) => ({ ...s, [key]: value }));
  const ask = () => { if (ready) navigate(`/assistant?q=${encodeURIComponent(sentence)}&go=1`); };
  const browse = () => {
    const params = new URLSearchParams(toSearchParams(selection, free));
    navigate(`/search?${params.toString()}`);
  };

  return (
    <section aria-labelledby="hero-title" className="rounded-3xl bg-gradient-to-br from-[#F0F7EE] to-[#FBFAF5] border border-[#DCEBD9] p-5 sm:p-7">
      <p className="eyebrow">Smart Product Finder</p>
      <h1 id="hero-title" className="mt-1 text-[32px] sm:text-[40px] font-bold leading-tight text-[#1E2B22]">
        {L3("Tìm thiết bị phù hợp với bạn", "Find the device that fits you", "Trouvez l'appareil qui vous convient")}
      </h1>
      <p className="mt-1 text-[17px] text-[#55604F] max-w-2xl">
        {L3("Nói nhu cầu và ngân sách của bạn. Hệ thống tìm trong dữ liệu thật, kèm số CO₂ và lý do nên cân nhắc.",
            "Tell us what you need and what you can spend. The site searches the real catalogue and says why a product is worth considering, with its CO₂.",
            "Dites votre besoin et votre budget. Le site cherche dans le vrai catalogue et explique pourquoi un produit mérite d'être considéré, CO₂ compris.")}
      </p>

      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="mt-4 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7468]"><Icon name="sparkles" size={20} /></span>
          <input value={free} onChange={(e) => setFree(e.target.value)}
                 aria-label={L3("Mô tả nhu cầu của bạn", "Describe what you need", "Décrivez votre besoin")}
                 placeholder={L3("Ví dụ: laptop học lập trình, pin trâu", "e.g. a laptop for programming, long battery", "ex. un portable pour programmer, bonne autonomie")}
                 className="w-full rounded-2xl border border-[#E7E2D4] bg-white pl-11 pr-3 py-3.5 text-[17px] focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]" />
        </div>
        <button type="submit" disabled={!ready} className="btn-primary px-6 py-3.5 text-[16.5px] disabled:opacity-50">
          {L3("Hỏi AI", "Ask AI", "Demander à l'IA")}
        </button>
      </form>

      <div className="mt-4"><NeedPicker selection={selection} onChange={change} lang={lang} compact /></div>

      {Object.values(selection).some(Boolean) && (
        <div className="mt-4 rounded-2xl bg-white border border-[#EFEBDF] p-3 space-y-2.5">
          <NeedChips selection={selection} lang={lang} onRemove={(k) => change(k, null)} />
          <p className="text-[14.5px] text-[#6B7468]">
            {L3("Câu sẽ gửi: ", "The question that will be sent: ", "La question envoyée : ")}
            <i className="text-[#1E2B22]">{sentence}</i>
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={ask} className="btn-primary">{L3("Hỏi AI", "Ask AI", "Demander à l'IA")}</button>
            <button type="button" onClick={browse} className="btn-secondary">
              {L3("Tự xem danh sách sản phẩm", "Just show me the products", "Voir simplement les produits")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
