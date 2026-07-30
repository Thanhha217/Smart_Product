import RangeSlider from "../general/RangeSlider";
import StarSlider from "../general/StarSlider";

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
    const titleCss = "text-primary-500 font-bold text-xl whitespace-nowrap"

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
        <aside className={"bg-primary-100 rounded-2xl h-16 flex flex-col gap-x-4 gap-y-6 p-6 "+ className}>
            {/* <p className="text-primary-900 font-bold text-xl whitespace-nowrap">Filters</p> */}
            <p className={titleCss}>Price range</p>


            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap w-full justify-center">
                    <input type="number" className="bg-primary-200 text-right" min="0" max={priceLimit} value={minPriceValue} onChange={handleMinChange}/>
                    <label>.000₫</label>
                    <p className="px-2 text-center">~</p>
                    <input type="number" className="bg-primary-200 text-right" min="0" max={priceLimit} value={maxPriceValue} onChange={handleMaxChange}/>
                    <label>.000₫</label>
                </div>
                
                <RangeSlider 
                    maxLimit={priceLimit}
                    minValue={minPriceValue}
                    setMinValue={setMinPriceValue}
                    maxValue={maxPriceValue}
                    setMaxValue={setMaxPriceValue}
                />
            </div>


            <p className={titleCss}>Minimum rating</p>


            <div className="flex gap-4 justify-center flex-wrap">
                <StarSlider 
                    className="min-w-25 flex-1"
                    starValue={starValue}
                    setStarValue={setStarValue}
                />
                <div>
                    <input type="number" className="bg-primary-200 text-right" min="0" max="5" value={starValue} onChange={handleStarChange}/>
                    <label>stars</label>
                </div>
                
            </div>


            <p className={titleCss}>Maximum GWP</p>


            <div className="flex gap-4 justify-center flex-wrap">
                <input type="range" className="flex-1 min-w-20" min="0" max={gwpLimit} value={maxGwpValue} onChange={handleGwpChange}/>
                <div className="flex">
                    <input type="number" className="" min="0" max={gwpLimit} value={maxGwpValue} onChange={handleGwpChange}/>
                    <label className="text-nowrap">kg CO₂e</label>
                </div>
                
            </div>


            <p className={titleCss}>Product filters</p>

            <div className="flex flex-col gap-2">
                <div className="flex gap-1">
                    <input type="checkbox" name="on-sale-check" id="on-sale-check" aria-labelledby="on-sale-label" checked={onSaleOnly} onChange={(e) => setOnSaleOnly(e.target.checked)}/>
                    <label id="on-sale-label" htmlFor="on-sale-check">On sale</label>
                </div>
                <div className="flex gap-1">
                    <input type="checkbox" name="ignore-gwp-check" id="ignore-gwp-check" aria-labelledby="ignore-gwp-label" checked={ignoreGwp} onChange={(e) => setIgnoreGwp(e.target.checked)}/>
                    <label id="ignore-gwp-label" htmlFor="ignore-gwp-check">Ignore GWP</label>
                </div>
            </div>
        </aside>
    );
}