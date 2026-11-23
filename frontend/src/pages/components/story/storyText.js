// Narration of the CO2 flipbook, in plain language. Every number comes from the API
// response passed in (`d`); nothing here invents a figure.
import { formatKg, formatNum, formatVnd } from "../../../lib/format";
import { tri } from "../../../i18n/LanguageContext";

export const TREE_KG_PER_YEAR = 21.8;   // CO2 one mature tree absorbs per year (same constant as the backend)
export const CAR_KM_PER_KG = 4.1;       // ~0.244 kg CO2e per km for a petrol car (same as the product page)
export const PHONE_CHARGES_PER_KG = 121;
export const GRID_EF_VN = 0.681;        // kg CO2e per kWh, Vietnam 2024
export const CITY_HOUSEHOLDS = 10000;   // scenario size for the smart-city page

const METHOD = {
  manufacturer: { vi: "số do chính hãng công bố cho đúng mẫu này", en: "the manufacturer's own figure for this exact model", fr: "le chiffre publié par le fabricant pour ce modèle exact" },
  neighbor_average: { vi: "trung bình các sản phẩm rất giống có số của hãng", en: "the average of very similar products with manufacturer figures", fr: "la moyenne de produits très similaires ayant un chiffre fabricant" },
  category_model: { vi: "mức điển hình của loại, chỉnh theo hãng và cỡ màn hình", en: "the typical level of the category, adjusted for brand and screen size", fr: "le niveau typique de la catégorie, ajusté selon la marque et la taille d'écran" },
  lifecycle_formula: { vi: "công thức vòng đời theo điện năng tiêu thụ ở Việt Nam", en: "a lifecycle formula based on electricity use in Vietnam", fr: "une formule de cycle de vie fondée sur la consommation électrique au Vietnam" },
  eeio_price: { vi: "ước tính thô theo giá bán và hệ số ngành", en: "a rough estimate from the price and an industry factor", fr: "une estimation grossière à partir du prix et d'un facteur sectoriel" },
  llm_estimate: { vi: "trung bình mẫu giống do AI chỉnh (thí nghiệm)", en: "an AI-adjusted neighbour average (experiment)", fr: "une moyenne de voisins ajustée par l'IA (expérience)" },
};

