// UI labels of the CO2 world (Vietnamese default, plain language).
export function worldText(lang) {
  const vi = lang === "vi";
  const T = (a, b) => (vi ? a : b);
  return {
    vi,
    aria: T("Thế giới mô phỏng phát thải CO₂ của sản phẩm", "Simulated world of a product's CO₂ emissions"),
    stages: {
      materials: T("Nguyên liệu", "Materials"),
      materials_production: T("Sản xuất", "Production"),
      transport: T("Vận chuyển", "Transport"),
      use: T("Sử dụng", "Use"),
      end_of_life: T("Thải bỏ", "End of life"),
    },
    total: T("Tổng", "Total"),
    overview: T("Toàn cảnh", "Overview"),
    zoomIn: T("Phóng to", "Zoom in"), zoomOut: T("Thu nhỏ", "Zoom out"),
    hint: T("Kéo để di chuyển · cuộn để phóng to · bấm vào bất kỳ thứ gì để hỏi", "Drag to move · scroll to zoom · tap anything to ask"),
    askMode: T("Hỏi bất kỳ chỗ nào", "Ask about anything"),
    askModeOn: T("Đang bật: bấm vào chữ, số hay hình bất kỳ", "On: tap any text, number or picture"),
    originLand: T("Nước sản xuất", "Country of manufacture"),
    originPort: T("Cảng xuất", "Export port"),
    vnPort: T("Cảng Việt Nam", "Vietnam port"),
    factoryAt: (o) => T(`Nhà máy · ${o}`, `Factory · ${o}`),
    assumed: T("(giả định)", "(assumed)"),
    official: T("Số chính thức", "Official figure"),
    greenScore: T("Điểm xanh", "Green score"),
    confidence: T("Độ tin cậy", "Confidence"),
    formula: T("Công thức", "Formula"),
    book: T("📖 Chế độ đọc sách", "📖 Book mode"),
    method: T("🧮 Phương pháp", "🧮 Method"),
    category: T("So với cùng loại", "Vs. its category"),
    alternative: T("Món xanh hơn", "Greener choice"),
    // explain panel
    close: T("Đóng", "Close"),
    askAi: T("✨ Hỏi AI giải thích thêm", "✨ Ask the AI for more"),
    askPlaceholder: T("Hỏi điều bạn chưa hiểu…", "Ask what you don't understand…"),
    send: T("Hỏi", "Ask"),
    thinking: T("AI đang soạn câu trả lời…", "The AI is writing…"),
    byAi: (m) => T(`Trả lời bởi AI · ${m}`, `Answered by AI · ${m}`),
    byRules: T("Câu giải thích soạn sẵn từ số liệu thật", "Prepared explanation from the real figures"),
    aiError: T("Chưa gọi được AI, đang hiện phần giải thích soạn sẵn.", "Could not reach the AI; showing the prepared explanation."),
    numbersNote: T("Mọi con số lấy từ dữ liệu của hệ thống; AI không được tự đặt ra số.", "Every number comes from the system's data; the AI may not invent figures."),
    // simulator
    sim: T("🎛 Thử thay đổi", "🎛 What if"),
    simTitle: T("Thử thay đổi để xem CO₂ đổi thế nào", "Change things and watch the CO₂"),
    origin: T("Sản xuất ở", "Made in"),
    mode: T("Vận chuyển bằng", "Shipped by"),
    ship: T("🚢 Tàu biển", "🚢 Ship"), plane: T("✈️ Máy bay", "✈️ Plane"),
    grid: T("Nguồn điện khi dùng", "Electricity used"),
    gridVn: T("Lưới điện VN", "Vietnam grid"), gridSolar: T("Điện mặt trời", "Solar"),
    gridNote: T("Điện mặt trời ≈ 0,048 kg/kWh (số xấp xỉ)", "Solar ≈ 0.048 kg/kWh (approximate)"),
    years: T("Số năm sử dụng", "Years of use"),
    yearsN: (n) => T(`${n} năm`, `${n} years`),
    refurb: T("Mua máy tân trang (đã qua sử dụng)", "Buy refurbished"),
    reset: T("Về số chính thức", "Back to the official figure"),
    scenarioTotal: T("Tổng theo kịch bản", "Scenario total"),
    scenarioNote: (k) => T(`Kịch bản mô phỏng – số chính thức vẫn là ${k} kg`, `Simulation – the official figure stays ${k} kg`),
    askScenario: T("✨ Hỏi AI về kịch bản này", "✨ Ask the AI about this scenario"),
    noSplit: T("Sản phẩm này chưa tách được theo giai đoạn nên chưa mô phỏng được.", "No stage split for this product, so no simulation."),
    planeLocal: T("Hàng sản xuất trong nước đi đường bộ.", "Made-in-Vietnam goods travel by road."),
    loading: T("Đang dựng thế giới…", "Building the world…"),
    notFound: T("Không tìm thấy sản phẩm.", "Product not found."),
    landingTitle: T("Bước vào thế giới CO₂ của sản phẩm", "Step into a product's CO₂ world"),
    landingLead: T("Chọn một sản phẩm: bạn sẽ thấy nó được khai thác, sản xuất, chở về Việt Nam, dùng điện và tái chế ra sao — kéo, phóng to, bấm vào bất cứ chỗ nào chưa hiểu để AI giải thích, và thử thay đổi để thấy CO₂ tăng giảm.",
                   "Pick a product to see how it is mined, made, shipped to Vietnam, powered and recycled — drag, zoom, tap anything you don't understand for an AI explanation, and change options to watch the CO₂ move."),
  };
}

