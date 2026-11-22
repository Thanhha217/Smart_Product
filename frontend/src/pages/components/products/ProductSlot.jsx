import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../../i18n/LanguageContext";

export default function ProductSlot({ product, image_url, platform_name }) {
    const navigate = useNavigate();
    const { t, formatNumber } = useI18n();


    const goToProduct = (e) => {
        navigate(`/product/${product.id}`)
    };

    return (
        <div onClick={goToProduct} className="bg-primary-100 flex flex-row gap-4 md:gap-0 md:flex-col rounded-md p-2 outline-transparent outline-2 transition duration-100 ease-in-out hover:outline-secondary-500  cursor-pointer">
            <div className="flex flex-col">
                <p className="font-bold">{platform_name}</p>

                <img className="border-primary-200 border-2 bg-white min-w-45 max-w-45 h-50 object-contain object-center md:max-w-full md:w-full md:h-60" src={image_url} alt={product.name} />
            </div>

            <div className="flex flex-col">
                <p className="line-clamp-2 h-12">{product.name}</p>

                <div className="flex items-center gap-2">
                    <p className="text-orange-400 text-2xl">{formatNumber(product.final_price)}₫</p>
                    <p className="bg-orange-100 text-orange-400 rounded-2xl text-nowrap px-1">{product.original_price != product.final_price ? "-" + (100 - Math.floor((product.final_price / product.original_price) * 100)) + "%" : ""}</p>
                </div>
            
                <div className="flex flex-col md:flex-row justify-between gap-x-4 gap-y-2 pt-2">
                    <p className="text-nowrap">★ {product.review_count ? `${product.product_rating * 5.0} (${product.review_count})` : t("product.noRating")}</p>
                    <p className="text-nowrap bg-green-500 text-white rounded-2xl px-2 font-bold w-min">{product.co2e_kg} kg CO₂e</p>
                </div>

            </div>


        </div>
    );
}