export function methodText(source, lang) {
  const m = METHOD[source];
  if (!m) return tri(lang)("chưa có cách tính", "no method", "aucune méthode");
  return m[lang] ?? m.en;
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
  const T = tri(lang);
  const k = (x) => formatKg(x, lang) ?? "—";
  const n = (x, dg = 0) => formatNum(x, lang, dg);
  return {
    vi,
    kicker: T("Hành trình CO₂ của sản phẩm", "The CO₂ journey of a product", "Le parcours CO₂ d'un produit"),
    coverLead: (kg) => kg === null
      ? T("Sản phẩm này chưa có số CO₂ đủ tin cậy, nên hệ thống để trống thay vì đoán.", "This product has no reliable CO₂ figure yet, so the system leaves it empty instead of guessing.",
          "Ce produit n'a pas encore de chiffre CO₂ fiable : le système laisse vide plutôt que de deviner.")
      : T(`Từ mỏ khoáng sản đến lúc bị thải bỏ, sản phẩm này gây ra khoảng ${k(kg)} kg CO₂e. Lật trang để xem con số đó đến từ đâu.`,
          `From the mine to the bin, this product causes about ${k(kg)} kg CO₂e. Turn the page to see where that number comes from.`,
          `De la mine à la poubelle, ce produit émet environ ${k(kg)} kg CO₂e. Tournez la page pour voir d'où vient ce chiffre.`),
    price: (p) => formatVnd(p, lang),
    meaningTitle: T("Con số này nghĩa là gì?", "What does this number mean?", "Que signifie ce chiffre ?"),
    meaningLead: T("CO₂e là cách quy mọi khí nhà kính về cùng một đơn vị. Để dễ hình dung, lượng phát thải của sản phẩm này tương đương:",
                   "CO₂e puts every greenhouse gas on one scale. To picture it, this product's footprint equals:",
                   "Le CO₂e ramène tous les gaz à effet de serre à une même unité. Pour se le représenter, l'empreinte de ce produit équivaut à :"),
    trees: (x) => T(`${n(x, 1)} cây xanh trưởng thành phải hấp thụ trong 1 năm`, `${n(x, 1)} mature trees absorbing for a whole year`, `${n(x, 1)} arbres adultes absorbant pendant un an`),
    car: (x) => T(`${n(x)} km chạy bằng ô tô xăng`, `${n(x)} km driven in a petrol car`, `${n(x)} km en voiture essence`),
    charges: (x) => T(`${n(x)} lần sạc đầy điện thoại`, `${n(x)} full phone charges`, `${n(x)} recharges complètes de téléphone`),
    journeyTitle: T("Hành trình 5 chặng", "A five-stage journey", "Un parcours en cinq étapes"),
    journeyLead: T("Bấm vào một chặng để lật tới trang giải thích chặng đó. Chấm cam chạy theo đường là dòng phát thải.",
                   "Tap a stage to jump to its page. The orange dot follows the flow of emissions.",
                   "Touchez une étape pour aller à sa page. Le point orange suit le flux des émissions."),
    stages: T(["Nguyên liệu", "Sản xuất", "Vận chuyển", "Sử dụng", "Thải bỏ"], ["Materials", "Production", "Transport", "Use", "End of life"],
              ["Matières", "Fabrication", "Transport", "Utilisation", "Fin de vie"]),
    prodTitle: T("Chặng 1–2 · Khai thác và sản xuất", "Stages 1–2 · Mining and manufacturing", "Étapes 1–2 · Extraction et fabrication"),
    prodBody: (s, origin) => s
      ? T(`Khai thác kim loại, làm chip, màn hình, pin và lắp ráp${origin ? ` (giả định tại ${origin})` : ""} tạo ra ${k(s.kg)} kg CO₂e, tức ${n(s.pct)}% cả vòng đời. Với đồ điện tử, đây thường là phần lớn nhất: phần lớn khí thải sinh ra trước khi bạn mở hộp.`,
          `Mining metals, making chips, screens and batteries and assembling${origin ? ` (assumed in ${origin})` : ""} emit ${k(s.kg)} kg CO₂e, ${n(s.pct)}% of the lifecycle. For electronics this is usually the largest part: most emissions happen before you open the box.`,
          `Extraire les métaux, fabriquer puces, écrans et batteries puis assembler${origin ? ` (supposé en ${origin})` : ""} émet ${k(s.kg)} kg CO₂e, soit ${n(s.pct)} % du cycle de vie. Pour l'électronique, c'est souvent la plus grosse part : l'essentiel des émissions a lieu avant même d'ouvrir la boîte.`)
      : T("Hãng không tách số theo giai đoạn cho sản phẩm này.", "No stage split is available for this product.", "Pas de répartition par étape pour ce produit."),
    prodTip: T("Dùng máy lâu hơn 1–2 năm là cách giảm CO₂ hiệu quả nhất, vì phần sản xuất được chia cho nhiều năm hơn.",
               "Keeping a device 1–2 years longer is the most effective cut, because manufacturing is spread over more years.",
               "Garder un appareil 1 à 2 ans de plus est le geste le plus efficace : la fabrication est répartie sur plus d'années."),
    transTitle: T("Chặng 3 · Vận chuyển về Việt Nam", "Stage 3 · Shipping to Vietnam", "Étape 3 · Expédition vers le Vietnam"),
    transBody: (s, r) => {
      if (!s) return T("Chưa có số cho chặng vận chuyển.", "No transport figure.", "Pas de chiffre pour le transport.");
      const origin = r ? (vi ? r.origin_vi : r.origin_en) : null;
      const route = r && r.sea_km
        ? T(`${n(r.sea_km)} km đường biển và ${n(r.road_km)} km đường bộ`, `${n(r.sea_km)} km by sea and ${n(r.road_km)} km by road`, `${n(r.sea_km)} km par mer et ${n(r.road_km)} km par route`)
        : r ? T(`${n(r.road_km)} km đường bộ trong nước`, `${n(r.road_km)} km by road inside Vietnam`, `${n(r.road_km)} km par route au Vietnam`) : "";
      return T(`Từ ${origin || "nhà máy"} tới tay bạn: ${route}. Chặng này chiếm ${k(s.kg)} kg CO₂e (${n(s.pct)}%). Tàu biển phát thải rất ít trên mỗi kg hàng; máy bay thì gấp hàng chục lần.`,
               `From ${origin || "the factory"} to you: ${route}. This stage is ${k(s.kg)} kg CO₂e (${n(s.pct)}%). Ships emit very little per kg of cargo; planes emit dozens of times more.`,
               `De ${origin || "l'usine"} jusqu'à vous : ${route}. Cette étape représente ${k(s.kg)} kg CO₂e (${n(s.pct)} %). Un navire émet très peu par kg transporté ; un avion des dizaines de fois plus.`);
    },
    assumedRoute: T("Nơi sản xuất và quãng đường là giả định theo hãng.", "Origin and distance are assumed from the brand.", "L'origine et la distance sont supposées d'après la marque."),
    useTitle: T("Chặng 4 · Sử dụng tại Việt Nam", "Stage 4 · Use in Vietnam", "Étape 4 · Utilisation au Vietnam"),
    useBody: (s, kwh, up) => s
      ? T(`Mỗi kWh điện ở Việt Nam phát thải khoảng ${n(GRID_EF_VN, 3)} kg CO₂e vì lưới điện còn nhiều nhiệt điện than. Trong ${up?.years ? `${n(up.years)} năm` : "cả vòng đời"}, sản phẩm dùng khoảng ${n(kwh)} kWh, tương đương ${k(s.kg)} kg CO₂e (${n(s.pct)}%).`,
          `Each kWh in Vietnam emits about ${n(GRID_EF_VN, 3)} kg CO₂e because the grid still relies on coal. Over ${up?.years ? `${n(up.years)} years` : "its life"} the product uses about ${n(kwh)} kWh, i.e. ${k(s.kg)} kg CO₂e (${n(s.pct)}%).`,
          `Chaque kWh au Vietnam émet environ ${n(GRID_EF_VN, 3)} kg CO₂e car le réseau dépend encore du charbon. Sur ${up?.years ? `${n(up.years)} ans` : "sa durée de vie"}, le produit consomme environ ${n(kwh)} kWh, soit ${k(s.kg)} kg CO₂e (${n(s.pct)} %).`)
      : T("Chưa có số cho chặng sử dụng.", "No use-phase figure.", "Pas de chiffre pour l'utilisation."),
    useTip: T("Với máy lạnh, tủ lạnh, tivi, chặng này lớn nhất: chọn máy inverter, nhãn 5 sao giúp giảm cả tiền điện lẫn CO₂.",
              "For air conditioners, fridges and TVs this stage dominates: inverter and 5-star labels cut both the bill and CO₂.",
              "Pour les climatiseurs, réfrigérateurs et téléviseurs, cette étape domine : un modèle inverter bien étiqueté réduit la facture et le CO₂."),
    eolTitle: T("Chặng 5 · Thải bỏ và tái chế", "Stage 5 · End of life", "Étape 5 · Fin de vie"),
    eolBody: (s) => s
      ? T(`Thu gom, xử lý và tái chế tạo ra ${k(s.kg)} kg CO₂e (${n(s.pct)}%). Con số nhỏ, nhưng rác điện tử vứt sai chỗ làm kim loại nặng ngấm vào đất và nước.`,
          `Collection, treatment and recycling emit ${k(s.kg)} kg CO₂e (${n(s.pct)}%). Small, but e-waste dumped in the wrong place leaks heavy metals into soil and water.`,
          `Collecte, traitement et recyclage émettent ${k(s.kg)} kg CO₂e (${n(s.pct)} %). C'est peu, mais un déchet électronique mal jeté libère des métaux lourds dans le sol et l'eau.`)
      : T("Chưa có số cho chặng thải bỏ.", "No end-of-life figure.", "Pas de chiffre pour la fin de vie."),
    eolTip: T("Bán lại, tặng lại hoặc mang tới điểm thu gom rác điện tử thay vì bỏ chung rác sinh hoạt.",
              "Resell, donate or bring it to an e-waste collection point instead of household waste.",
              "Revendez, donnez ou déposez-le dans un point de collecte plutôt qu'avec les ordures ménagères."),
    formulaTitle: T("Con số được tính thế nào?", "How was the number computed?", "Comment le chiffre est-il calculé ?"),
    formulaLead: (src) => T(`Hệ thống thử lần lượt 4 cách và dừng ở cách đầu tiên cho ra số. Sản phẩm này dùng: ${methodText(src, lang)}.`,
                            `The system tries four methods in order and stops at the first that gives a number. This product uses: ${methodText(src, lang)}.`,
                            `Le système essaie quatre méthodes dans l'ordre et s'arrête à la première qui donne un chiffre. Ce produit utilise : ${methodText(src, lang)}.`),
    chain: T(["Trùng đúng mẫu của hãng", "Trung bình mẫu giống (≥ 66%)", "Công thức / mức của loại / theo giá", "Để trống, không đoán"],
             ["Exact manufacturer model", "Average of similar (≥ 66%)", "Formula / category level / price", "Leave empty, never guess"],
             ["Modèle exact du fabricant", "Moyenne de produits similaires (≥ 66 %)", "Formule / niveau de catégorie / prix", "Laisser vide, ne jamais deviner"]),
    confidence: T("Độ tin cậy", "Confidence", "Fiabilité"),
    principle: T("AI chỉ dùng để tìm sản phẩm giống nhau, không tự bịa ra con số.", "AI only finds similar products; it never makes up the number.",
                 "L'IA ne sert qu'à trouver des produits similaires ; elle n'invente jamais le chiffre."),
    refs: T("Mẫu đã dùng (bấm để mở báo cáo của hãng)", "References used (tap to open the report)", "Références utilisées (touchez pour ouvrir le rapport)"),
    compareTitle: T("So với sản phẩm cùng loại", "Compared with its category", "Face à sa catégorie"),
    compareBody: (st) => st && st.greener_than_pct !== null && st.greener_than_pct !== undefined
      ? T(`Trong ${n(st.n)} sản phẩm cùng loại trên các sàn, sản phẩm này xanh hơn ${n(st.greener_than_pct)}%. Mức giữa của loại là ${k(st.median_kg)} kg.`,
          `Among ${n(st.n)} products of the same type, this one is greener than ${n(st.greener_than_pct)}%. The category median is ${k(st.median_kg)} kg.`,
          `Parmi ${n(st.n)} produits du même type, celui-ci est plus vert que ${n(st.greener_than_pct)} % d'entre eux. La médiane de la catégorie est de ${k(st.median_kg)} kg.`)
      : T("Chưa đủ dữ liệu thống kê cho loại này.", "Not enough data for this category.", "Pas assez de données pour cette catégorie."),
    lowLabel: T("ít CO₂", "low CO₂", "peu de CO₂"), highLabel: T("nhiều CO₂", "high CO₂", "beaucoup de CO₂"), median: T("trung vị", "median", "médiane"),
    greener: T("Món xanh hơn, giá tương đương", "Greener choice at a similar price", "Choix plus vert à prix proche"),
    openStory: T("Xem hành trình của món này →", "See its journey →", "Voir son parcours →"),
    wefeTitle: T("WEFE và đô thị thông minh", "WEFE and the smart city", "WEFE et ville intelligente"),
    wefeLead: T("Nước – Năng lượng – Lương thực – Hệ sinh thái gắn chặt với nhau. Một lựa chọn mua sắm chạm tới cả bốn:",
                "Water, Energy, Food and Ecosystems are tightly linked. One purchase touches all four:",
                "Eau, énergie, alimentation et écosystèmes sont étroitement liés. Un achat touche les quatre :"),
    wefeEnergy: (kwh) => T(`⚡ Năng lượng: khoảng ${n(kwh)} kWh điện lưới trong vòng đời.`, `⚡ Energy: about ${n(kwh)} kWh of grid power over its life.`, `⚡ Énergie : environ ${n(kwh)} kWh du réseau sur sa durée de vie.`),
    wefeWater: T("💧 Nước: nhiệt điện than cần rất nhiều nước làm mát, tiết kiệm điện cũng là tiết kiệm nước.",
                 "💧 Water: coal plants need a lot of cooling water, so saving power saves water.",
                 "💧 Eau : les centrales à charbon ont besoin de beaucoup d'eau de refroidissement ; économiser l'électricité, c'est économiser l'eau."),
    wefeFood: T("🌾 Lương thực: rác điện tử xử lý sai làm ô nhiễm đất canh tác và nguồn nước tưới.",
                "🌾 Food: badly handled e-waste pollutes farmland and irrigation water.",
                "🌾 Alimentation : des déchets électroniques mal traités polluent les terres agricoles et l'eau d'irrigation."),
    wefeEco: (t) => T(`🌳 Hệ sinh thái: cần ${n(t, 1)} cây hấp thụ trong một năm để bù lại.`, `🌳 Ecosystems: ${n(t, 1)} trees need a year to absorb it.`, `🌳 Écosystèmes : il faut ${n(t, 1)} arbres pendant un an pour l'absorber.`),
    city: (tn, sv) => tn !== null
      ? T(`Kịch bản đô thị: nếu ${n(CITY_HOUSEHOLDS)} hộ chọn sản phẩm này thay vì món ở mức trung vị của loại, thành phố tránh được khoảng ${n(tn, 1)} tấn CO₂e (${k(sv)} kg mỗi hộ).`,
          `City scenario: if ${n(CITY_HOUSEHOLDS)} households pick this product instead of a median one, the city avoids about ${n(tn, 1)} t CO₂e (${k(sv)} kg each).`,
          `Scénario urbain : si ${n(CITY_HOUSEHOLDS)} foyers choisissent ce produit plutôt qu'un produit médian, la ville évite environ ${n(tn, 1)} t CO₂e (${k(sv)} kg chacun).`)
      : T("Kịch bản đô thị: sản phẩm này không thấp hơn mức trung vị của loại; chọn món xanh hơn ở trang trước sẽ giúp thành phố giảm phát thải.",
          "City scenario: this product is not below the category median; picking the greener option on the previous page would cut the city's emissions.",
          "Scénario urbain : ce produit n'est pas sous la médiane de sa catégorie ; choisir l'option plus verte de la page précédente réduirait les émissions de la ville."),
    scenarioNote: T("Kịch bản minh họa, không phải số đo thực tế.", "Illustrative scenario, not a measurement.", "Scénario illustratif, pas une mesure."),
    actTitle: T("Bạn có thể làm gì?", "What can you do?", "Que pouvez-vous faire ?"),
    actAsk: T("Hỏi AI về sản phẩm này", "Ask the AI about it", "Interroger l'IA sur ce produit"),
    actCompare: T("So sánh với món khác", "Compare with others", "Comparer avec d'autres"),
    actCart: T("Thêm vào giỏ (thử)", "Add to cart (test)", "Ajouter au panier (test)"),
    actProduct: T("Xem trang sản phẩm", "Open the product page", "Ouvrir la fiche produit"),
    actAnother: T("Chọn sản phẩm khác", "Pick another product", "Choisir un autre produit"),
    tips: T(["Ưu tiên món có điểm xanh cao trong cùng tầm giá.", "Dùng lâu hơn, sửa thay vì thay mới.", "Tắt hẳn thiết bị khi không dùng.", "Thu gom rác điện tử đúng nơi."],
            ["Prefer a higher green score in the same price range.", "Use it longer; repair before replacing.", "Switch devices fully off.", "Recycle e-waste properly."],
            ["Préférez un meilleur score vert dans la même gamme de prix.", "Utilisez-le plus longtemps ; réparez avant de remplacer.", "Éteignez complètement vos appareils.", "Recyclez correctement les déchets électroniques."]),
    backTitle: T("Nguồn và giới hạn", "Sources and limits", "Sources et limites"),
    backBody: T(["Số CO₂ lấy từ cột co2e_kg của hệ thống: cùng một số trên mọi trang.", "Hệ số lưới điện Việt Nam 0,681 kg CO₂e/kWh (2024).", "1.450 sản phẩm mẫu có số do hãng công bố (báo cáo EPD/PCF).", "Tỷ lệ theo giai đoạn và tuyến vận chuyển là giả định khi hãng chỉ công bố tổng.", "Hình minh họa: SVG do AI vẽ, chuyển động theo dữ liệu thật."],
                ["CO₂ comes from the system's co2e_kg column: the same number on every page.", "Vietnam grid factor 0.681 kg CO₂e/kWh (2024).", "1,450 reference products with manufacturer figures (EPD/PCF reports).", "Stage shares and shipping route are assumptions when only a total is published.", "Illustrations: AI-drawn SVG, animated from real data."],
                ["Le CO₂ vient de la colonne co2e_kg du système : le même chiffre sur toutes les pages.", "Facteur du réseau vietnamien : 0,681 kg CO₂e/kWh (2024).", "1 450 produits de référence avec des chiffres de fabricants (rapports EPD/PCF).", "Les parts par étape et le trajet sont des hypothèses quand seul un total est publié.", "Illustrations : SVG dessinés par l'IA, animés à partir des vraies données."]),
    prev: T("Trang trước", "Previous", "Page précédente"), next: T("Trang sau", "Next", "Page suivante"),
    autoplay: T("Tự lật", "Autoplay", "Lecture auto"), stop: T("Dừng", "Stop", "Arrêter"),
    loading: T("Đang dựng cuốn sách…", "Building the book…", "Création du livre…"),
    notFound: T("Không tìm thấy sản phẩm.", "Product not found.", "Produit introuvable."),
    landingTitle: T("Mỗi sản phẩm là một câu chuyện CO₂", "Every product has a CO₂ story", "Chaque produit a son histoire CO₂"),
    landingLead: T("Gõ tên sản phẩm bạn quan tâm. Hệ thống dựng một cuốn sách tương tác: nó được làm ở đâu, đi bằng gì, dùng tốn bao nhiêu điện, và vì sao nên chọn món ít CO₂ hơn.",
                   "Type a product you care about. The system builds an interactive book: where it was made, how it travelled, how much power it uses, and why a lower-CO₂ choice matters.",
                   "Tapez un produit qui vous intéresse. Le système construit un livre interactif : où il a été fabriqué, comment il a voyagé, combien d'électricité il consomme, et pourquoi un choix moins émetteur compte."),
    landingPlaceholder: T("Ví dụ: laptop Dell, màn hình 27 inch, iPhone…", "e.g. Dell laptop, 27-inch monitor, iPhone…", "ex. portable Dell, écran 27 pouces, iPhone…"),
    landingGo: T("Mở sách", "Open the book", "Ouvrir le livre"),
    landingPick: T("Chọn một sản phẩm để mở sách", "Pick a product to open its book", "Choisissez un produit pour ouvrir son livre"),
    landingNone: T("Không có sản phẩm có số CO₂ cho từ khóa này.", "No product with a CO₂ figure for this query.", "Aucun produit avec un chiffre CO₂ pour cette recherche."),
    suggestions: T(["laptop Dell", "MacBook", "màn hình 27 inch", "iPhone", "tai nghe", "máy tính bảng"],
                   ["Dell laptop", "MacBook", "27 inch monitor", "iPhone", "headphones", "tablet"],
                   ["portable Dell", "MacBook", "écran 27 pouces", "iPhone", "casque", "tablette"]),
  };
}
