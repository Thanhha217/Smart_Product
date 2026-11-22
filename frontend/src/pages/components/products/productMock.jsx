export const MOCK_PRODUCTS = [
  {
    platform_name: "CellphoneS",
    category_name: "Smartphones",
    image_url: "https://images.pexels.com/photos/788946/pexels-photo-788946.jpeg?auto=compress&cs=tinysrgb&w=500",
    seller: {
      name: "CellphoneS Official Store",
      seller_rating: 98
    },
    product: {
      id: "iphone15",
      product_url: "https://cellphones.com.vn/",
      name: "Apple iPhone 15 Pro Max 256GB",
      original_price: 34990000,
      final_price: 29990000,
      product_rating: 0.98, // rating normalized between 0 and 1
      review_count: 320,
      co2e_kg: 75.0,
      co2e_source: "llm_estimate",
      co2e_confidence: 0.6,
      co2e_explanation: "Estimated based on Apple's iPhone 15 Pro Max Environmental Report.",
      co2e_explanation_vi: "Được ước tính dựa trên Báo cáo Môi trường iPhone 15 Pro Max của Apple.",
      recommendation_reason: "Great customer ratings & top performance"
    },
    highlights: [
      "Màn hình Super Retina XDR OLED 6.7 inch sắc nét",
      "Vi xử lý Apple A17 Pro hiệu năng vượt trội",
      "Hệ thống camera 48MP zoom quang học 5x chuyên nghiệp",
      "Khung sườn làm từ chất liệu Titan cao cấp siêu nhẹ & bền"
    ],
    return_policy: {
      days_for_return: 30,
      free_delivery: true,
      warranty_duration: 12
    }
  },
  {
    platform_name: "Phong Vũ",
    category_name: "Laptops",
    image_url: "https://images.pexels.com/photos/18105/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=500",
    seller: {
      name: "Phong Vũ Tech",
      seller_rating: 95
    },
    product: {
      id: "macbookm2",
      product_url: "https://phongvu.vn/",
      name: "Apple MacBook Air 13-inch M2 (8GB/256GB SSD)",
      original_price: 27990000,
      final_price: 24990000,
      product_rating: 0.96, // rating normalized between 0 and 1
      review_count: 145,
      co2e_kg: 147.0,
      co2e_source: "llm_estimate",
      co2e_confidence: 0.6,
      co2e_explanation: "Estimated from Apple's June 2022 Product Environmental Report.",
      co2e_explanation_vi: "Được ước tính từ Báo cáo Môi trường Sản phẩm tháng 6/2022 của Apple.",
      recommendation_reason: "Best price/quality ratio in laptops"
    },
    highlights: [
      "Chip xử lý Apple M2 cực kỳ mạnh mẽ & tối ưu",
      "Bộ nhớ RAM 8GB và ổ cứng SSD 256GB tốc độ cao",
      "Thời lượng pin ấn tượng lên đến 18 tiếng liên tục",
      "Thiết kế nhôm nguyên khối siêu mỏng nhẹ, không quạt ồn ào"
    ],
    return_policy: {
      days_for_return: 15,
      free_delivery: true,
      warranty_duration: 12
    }
  },
  {
    platform_name: "Tiki",
    category_name: "Bags & Wallets",
    image_url: "https://images.pexels.com/photos/2905238/pexels-photo-2905238.jpeg?auto=compress&cs=tinysrgb&w=500",
    seller: {
      name: "Fashion House Vietnam",
      seller_rating: -1.0
    },
    product: {
      id: "backpack",
      product_url: "https://tiki.vn/",
      name: "Balo Da Canvas Du Lịch Cao Cấp Vintage",
      original_price: 650000,
      final_price: 450000,
      product_rating: 0.9, // rating normalized between 0 and 1
      review_count: 18,
      co2e_kg: null,
      co2e_source: "unsupported",
      co2e_confidence: 0.0,
      co2e_explanation: "CO2 footprint estimation is not supported for this product category.",
      co2e_explanation_vi: "Ước tính dấu chân CO2 chưa hỗ trợ cho danh mục sản phẩm này.",
      recommendation_reason: "Huge 30% sale discount"
    },
    highlights: [
      "Chất liệu vải Canvas kết hợp phối da PU dày dặn chống trầy xước",
      "Ngăn chứa đồ cực rộng, có ngăn đệm chống sốc riêng cho laptop 15.6 inch",
      "Khóa kéo kim loại phong cách vintage mượt mà, chống gỉ sét",
      "Quai đeo trang bị đệm xốp êm ái giúp giảm áp lực vai hiệu quả"
    ],
    return_policy: {
      days_for_return: 7,
      free_delivery: false,
      warranty_duration: 0
    }
  },
  {
    platform_name: "Shopee",
    category_name: "Fashion Women",
    image_url: "https://images.pexels.com/photos/996329/pexels-photo-996329.jpeg?auto=compress&cs=tinysrgb&w=500",
    seller: {
      name: "YODY Clothes Store",
      seller_rating: 99
    },
    product: {
      id: "tshirt",
      product_url: "https://shopee.vn/",
      name: "Áo Thun Cotton Nữ YODY Cổ Tròn Mềm Mịn",
      original_price: 250000,
      final_price: 189000,
      product_rating: 0.94, // rating normalized between 0 and 1
      review_count: 1250,
      co2e_kg: null,
      co2e_source: "unsupported",
      co2e_confidence: 0.0,
      co2e_explanation: "CO2 footprint estimation is not supported for this product category.",
      co2e_explanation_vi: "Ước tính dấu chân CO2 chưa hỗ trợ cho danh mục sản phẩm này.",
      recommendation_reason: "Best budget value choice"
    },
    highlights: [
      "Sợi vải 100% Cotton tự nhiên mang lại cảm giác mềm mịn cho làn da",
      "Khả năng co giãn và thấm hút mồ hôi vượt trội, tạo cảm giác thoáng mát",
      "Form dáng Regular Fit trẻ trung, năng động và tôn dáng",
      "Công nghệ dệt tiên tiến giúp giữ phom dáng tốt, chống xơ sợi khi giặt"
    ],
    return_policy: {
      days_for_return: 15,
      free_delivery: true,
      warranty_duration: 3
    }
  },
  {
    platform_name: "FPT Shop",
    category_name: "Headphones & Earbuds",
    image_url: "https://images.pexels.com/photos/3394651/pexels-photo-3394651.jpeg?auto=compress&cs=tinysrgb&w=500",
    seller: {
      name: "FPT Shop Brand Store",
      seller_rating: 97
    },
    product: {
      id: "airpods3",
      product_url: "https://fptshop.com.vn/",
      name: "Tai nghe Bluetooth Apple AirPods 3 Magsafe",
      original_price: 5490000,
      final_price: 4390000,
      product_rating: 0.96, // rating normalized between 0 and 1
      review_count: 88,
      co2e_kg: 18.5,
      co2e_source: "neighbor_fallback",
      co2e_confidence: 0.3,
      co2e_explanation: "Average of verified earphone reference products.",
      co2e_explanation_vi: "Trung bình của các sản phẩm tai nghe tham chiếu đã xác minh.",
      recommendation_reason: null
    },
    highlights: [
      "Kiểu dáng ôm khít tai tối ưu, mang lại sự dễ chịu khi đeo lâu",
      "Tính năng Spatial Audio cho trải nghiệm âm thanh vòm sống động",
      "Khả năng kháng nước và mồ hôi đạt tiêu chuẩn IPX4 yên tâm tập luyện",
      "Thời lượng pin ấn tượng lên đến 6 giờ nghe nhạc (kèm hộp sạc tổng 30 giờ)"
    ],
    return_policy: {
      days_for_return: 30,
      free_delivery: true,
      warranty_duration: 12
    }
  }
];

export function generateMockProducts(count = 8) {
  return MOCK_PRODUCTS;
}