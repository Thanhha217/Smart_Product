// Narration of the CO2 flipbook, in plain language. Every number comes from the API
// response passed in (`d`); nothing here invents a figure.
import { formatKg, formatNum, formatVnd } from "../../../lib/format";

export const TREE_KG_PER_YEAR = 21.8;   // CO2 one mature tree absorbs per year (same constant as the backend)
export const CAR_KM_PER_KG = 4.1;       // ~0.244 kg CO2e per km for a petrol car (same as the product page)
export const PHONE_CHARGES_PER_KG = 121;
export const GRID_EF_VN = 0.681;        // kg CO2e per kWh, Vietnam 2024
export const CITY_HOUSEHOLDS = 10000;   // scenario size for the smart-city page

const METHOD = {
  manufacturer: ["số do chính hãng công bố cho đúng mẫu này", "the manufacturer's own figure for this exact model"],
  neighbor_average: ["trung bình các sản phẩm rất giống có số của hãng", "the average of very similar products with manufacturer figures"],
  category_model: ["mức điển hình của loại, chỉnh theo hãng và cỡ màn hình", "the typical level of the category, adjusted for brand and screen size"],
  lifecycle_formula: ["công thức vòng đời theo điện năng tiêu thụ ở Việt Nam", "a lifecycle formula based on electricity use in Vietnam"],
  eeio_price: ["ước tính thô theo giá bán và hệ số ngành", "a rough estimate from the price and an industry factor"],
  llm_estimate: ["trung bình mẫu giống do AI chỉnh (thí nghiệm)", "an AI-adjusted neighbour average (experiment)"],
};

export function methodText(source, lang) {
  const m = METHOD[source];
  return m ? m[lang === "vi" ? 0 : 1] : lang === "vi" ? "chưa có cách tính" : "no method";
}

export function derive(d) {
  const kg = d?.product?.co2e_kg ?? null;
  const stages = Object.fromEntries((d?.lifecycle?.stages || []).map((s) => [s.key, s]));
  const route = d?.lifecycle?.route || null;
  const usePhase = d?.lifecycle?.use_phase || null;
  const useKg = stages.use?.kg ?? null;
  const kwhLife = usePhase?.kwh_year && usePhase?.years ? usePhase.kwh_year * usePhase.years
    : useKg !== null ? useKg / GRID_EF_VN : null;
  const median = d?.stats?.median_kg ?? null;
  const savedPerUnit = kg !== null && median !== null && median > kg ? median - kg : null;
  return {
    kg, stages, route, usePhase, useKg, kwhLife, median, savedPerUnit,
    trees: kg !== null ? kg / TREE_KG_PER_YEAR : null,
    carKm: kg !== null ? kg * CAR_KM_PER_KG : null,
    charges: kg !== null ? kg * PHONE_CHARGES_PER_KG : null,
    cityTonnes: savedPerUnit !== null ? (savedPerUnit * CITY_HOUSEHOLDS) / 1000 : null,
    assumed: d?.lifecycle?.basis === "typical_share" || route?.assumed,
  };
}

