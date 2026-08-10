import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { generateMockProducts } from "./components/products/productMock";
import ProductCarousel from "./components/products/ProductCarousel";
import { GATEWAY_URL } from "./utils/consts";
import { useI18n } from "../i18n/LanguageContext";
import { getProductHighlights, getRecommendationReason } from "./utils/helpers";


export default function Product() {
    const params = useParams()
    const { t, formatNumber } = useI18n();

    // const productInfo = {
    //     platform_name: "Shopee",
    //     category_name: "Smartphone",
    //     image_url: "/logo192.png",
    //     seller: {
    //         name: "Super seller",
    //         seller_rating: 80
    //     },
    //     product: {
    //         id: productId,
    //         product_url: "https://youtu.be/dQw4w9WgXcQ",
    //         name: "Test product",
    //         original_price: 15636212,
    //         final_price: 12010000,
    //         product_rating: 4.6,
    //         review_count: 123,
    //         gwp: 12.3
    //     },
    //     return_policy: {
    //         days_for_return: 30,
    //         free_delivery: true,
    //         warranty_duration: 12
    //     }

    // }


    const [productInfo, setProductInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProductInfo = async (productId) => {
            try {
                const res = await fetch(`${GATEWAY_URL}/product/${productId}`);
                const data = await res.json();
                setProductInfo(data.product);
            } catch (error) {
                console.log("Failed to fetch product details, falling back to mock product:", error);
                const mockList = generateMockProducts();
                const matched = mockList.find(item => item.product.id === productId);
                if (matched) {
                    setProductInfo(matched);
                }
            } finally {
                setLoading(false);
            }
        };

        if (params.productId) {
            fetchProductInfo(params.productId);
        }
    }, [params.productId]);

    const tagStyle = "bg-primary-200 rounded-2xl text-nowrap py-1 px-2";

    if (loading) {
        return <div className="flex justify-center items-center p-10 min-h-full">{t("product.loading")}</div>;
    }

    if (!productInfo) {
        return <div className="flex justify-center items-center p-10 min-h-full">{t("product.notFound")}</div>;
    }

    const highlights = getProductHighlights(productInfo);
    const reason = getRecommendationReason(productInfo, productInfo.platform_name, t);


    return (
        <div className="flex flex-col items-center gap-2 py-6 md:p-10 min-h-full">
            <div className="flex justify-start w-full px-2">
                <p className="text-primary-800 hover:underline cursor-pointer">{productInfo.category_name}</p>
            </div>
            
            <div className="bg-primary-100 rounded-2xl max-w-full md:min-w-full md:min-h-5/12 flex md:items-normal flex-col md:flex-row p-6 gap-2">
                <img className="w-full md:w-120 md:h-120 bg-white border-2 border-primary-200" src={productInfo.image_url} />
                <div className="flex flex-col justify-between md:px-12 max-w-full items-center md:items-baseline gap-10">
                    <div className='flex flex-col gap-4'>
                        <p className="font-bold text-2xl">{productInfo.platform_name}</p>
                        
                        <h1 className="text-4xl">{productInfo.product.name}</h1>

                        <div className="flex gap-4">
                            <p className="text-nowrap">★ {productInfo.product.review_count ? (`${productInfo.product.product_rating * 5.0} (${productInfo.product.review_count})`) : t("product.noRating")}</p>
                            <p>
                                {t("product.seller")}: {productInfo.seller.name} (
                                {productInfo.seller.seller_rating <= 0
                                    ? t("product.noSellerRating")
                                    : t("product.goodRatings", { percent: productInfo.seller.seller_rating })}
                                )
                            </p>
                        </div>

                        <p className="text-orange-400 text-4xl font-bold">{formatNumber(productInfo.product.final_price)}₫</p>
                        <div className={"flex gap-4 " + (productInfo.product.original_price != productInfo.product.final_price ? "" : "hidden")}>
                            <p className="text-primary-800 line-through">{formatNumber(productInfo.product.original_price)}₫</p>
                            <p className="bg-orange-100 text-orange-400 rounded-2xl text-nowrap px-1">{"-" + (100 - Math.floor((productInfo.product.final_price / productInfo.product.original_price) * 100)) + "%"}</p>
                        </div>
                        
                        <div className="flex flex-wrap gap-x-4 gap-y-2 md:gap-6">
                            <p className={(productInfo.return_policy.free_delivery ? "" : "hidden ") + tagStyle}>{t("product.freeDelivery")}</p>
                            <p className={(productInfo.return_policy.days_for_return ? "" : "hidden ") + tagStyle}>{t("product.daysReturn", { days: productInfo.return_policy.days_for_return })}</p>
                            <p className={(productInfo.return_policy.warranty_duration ? "" : "hidden ") + tagStyle}>{t("product.warranty", { months: productInfo.return_policy.warranty_duration })}</p>
                        </div>

                        {/* Why Recommended Callout (Explanation) */}
                        <div className="bg-orange-50 border-l-4 border-orange-500 rounded-r-xl p-4 my-2 w-full">
                            <h3 className="font-bold text-orange-950 text-sm flex items-center gap-1.5 mb-1">
                                ✨ {t("product.whyRecommended")}
                            </h3>
                            <p className="text-gray-700 text-sm italic">
                                "{reason}"
                            </p>
                        </div>

                        {/* Product Highlights / Specs (Details) */}
                        {highlights.length > 0 && (
                            <div className="flex flex-col gap-2 my-2 w-full">
                                <h3 className="font-bold text-primary-900 text-sm">
                                    📋 {t("product.keyHighlights")}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {highlights.map((hl, idx) => (
                                        <div key={idx} className="bg-primary-50 rounded-lg p-2.5 border border-primary-150 flex items-start gap-2">
                                            <span className="text-primary-500 font-bold text-xs">✔</span>
                                            <span className="text-gray-700 text-xs">{hl}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {productInfo.product.co2e_kg !== null && productInfo.product.co2e_kg !== undefined ? (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2 bg-green-500 rounded-2xl text-white p-3 w-fit">
                                    <span>{t("product.estimatedGwp")}: <span className="font-bold">{productInfo.product.co2e_kg}</span> kg CO₂e</span>
                                    <div className="group relative cursor-pointer ml-1 inline-block">
                                        <span className="bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">ⓘ</span>
                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-gray-800 text-white text-xs rounded p-2 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-10 shadow-lg">
                                            {t("product.co2ExplanationDisclaimer")}
                                        </div>
                                    </div>
                                </div>
                                {productInfo.product.co2e_explanation && (
                                    <p className="text-sm text-primary-800 italic">
                                        {t("product.aiExplanation")}: "{productInfo.product.co2e_explanation}"
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 bg-gray-400 rounded-2xl text-white p-3 w-fit">
                                <span>{t("product.estimatedGwp")}: <span className="font-bold">{t("product.co2Unavailable")}</span></span>
                                <div className="group relative cursor-pointer ml-1 inline-block">
                                    <span className="bg-gray-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">ⓘ</span>
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-gray-800 text-white text-xs rounded p-2 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-10 shadow-lg">
                                        {productInfo.product.co2e_source === "unsupported" ? t("product.co2NotSupported") : t("product.co2UnavailableTooltip")}
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                    <div className="py-2">
                        <a 
                            href={productInfo.product.product_url}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-center w-full bg-primary-500 rounded-2xl text-2xl font-bold text-primary-100 px-4 py-2  p-100 cursor-pointer hover:bg-primary-800 transition duration-100 ease-in-out">
                            {t("product.checkOnWebsite")}
                        </a>
                    </div>
                </div>

            </div>

            {/* Sustainability & Carbon Footprint Report */}
            <div className="w-full bg-white border border-primary-200 rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-sm mt-4">
                <h2 className="text-2xl font-bold text-primary-900 border-b border-primary-100 pb-3 flex items-center gap-2">
                    🍃 {t("product.sustainabilityReport")}
                </h2>

                {productInfo.product.co2e_kg !== null && productInfo.product.co2e_kg !== undefined ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left Side: Score & Rating */}
                        <div className="flex flex-col gap-4">
                            <div className="bg-green-50 rounded-xl p-6 border border-green-200 flex flex-col items-center justify-center text-center gap-2">
                                <span className="text-gray-600 text-sm font-semibold uppercase tracking-wider">{t("product.estimatedGwp")}</span>
                                <span className="text-5xl font-black text-green-700">{productInfo.product.co2e_kg} <span className="text-2xl font-normal">kg CO₂e</span></span>
                                
                                {/* Carbon Rating Badge */}
                                <span className={`mt-2 px-3 py-1 rounded-full text-sm font-bold text-white ${
                                    productInfo.product.co2e_kg < 50 ? "bg-green-600" :
                                    productInfo.product.co2e_kg < 200 ? "bg-amber-500" : "bg-red-500"
                                }`}>
                                    {t("product.carbonRating")}: {
                                        productInfo.product.co2e_kg < 50 ? t("product.carbonRatingLow") :
                                        productInfo.product.co2e_kg < 200 ? t("product.carbonRatingMed") : t("product.carbonRatingHigh")
                                    }
                                </span>
                            </div>

                            {/* Explanation Text */}
                            <div className="bg-primary-50 rounded-xl p-4 border border-primary-100">
                                <h3 className="font-semibold text-primary-900 text-sm mb-1">{t("product.aiExplanation")}</h3>
                                <p className="text-gray-700 text-sm italic">
                                    "{productInfo.product.co2e_explanation || "Estimated based on product materials, specs, and similar verified benchmarks."}"
                                </p>
                            </div>
                        </div>

                        {/* Right Side: Equivalences & Lifecycle */}
                        <div className="flex flex-col gap-6">
                            {/* Environmental Equivalence */}
                            <div className="flex flex-col gap-3">
                                <h3 className="font-bold text-primary-900 text-base">{t("product.equivalence")}</h3>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex flex-col items-center text-center gap-1">
                                        <span className="text-2xl">🚗</span>
                                        <span className="text-lg font-bold text-gray-800">{Math.round(productInfo.product.co2e_kg * 4.1)} km</span>
                                        <span className="text-[10px] text-gray-500 line-clamp-2 leading-tight">{t("product.eqDriving")}</span>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex flex-col items-center text-center gap-1">
                                        <span className="text-2xl">📱</span>
                                        <span className="text-lg font-bold text-gray-800">{Math.round(productInfo.product.co2e_kg * 121)}</span>
                                        <span className="text-[10px] text-gray-500 line-clamp-2 leading-tight">{t("product.eqPhones")}</span>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex flex-col items-center text-center gap-1">
                                        <span className="text-2xl">🌳</span>
                                        <span className="text-lg font-bold text-gray-800">{Math.max(1, Math.round(productInfo.product.co2e_kg / 22))}</span>
                                        <span className="text-[10px] text-gray-500 line-clamp-2 leading-tight">{t("product.eqTrees")}</span>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                ) : (
                    /* Unsupported or missing data view */
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6">
                        <div className="bg-gray-200 text-gray-500 text-4xl w-16 h-16 rounded-full flex items-center justify-center shrink-0">📭</div>
                        <div className="flex flex-col gap-2 text-center md:text-left">
                            <h3 className="text-lg font-bold text-gray-800">{t("product.notEvaluatedTitle")}</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                {t("product.notEvaluatedReason")}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* <ProductCarousel query={productInfo.product.name}/> */}

        </div>
    );
}