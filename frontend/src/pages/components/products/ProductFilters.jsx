import RangeSlider from "../general/RangeSlider";
import { useState } from "react";
import StarSlider from "../general/StarSlider";

export default function ProductFilter({className}) {
    const MAX_PRICE = 100000

    const titleCss = "text-primary-500 font-bold text-xl whitespace-nowrap"
    const [minPriceValue, setMinPriceValue] = useState(0);
    const [maxPriceValue, setMaxPriceValue] = useState(MAX_PRICE);

    const [starValue, setStarValue] = useState(1);

    const handleMinChange = (e) => {
        const val = Number(e.target.value);
        setMinPriceValue(Math.min(val, maxPriceValue));
    };

    const handleMaxChange = (e) => {
        const val = Number(e.target.value);
        setMaxPriceValue(Math.max(Math.min(val, MAX_PRICE), minPriceValue));
    };

    const handleStarChange = (e) => {
        setStarValue(Number(e.target.value));
    };

    return (
        <aside className={"bg-primary-100 rounded-2xl h-16 flex flex-col gap-x-4 gap-y-6 p-6 "+ className}>
            {/* <p className="text-primary-900 font-bold text-xl whitespace-nowrap">Filters</p> */}
            <p className={titleCss}>Price range</p>

            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap w-full justify-center">
                    <input type="number" className="bg-primary-200 text-right" min="0" max={MAX_PRICE} value={minPriceValue} onChange={handleMinChange}/>
                    <label>.000₫</label>
                    <p className="px-2 text-center">~</p>
                    <input type="number" className="bg-primary-200 text-right" min="0" max={MAX_PRICE} value={maxPriceValue} onChange={handleMaxChange}/>
                    <label>.000₫</label>
                </div>
                
                <RangeSlider 
                    minValue={minPriceValue}
                    setMinValue={setMinPriceValue}
                    maxValue={maxPriceValue}
                    setMaxValue={setMaxPriceValue}
                />
            </div>

            

            <p className={titleCss}>Minimum rating</p>
            <div className="flex gap-4 justify-center flex-wrap">
                <StarSlider 
                    className="min-w-40"
                    starValue={starValue}
                    setStarValue={setStarValue}
                />

                <input type="number" className="bg-primary-200 text-right" min="1" max="5" value={starValue} onChange={handleStarChange}/>
                <label>stars</label>
            </div>

            <p className={titleCss}>Maximum GWP</p>
            <p className={titleCss}>Product filters</p>
        </aside>
    );
}