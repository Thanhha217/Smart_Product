export function getProductHighlights(productInfo) {
  if (!productInfo) return [];

  // If the mock product has predefined highlights, return them
  if (productInfo.highlights && Array.isArray(productInfo.highlights)) {
    return productInfo.highlights;
  }
  
  // Check if nested in productInfo.product
  if (productInfo.product && productInfo.product.highlights && Array.isArray(productInfo.product.highlights)) {
    return productInfo.product.highlights;
  }
  
  const product = productInfo.product || productInfo;
  const description = product.description;
  if (!description) return [];
  
  // Clean description and extract lines that look like bullet points or key specs
  const lines = description
    .split(/[•\-\*\n]/)
    .map(line => line.trim())
    .filter(line => line.length > 5 && line.length < 80);
    
  return lines.slice(0, 4); // return top 4 points
}

export function getRecommendationReason(productInfo, platform_name, t, isProductPage = false) {
  if (!productInfo) return null;
  const product = productInfo.product || productInfo;
  
  if (product && product.recommendation_reason) {
    return product.recommendation_reason;
  }
  if (productInfo && productInfo.recommendation_reason) {
    return productInfo.recommendation_reason;
  }

  // On Search Results grid (ProductSlot), only top 4 get LLM explanations.
  // For products 5th+, no reason is shown unless on Product detail page (isProductPage = true).
  if (!isProductPage) {
    return null;
  }

  // On Product detail page, fall back to dynamic attribute-based reason if no LLM reason exists
  const rawRating = product.product_rating || 0.0;
  const ratingOutOfFive = rawRating <= 1.0 ? rawRating * 5.0 : rawRating;
  
  const co2e = product.co2e_kg;
  const isEcoFriendly = co2e !== null && co2e !== undefined && co2e < 50;
  
  const originalPrice = product.original_price || 0;
  const finalPrice = product.final_price || 0;
  const isGoodDiscount = originalPrice > finalPrice && (1 - finalPrice / originalPrice) >= 0.15;
  
  const reviews = product.review_count || 0;
  const isHighlyRated = ratingOutOfFive >= 4.5 && reviews > 10;
  
  if (isEcoFriendly && isHighlyRated) {
    return t("product.reasonEcoHighlyRated", { rating: ratingOutOfFive.toFixed(1) });
  }
  if (isGoodDiscount) {
    const pct = Math.floor((1 - finalPrice / originalPrice) * 100);
    return t("product.reasonDiscount", { pct, platform_name: platform_name || "e-commerce" });
  }
  if (isHighlyRated) {
    return t("product.reasonHighlyRated", { rating: ratingOutOfFive.toFixed(1), reviews });
  }
  
  return t("product.reasonBalanced");
}

// Colour + label for the 0-5 green score (computed in db-search, higher = greener
// within the product's category). Falls back to grey when there is no score.
export function getGreenLevel(score) {
  if (score === null || score === undefined) return { bg: "bg-gray-500", text: "text-gray-700", key: "product.greenNoScore" };
  if (score >= 3.5) return { bg: "bg-green-600", text: "text-green-700", key: "product.carbonRatingLow" };
  if (score >= 2) return { bg: "bg-amber-500", text: "text-amber-600", key: "product.carbonRatingMed" };
  return { bg: "bg-red-500", text: "text-red-600", key: "product.carbonRatingHigh" };
}

export function getCo2SourceKey(source) {
  if (source === "manufacturer") return "product.co2SourceManufacturer";
  if (source === "neighbor_average") return "product.co2SourceAverage";
  return "product.co2SourceOther";
}


// The ranking service writes its short "why this product" badges in English
// (ranking_system/explanation_generator.py). Known patterns are translated; numbers are kept.
const REASON_PATTERNS = [
  [/^Huge (\d+)% sale discount$/i, (m) => `Đang giảm giá mạnh ${m[1]}%`],
  [/^Great customer ratings \(([\d.]+)★\)$/i, (m) => `Khách hàng đánh giá cao (${m[1].replace(".", ",")}★)`],
  [/^Great customer ratings$/i, () => "Khách hàng đánh giá cao"],
  [/^Best budget value choice$/i, () => "Lựa chọn tiết kiệm nhất"],
  [/^Best price\/quality ratio$/i, () => "Giá và chất lượng cân đối nhất"],
  [/^Best value( for money)?$/i, () => "Đáng tiền nhất"],
  [/^Lowest price$/i, () => "Giá thấp nhất"],
  [/^Free (delivery|shipping)$/i, () => "Miễn phí giao hàng"],
];

export function localizeReason(text, lang) {
  if (!text || lang !== "vi") return text;
  const clean = String(text).trim();
  for (const [re, fn] of REASON_PATTERNS) {
    const m = clean.match(re);
    if (m) return fn(m);
  }
  return clean;
}
