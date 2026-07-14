import { useState } from "react";

export default function ProductSlot({product, image_url, platform_name}) {
    function display_price(price) {
        let stringPrice = price.toString();
        for (let i = 3; i < stringPrice.length; i += 4) {
            stringPrice = stringPrice.slice(0, stringPrice.length-i) + "." + stringPrice.slice(stringPrice.length-i, stringPrice.length)
        }
        return stringPrice;
    }

    return (
        <div className="bg-primary-100 flex flex-col p-2 hover:outline-2 outline-secondary-500">
            <p className="font-bold">{platform_name}</p>
            
            <img src={image_url} alt={product.name}/>

            <p className="line-clamp-2">{product.name}</p>

            <div className="flex items-center gap-2">
                <p className="text-orange-400 text-2xl">{display_price(product.final_price)}₫</p>
                <p className="bg-orange-100 text-orange-400 rounded-2xl text-nowrap px-1">{product.original_price != product.final_price ? "-" + (100 - Math.floor((product.final_price/product.original_price)*100)) + "%" : ""}</p>
            </div>

            <div className="flex justify-between gap-4 pt-2">
                <p className="text-nowrap">★ {product.product_rating} ({product.review_count})</p>
                <p className="text-nowrap bg-green-500 text-white rounded-2xl px-2 font-bold">{product.gwp} kg CO₂e</p>
            </div>
            
        </div>
    );
}