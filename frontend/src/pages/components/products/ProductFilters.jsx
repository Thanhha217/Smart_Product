import RangeSlider from "../general/RangeSlider";
import StarSlider from "../general/StarSlider";
import { useI18n } from "../../../i18n/LanguageContext";

export default function ProductFilter({
    className,
    priceLimit,
    minPriceValue,
    setMinPriceValue,
    maxPriceValue,
    setMaxPriceValue,
    starValue,
    setStarValue,
    gwpLimit,
    maxGwpValue,
    setMaxGwpValue,
    onSaleOnly,
    setOnSaleOnly,
    ignoreGwp,
    setIgnoreGwp,
}) {
    const { t } = useI18n();

    const titleCss = "text-[16px] font-bold text-[#1E2B22]"
    const numCss = "w-full bg-[#F6F4EC] border border-[#E7E2D4] rounded-xl pl-3 pr-14 py-2 text-right text-[15px] font-semibold"
    const unitCss = "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13.5px] text-[#6B7468]"

    const handleMinChange = (e) => {
        const val = Number(e.target.value);
        setMinPriceValue(Math.min(val, maxPriceValue));
    };

    const handleMaxChange = (e) => {
        const val = Number(e.target.value);
        setMaxPriceValue(Math.max(Math.min(val, priceLimit), minPriceValue));
    };

    const handleStarChange = (e) => {
        setStarValue(Number(e.target.value));
    };

    const handleGwpChange = (e) => {
        setMaxGwpValue(Number(e.target.value));
    };



    return (
        <aside className={"flex flex-col gap-5 "+ className}>
            {/* <p className="text-primary-900 font-bold text-xl whitespace-nowrap">Filters</p> */}
            <section className="flex flex-col gap-3">
                <p className={titleCss}>{t("filter.priceRange")}</p>
                <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
                    <span className="text-[14px] text-[#55604F]">{t("filter.from")}</span>
                    <label className="relative block">
                        <input type="number" aria-label="min price" className={numCss} min="0" max={priceLimit} value={minPriceValue} onChange={handleMinChange}/>
                        <span className={unitCss}>.000₫</span>
                    </label>
                    <span className="text-[14px] text-[#55604F]">{t("filter.to")}</span>
                    <label className="relative block">
                        <input type="number" aria-label="max price" className={numCss} min="0" max={priceLimit} value={maxPriceValue} onChange={handleMaxChange}/>
                        <span className={unitCss}>.000₫</span>
                    </label>
                </div>
                <div className="px-1">
                    <RangeSlider
                        maxLimit={priceLimit}
                        minValue={minPriceValue}
                        setMinValue={setMinPriceValue}
                        maxValue={maxPriceValue}
                        setMaxValue={setMaxPriceValue}
                    />
                </div>
            </section>

            <section className="flex flex-col gap-3 border-t border-[#EFEBDF] pt-5">
                <p className={titleCss}>{t("filter.minRating")}</p>
                <StarSlider
                    className="w-full"
                    starValue={starValue}
                    setStarValue={setStarValue}
                />
                <label className="relative block w-32">
                    <input type="number" aria-label="minimum stars" className={numCss} min="0" max="5" value={starValue} onChange={handleStarChange}/>
                    <span className={unitCss}>{t("filter.stars")}</span>
                </label>
            </section>

            <section className="flex flex-col gap-3 border-t border-[#EFEBDF] pt-5">
                <p className={titleCss}>{t("filter.maxGwp")}</p>
                <input type="range" className="w-full" min="0" max={gwpLimit} value={maxGwpValue} onChange={handleGwpChange}/>
                <label className="relative block w-40">
                    <input type="number" aria-label="max kg CO2e" className={numCss + " !pr-20"} min="0" max={gwpLimit} value={maxGwpValue} onChange={handleGwpChange}/>
                    <span className={unitCss}>kg CO₂e</span>
                </label>
            </section>

            <section className="flex flex-col gap-3 border-t border-[#EFEBDF] pt-5">
            <p className={titleCss}>{t("filter.productFilters")}</p>

            <div className="flex flex-col gap-2.5 text-[15px]">
                <div className="flex items-center gap-2">
                    <input type="checkbox" name="on-sale-check" id="on-sale-check" aria-labelledby="on-sale-label" checked={onSaleOnly} onChange={(e) => setOnSaleOnly(e.target.checked)}/>
                    <label id="on-sale-label" htmlFor="on-sale-check">{t("filter.onSale")}</label>
                </div>
                <div className="flex items-center gap-2">
                    <input type="checkbox" name="ignore-gwp-check" id="ignore-gwp-check" aria-labelledby="ignore-gwp-label" checked={ignoreGwp} onChange={(e) => setIgnoreGwp(e.target.checked)}/>
                    <label id="ignore-gwp-label" htmlFor="ignore-gwp-check">{t("filter.ignoreGwp")}</label>
                </div>
            </div>
            </section>
        </aside>
    );
}