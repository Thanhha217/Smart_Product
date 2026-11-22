export function generateMockProducts(count = 8) {
  const platforms = ["Amazon", "eBay", "Shopify", "Target", "Walmart"];
  const productNames = [
    "Eco-Friendly Bamboo Toothbrush",
    "Organic Cotton Canvas Tote Bag",
    "Stainless Steel Water Bottle 32oz",
    "Solar Powered Backpack charger",
    "Biodegradable Yoga Mat",
    "Recycled Ocean Plastic Sunglasses",
    "Reusable Beeswax Food Wraps (3pk)",
    "Natural Soy Wax Candle - Lavender",
    "Lorem ipsum dolor sit amet consectetur adipiscing",
    "Super long product name which is really long I can't believe it omg so long wow"
  ];

  return Array.from({ length: count }, (_, index) => {
    // Generate a random product name and platform
    const name = productNames[index % productNames.length] + (index >= productNames.length ? ` Vol. ${Math.floor(index / productNames.length) + 1}` : "");
    const platform_name = platforms[Math.floor(Math.random() * platforms.length)];
    
    // Set up some realistic variation for original vs final pricing
    const hasDiscount = Math.random() > 0.4; // 60% chance to have a discount
    const original_price = parseInt((Math.random() * 20000000 + 5000).toFixed(2)); // $20.00 to $100.00
    const final_price = hasDiscount 
      ? parseInt((original_price * (Math.random() * 0.4 + 0.5)).toFixed(2)) // 50% to 90% of original price
      : original_price;

    return {
      platform_name,
      image_url: "/logo192.png", // Kept strictly static as requested
      product: {
        id: `${index}`,
        name,
        original_price,
        final_price,
        product_rating: parseFloat((Math.random() * 1.5 + 3.5).toFixed(1)), // Ratings between 3.5 and 5.0
        review_count: Math.floor(Math.random() * 1450 + 50), // 50 to 1500 reviews
        co2e_kg: parseFloat((Math.random() * 12 + 1).toFixed(2)) // Global Warming Potential (carbon footprint)
      }
    };
  });
}