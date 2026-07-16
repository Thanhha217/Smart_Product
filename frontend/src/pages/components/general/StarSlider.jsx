export default function StarSlider({className, starValue, setStarValue }) {
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
                    className="absolute z-10 w-full min-h-full hide-track hide-thumb py-2" 
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