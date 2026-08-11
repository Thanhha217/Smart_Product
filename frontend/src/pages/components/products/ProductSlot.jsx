import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../../i18n/LanguageContext";
import { getProductHighlights, getRecommendationReason } from "../../utils/helpers";

export default function ProductSlot({ product, image_url, platform_name }) {
    const navigate = useNavigate();
    const { t, formatNumber } = useI18n();

    const goToProduct = (e) => {
        navigate(`/product/${product.id}`, { state: { product } });
    };

    const highlights = getProductHighlights(product);
    const reason = getRecommendationReason(product, platform_name, t);

    return (
        <div onClick={goToProduct} className="bg-primary-100 flex flex-row gap-4 md:gap-0 md:flex-col rounded-md p-2 outline-transparent outline-2 transition duration-100 ease-in-out hover:outline-secondary-500  cursor-pointer">
            <div className="flex flex-col">
                <p className="font-bold">{platform_name}</p>

                <img className="border-primary-200 border-2 bg-white min-w-45 max-w-45 h-50 object-contain object-center md:max-w-full md:w-full md:h-60" src={image_url} alt={product.name} />
            </div>

            <div className="flex flex-col justify-between flex-grow">
                <div>
                    <p className="line-clamp-2 h-12 font-medium text-gray-800">{product.name}</p>
                    
                    {/* Key Highlights / Details */}
                    <ul className="text-[11px] text-gray-500 my-1.5 list-disc pl-4 space-y-0.5 min-h-[36px] max-h-[36px] overflow-hidden">
                        {highlights.slice(0, 2).map((hl, idx) => (
                            <li key={idx} className="line-clamp-1">{hl}</li>
                        ))}
                    </ul>

                    {/* Recommendation Reason / Explanation */}
                    {reason && (
                        <div className="bg-orange-50 border border-orange-100 rounded px-1.5 py-0.5 text-[10px] text-orange-700 italic my-1 font-medium line-clamp-1">
                            ✨ {reason}
                        </div>
                    )}
                </div>

                <div>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-orange-400 text-2xl">{formatNumber(product.final_price)}₫</p>
                        <p className="bg-orange-100 text-orange-400 rounded-2xl text-nowrap px-1">{product.original_price != product.final_price ? "-" + (100 - Math.floor((product.final_price / product.original_price) * 100)) + "%" : ""}</p>
                    </div>
                
                    <div className="flex flex-col md:flex-row justify-between gap-x-4 gap-y-2 pt-2">
                        <p className="text-nowrap">★ {product.review_count ? `${product.product_rating * 5.0} (${product.review_count})` : t("product.noRating")}</p>
                        {product.co2e_kg !== null && product.co2e_kg !== undefined ? (
                            <p className="text-nowrap bg-green-500 text-white rounded-2xl px-2 font-bold w-min">{product.co2e_kg} kg CO₂e</p>
                        ) : (
                            <p className="text-nowrap bg-gray-400 text-white rounded-2xl px-2 font-bold w-min text-xs flex items-center justify-center">{t("product.co2ShortUnavailable")}</p>
                        )}
                    </div>
                </div>

            </div>

        </div>
    );
}