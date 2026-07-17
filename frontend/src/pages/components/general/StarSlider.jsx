import { useState } from "react";

export default function StarSlider({ className, starValue, setStarValue }) {
    const [hoverValue, setHoverValue] = useState(null);
    const displayedValue = hoverValue ?? starValue;

    const updateHoverValue = (event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const relativeX = event.clientX - bounds.left;
        const starCount = Math.min(5, Math.max(1, Math.ceil((relativeX / bounds.width) * 5)));

        setHoverValue(starCount);
    };

    let stars = [];

    for (let i = 0; i < 5; i++) {
        stars.push(
            <span
                key={i}
                className={"text-4xl " + (i < displayedValue ?
                    "text-amber-400" :
                    "text-gray-500 ")}
            >
                {i < displayedValue ? "★" : "☆"}
            </span>
        );
    }

    return (
        <div className={className}>
            <div
                className="relative w-full h-4 flex items-center justify-center"
                onMouseMove={updateHoverValue}
                onMouseLeave={() => setHoverValue(null)}
            >
                <div className="absolute flex justify-between w-full z-12 pointer-events-none">
                    {stars}
                </div>

                <input
                    className="absolute z-10 w-full min-h-full hide-track hide-thumb py-2 opacity-0 cursor-pointer"
                    type="range"
                    min="1"
                    max="5"
                    value={starValue}
                    onChange={(e) => setStarValue(Number(e.target.value))}
                    onMouseDown={updateHoverValue}
                    step="1"
                />
            </div>
        </div>
    );
}