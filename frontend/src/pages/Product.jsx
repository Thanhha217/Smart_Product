import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { generateMockProducts } from "./components/products/productMock";
import ProductCarousel from "./components/products/ProductCarousel";
import { GATEWAY_URL } from "./utils/consts";

export default function Product() {
    const params = useParams()

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
                console.log(data);
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

    function display_price(price) {
    if (price == null) return "";
    let stringPrice = String(price);
    let parts = [];
    
    // Slice the string from right to left in chunks of 3
    while (stringPrice.length > 3) {
        parts.unshift(stringPrice.slice(-3));
        stringPrice = stringPrice.slice(0, -3);
    }
    parts.unshift(stringPrice);
    
    return parts.join(".");
}

    const tagStyle = "bg-primary-200 rounded-2xl text-nowrap py-1 px-2";

    if (loading) {
        return <div className="flex justify-center items-center p-10 min-h-full">Loading product...</div>;
    }

    if (!productInfo) {
        return <div className="flex justify-center items-center p-10 min-h-full">Product not found.</div>;
    }


    return (
        <div className="flex flex-col items-center gap-2 p-10 min-h-full">
            <div className="flex justify-start w-full">
                <p className="text-primary-800 hover:underline cursor-pointer">{productInfo.category_name}</p>
            </div>
            
            <div className="bg-primary-100 min-w-full min-h-5/12 flex p-6 gap-2">
                <img className="w-120 h-120 bg-white border-2 border-primary-200" src={productInfo.image_url} />
                <div className="flex flex-col justify-between px-12">
                    <div className='flex flex-col gap-4'>
                        <p className="font-bold text-2xl">{productInfo.platform_name}</p>
                        
                        <h1 className="text-4xl">{productInfo.product.name}</h1>

                        <div className="flex gap-4">
                            <p className="text-nowrap">★ {productInfo.product.product_rating} ({productInfo.product.review_count})</p>
                            <p>Seller: {productInfo.seller.name} ({productInfo.seller.seller_rating}% good ratings)</p>
                        </div>

                        <p className="text-orange-400 text-4xl font-bold">{display_price(productInfo.product.final_price)}₫</p>
                        <div className="flex gap-4 ">
                            <p className="text-primary-800 line-through">{display_price(productInfo.product.final_price)}₫</p>
                            <p className="bg-orange-100 text-orange-400 rounded-2xl text-nowrap px-1">{productInfo.product.original_price != productInfo.product.final_price ? "-" + (100 - Math.floor((productInfo.product.final_price / productInfo.product.original_price) * 100)) + "%" : ""}</p>
                        </div>
                        <div className="flex gap-6">
                            <p className={(productInfo.return_policy.free_delivery ? "" : "hidden ") + tagStyle}>Free delivery</p>
                            <p className={(productInfo.return_policy.days_for_return ? "" : "hidden ") + tagStyle}>{productInfo.return_policy.days_for_return} days for return</p>
                            <p className={(productInfo.return_policy.warranty_duration ? "" : "hidden ") + tagStyle}>{productInfo.return_policy.warranty_duration} months warranty</p>
                        </div>
                        <p className="text-nowrap bg-green-500 rounded-2xl text-white p-3 w-min">Estimated GWP: <span className="font-bold">{productInfo.product.gwp}</span> kg CO₂e</p>

                    </div>
                    <div className="py-2">
                        <a 
                            href={productInfo.product.product_url}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-primary-500 rounded-2xl text-2xl font-bold text-primary-100 px-4 py-2 cursor-pointer hover:bg-primary-800 transition duration-100 ease-in-out">
                            Check On Website
                        </a>
                    </div>
                </div>

            </div>

            {/* <ProductCarousel query={productInfo.product.name}/> */}

        </div>
    );
}