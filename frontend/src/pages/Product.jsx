import { ProductImage } from "./components/products/ProductSlot";
import { useParams, useLocation, useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api, toProductCard } from "../api/client";
import { addToCart } from "../lib/cart";
import FormulaCard from "./components/co2/FormulaCard";
import LifecycleDiagram from "./components/co2/LifecycleDiagram";
import ProductCard from "./components/co2/ProductCard";
import { GATEWAY_URL } from "./utils/consts";
import { useI18n } from "../i18n/LanguageContext";
import { getProductHighlights, getRecommendationReason, getGreenLevel, getCo2SourceKey } from "./utils/helpers";


export default function Product() {
    const params = useParams();
    const location = useLocation();
    const { lang, t, formatNumber } = useI18n();

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
    const [co2Info, setCo2Info] = useState(null);
    const [related, setRelated] = useState(null);
    const [added, setAdded] = useState(false);
    const navigate = useNavigate();

    // CO2 detail (formula with numbers, lifecycle) and greener alternative: optional extras.
    useEffect(() => {
        if (!params.productId) return;
        let cancelled = false;
        setCo2Info(null);
        setRelated(null);
        api.getProductCo2(params.productId).then((d) => !cancelled && setCo2Info(d)).catch(() => {});
        api.getRelated(params.productId, 6).then((d) => !cancelled && setRelated(d)).catch(() => {});
        return () => { cancelled = true; };
    }, [params.productId]);

    useEffect(() => {
        const fetchProductInfo = async (productId) => {
            try {
                const res = await fetch(`${GATEWAY_URL}/product/${productId}`);
                const data = await res.json();
                let fetched = data.product;

                const stateProduct = location.state?.product || location.state?.productInfo;
                const stateReason = stateProduct?.recommendation_reason || stateProduct?.product?.recommendation_reason;
                if (stateReason && fetched && fetched.product) {
                    fetched.product.recommendation_reason = stateReason;
                    fetched.recommendation_reason = stateReason;
                }

                setProductInfo(fetched);
            } catch (error) {
                console.error("Failed to fetch product details:", error);
            } finally {
                setLoading(false);
            }
        };

        if (params.productId) {
            fetchProductInfo(params.productId);
        }
    }, [params.productId, location.state]);

    const tagStyle = "bg-primary-50 rounded-2xl border border-primary-200 text-xs px-2 py-1 flex items-center gap-1 font-semibold text-primary-900 shadow-sm";

    if (loading) {
        return <div className="flex justify-center items-center p-10 min-h-full">{t("product.loading")}</div>;
    }

    if (!productInfo) {
        return <div className="flex justify-center items-center p-10 min-h-full">{t("product.notFound")}</div>;
    }

    const highlights = getProductHighlights(productInfo);
    const reason = getRecommendationReason(productInfo, productInfo.platform_name, t, true);
    const co2Explanation = lang === "vi"
        ? (productInfo.product.co2e_explanation_vi || productInfo.product.co2e_explanation)
        : (productInfo.product.co2e_explanation || productInfo.product.co2e_explanation_vi);


    return (
        <div className="mx-auto max-w-[1320px] px-4 min-[900px]:px-8 py-6 flex flex-col gap-4 min-h-full">
            <div className="flex justify-start w-full px-2">
                <p className="eyebrow">{productInfo.category_name}</p>
            </div>
            
            <div className="card max-w-full md:min-w-full flex md:items-start flex-col md:flex-row p-5 md:p-7 gap-6">
                <div className="w-full md:w-[380px] shrink-0"><ProductImage src={productInfo.image_url} alt={productInfo.product.name} className="h-72 md:h-[380px]" /></div>
                <div className="flex flex-col justify-between max-w-full items-start gap-8 min-w-0">
                    <div className='flex flex-col gap-4'>
                        <span className="pill bg-[#E4F1E6] text-[#1F5D3A] self-start">{productInfo.platform_name}</span>
                        
                        <h1 className="text-[34px] leading-tight font-bold text-[#1E2B22]">{productInfo.product.name}</h1>

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

                        <p className="text-[#1F5D3A] text-4xl font-extrabold">{formatNumber(productInfo.product.final_price)}₫</p>
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
                        {reason && (
                            <div className="bg-orange-50 border-l-4 border-orange-500 rounded-r-xl p-4 my-2 w-full">
                                <h3 className="font-bold text-orange-950 text-sm flex items-center gap-1.5 mb-1">
                                    ✨ {t("product.whyRecommended")}
                                </h3>
                                <p className="text-gray-700 text-sm italic">
                                    "{reason}"
                                </p>
                            </div>
                        )}

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
                                <div className="flex items-center gap-2 bg-[#E4F1E6] text-[#1F5D3A] border border-[#cfe5d2] rounded-2xl p-3 w-fit">
                                    <span>{t("product.estimatedGwp")}: <span className="font-bold">{productInfo.product.co2e_kg}</span> kg CO₂e</span>
                                    <div className="group relative cursor-pointer ml-1 inline-block">
                                        <span className="bg-[#2E7D4F] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">ⓘ</span>
                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-gray-800 text-white text-xs rounded p-2 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-10 shadow-lg">
                                            {t("product.co2ExplanationDisclaimer")}
                                        </div>
                                    </div>
                                </div>
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
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => navigate(`/world/${params.productId}`)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl px-5 py-2.5 transition">
                            🌏 {t("product.world")}
                        </button>
                        <button type="button" onClick={() => navigate(`/story/${params.productId}`)}
                            className="border border-emerald-600 text-emerald-700 font-semibold rounded-2xl px-5 py-2.5 transition hover:bg-emerald-50">
                            📖 {t("product.story")}
                        </button>
                        <button type="button" onClick={() => navigate(`/assistant?q=${encodeURIComponent(t("product.askAiPrompt", { name: productInfo.product.name }))}`)}
                            className="bg-secondary-500 text-white rounded-2xl px-4 py-2 font-semibold hover:bg-secondary-700">
                            ✨ {t("product.askAi")}
                        </button>
                        <Link to={`/compare?ids=${[params.productId, related?.greener_alternative?.product_id, ...(related?.items || []).slice(0, 2).map((x) => x.product_id)].filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 4).join(",")}`}
                            className="bg-white border border-primary-500 text-primary-500 rounded-2xl px-4 py-2 font-semibold hover:bg-primary-200">
                            ⚖️ {t("action.compare")}
                        </Link>
                        <button type="button" onClick={() => { addToCart(co2Info?.product || toProductCard(productInfo), 1); setAdded(true); }}
                            className="bg-white border border-primary-500 text-primary-500 rounded-2xl px-4 py-2 font-semibold hover:bg-primary-200">
                            🛒 {added ? t("cart.added") : t("cart.addTest")}
                        </button>
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
                                
                                {/* Green score 0-5 within the category */}
                                {(() => {
                                    const score = productInfo.product.green_score;
                                    const level = getGreenLevel(score);
                                    return (
                                        <div className="w-full flex flex-col items-center gap-2 mt-2">
                                            <span className={`text-3xl font-black ${level.text}`}>
                                                {t("product.greenScore")}: {score ?? "–"}<span className="text-lg font-normal">/5</span>
                                            </span>
                                            {score !== null && score !== undefined && (
                                                <div className="w-full max-w-xs h-2 bg-gray-200 rounded-full overflow-hidden">
                                                    <div className={`h-full ${level.bg}`} style={{ width: `${(score / 5) * 100}%` }} />
                                                </div>
                                            )}
                                            <span className={`px-3 py-1 rounded-full text-sm font-bold text-white ${level.bg}`}>
                                                {t("product.carbonRating")}: {t(level.key)}
                                            </span>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Where the number comes from */}
                            <div className="bg-white rounded-xl p-4 border border-primary-100 flex flex-col gap-2">
                                <h3 className="font-semibold text-primary-900 text-sm">{t("product.co2Source")}</h3>
                                <p className="text-gray-700 text-sm">{t(getCo2SourceKey(productInfo.product.co2e_source))}</p>
                                {productInfo.product.co2e_references?.length > 0 && (
                                    <>
                                        <h4 className="font-semibold text-primary-900 text-xs mt-1">{t("product.co2References")}</h4>
                                        <ul className="text-xs text-gray-600 flex flex-col gap-1">
                                            {productInfo.product.co2e_references.map((ref, i) => (
                                                <li key={i} className="flex justify-between gap-2 border-b border-gray-100 pb-1">
                                                    <span className="line-clamp-1">{ref.name}</span>
                                                    <span className="text-nowrap font-semibold">
                                                        {ref.co2e_kg} kg{ref.cosine < 1 ? ` · ${t("product.co2Similarity")} ${ref.cosine}` : ""}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                            </div>

                            {/* Explanation Text */}
                            <div className="bg-primary-50 rounded-xl p-4 border border-primary-100">
                                <h3 className="font-semibold text-primary-900 text-sm mb-1">{t("product.aiExplanation")}</h3>
                                <p className="text-gray-700 text-sm italic">
                                    "{co2Explanation || (lang === "vi" ? "Được ước tính dựa trên vật liệu, thông số kỹ thuật và các sản phẩm tham chiếu đã xác minh." : "Estimated based on product materials, specs, and similar verified benchmarks.")}"
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

            {/* How the number was computed + where the CO2 comes from (api /products/{id}/co2) */}
            {co2Info && (
                <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <FormulaCard formula={co2Info.formula} />
                    <LifecycleDiagram lifecycle={co2Info.lifecycle} />
                </div>
            )}

            {related?.greener_alternative && (
                <div className="w-full bg-green-50 border border-green-200 rounded-2xl p-4 mt-4 flex flex-col gap-2">
                    <h2 className="font-bold text-green-900">🌱 {t("related.greenerTitle")}</h2>
                    <div className="max-w-sm"><ProductCard product={related.greener_alternative} highlight /></div>
                </div>
            )}

            {/* <ProductCarousel query={productInfo.product.name}/> */}

        </div>
    );
}