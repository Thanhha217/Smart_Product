export default function StarSlider({className, starValue, setStarValue }) {
    // base slider style
    const baseSliderCss = "absolute appearance-none bg-transparent h-full w-full top-0 left-0 " +
                          "[&::-webkit-slider-thumb]:appearance-none " +
                          "[&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto " +
                          "[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-transparent " +
                          "[&::-webkit-slider-thumb]:-mt-2 " +
                          "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-transparent [&::-moz-range-thumb]:border-none " +
                          "[&::-moz-range-thumb]:top-2";
    // Hide slider track
    const inputsCss = baseSliderCss + " " +
                      "[&::-webkit-slider-runnable-track]:h-0 [&::-webkit-slider-runnable-track]:bg-transparent " +
                      "[&::-moz-range-track]:h-0 [&::-moz-range-track]:bg-transparent";
    
    console.log(starValue)
    const starDisplay = [
        "★",
        starValue >= 2 ? "★" : "☆",
        starValue >= 3 ? "★" : "☆",
        starValue >= 4 ? "★" : "☆",
        starValue == 5 ? "★" : "☆"
    ]

    return (
        <div className={className}>
            <div className="relative w-full h-4 flex items-center justify-center">
                <div className="absolute flex justify-between w-full text-2xl">
                    <p>{starDisplay[0]}</p>
                    <p>{starDisplay[1]}</p>
                    <p>{starDisplay[2]}</p>
                    <p>{starDisplay[3]}</p>
                    <p>{starDisplay[4]}</p>
                </div>

                <input 
                    className={inputsCss} 
                    type="range" 
                    min="1" 
                    max="5" 
                    value={starValue} 
                    onChange={(e) => setStarValue(Number(e.target.value))} 
                    step="1"
                />
            </div>
        </div>
    );
}