// Texts of the walk-in scenes. `c` carries only numbers the system has (stored stages,
// the what-if model, the Vietnam grid factor); qualitative scenes say so instead of inventing figures.
export function sceneText(lang) {
  const vi = lang === "vi";
  const T = (a, b) => (vi ? a : b);
  const noSplit = T("Hãng không công bố CO₂ tách theo từng linh kiện, nên hệ thống không ghi số riêng cho phần này.",
                    "Makers do not publish CO₂ per component, so the system shows no separate number here.");
  return {
    world: T("Thế giới", "World"),
    askHere: T("✨ Hỏi AI về chỗ này", "✨ Ask the AI about this"),
    back: T("Quay ra", "Back out"),
    prev: T("Chặng trước", "Previous"), next: T("Chặng sau", "Next"),
    dive: T("Bấm vào vòng sáng để đi sâu hơn", "Tap a glowing ring to go deeper"),
    swipe: T("Kéo sang trái / phải để đi tiếp", "Swipe left / right to move on"),
    ofTotal: T("của cả vòng đời", "of the lifecycle"),
    inProduction: T("tính chung trong chặng sản xuất", "counted within production"),
    scenario: T("Kịch bản mô phỏng", "Simulation"),
    assumedSplit: T("Tỷ lệ giai đoạn là mức điển hình của loại (giả định).", "Stage shares are typical for the category (assumption)."),
    noSplit,
    names: {
      materials: T("Nguyên liệu", "Materials"), production: T("Nhà máy", "Factory"), transport: T("Vận chuyển", "Transport"),
      use: T("Sử dụng", "Use"), end_of_life: T("Thải bỏ", "End of life"), formula: T("Công thức", "Formula"),
      category: T("So với cùng loại", "Its category"),
      "materials/ore": T("Quặng & kim loại", "Ore & metals"), "materials/refining": T("Tinh luyện", "Refining"),
      "production/chip": T("Chip & bo mạch", "Chips & boards"), "production/screen": T("Màn hình", "Screen"),
      "production/battery": T("Pin", "Battery"), "production/assembly": T("Vỏ & lắp ráp", "Case & assembly"),
      "transport/mode": T("Tàu biển hay máy bay", "Ship or plane"), "transport/route": T("Quãng đường", "The route"),
      "use/grid": T("Lưới điện Việt Nam", "Vietnam's grid"), "use/years": T("Số năm sử dụng", "Years of use"),
      "end_of_life/ewaste": T("Rác điện tử đi đâu", "Where e-waste goes"), "end_of_life/recover": T("Tái chế thu hồi gì", "What recycling recovers"),
    },
    body: {
      materials: (c) => [
        T("Mọi sản phẩm bắt đầu từ mỏ: đồng, nhôm, vàng, lithium, đất hiếm được đào lên.", "Every product starts at a mine: copper, aluminium, gold, lithium and rare earths are dug up."),
        T("Máy xúc, xe tải và lò tinh luyện tốn rất nhiều năng lượng, nên đây là nơi CO₂ bắt đầu tích lũy.", "Diggers, trucks and refineries burn a lot of energy, so this is where CO₂ starts piling up."),
        T(`Hệ thống tính phần này chung với nhà máy: ${c.prodKg} kg CO₂e cho cả khai thác và sản xuất.`, `The system counts this with the factory: ${c.prodKg} kg CO₂e for mining and manufacturing.`),
      ],
      production: (c) => [
        T(`Ở nhà máy (giả định tại ${c.origin}), chip, màn hình, pin được làm ra rồi lắp ráp.`, `In the factory (assumed in ${c.origin}), chips, screens and batteries are made and assembled.`),
        T(`Chặng này thải ${c.kg} kg CO₂e, tức ${c.pct}% cả vòng đời — với đồ điện tử thường là phần lớn nhất.`, `This stage emits ${c.kg} kg CO₂e, ${c.pct}% of the lifecycle — for electronics usually the largest part.`),
        T("Dùng máy lâu hơn hoặc mua máy tân trang là cách giảm phần này hiệu quả nhất.", "Keeping a device longer or buying refurbished cuts this part most."),
      ],
      transport: (c) => [
        c.local ? T("Sản phẩm làm tại Việt Nam nên chỉ đi xe tải trong nước.", "Made in Vietnam, it only travels by truck.")
                : T(`Từ ${c.origin}, hàng đi ${c.sea} km đường biển và ${c.road} km đường bộ tới cửa hàng.`, `From ${c.origin} it travels ${c.sea} km by sea and ${c.road} km by road to the shop.`),
        T(`Chặng này chỉ ${c.kg} kg CO₂e (${c.pct}%): tàu biển chở rất nhiều hàng nên phần chia cho mỗi máy rất nhỏ.`, `Only ${c.kg} kg CO₂e (${c.pct}%): a ship carries so much that each unit's share is tiny.`),
        T("Bấm vào con tàu để so sánh với đi máy bay.", "Tap the ship to compare it with flying."),
      ],
      use: (c) => [
        T(`Bạn dùng sản phẩm khoảng ${c.years} năm, tốn khoảng ${c.kwh} kWh điện.`, `You use it about ${c.years} years, about ${c.kwh} kWh of electricity.`),
        T(`Mỗi kWh ở Việt Nam thải ${c.ef} kg CO₂e vì lưới điện còn nhiều nhiệt điện than: tổng ${c.kg} kg (${c.pct}%).`, `Each kWh in Vietnam emits ${c.ef} kg CO₂e because of coal power: ${c.kg} kg in all (${c.pct}%).`),
        T("Tắt hẳn máy khi không dùng và chọn máy tiết kiệm điện giúp giảm phần này.", "Switch it fully off and pick efficient devices to cut this part."),
      ],
      end_of_life: (c) => [
        T("Hết dùng, sản phẩm được thu gom, tháo rời và tái chế.", "At the end it is collected, taken apart and recycled."),
        T(`Phần này nhỏ: ${c.kg} kg CO₂e (${c.pct}%), nhưng vứt sai chỗ làm kim loại nặng ngấm vào đất và nước.`, `It is small: ${c.kg} kg CO₂e (${c.pct}%), but dumping it leaks heavy metals into soil and water.`),
      ],
      formula: () => [
        T("Hệ thống thử 4 cách theo thứ tự và dừng ở cách đầu tiên ra số; AI chỉ tìm sản phẩm giống, không tự bịa số.", "The system tries four methods in order and stops at the first that works; AI only finds similar products, it never invents the number."),
      ],
      category: (c) => [
        c.n ? T(`Trong ${c.n} sản phẩm cùng loại, mức giữa là ${c.median} kg. Sản phẩm này xanh hơn ${c.greener}% số còn lại.`,
                `Among ${c.n} similar products the median is ${c.median} kg. This one is greener than ${c.greener}% of them.`)
            : T("Chưa đủ dữ liệu thống kê cho loại này.", "Not enough data for this category."),
        T("Bấm vào một sản phẩm để bước sang thế giới CO₂ của nó.", "Tap a product to step into its CO₂ world."),
      ],
      "materials/ore": () => [
        T("Một chiếc laptop hay điện thoại chứa hàng chục loại kim loại: đồng trong dây dẫn, vàng trong mạch, lithium và cobalt trong pin, đất hiếm trong loa.", "A laptop or phone holds dozens of metals: copper in wiring, gold in circuits, lithium and cobalt in the battery, rare earths in speakers."),
        T("Phải đào và xử lý hàng tấn đất đá để lấy được một lượng nhỏ kim loại.", "Tonnes of rock are moved and processed to get a small amount of metal."),
        noSplit,
      ],
      "materials/refining": () => [
        T("Quặng được nghiền, nấu chảy và tinh luyện thành kim loại sạch trong lò nhiệt độ rất cao.", "Ore is crushed, smelted and refined into pure metal in very hot furnaces."),
        T("Nhiều lò tinh luyện vẫn chạy bằng điện than, nên tái chế kim loại cũ giúp tránh bước này.", "Many refineries still run on coal power, so recycling metal avoids this step."),
        noSplit,
      ],
      "production/chip": () => [
        T("Chip được làm trong phòng sạch, qua hàng trăm bước khắc, phủ, nung trên tấm silicon.", "Chips are made in clean rooms through hundreds of etching, coating and baking steps on silicon wafers."),
        T("Phòng sạch, máy khắc và hóa chất cần rất nhiều điện; với laptop và điện thoại, chip và bo mạch thường là một trong những phần sản xuất thải nhiều nhất.", "Clean rooms, lithography tools and chemicals need a lot of power; for laptops and phones, chips and boards are usually among the largest manufacturing parts."),
        noSplit,
      ],
      "production/screen": () => [
        T("Màn hình cần kính, lớp tinh thể lỏng hoặc OLED, đèn nền và mạch điều khiển.", "A screen needs glass, liquid-crystal or OLED layers, a backlight and driver circuits."),
        T("Màn hình càng to càng tốn vật liệu và năng lượng — vì vậy hệ thống chỉnh CO₂ theo cỡ inch (màn hình to gấp đôi ≈ CO₂ gấp 1,75 lần).", "Bigger screens need more material and energy — so the system adjusts CO₂ by inches (a screen twice as big ≈ 1.75 times the CO₂)."),
        noSplit,
      ],
      "production/battery": () => [
        T("Pin lithium-ion cần lithium, cobalt, nickel và than chì, khai thác từ mỏ rồi tinh chế.", "Lithium-ion batteries need lithium, cobalt, nickel and graphite, mined and refined."),
        T("Pin dùng lâu, sạc đúng cách và được tái chế thì thu hồi lại được những kim loại này.", "A battery that lasts, is charged well and gets recycled gives these metals back."),
        noSplit,
      ],
      "production/assembly": () => [
        T("Vỏ nhôm hoặc nhựa được đúc, phay rồi lắp với chip, màn hình, pin thành sản phẩm hoàn chỉnh.", "Aluminium or plastic cases are cast and milled, then put together with chips, screen and battery."),
        T("Khâu lắp ráp thường thải ít hơn chip và màn hình; vỏ nhôm tái chế giúp giảm thêm.", "Assembly usually emits less than chips and screens; recycled aluminium cuts it further."),
        noSplit,
      ],
      "transport/mode": (c) => [
        T(`Đi tàu biển: ${c.shipKg} kg CO₂e. Nếu đi máy bay: ${c.planeKg} kg CO₂e cho cùng quãng đường.`, `By ship: ${c.shipKg} kg CO₂e. By plane: ${c.planeKg} kg CO₂e for the same trip.`),
        T("Máy bay đốt nhiên liệu cho mỗi kg hàng nhiều hơn tàu biển hàng chục lần, nên hàng gửi đường hàng không thải nhiều hơn hẳn.", "A plane burns dozens of times more fuel per kg than a ship, so air-freighted goods emit far more."),
        T("Bấm nút để đổi phương tiện và xem con số thay đổi.", "Switch the mode and watch the number change."),
      ],
      "transport/route": (c) => [
        c.local ? T(`Hàng sản xuất trong nước đi khoảng ${c.road} km đường bộ.`, `Made in Vietnam, it travels about ${c.road} km by road.`)
                : T(`Tuyến giả định: nhà máy ở ${c.origin} → cảng → ${c.sea} km đường biển → cảng Việt Nam → ${c.road} km đường bộ.`, `Assumed route: factory in ${c.origin} → port → ${c.sea} km by sea → Vietnamese port → ${c.road} km by road.`),
        T("Nơi sản xuất được đoán theo hãng nên quãng đường là giả định; đổi nơi sản xuất để xem ảnh hưởng.", "The origin is guessed from the brand, so the distance is an assumption; change the origin to see the effect."),
      ],
      "use/grid": (c) => [
        T(`Điện Việt Nam trung bình thải ${c.ef} kg CO₂e mỗi kWh (2024), vì nhiệt điện than vẫn chiếm phần lớn.`, `Vietnam's power emits on average ${c.ef} kg CO₂e per kWh (2024), because coal still dominates.`),
        T("Mỗi nguồn điện thải rất khác nhau trong cả vòng đời (trung vị IPCC AR5, gam CO₂e mỗi kWh):", "Each power source emits very differently over its life (IPCC AR5 medians, g CO₂e per kWh):"),
        T(`Nếu dùng điện mặt trời áp mái, chặng sử dụng còn khoảng ${c.solarUseKg} kg thay vì ${c.vnUseKg} kg.`, `With rooftop solar, the use stage would be about ${c.solarUseKg} kg instead of ${c.vnUseKg} kg.`),
      ],
      "use/years": (c) => [
        T(`Dùng ${c.years} năm: chặng sử dụng là ${c.kg} kg CO₂e.`, `Used ${c.years} years: the use stage is ${c.kg} kg CO₂e.`),
        T("Dùng lâu hơn thì tốn thêm điện, nhưng phần sản xuất được chia cho nhiều năm hơn — tính ra mỗi năm sử dụng ít CO₂ hơn.", "Using it longer adds electricity, but spreads manufacturing over more years — each year of use costs less CO₂."),
        T("Kéo thanh trượt để đổi số năm.", "Drag the slider to change the years."),
      ],
      "end_of_life/ewaste": () => [
        T("Thiết bị cũ có thể được bán lại, sửa chữa, tặng lại hoặc mang tới điểm thu gom rác điện tử.", "Old devices can be resold, repaired, donated or brought to an e-waste collection point."),
        T("Đốt hoặc chôn sai cách làm chì, thủy ngân, cadmium ngấm vào đất và nước, tới cả ruộng đồng và nước sinh hoạt.", "Burning or dumping them leaks lead, mercury and cadmium into soil and water, reaching fields and drinking water."),
      ],
      "end_of_life/recover": () => [
        T("Tái chế đúng cách tách được đồng, vàng, nhôm, nhựa và kim loại trong pin để dùng lại.", "Proper recycling recovers copper, gold, aluminium, plastics and battery metals for reuse."),
        T("Mỗi kg kim loại thu hồi là bớt một phần phải đào mỏ và tinh luyện mới — giảm CO₂ ngay từ chặng đầu tiên.", "Each kg of recovered metal means less new mining and refining — cutting CO₂ back at the first stage."),
      ],
    },
    mode: { sea: T("🚢 Tàu biển", "🚢 Ship"), air: T("✈️ Máy bay", "✈️ Plane") },
    grid: { vn: T("Lưới điện VN", "Vietnam grid"), solar: T("☀️ Điện mặt trời", "☀️ Solar") },
    sources: { coal: T("Than", "Coal"), gas: T("Khí", "Gas"), hydro: T("Thủy điện", "Hydro"), solar: T("Mặt trời", "Solar"), wind: T("Gió", "Wind") },
    refurb: T("Máy tân trang", "Refurbished"),
    newDevice: T("Máy mới", "New device"),
    years: (n) => T(`${n} năm`, `${n} years`),
    openWorld: T("Vào thế giới của món này →", "Enter its world →"),
    you: T("Sản phẩm này", "This product"),
  };
}
