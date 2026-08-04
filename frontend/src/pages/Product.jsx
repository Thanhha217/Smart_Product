import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { generateMockProducts } from "./components/products/productMock";
import ProductCarousel from "./components/products/ProductCarousel";
import { GATEWAY_URL } from "./utils/consts";
import { useI18n } from "../i18n/LanguageContext";

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
                console.log(error);
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
                        <p className="text-nowrap bg-green-500 rounded-2xl text-white p-3 w-min">{t("product.estimatedGwp")}: <span className="font-bold">{productInfo.product.co2e_kg}</span> kg CO₂e</p>

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

            {/* <ProductCarousel query={productInfo.product.name}/> */}

        </div>
    );
}