export function txt(lang) {
  const vi = lang === "vi";
  const k = (x) => formatKg(x, lang) ?? "—";
  const n = (x, dg = 0) => formatNum(x, lang, dg);
  return {
    vi,
    kicker: vi ? "Hành trình CO₂ của sản phẩm" : "The CO₂ journey of a product",
    coverLead: (kg) => kg === null
      ? (vi ? "Sản phẩm này chưa có số CO₂ đủ tin cậy, nên hệ thống để trống thay vì đoán." : "This product has no reliable CO₂ figure yet, so the system leaves it empty instead of guessing.")
      : (vi ? `Từ mỏ khoáng sản đến lúc bị thải bỏ, sản phẩm này gây ra khoảng ${k(kg)} kg CO₂e. Lật trang để xem con số đó đến từ đâu.`
            : `From the mine to the bin, this product causes about ${k(kg)} kg CO₂e. Turn the page to see where that number comes from.`),
    price: (p) => formatVnd(p, lang),
    meaningTitle: vi ? "Con số này nghĩa là gì?" : "What does this number mean?",
    meaningLead: vi ? "CO₂e là cách quy mọi khí nhà kính về cùng một đơn vị. Để dễ hình dung, lượng phát thải của sản phẩm này tương đương:"
                    : "CO₂e puts every greenhouse gas on one scale. To picture it, this product's footprint equals:",
    trees: (x) => vi ? `${n(x, 1)} cây xanh trưởng thành phải hấp thụ trong 1 năm` : `${n(x, 1)} mature trees absorbing for a whole year`,
    car: (x) => vi ? `${n(x)} km chạy bằng ô tô xăng` : `${n(x)} km driven in a petrol car`,
    charges: (x) => vi ? `${n(x)} lần sạc đầy điện thoại` : `${n(x)} full phone charges`,
    journeyTitle: vi ? "Hành trình 5 chặng" : "A five-stage journey",
    journeyLead: vi ? "Bấm vào một chặng để lật tới trang giải thích chặng đó. Chấm cam chạy theo đường là dòng phát thải."
                    : "Tap a stage to jump to its page. The orange dot follows the flow of emissions.",
    stages: vi ? ["Nguyên liệu", "Sản xuất", "Vận chuyển", "Sử dụng", "Thải bỏ"] : ["Materials", "Production", "Transport", "Use", "End of life"],
    prodTitle: vi ? "Chặng 1–2 · Khai thác và sản xuất" : "Stages 1–2 · Mining and manufacturing",
    prodBody: (s, origin) => s
      ? (vi ? `Khai thác kim loại, làm chip, màn hình, pin và lắp ráp${origin ? ` (giả định tại ${origin})` : ""} tạo ra ${k(s.kg)} kg CO₂e, tức ${n(s.pct)}% cả vòng đời. Với đồ điện tử, đây thường là phần lớn nhất: phần lớn khí thải sinh ra trước khi bạn mở hộp.`
            : `Mining metals, making chips, screens and batteries and assembling${origin ? ` (assumed in ${origin})` : ""} emit ${k(s.kg)} kg CO₂e, ${n(s.pct)}% of the lifecycle. For electronics this is usually the largest part: most emissions happen before you open the box.`)
      : (vi ? "Hãng không tách số theo giai đoạn cho sản phẩm này." : "No stage split is available for this product."),
    prodTip: vi ? "Dùng máy lâu hơn 1–2 năm là cách giảm CO₂ hiệu quả nhất, vì phần sản xuất được chia cho nhiều năm hơn."
                : "Keeping a device 1–2 years longer is the most effective cut, because manufacturing is spread over more years.",
    transTitle: vi ? "Chặng 3 · Vận chuyển về Việt Nam" : "Stage 3 · Shipping to Vietnam",
    transBody: (s, r) => {
      if (!s) return vi ? "Chưa có số cho chặng vận chuyển." : "No transport figure.";
      const origin = r ? (vi ? r.origin_vi : r.origin_en) : null;
      const route = r && r.sea_km ? (vi ? `${n(r.sea_km)} km đường biển và ${n(r.road_km)} km đường bộ` : `${n(r.sea_km)} km by sea and ${n(r.road_km)} km by road`)
        : r ? (vi ? `${n(r.road_km)} km đường bộ trong nước` : `${n(r.road_km)} km by road inside Vietnam`) : "";
      return vi ? `Từ ${origin || "nhà máy"} tới tay bạn: ${route}. Chặng này chiếm ${k(s.kg)} kg CO₂e (${n(s.pct)}%). Tàu biển phát thải rất ít trên mỗi kg hàng; máy bay thì gấp hàng chục lần.`
                : `From ${origin || "the factory"} to you: ${route}. This stage is ${k(s.kg)} kg CO₂e (${n(s.pct)}%). Ships emit very little per kg of cargo; planes emit dozens of times more.`;
    },
    assumedRoute: vi ? "Nơi sản xuất và quãng đường là giả định theo hãng." : "Origin and distance are assumed from the brand.",
    useTitle: vi ? "Chặng 4 · Sử dụng tại Việt Nam" : "Stage 4 · Use in Vietnam",
    useBody: (s, kwh, up) => s
      ? (vi ? `Mỗi kWh điện ở Việt Nam phát thải khoảng ${n(GRID_EF_VN, 3)} kg CO₂e vì lưới điện còn nhiều nhiệt điện than. Trong ${up?.years ? `${n(up.years)} năm` : "cả vòng đời"}, sản phẩm dùng khoảng ${n(kwh)} kWh, tương đương ${k(s.kg)} kg CO₂e (${n(s.pct)}%).`
            : `Each kWh in Vietnam emits about ${n(GRID_EF_VN, 3)} kg CO₂e because the grid still relies on coal. Over ${up?.years ? `${n(up.years)} years` : "its life"} the product uses about ${n(kwh)} kWh, i.e. ${k(s.kg)} kg CO₂e (${n(s.pct)}%).`)
      : (vi ? "Chưa có số cho chặng sử dụng." : "No use-phase figure."),
    useTip: vi ? "Với máy lạnh, tủ lạnh, tivi, chặng này lớn nhất: chọn máy inverter, nhãn 5 sao giúp giảm cả tiền điện lẫn CO₂."
               : "For air conditioners, fridges and TVs this stage dominates: inverter and 5-star labels cut both the bill and CO₂.",
    eolTitle: vi ? "Chặng 5 · Thải bỏ và tái chế" : "Stage 5 · End of life",
    eolBody: (s) => s
      ? (vi ? `Thu gom, xử lý và tái chế tạo ra ${k(s.kg)} kg CO₂e (${n(s.pct)}%). Con số nhỏ, nhưng rác điện tử vứt sai chỗ làm kim loại nặng ngấm vào đất và nước.`
            : `Collection, treatment and recycling emit ${k(s.kg)} kg CO₂e (${n(s.pct)}%). Small, but e-waste dumped in the wrong place leaks heavy metals into soil and water.`)
      : (vi ? "Chưa có số cho chặng thải bỏ." : "No end-of-life figure."),
    eolTip: vi ? "Bán lại, tặng lại hoặc mang tới điểm thu gom rác điện tử thay vì bỏ chung rác sinh hoạt."
               : "Resell, donate or bring it to an e-waste collection point instead of household waste.",
    formulaTitle: vi ? "Con số được tính thế nào?" : "How was the number computed?",
    formulaLead: (src) => vi ? `Hệ thống thử lần lượt 4 cách và dừng ở cách đầu tiên cho ra số. Sản phẩm này dùng: ${methodText(src, lang)}.`
                             : `The system tries four methods in order and stops at the first that gives a number. This product uses: ${methodText(src, lang)}.`,
    chain: vi ? ["Trùng đúng mẫu của hãng", "Trung bình mẫu giống (≥ 66%)", "Công thức / mức của loại / theo giá", "Để trống, không đoán"]
              : ["Exact manufacturer model", "Average of similar (≥ 66%)", "Formula / category level / price", "Leave empty, never guess"],
    confidence: vi ? "Độ tin cậy" : "Confidence",
    principle: vi ? "AI chỉ dùng để tìm sản phẩm giống nhau, không tự bịa ra con số." : "AI only finds similar products; it never makes up the number.",
    refs: vi ? "Mẫu đã dùng (bấm để mở báo cáo của hãng)" : "References used (tap to open the report)",
    compareTitle: vi ? "So với sản phẩm cùng loại" : "Compared with its category",
    compareBody: (st) => st && st.greener_than_pct !== null && st.greener_than_pct !== undefined
      ? (vi ? `Trong ${n(st.n)} sản phẩm cùng loại trên các sàn, sản phẩm này xanh hơn ${n(st.greener_than_pct)}%. Mức giữa của loại là ${k(st.median_kg)} kg.`
            : `Among ${n(st.n)} products of the same type, this one is greener than ${n(st.greener_than_pct)}%. The category median is ${k(st.median_kg)} kg.`)
      : (vi ? "Chưa đủ dữ liệu thống kê cho loại này." : "Not enough data for this category."),
    lowLabel: vi ? "ít CO₂" : "low CO₂", highLabel: vi ? "nhiều CO₂" : "high CO₂", median: vi ? "trung vị" : "median",
    greener: vi ? "Món xanh hơn, giá tương đương" : "Greener choice at a similar price",
    openStory: vi ? "Xem hành trình của món này →" : "See its journey →",
    wefeTitle: vi ? "WEFE và đô thị thông minh" : "WEFE and the smart city",
    wefeLead: vi ? "Nước – Năng lượng – Lương thực – Hệ sinh thái gắn chặt với nhau. Một lựa chọn mua sắm chạm tới cả bốn:"
                 : "Water, Energy, Food and Ecosystems are tightly linked. One purchase touches all four:",
    wefeEnergy: (kwh) => vi ? `⚡ Năng lượng: khoảng ${n(kwh)} kWh điện lưới trong vòng đời.` : `⚡ Energy: about ${n(kwh)} kWh of grid power over its life.`,
    wefeWater: vi ? "💧 Nước: nhiệt điện than cần rất nhiều nước làm mát, tiết kiệm điện cũng là tiết kiệm nước."
                  : "💧 Water: coal plants need a lot of cooling water, so saving power saves water.",
    wefeFood: vi ? "🌾 Lương thực: rác điện tử xử lý sai làm ô nhiễm đất canh tác và nguồn nước tưới."
                 : "🌾 Food: badly handled e-waste pollutes farmland and irrigation water.",
    wefeEco: (t) => vi ? `🌳 Hệ sinh thái: cần ${n(t, 1)} cây hấp thụ trong một năm để bù lại.` : `🌳 Ecosystems: ${n(t, 1)} trees need a year to absorb it.`,
    city: (tn, sv) => tn !== null
      ? (vi ? `Kịch bản đô thị: nếu ${n(CITY_HOUSEHOLDS)} hộ chọn sản phẩm này thay vì món ở mức trung vị của loại, thành phố tránh được khoảng ${n(tn, 1)} tấn CO₂e (${k(sv)} kg mỗi hộ).`
            : `City scenario: if ${n(CITY_HOUSEHOLDS)} households pick this product instead of a median one, the city avoids about ${n(tn, 1)} t CO₂e (${k(sv)} kg each).`)
      : (vi ? `Kịch bản đô thị: sản phẩm này không thấp hơn mức trung vị của loại; chọn món xanh hơn ở trang trước sẽ giúp thành phố giảm phát thải.`
            : `City scenario: this product is not below the category median; picking the greener option on the previous page would cut the city's emissions.`),
    scenarioNote: vi ? "Kịch bản minh họa, không phải số đo thực tế." : "Illustrative scenario, not a measurement.",
    actTitle: vi ? "Bạn có thể làm gì?" : "What can you do?",
    actAsk: vi ? "Hỏi AI về sản phẩm này" : "Ask the AI about it",
    actCompare: vi ? "So sánh với món khác" : "Compare with others",
    actCart: vi ? "Thêm vào giỏ (thử)" : "Add to cart (test)",
    actProduct: vi ? "Xem trang sản phẩm" : "Open the product page",
    actAnother: vi ? "Chọn sản phẩm khác" : "Pick another product",
    tips: vi ? ["Ưu tiên món có điểm xanh cao trong cùng tầm giá.", "Dùng lâu hơn, sửa thay vì thay mới.", "Tắt hẳn thiết bị khi không dùng.", "Thu gom rác điện tử đúng nơi."]
             : ["Prefer a higher green score in the same price range.", "Use it longer; repair before replacing.", "Switch devices fully off.", "Recycle e-waste properly."],
    backTitle: vi ? "Nguồn và giới hạn" : "Sources and limits",
    backBody: vi ? ["Số CO₂ lấy từ cột co2e_kg của hệ thống: cùng một số trên mọi trang.", "Hệ số lưới điện Việt Nam 0,681 kg CO₂e/kWh (2024).", "1.450 sản phẩm mẫu có số do hãng công bố (báo cáo EPD/PCF).", "Tỷ lệ theo giai đoạn và tuyến vận chuyển là giả định khi hãng chỉ công bố tổng.", "Hình minh họa: SVG do AI vẽ, chuyển động theo dữ liệu thật."]
                 : ["CO₂ comes from the system's co2e_kg column: the same number on every page.", "Vietnam grid factor 0.681 kg CO₂e/kWh (2024).", "1,450 reference products with manufacturer figures (EPD/PCF reports).", "Stage shares and shipping route are assumptions when only a total is published.", "Illustrations: AI-drawn SVG, animated from real data."],
    prev: vi ? "Trang trước" : "Previous", next: vi ? "Trang sau" : "Next",
    autoplay: vi ? "Tự lật" : "Autoplay", stop: vi ? "Dừng" : "Stop",
    loading: vi ? "Đang dựng cuốn sách…" : "Building the book…",
    notFound: vi ? "Không tìm thấy sản phẩm." : "Product not found.",
    landingTitle: vi ? "Mỗi sản phẩm là một câu chuyện CO₂" : "Every product has a CO₂ story",
    landingLead: vi ? "Gõ tên sản phẩm bạn quan tâm. Hệ thống dựng một cuốn sách tương tác: nó được làm ở đâu, đi bằng gì, dùng tốn bao nhiêu điện, và vì sao nên chọn món ít CO₂ hơn."
                    : "Type a product you care about. The system builds an interactive book: where it was made, how it travelled, how much power it uses, and why a lower-CO₂ choice matters.",
    landingPlaceholder: vi ? "Ví dụ: laptop Dell, màn hình 27 inch, iPhone…" : "e.g. Dell laptop, 27-inch monitor, iPhone…",
    landingGo: vi ? "Mở sách" : "Open the book",
    landingPick: vi ? "Chọn một sản phẩm để mở sách" : "Pick a product to open its book",
    landingNone: vi ? "Không có sản phẩm có số CO₂ cho từ khóa này." : "No product with a CO₂ figure for this query.",
    suggestions: vi ? ["laptop Dell", "MacBook", "màn hình 27 inch", "iPhone", "tai nghe", "máy tính bảng"] : ["Dell laptop", "MacBook", "27 inch monitor", "iPhone", "headphones", "tablet"],
  };
}
