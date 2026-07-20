import ProductFilter from "./ProductFilters";
import { useState } from "react";

export default function ProductMobileFilter({
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
    sortValue,
    setSortValue
}) {

    const handleSortChange = (event) => {
        setSortValue(event.target.value);
    };

    const [open, setOpen] = useState(false)
    const closeFilters = () => setOpen(false)

    const elementHeight = 16

    return (
        <div className="md:hidden sticky top-0 flex flex-col shadow-md">


            <div className={`relative z-10 h-${elementHeight} bg-primary-100 flex gap-4 justify-between p-2 pt-6 items-center`}>
                <button className="bg-primary-500 text-primary-100 py-1 px-2 rounded-2xl" onClick={() => setOpen(!open)}>{open ? "Close filters" : "Open filters"}</button>

                <div className="flex gap-4 items-center">
                    <label>Sort by</label>
                    <select name="sorting" id="sorting" className="bg-primary-200 p-1" onChange={handleSortChange}>
                        <option value="">Relevence</option>
                        <option value="price-low">Price low to high</option>
                        <option value="price-high">Price high to low</option>
                        <option value="eco-friendly">Most eco-friendly</option>
                    </select>
                </div>
            </div>

            <div className={`absolute top-12 ${open?"":"hidden"}`}>
                <div
                    className={`absolute z-0 h-screen w-screen top-0 bg-black/40 transition-opacity duration-500 ease-out ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
                    onClick={closeFilters}
                    aria-hidden="true"
                ></div>

                <div className={`sticky left-0  z-30 h-auto w-[min(90vw,24rem)] overflow-y-auto transition-transform duration-500 ease-out ${open ? "translate-x-0" : "pointer-events-none -translate-x-full"}`}>
                    <ProductFilter
                        className="h-full w-full rounded-r-2xl rounded-l-none shadow-2xl"
                        priceLimit={priceLimit}
                        minPriceValue={minPriceValue}
                        setMinPriceValue={setMinPriceValue}
                        maxPriceValue={maxPriceValue}
                        setMaxPriceValue={setMaxPriceValue}
                        starValue={starValue}
                        setStarValue={setStarValue}
                        gwpLimit={gwpLimit}
                        maxGwpValue={maxGwpValue}
                        setMaxGwpValue={setMaxGwpValue}
                        onSaleOnly={onSaleOnly}
                        setOnSaleOnly={setOnSaleOnly}
                        ignoreGwp={ignoreGwp}
                        setIgnoreGwp={setIgnoreGwp}
                    />
                </div>
            </div>



        </div>
    );
}