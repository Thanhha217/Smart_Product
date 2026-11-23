// "Tìm thiết bị phù hợp với bạn": a sentence box plus four quick choices (device, purpose,
// budget, priority). The choices are shown back as removable chips, so the visitor can always
// see what the site understood and correct it before asking.
import { NEED_GROUPS, composeQuery, selectionChips } from "../../../lib/needs";
import { tri, useI18n } from "../../../i18n/LanguageContext";
import DeviceIcon from "../ui/DeviceIcon";

export function NeedChips({ selection, onRemove, lang, title }) {
  const L3 = tri(lang);
  const chips = selectionChips(selection, lang);
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[15px] font-semibold text-[#1E2B22]">
        {title ?? L3("Tôi hiểu bạn đang cần:", "What I understood:", "Ce que j'ai compris :")}
      </span>
      {chips.map((c) => (
        <span key={c.key} className="inline-flex items-center gap-1.5 rounded-full bg-[#E4F1E6] border border-[#CFE6D5] pl-3 pr-1.5 py-1 text-[14.5px] text-[#1F5D3A]">
          <span className="text-[#55604F]">{c.group}:</span> <b>{c.label}</b>
          {onRemove && (
            <button type="button" onClick={() => onRemove(c.key)}
                    className="grid place-items-center w-5 h-5 rounded-full hover:bg-[#CFE6D5]"
                    aria-label={L3(`Bỏ ${c.label}`, `Remove ${c.label}`, `Retirer ${c.label}`)}>×</button>
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * @param selection  {device, purpose, budget, priority}
 * @param onChange   (key, value|null) -> void
 */
export default function NeedPicker({ selection, onChange, lang: langProp, compact = false }) {
  const { lang: ctx } = useI18n();
  const lang = langProp || ctx;
  return (
    <div className={compact ? "space-y-2.5" : "space-y-3"}>
      {NEED_GROUPS.map((group) => (
        <fieldset key={group.key} className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">{group.title[lang] || group.title.en}</legend>
          <span className="text-[14px] font-semibold text-[#55604F] w-full sm:w-auto sm:min-w-[108px]">
            {group.title[lang] || group.title.en}
          </span>
          {group.options.map((option) => {
            const on = selection?.[group.key] === option.value;
            return (
              <button key={option.value} type="button" aria-pressed={on}
                      onClick={() => onChange(group.key, on ? null : option.value)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[14.5px] font-medium transition ${
                        on ? "bg-[#1F5D3A] border-[#1F5D3A] text-white shadow-sm"
                           : "bg-white border-[#E7E2D4] text-[#1E2B22] hover:border-[#2E7D4F]"}`}>
                {group.key === "device" && <DeviceIcon name={option.value} size={18} tint={false} />}
                {option.label[lang] || option.label.en}
              </button>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}

export { composeQuery };
