// Static bilingual content of /method (CO2 method explained for visitors and the jury).
// Figures from docs/co2-method (worked examples, leave-one-family-out test, 28-product test).

export const METHOD = {
  vi: {
    title: "Phương pháp tính CO₂ của Smart Product Finder",
    intro:
      "Mỗi sản phẩm được gán lượng phát thải vòng đời (kg CO₂e, khung cradle-to-grave ISO 14067). Hệ thống luôn ưu tiên số thật của hãng, chỉ ước lượng khi không có, ghi rõ nguồn và độ tin cậy của mọi con số. AI chỉ dùng để tìm sản phẩm giống nhau, không tự đoán ra số. Không đủ căn cứ thì để trống.",
    chainTitle: "Chuỗi tính: bước nào ra số trước thì dừng",
    chain: [
      { key: "manufacturer", label: "1. Trùng đúng mẫu", sub: "tên chứa nguyên tên mẫu (≥ 3 từ)" },
      { key: "neighbor_average", label: "2. Trung bình mẫu giống", sub: "OpenCLIP, cosine ≥ 0,66" },
      { key: "fallback", label: "3. Dự phòng", sub: "theo điện · mức giữa của loại · theo giá" },
      { key: "none", label: "4. Để trống", sub: "không đoán" },
    ],
    methods: [
      {
        key: "manufacturer", name: "Trùng đúng mẫu", label: "manufacturer · 0,9",
        when: "Tên sản phẩm chứa nguyên tên một mẫu có báo cáo của hãng (EPD/PCF).",
        formula: "CO₂ = số hãng công bố",
        example: "MacBook Air 13\" M3 → 135 kg CO₂e (số của Apple).",
        accuracy: "Bằng số của hãng.",
      },
      {
        key: "neighbor_average", name: "Trung bình mẫu giống", label: "neighbor_average · 0,5",
        when: "Có ít nhất 1 mẫu giống với cosine ≥ 0,66 trong 1.450 mẫu có số thật.",
        formula: "CO₂ = trung bình CO₂ của ≤ 5 mẫu giống nhất (ưu tiên cùng loại, bỏ mẫu ngoài [trung vị ÷ 8; trung vị × 8])",
        example: "Dell Latitude 5450: (290 + 321 + 312 + 349 + 391) ÷ 5 = 332,6 kg.",
        accuracy: "Sai ~20%, Spearman 0,95 (16 sản phẩm thuộc loại đã có mẫu).",
      },
      {
        key: "lifecycle_formula", name: "Công thức vòng đời theo điện", label: "lifecycle_formula · 0,25–0,35",
        when: "Đồ điện gia dụng (máy lạnh, tủ lạnh, máy giặt, tivi, quạt, nồi cơm…).",
        formula: "CO₂ = sản xuất + năm × (kWh/năm × 0,681 + rò rỉ ga) + thải bỏ",
        example:
          "Máy lạnh Daikin Inverter 1,5 HP, nhãn 820 kWh/năm: 450 + 10 × 820 × 0,681 + 121,5 + 141,5 ≈ 6.297 kg (≈ 6.118 kg với hệ số lưới cũ 0,6592).",
        accuracy: "Chưa đủ số thật để kiểm định; tivi 75\" ra 1.972 kg, Samsung công bố 982–2.388 kg.",
      },
      {
        key: "category_model", name: "Mức giữa của loại", label: "category_model · 0,35",
        when: "Đồ điện tử thuộc loại có ≥ 4 mẫu.",
        formula: "CO₂ = trung vị loại (hoặc của hãng nếu ≥ 3 mẫu) × (inch ÷ inch chuẩn)^b; màn hình b = 0,81 (23,8\"), laptop b = 0,53 (14\")",
        example: "Màn hình Samsung 27\": 491,5 × (27 ÷ 23,8)^0,81 = 544 kg. Laptop Acer 15,6\": 255 × (15,6 ÷ 14)^0,53 = 270 kg.",
        accuracy: "Sai trung vị 20,9% khi chạy lại trong repo (màn hình 13,8%, điện thoại 13,7%, laptop 22,6%).",
      },
      {
        key: "eeio_price", name: "Theo giá bán (US EPA)", label: "eeio_price · 0,15",
        when: "Loại không có công thức và không có mẫu (quần áo, sách, mỹ phẩm…).",
        formula: "CO₂ = giá ÷ 25.900 × (292,655 ÷ 336,940) × hệ số ngành",
        example: "Áo thun 199.000 đ → 7,68 USD → 6,67 USD (2022) × 0,12 = 0,8 kg.",
        accuracy: "Rất thô, chỉ gồm sản xuất và vận chuyển; là cách cuối cùng.",
      },
    ],
    useTitle: "Dùng con số: điểm xanh và xếp hạng",
    greenScore: "Điểm xanh = 5 × ln(U ÷ CO₂) ÷ ln(U ÷ L), giới hạn 0–5 (L, U: khoảng hợp lý của loại; theo Kalisvaart 2025).",
    rrf: "Điểm xếp hạng = 1 ÷ (60 + hạng nhu cầu) + 0,2 × 1 ÷ (60 + hạng CO₂). Nhu cầu là chính, CO₂ phá thế hòa; sản phẩm chưa có số nhận hạng CO₂ ở giữa (theo Vestrum 2026).",
    rrfNote: "Chỉ dùng thứ tự, không dùng số kg: con số sai một ít thì kết quả vẫn đúng nếu thứ tự đúng.",
    resultsTitle: "Kết quả thử nghiệm",
    resultsHead: ["Thử nghiệm", "Cách làm", "Kết quả chính"],
    results: [
      ["28 sản phẩm có số thật", "16 thuộc loại đã có mẫu, 12 thuộc loại chưa có", "Loại đã có mẫu: sai 20–22%, không lệch quá 2 lần, Spearman 0,95. Bỏ ngưỡng 0,66: 9/12 sản phẩm loại mới lệch quá 2 lần"],
      ["Che từng dòng máy (1.450 mẫu)", "Đoán mỗi sản phẩm từ các mẫu còn lại, bỏ cả dòng máy", "Mức giữa của loại: sai 20,9% (chỉ lấy trung vị: 24,1%)"],
      ["So với AI đoán số (Qwen)", "Cùng bộ thử", "AI sai TB 77,2 kg; trung bình mẫu giống 68,0 kg. AI đoán chuột ~76 kg, thật < 5 kg"],
      ["10.000 sản phẩm", "1.450 mẫu + 8.550 sản phẩm Amazon", "7.406 có số (74%); để trống 2.594"],
    ],
    limitsTitle: "Hạn chế",
    limits: [
      "Các cách tính không cùng phạm vi: số của hãng dùng lưới điện nước ngoài, cách theo giá không tính điện lúc dùng → chỉ nên so trong cùng loại; nguồn số luôn hiện cạnh con số.",
      "Tên tiếng Việt cho kết quả kém hơn tên tiếng Anh (OpenCLIP học chủ yếu bằng tiếng Anh).",
      "Công thức đồ gia dụng chưa đủ số thật để kiểm định; tham số vẫn là giả định.",
      "Tỷ lệ theo giai đoạn (khi hãng không tách) và tuyến vận chuyển là giả định minh họa.",
    ],
    gridNote: "Lưới điện Việt Nam: 0,681 kg CO₂e/kWh (2024, ĐH Bách khoa Hà Nội và Bộ Nông nghiệp và Môi trường).",
  },
  en: {
    title: "How Smart Product Finder computes CO₂",
    intro:
      "Every product gets a lifecycle footprint (kg CO₂e, cradle-to-grave per ISO 14067). The system always prefers the manufacturer's own figure, estimates only when there is none, and labels the source and confidence of every number. AI only finds similar products; it never invents a number. Without enough evidence the value stays empty.",
    chainTitle: "Calculation chain: the first step that yields a number wins",
    chain: [
      { key: "manufacturer", label: "1. Exact model", sub: "name contains a reference name (≥ 3 words)" },
      { key: "neighbor_average", label: "2. Similar products", sub: "OpenCLIP, cosine ≥ 0.66" },
      { key: "fallback", label: "3. Fallback", sub: "electricity · category model · price" },
      { key: "none", label: "4. Leave empty", sub: "no guessing" },
    ],
    methods: [
      {
        key: "manufacturer", name: "Exact model", label: "manufacturer · 0.9",
        when: "The product name contains the name of a model with a manufacturer report (EPD/PCF).",
        formula: "CO₂ = manufacturer figure",
        example: "MacBook Air 13\" M3 → 135 kg CO₂e (Apple's figure).",
        accuracy: "Same as the manufacturer's figure.",
      },
      {
        key: "neighbor_average", name: "Average of similar products", label: "neighbor_average · 0.5",
        when: "At least one of the 1,450 references has cosine ≥ 0.66.",
        formula: "CO₂ = mean of ≤ 5 most similar references (same category first, outside [median ÷ 8; median × 8] removed)",
        example: "Dell Latitude 5450: (290 + 321 + 312 + 349 + 391) ÷ 5 = 332.6 kg.",
        accuracy: "~20% error, Spearman 0.95 (16 products in covered categories).",
      },
      {
        key: "lifecycle_formula", name: "Electricity lifecycle formula", label: "lifecycle_formula · 0.25–0.35",
        when: "Home appliances (air conditioners, fridges, washing machines, TVs, fans, rice cookers…).",
        formula: "CO₂ = manufacturing + years × (kWh/year × 0.681 + refrigerant leakage) + end of life",
        example: "Daikin Inverter 1.5 HP AC, label 820 kWh/year: 450 + 10 × 820 × 0.681 + 121.5 + 141.5 ≈ 6,297 kg (≈ 6,118 kg with the older 0.6592 grid factor).",
        accuracy: "Not yet validated; a 75\" TV gives 1,972 kg vs Samsung's 982–2,388 kg.",
      },
      {
        key: "category_model", name: "Category model", label: "category_model · 0.35",
        when: "Electronics in a category with ≥ 4 references.",
        formula: "CO₂ = category (or brand, if ≥ 3 refs) median × (inch ÷ ref inch)^b; monitors b = 0.81 (23.8\"), laptops b = 0.53 (14\")",
        example: "Samsung 27\" monitor: 491.5 × (27 ÷ 23.8)^0.81 = 544 kg. Acer 15.6\" laptop: 255 × (15.6 ÷ 14)^0.53 = 270 kg.",
        accuracy: "Median error 20.9% in the in-repo re-run (monitors 13.8%, phones 13.7%, laptops 22.6%).",
      },
      {
        key: "eeio_price", name: "Price × US EPA factor", label: "eeio_price · 0.15",
        when: "No formula and no references (clothing, books, cosmetics…).",
        formula: "CO₂ = price ÷ 25,900 × (292.655 ÷ 336.940) × industry factor",
        example: "T-shirt 199,000 ₫ → 7.68 USD → 6.67 USD (2022) × 0.12 = 0.8 kg.",
        accuracy: "Very rough, production and delivery only; last resort.",
      },
    ],
    useTitle: "Using the number: green score and ranking",
    greenScore: "Green score = 5 × ln(U ÷ CO₂) ÷ ln(U ÷ L), clamped to 0–5 (L, U: plausible range of the category; Kalisvaart 2025).",
    rrf: "Ranking score = 1 ÷ (60 + relevance rank) + 0.2 × 1 ÷ (60 + CO₂ rank). Relevance dominates, CO₂ breaks ties; products without a number get the middle CO₂ rank (Vestrum 2026).",
    rrfNote: "Only the order is used, not the kg: a slightly wrong number still gives the right ranking if the order is right.",
    resultsTitle: "Experimental results",
    resultsHead: ["Experiment", "Setup", "Main result"],
    results: [
      ["28 products with real figures", "16 in covered categories, 12 in new ones", "Covered: 20–22% error, none off by > 2×, Spearman 0.95. Without the 0.66 gate 9/12 new-category products are off by > 2×"],
      ["Leave one product family out (1,450 refs)", "Predict each product from the others, whole family removed", "Category model: 20.9% error (plain median: 24.1%)"],
      ["Versus an LLM guessing (Qwen)", "Same test set", "LLM mean error 77.2 kg vs 68.0 kg for the neighbour average; it guessed ~76 kg for a mouse (< 5 kg real)"],
      ["10,000 products", "1,450 refs + 8,550 Amazon products", "7,406 with a number (74%); 2,594 left empty"],
    ],
    limitsTitle: "Limitations",
    limits: [
      "Sources differ in scope: manufacturer figures use foreign grids, the price method excludes use-phase electricity → compare within a category; the source is shown next to every number.",
      "Vietnamese names score worse than English names (OpenCLIP is trained mostly on English).",
      "The appliance formula is not yet validated against enough real figures; its parameters are assumptions.",
      "Stage shares (when the manufacturer gives no split) and transport routes are illustrative assumptions.",
    ],
    gridNote: "Vietnamese grid: 0.681 kg CO₂e/kWh (2024, Hanoi University of Science and Technology with the Ministry of Agriculture and Environment).",
  },
};
