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
