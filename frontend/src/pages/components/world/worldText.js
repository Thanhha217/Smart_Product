import { tri } from "../../../i18n/LanguageContext";

// UI labels of the CO2 world, in plain language. T(vi, en, fr).
export function worldText(lang) {
  const vi = lang === "vi";
  const T = tri(lang);
  return {
    vi,
    aria: T("Thế giới mô phỏng phát thải CO₂ của sản phẩm", "Simulated world of a product's CO₂ emissions", "Monde simulé des émissions de CO₂ d'un produit"),
    stages: {
      materials: T("Nguyên liệu", "Materials", "Matières"),
      materials_production: T("Sản xuất", "Production", "Fabrication"),
      transport: T("Vận chuyển", "Transport", "Transport"),
      use: T("Sử dụng", "Use", "Utilisation"),
      end_of_life: T("Thải bỏ", "End of life", "Fin de vie"),
    },
    total: T("Tổng", "Total", "Total"),
    overview: T("Toàn cảnh", "Overview", "Vue d'ensemble"),
    zoomIn: T("Phóng to", "Zoom in", "Zoomer"), zoomOut: T("Thu nhỏ", "Zoom out", "Dézoomer"),
    hint: T("Kéo để di chuyển · cuộn để phóng to · bấm vào bất kỳ thứ gì để hỏi", "Drag to move · scroll to zoom · tap anything to ask",
            "Glissez pour bouger · molette pour zoomer · touchez n'importe quoi pour demander"),
    askMode: T("Hỏi bất kỳ chỗ nào", "Ask about anything", "Demander sur tout"),
    askModeOn: T("Đang bật: bấm vào chữ, số hay hình bất kỳ", "On: tap any text, number or picture", "Activé : touchez un texte, un chiffre ou une image"),
    originLand: T("Nước sản xuất", "Country of manufacture", "Pays de fabrication"),
    originPort: T("Cảng xuất", "Export port", "Port d'export"),
    vnPort: T("Cảng Việt Nam", "Vietnam port", "Port vietnamien"),
    factoryAt: (o) => T(`Nhà máy · ${o}`, `Factory · ${o}`, `Usine · ${o}`),
    assumed: T("(giả định)", "(assumed)", "(hypothèse)"),
    official: T("Số chính thức", "Official figure", "Chiffre officiel"),
    greenScore: T("Điểm xanh", "Green score", "Score vert"),
    confidence: T("Độ tin cậy", "Confidence", "Fiabilité"),
    formula: T("Công thức", "Formula", "Formule"),
    book: T("📖 Chế độ đọc sách", "📖 Book mode", "📖 Mode livre"),
    method: T("🧮 Phương pháp", "🧮 Method", "🧮 Méthode"),
    category: T("So với cùng loại", "Vs. its category", "Face à sa catégorie"),
    alternative: T("Món xanh hơn", "Greener choice", "Choix plus vert"),
    // explain panel
    close: T("Đóng", "Close", "Fermer"),
    askAi: T("✨ Hỏi AI giải thích thêm", "✨ Ask the AI for more", "✨ Demander plus à l'IA"),
    askPlaceholder: T("Hỏi điều bạn chưa hiểu…", "Ask what you don't understand…", "Demandez ce que vous ne comprenez pas…"),
    send: T("Hỏi", "Ask", "Demander"),
    thinking: T("AI đang soạn câu trả lời…", "The AI is writing…", "L'IA rédige sa réponse…"),
    byAi: (m) => T(`Trả lời bởi AI · ${m}`, `Answered by AI · ${m}`, `Réponse de l'IA · ${m}`),
    byRules: T("Câu giải thích soạn sẵn từ số liệu thật", "Prepared explanation from the real figures", "Explication préparée à partir des vrais chiffres"),
    aiError: T("Chưa gọi được AI, đang hiện phần giải thích soạn sẵn.", "Could not reach the AI; showing the prepared explanation.",
               "L'IA est injoignable ; affichage de l'explication préparée."),
    numbersNote: T("Mọi con số lấy từ dữ liệu của hệ thống; AI không được tự đặt ra số.", "Every number comes from the system's data; the AI may not invent figures.",
                   "Chaque chiffre vient des données du système ; l'IA n'a pas le droit d'en inventer."),
    // simulator
    sim: T("🎛 Thử thay đổi", "🎛 What if", "🎛 Et si…"),
    simTitle: T("Thử thay đổi để xem CO₂ đổi thế nào", "Change things and watch the CO₂", "Changez les options et observez le CO₂"),
    simOnShares: T("Mô phỏng chạy trên tỷ lệ giai đoạn điển hình của loại, không phải số đo riêng của sản phẩm này.",
                   "The simulation runs on the category's typical stage shares, not on measurements of this product.",
                   "La simulation s'appuie sur les parts typiques de la catégorie, pas sur des mesures de ce produit."),
    origin: T("Sản xuất ở", "Made in", "Fabriqué en"),
    mode: T("Vận chuyển bằng", "Shipped by", "Transporté par"),
    ship: T("🚢 Tàu biển", "🚢 Ship", "🚢 Bateau"), plane: T("✈️ Máy bay", "✈️ Plane", "✈️ Avion"),
    grid: T("Nguồn điện khi dùng", "Electricity used", "Électricité utilisée"),
    gridVn: T("Lưới điện VN", "Vietnam grid", "Réseau vietnamien"), gridSolar: T("Điện mặt trời", "Solar", "Solaire"),
    gridNote: T("Điện mặt trời ≈ 0,048 kg/kWh (số xấp xỉ)", "Solar ≈ 0.048 kg/kWh (approximate)", "Solaire ≈ 0,048 kg/kWh (approximatif)"),
    years: T("Số năm sử dụng", "Years of use", "Années d'utilisation"),
    yearsN: (n) => T(`${n} năm`, `${n} years`, `${n} ans`),
    refurb: T("Mua máy tân trang (đã qua sử dụng)", "Buy refurbished", "Acheter reconditionné"),
    reset: T("Về số chính thức", "Back to the official figure", "Revenir au chiffre officiel"),
    scenarioTotal: T("Tổng theo kịch bản", "Scenario total", "Total du scénario"),
    scenarioNote: (k) => T(`Kịch bản mô phỏng – số chính thức vẫn là ${k} kg`, `Simulation – the official figure stays ${k} kg`,
                           `Simulation – le chiffre officiel reste ${k} kg`),
    askScenario: T("✨ Hỏi AI về kịch bản này", "✨ Ask the AI about this scenario", "✨ Demander à l'IA sur ce scénario"),
    noSplit: T("Sản phẩm này chưa tách được theo giai đoạn nên chưa mô phỏng được.", "No stage split for this product, so no simulation.",
               "Pas de répartition par étape pour ce produit, donc pas de simulation."),
    planeLocal: T("Hàng sản xuất trong nước đi đường bộ.", "Made-in-Vietnam goods travel by road.", "Les produits fabriqués au Vietnam voyagent par la route."),
    loading: T("Đang dựng thế giới…", "Building the world…", "Construction du monde…"),
    notFound: T("Không tìm thấy sản phẩm.", "Product not found.", "Produit introuvable."),
    landingTitle: T("Bước vào thế giới CO₂ của sản phẩm", "Step into a product's CO₂ world", "Entrez dans le monde CO₂ d'un produit"),
    landingLead: T("Chọn một sản phẩm: bạn sẽ thấy nó được khai thác, sản xuất, chở về Việt Nam, dùng điện và tái chế ra sao — kéo, phóng to, bấm vào bất cứ chỗ nào chưa hiểu để AI giải thích, và thử thay đổi để thấy CO₂ tăng giảm.",
                   "Pick a product to see how it is mined, made, shipped to Vietnam, powered and recycled — drag, zoom, tap anything you don't understand for an AI explanation, and change options to watch the CO₂ move.",
                   "Choisissez un produit pour voir comment il est extrait, fabriqué, expédié au Vietnam, alimenté et recyclé — faites glisser, zoomez, touchez ce que vous ne comprenez pas pour une explication de l'IA, et changez les options pour voir le CO₂ bouger."),
  };
}

