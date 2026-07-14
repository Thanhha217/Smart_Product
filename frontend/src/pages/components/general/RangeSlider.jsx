export default function RangeSlider({ minValue, setMinValue, maxValue, setMaxValue }) {
    if (minValue > maxValue) {
        let temp = minValue
        setMinValue(maxValue)
        setMaxValue(temp)
    }
    
    const minPercent = (minValue / 100000) * 100;
    const maxPercent = (maxValue / 100000) * 100;

    // base slider style
    // const baseSliderCss = " " +
    //                       "[&::-webkit-slider-thumb]:appearance-none " +
    //                       "[&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto " +
    //                       "[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-secondary-500 " +
    //                       "[&::-webkit-slider-thumb]:-mt-2 " +
    //                       "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-secondary-500 [&::-moz-range-thumb]:border-none " +
    //                       "[&::-moz-range-thumb]:top-2";
    // Hide slider track
    const inputsCss = "absolute h-full w-full top-0 left-0 pointer-events-none hide-track";

    return (
        /* The container handles the vertical alignment zone */
        <div className="relative w-full h-4 flex items-center justify-center">

            <div className="absolute h-2 rounded-lg bg-primary-200 w-full"></div>

            
            <div className="absolute h-2 px-2 w-full">
                <div 
                    className="relative w-full h-full bg-secondary-700"
                    style={{
                        left: `${minPercent}%`,
                        width: `${maxPercent - minPercent}%`
                    }}
                ></div>
            </div>
            <input 
                className={inputsCss} 
                type="range" 
                min="0" 
                max="100000" 
                value={minValue} 
                onChange={(e) => setMinValue(Number(e.target.value))} 
                step="10"
            />
            <input 
                className={inputsCss} 
                type="range" 
                min="0" 
                max="100000" 
                value={maxValue} 
                onChange={(e) => setMaxValue(Number(e.target.value))} 
                step="10"
            />
            
        </div>
    );
}