// Texts of the walk-in scenes. `c` carries only numbers the system has (stored stages,
// the what-if model, the Vietnam grid factor); qualitative scenes say so instead of inventing figures.
export function sceneText(lang) {
  const T = tri(lang);
  const noSplit = T("Hãng không công bố CO₂ tách theo từng linh kiện, nên hệ thống không ghi số riêng cho phần này.",
                    "Makers do not publish CO₂ per component, so the system shows no separate number here.",
                    "Les fabricants ne publient pas le CO₂ par composant : le système n'affiche donc pas de chiffre séparé ici.");
  return {
    world: T("Thế giới", "World", "Monde"),
    askHere: T("✨ Hỏi AI về chỗ này", "✨ Ask the AI about this", "✨ Demander à l'IA ici"),
    back: T("Quay ra", "Back out", "Revenir"),
    prev: T("Chặng trước", "Previous", "Étape précédente"), next: T("Chặng sau", "Next", "Étape suivante"),
    dive: T("Bấm vào vòng sáng để đi sâu hơn", "Tap a glowing ring to go deeper", "Touchez un cercle lumineux pour aller plus loin"),
    swipe: T("Kéo sang trái / phải để đi tiếp", "Swipe left / right to move on", "Glissez à gauche / droite pour avancer"),
    ofTotal: T("của cả vòng đời", "of the lifecycle", "du cycle de vie"),
    typicalShare: T("của cả vòng đời, với loại sản phẩm này", "of the lifecycle, for this kind of product",
                    "du cycle de vie, pour ce type de produit"),
    inProduction: T("tính chung trong chặng sản xuất", "counted within production", "compté dans la fabrication"),
    scenario: T("Kịch bản mô phỏng", "Simulation", "Simulation"),
    assumedSplit: T("Tỷ lệ giai đoạn là mức điển hình của loại (giả định).", "Stage shares are typical for the category (assumption).",
                    "Les parts par étape sont typiques de la catégorie (hypothèse)."),
    noSplit,
    names: {
      materials: T("Nguyên liệu", "Materials", "Matières"), production: T("Nhà máy", "Factory", "Usine"), transport: T("Vận chuyển", "Transport", "Transport"),
      use: T("Sử dụng", "Use", "Utilisation"), end_of_life: T("Thải bỏ", "End of life", "Fin de vie"), formula: T("Công thức", "Formula", "Formule"),
      category: T("So với cùng loại", "Its category", "Sa catégorie"),
      vietnam: T("Việt Nam", "Vietnam", "Vietnam"), plastic: T("Nhựa", "Plastic", "Plastique"),
      "materials/ore": T("Quặng & kim loại", "Ore & metals", "Minerai et métaux"), "materials/refining": T("Tinh luyện", "Refining", "Raffinage"),
      "production/chip": T("Chip & bo mạch", "Chips & boards", "Puces et cartes"), "production/screen": T("Màn hình", "Screen", "Écran"),
      "production/battery": T("Pin", "Battery", "Batterie"), "production/assembly": T("Vỏ & lắp ráp", "Case & assembly", "Coque et assemblage"),
      "transport/mode": T("Tàu biển hay máy bay", "Ship or plane", "Bateau ou avion"), "transport/route": T("Quãng đường", "The route", "Le trajet"),
      "use/grid": T("Lưới điện Việt Nam", "Vietnam's grid", "Le réseau vietnamien"), "use/years": T("Số năm sử dụng", "Years of use", "Années d'utilisation"),
      "end_of_life/ewaste": T("Rác điện tử đi đâu", "Where e-waste goes", "Où vont les déchets électroniques"),
      "end_of_life/recover": T("Tái chế thu hồi gì", "What recycling recovers", "Ce que le recyclage récupère"),
    },
    body: {
      materials: (c) => [
        T("Mọi sản phẩm bắt đầu từ mỏ: đồng, nhôm, vàng, lithium, đất hiếm được đào lên.", "Every product starts at a mine: copper, aluminium, gold, lithium and rare earths are dug up.",
          "Tout produit commence dans une mine : cuivre, aluminium, or, lithium et terres rares sont extraits."),
        T("Máy xúc, xe tải và lò tinh luyện tốn rất nhiều năng lượng, nên đây là nơi CO₂ bắt đầu tích lũy.", "Diggers, trucks and refineries burn a lot of energy, so this is where CO₂ starts piling up.",
          "Pelleteuses, camions et raffineries consomment beaucoup d'énergie : c'est là que le CO₂ commence à s'accumuler."),
        T(`Hệ thống tính phần này chung với nhà máy; với loại này, khai thác và sản xuất thường chiếm phần lớn nhất.`, `The system counts this with the factory; for this kind of product, mining and manufacturing is usually the largest part.`,
          `Le système compte cette part avec l'usine ; pour ce type de produit, extraction et fabrication pèsent le plus.`),
      ],
      production: (c) => [
        T(`Ở nhà máy (giả định tại ${c.origin}), chip, màn hình, pin được làm ra rồi lắp ráp.`, `In the factory (assumed in ${c.origin}), chips, screens and batteries are made and assembled.`,
          `À l'usine (supposée en ${c.origin}), puces, écrans et batteries sont fabriqués puis assemblés.`),
        c.measured
          ? T(`Chặng này thải ${c.kg} kg CO₂e, tức ${c.pct}% cả vòng đời — với đồ điện tử thường là phần lớn nhất.`, `This stage emits ${c.kg} kg CO₂e, ${c.pct}% of the lifecycle — for electronics usually the largest part.`,
              `Cette étape émet ${c.kg} kg CO₂e, soit ${c.pct} % du cycle de vie — pour l'électronique, c'est souvent la plus grosse part.`)
          : T(`Với loại sản phẩm này, chặng này thường chiếm khoảng ${c.pct}% cả vòng đời — thường là phần lớn nhất.`, `For this kind of product this stage is usually about ${c.pct}% of the lifecycle — often the largest part.`,
              `Pour ce type de produit, cette étape pèse en général environ ${c.pct} % du cycle de vie — souvent la plus grosse part.`),
        T("Dùng máy lâu hơn hoặc mua máy tân trang là cách giảm phần này hiệu quả nhất.", "Keeping a device longer or buying refurbished cuts this part most.",
          "Garder l'appareil plus longtemps ou l'acheter reconditionné réduit le plus cette part."),
      ],
      transport: (c) => [
        c.local ? T("Sản phẩm làm tại Việt Nam nên chỉ đi xe tải trong nước.", "Made in Vietnam, it only travels by truck.", "Fabriqué au Vietnam, il ne voyage qu'en camion.")
                : T(`Từ ${c.origin}, hàng đi ${c.sea} km đường biển và ${c.road} km đường bộ tới cửa hàng.`, `From ${c.origin} it travels ${c.sea} km by sea and ${c.road} km by road to the shop.`,
                    `Depuis ${c.origin}, il parcourt ${c.sea} km par mer et ${c.road} km par route jusqu'au magasin.`),
        c.measured
          ? T(`Chặng này chỉ ${c.kg} kg CO₂e (${c.pct}%): tàu biển chở rất nhiều hàng nên phần chia cho mỗi máy rất nhỏ.`, `Only ${c.kg} kg CO₂e (${c.pct}%): a ship carries so much that each unit's share is tiny.`,
              `Seulement ${c.kg} kg CO₂e (${c.pct} %) : un navire transporte tant de marchandises que la part de chaque appareil est minuscule.`)
          : T(`Chặng này thường chỉ khoảng ${c.pct}% với loại này: tàu biển chở rất nhiều hàng nên phần chia cho mỗi máy rất nhỏ.`, `Usually only about ${c.pct}% for this kind of product: a ship carries so much that each unit's share is tiny.`,
              `En général seulement environ ${c.pct} % pour ce type de produit : un navire transporte tant que la part de chaque appareil est minuscule.`),
        T("Bấm vào con tàu để so sánh với đi máy bay.", "Tap the ship to compare it with flying.", "Touchez le navire pour comparer avec l'avion."),
      ],
      use: (c) => [
        T(`Bạn dùng sản phẩm khoảng ${c.years} năm, tốn khoảng ${c.kwh} kWh điện.`, `You use it about ${c.years} years, about ${c.kwh} kWh of electricity.`,
          `Vous l'utilisez environ ${c.years} ans, soit environ ${c.kwh} kWh d'électricité.`),
        c.measured
          ? T(`Mỗi kWh ở Việt Nam thải ${c.ef} kg CO₂e vì lưới điện còn nhiều nhiệt điện than: tổng ${c.kg} kg (${c.pct}%).`, `Each kWh in Vietnam emits ${c.ef} kg CO₂e because of coal power: ${c.kg} kg in all (${c.pct}%).`,
              `Chaque kWh au Vietnam émet ${c.ef} kg CO₂e à cause du charbon : ${c.kg} kg au total (${c.pct} %).`)
          : T(`Mỗi kWh ở Việt Nam thải ${c.ef} kg CO₂e vì lưới điện còn nhiều nhiệt điện than; với loại này, phần sử dụng thường chiếm khoảng ${c.pct}%.`, `Each kWh in Vietnam emits ${c.ef} kg CO₂e because of coal power; for this kind of product, use is usually about ${c.pct}%.`,
              `Chaque kWh au Vietnam émet ${c.ef} kg CO₂e à cause du charbon ; pour ce type de produit, l'usage pèse en général environ ${c.pct} %.`),
        T("Tắt hẳn máy khi không dùng và chọn máy tiết kiệm điện giúp giảm phần này.", "Switch it fully off and pick efficient devices to cut this part.",
          "Éteignez complètement l'appareil et choisissez des modèles économes pour réduire cette part."),
      ],
      end_of_life: (c) => [
        T("Hết dùng, sản phẩm được thu gom, tháo rời và tái chế.", "At the end it is collected, taken apart and recycled.", "En fin de vie, il est collecté, démonté et recyclé."),
        c.measured
          ? T(`Phần này nhỏ: ${c.kg} kg CO₂e (${c.pct}%), nhưng vứt sai chỗ làm kim loại nặng ngấm vào đất và nước.`, `It is small: ${c.kg} kg CO₂e (${c.pct}%), but dumping it leaks heavy metals into soil and water.`,
              `C'est peu : ${c.kg} kg CO₂e (${c.pct} %), mais un abandon sauvage libère des métaux lourds dans le sol et l'eau.`)
          : T(`Phần này thường nhỏ, khoảng ${c.pct}%, nhưng vứt sai chỗ làm kim loại nặng ngấm vào đất và nước.`, `It is usually small, about ${c.pct}%, but dumping it leaks heavy metals into soil and water.`,
              `C'est en général peu, environ ${c.pct} %, mais un abandon sauvage libère des métaux lourds dans le sol et l'eau.`),
      ],
      formula: () => [
        T("Hệ thống thử 4 cách theo thứ tự và dừng ở cách đầu tiên ra số; AI chỉ tìm sản phẩm giống, không tự bịa số.", "The system tries four methods in order and stops at the first that works; AI only finds similar products, it never invents the number.",
          "Le système essaie quatre méthodes dans l'ordre et s'arrête à la première qui fonctionne ; l'IA ne fait que trouver des produits similaires, elle n'invente jamais le chiffre."),
      ],
      category: (c) => [
        c.n ? T(`Trong ${c.n} sản phẩm cùng loại, mức giữa là ${c.median} kg. Sản phẩm này xanh hơn ${c.greener}% số còn lại.`,
                `Among ${c.n} similar products the median is ${c.median} kg. This one is greener than ${c.greener}% of them.`,
                `Parmi ${c.n} produits similaires, la médiane est de ${c.median} kg. Celui-ci est plus vert que ${c.greener} % d'entre eux.`)
            : T("Chưa đủ dữ liệu thống kê cho loại này.", "Not enough data for this category.", "Pas assez de données pour cette catégorie."),
        T("Bấm vào một sản phẩm để bước sang thế giới CO₂ của nó.", "Tap a product to step into its CO₂ world.", "Touchez un produit pour entrer dans son monde CO₂."),
      ],
      "materials/ore": () => [
        T("Một chiếc laptop hay điện thoại chứa hàng chục loại kim loại: đồng trong dây dẫn, vàng trong mạch, lithium và cobalt trong pin, đất hiếm trong loa.", "A laptop or phone holds dozens of metals: copper in wiring, gold in circuits, lithium and cobalt in the battery, rare earths in speakers.",
          "Un ordinateur ou un téléphone contient des dizaines de métaux : cuivre dans les fils, or dans les circuits, lithium et cobalt dans la batterie, terres rares dans les haut-parleurs."),
        T("Phải đào và xử lý hàng tấn đất đá để lấy được một lượng nhỏ kim loại.", "Tonnes of rock are moved and processed to get a small amount of metal.",
          "Il faut déplacer et traiter des tonnes de roche pour obtenir un peu de métal."),
        noSplit,
      ],
      "materials/refining": () => [
        T("Quặng được nghiền, nấu chảy và tinh luyện thành kim loại sạch trong lò nhiệt độ rất cao.", "Ore is crushed, smelted and refined into pure metal in very hot furnaces.",
          "Le minerai est broyé, fondu et raffiné en métal pur dans des fours très chauds."),
        T("Nhiều lò tinh luyện vẫn chạy bằng điện than, nên tái chế kim loại cũ giúp tránh bước này.", "Many refineries still run on coal power, so recycling metal avoids this step.",
          "Beaucoup de raffineries fonctionnent encore au charbon : recycler le métal évite cette étape."),
        noSplit,
      ],
      "production/chip": () => [
        T("Chip được làm trong phòng sạch, qua hàng trăm bước khắc, phủ, nung trên tấm silicon.", "Chips are made in clean rooms through hundreds of etching, coating and baking steps on silicon wafers.",
          "Les puces sont fabriquées en salle blanche, en des centaines d'étapes de gravure, de dépôt et de cuisson sur des plaquettes de silicium."),
        T("Phòng sạch, máy khắc và hóa chất cần rất nhiều điện; với laptop và điện thoại, chip và bo mạch thường là một trong những phần sản xuất thải nhiều nhất.", "Clean rooms, lithography tools and chemicals need a lot of power; for laptops and phones, chips and boards are usually among the largest manufacturing parts.",
          "Salles blanches, outils de lithographie et produits chimiques consomment beaucoup d'électricité ; pour les ordinateurs et téléphones, puces et cartes font souvent partie des plus gros postes de fabrication."),
        noSplit,
      ],
      "production/screen": () => [
        T("Màn hình cần kính, lớp tinh thể lỏng hoặc OLED, đèn nền và mạch điều khiển.", "A screen needs glass, liquid-crystal or OLED layers, a backlight and driver circuits.",
          "Un écran nécessite du verre, des couches LCD ou OLED, un rétroéclairage et des circuits de commande."),
        T("Màn hình càng to càng tốn vật liệu và năng lượng — vì vậy hệ thống chỉnh CO₂ theo cỡ inch (màn hình to gấp đôi ≈ CO₂ gấp 1,75 lần).", "Bigger screens need more material and energy — so the system adjusts CO₂ by inches (a screen twice as big ≈ 1.75 times the CO₂).",
          "Plus l'écran est grand, plus il faut de matière et d'énergie — le système ajuste donc le CO₂ selon les pouces (un écran deux fois plus grand ≈ 1,75 fois le CO₂)."),
        noSplit,
      ],
      "production/battery": () => [
        T("Pin lithium-ion cần lithium, cobalt, nickel và than chì, khai thác từ mỏ rồi tinh chế.", "Lithium-ion batteries need lithium, cobalt, nickel and graphite, mined and refined.",
          "Les batteries lithium-ion nécessitent lithium, cobalt, nickel et graphite, extraits puis raffinés."),
        T("Pin dùng lâu, sạc đúng cách và được tái chế thì thu hồi lại được những kim loại này.", "A battery that lasts, is charged well and gets recycled gives these metals back.",
          "Une batterie qui dure, bien chargée puis recyclée, restitue ces métaux."),
        noSplit,
      ],
      "production/assembly": () => [
        T("Vỏ nhôm hoặc nhựa được đúc, phay rồi lắp với chip, màn hình, pin thành sản phẩm hoàn chỉnh.", "Aluminium or plastic cases are cast and milled, then put together with chips, screen and battery.",
          "Les coques en aluminium ou en plastique sont moulées et usinées, puis assemblées avec puces, écran et batterie."),
        T("Khâu lắp ráp thường thải ít hơn chip và màn hình; vỏ nhôm tái chế giúp giảm thêm.", "Assembly usually emits less than chips and screens; recycled aluminium cuts it further.",
          "L'assemblage émet généralement moins que les puces et l'écran ; l'aluminium recyclé réduit encore cette part."),
        noSplit,
      ],
      "transport/mode": (c) => [
        T(`Mô phỏng trên tỷ lệ điển hình — đi tàu biển: ${c.shipKg} kg CO₂e; nếu đi máy bay: ${c.planeKg} kg CO₂e cho cùng quãng đường.`, `Simulated on the typical shares — by ship: ${c.shipKg} kg CO₂e; by plane: ${c.planeKg} kg CO₂e for the same trip.`,
          `Simulé sur les parts typiques — en bateau : ${c.shipKg} kg CO₂e ; en avion : ${c.planeKg} kg CO₂e pour le même trajet.`),
        T("Máy bay đốt nhiên liệu cho mỗi kg hàng nhiều hơn tàu biển hàng chục lần, nên hàng gửi đường hàng không thải nhiều hơn hẳn.", "A plane burns dozens of times more fuel per kg than a ship, so air-freighted goods emit far more.",
          "Un avion brûle des dizaines de fois plus de carburant par kg qu'un navire : le fret aérien émet donc beaucoup plus."),
        T("Bấm nút để đổi phương tiện và xem con số thay đổi.", "Switch the mode and watch the number change.", "Changez de mode et regardez le chiffre évoluer."),
      ],
      "transport/route": (c) => [
        c.local ? T(`Hàng sản xuất trong nước đi khoảng ${c.road} km đường bộ.`, `Made in Vietnam, it travels about ${c.road} km by road.`, `Fabriqué au Vietnam, il parcourt environ ${c.road} km par la route.`)
                : T(`Tuyến giả định: nhà máy ở ${c.origin} → cảng → ${c.sea} km đường biển → cảng Việt Nam → ${c.road} km đường bộ.`, `Assumed route: factory in ${c.origin} → port → ${c.sea} km by sea → Vietnamese port → ${c.road} km by road.`,
                    `Trajet supposé : usine en ${c.origin} → port → ${c.sea} km par mer → port vietnamien → ${c.road} km par route.`),
        T("Nơi sản xuất được đoán theo hãng nên quãng đường là giả định; đổi nơi sản xuất để xem ảnh hưởng.", "The origin is guessed from the brand, so the distance is an assumption; change the origin to see the effect.",
          "L'origine est déduite de la marque, la distance est donc une hypothèse ; changez l'origine pour voir l'effet."),
      ],
      "use/grid": (c) => [
        T(`Điện Việt Nam trung bình thải ${c.ef} kg CO₂e mỗi kWh (2024), vì nhiệt điện than vẫn chiếm phần lớn.`, `Vietnam's power emits on average ${c.ef} kg CO₂e per kWh (2024), because coal still dominates.`,
          `L'électricité vietnamienne émet en moyenne ${c.ef} kg CO₂e par kWh (2024), car le charbon domine encore.`),
        T("Mỗi nguồn điện thải rất khác nhau trong cả vòng đời (trung vị IPCC AR5, gam CO₂e mỗi kWh):", "Each power source emits very differently over its life (IPCC AR5 medians, g CO₂e per kWh):",
          "Chaque source d'électricité émet très différemment sur son cycle de vie (médianes GIEC AR5, g CO₂e par kWh) :"),
        T(`Mô phỏng: nếu dùng điện mặt trời áp mái, chặng sử dụng còn khoảng ${c.solarUseKg} kg thay vì ${c.vnUseKg} kg.`, `Simulation: with rooftop solar, the use stage would be about ${c.solarUseKg} kg instead of ${c.vnUseKg} kg.`,
          `Simulation : avec du solaire en toiture, l'étape d'utilisation serait d'environ ${c.solarUseKg} kg au lieu de ${c.vnUseKg} kg.`),
      ],
      "use/years": (c) => [
        c.measured
          ? T(`Dùng ${c.years} năm: chặng sử dụng là ${c.kg} kg CO₂e.`, `Used ${c.years} years: the use stage is ${c.kg} kg CO₂e.`, `Utilisé ${c.years} ans : l'étape d'utilisation représente ${c.kg} kg CO₂e.`)
          : T(`Dùng ${c.years} năm: điện dùng càng lâu thì phần sử dụng càng lớn, còn phần sản xuất chia cho nhiều năm hơn.`, `Used ${c.years} years: the longer it runs, the bigger the use part, while manufacturing is spread over more years.`,
              `Utilisé ${c.years} ans : plus il fonctionne longtemps, plus l'usage pèse, tandis que la fabrication se répartit sur plus d'années.`),
        T("Dùng lâu hơn thì tốn thêm điện, nhưng phần sản xuất được chia cho nhiều năm hơn — tính ra mỗi năm sử dụng ít CO₂ hơn.", "Using it longer adds electricity, but spreads manufacturing over more years — each year of use costs less CO₂.",
          "L'utiliser plus longtemps ajoute de l'électricité, mais répartit la fabrication sur plus d'années — chaque année d'utilisation coûte moins de CO₂."),
        T("Kéo thanh trượt để đổi số năm.", "Drag the slider to change the years.", "Faites glisser le curseur pour changer le nombre d'années."),
      ],
      "end_of_life/ewaste": () => [
        T("Thiết bị cũ có thể được bán lại, sửa chữa, tặng lại hoặc mang tới điểm thu gom rác điện tử.", "Old devices can be resold, repaired, donated or brought to an e-waste collection point.",
          "Les vieux appareils peuvent être revendus, réparés, donnés ou déposés dans un point de collecte des déchets électroniques."),
        T("Đốt hoặc chôn sai cách làm chì, thủy ngân, cadmium ngấm vào đất và nước, tới cả ruộng đồng và nước sinh hoạt.", "Burning or dumping them leaks lead, mercury and cadmium into soil and water, reaching fields and drinking water.",
          "Les brûler ou les abandonner libère plomb, mercure et cadmium dans le sol et l'eau, jusqu'aux champs et à l'eau potable."),
      ],
      "end_of_life/recover": () => [
        T("Tái chế đúng cách tách được đồng, vàng, nhôm, nhựa và kim loại trong pin để dùng lại.", "Proper recycling recovers copper, gold, aluminium, plastics and battery metals for reuse.",
          "Un recyclage correct récupère cuivre, or, aluminium, plastiques et métaux des batteries pour les réutiliser."),
        T("Mỗi kg kim loại thu hồi là bớt một phần phải đào mỏ và tinh luyện mới — giảm CO₂ ngay từ chặng đầu tiên.", "Each kg of recovered metal means less new mining and refining — cutting CO₂ back at the first stage.",
          "Chaque kg de métal récupéré, c'est moins d'extraction et de raffinage — le CO₂ baisse dès la première étape."),
      ],
    },
    mode: { sea: T("🚢 Tàu biển", "🚢 Ship", "🚢 Bateau"), air: T("✈️ Máy bay", "✈️ Plane", "✈️ Avion") },
    grid: { vn: T("Lưới điện VN", "Vietnam grid", "Réseau vietnamien"), solar: T("☀️ Điện mặt trời", "☀️ Solar", "☀️ Solaire") },
    sources: { coal: T("Than", "Coal", "Charbon"), gas: T("Khí", "Gas", "Gaz"), hydro: T("Thủy điện", "Hydro", "Hydro"), solar: T("Mặt trời", "Solar", "Solaire"), wind: T("Gió", "Wind", "Éolien") },
    refurb: T("Máy tân trang", "Refurbished", "Reconditionné"),
    newDevice: T("Máy mới", "New device", "Appareil neuf"),
    years: (n) => T(`${n} năm`, `${n} years`, `${n} ans`),
    openWorld: T("Vào thế giới của món này →", "Enter its world →", "Entrer dans son monde →"),
    you: T("Sản phẩm này", "This product", "Ce produit"),
  };
}
