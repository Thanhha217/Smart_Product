// What each lifecycle stage is, why it emits, and what a shopper can actually do about it.
// Shared by the product page (LifecycleJourney) and the CO₂ world, so the same stage is never
// explained two different ways.
import { tri } from "../i18n/LanguageContext";

export const STAGE_KEYS = ["materials_production", "transport", "use", "end_of_life"];
export const STAGE_COLOR = {
  materials_production: "#2E7D4F", transport: "#3B8FD9", use: "#E0A526", end_of_life: "#8B5CF6",
};
export const STAGE_ICON = {
  materials_production: "pc_component", transport: "e_bike", use: "smart_plug", end_of_life: "recycle",
};

/** @param route the lifecycle route, for the origin country and the mode of transport */
export function stageText(key, lang, route = null) {
  const L3 = tri(lang);
  const origin = route ? (lang === "vi" ? route.origin_vi : route.origin_en) : null;
  const byAir = route?.mode === "air";
  const all = {
    materials_production: {
      name: L3("Nguyên liệu & sản xuất", "Materials & manufacturing", "Matières & fabrication"),
      what: L3("Khai thác kim loại, làm chip, màn hình, pin rồi lắp ráp thành máy.",
               "Mining metals, making the chips, screen and battery, then assembling the device.",
               "Extraire les métaux, fabriquer puces, écran et batterie, puis assembler l'appareil."),
      why: L3("Làm chip và màn hình cần nhiệt độ rất cao và phòng sạch, nên tốn rất nhiều điện.",
              "Chips and screens need very high temperatures and clean rooms, which take a lot of electricity.",
              "Puces et écrans exigent de très hautes températures et des salles blanches, donc beaucoup d'électricité."),
      todo: L3("Dùng máy lâu hơn, hoặc mua hàng tân trang: phần này chỉ thải một lần.",
               "Keep the device longer, or buy refurbished: this part is emitted only once.",
               "Gardez l'appareil plus longtemps, ou achetez reconditionné : cette part n'est émise qu'une fois."),
    },
    transport: {
      name: L3("Vận chuyển", "Transport", "Transport"),
      what: origin
        ? L3(`Chở từ ${origin} về Việt Nam, rồi bằng xe tải tới cửa hàng.`,
             `Shipped from ${origin} to Vietnam, then by truck to the shop.`,
             `Expédié depuis ${origin} vers le Vietnam, puis par camion jusqu'au magasin.`)
        : L3("Chở từ nơi sản xuất về Việt Nam rồi tới cửa hàng.",
             "Shipped from where it was made to Vietnam and on to the shop.",
             "Transporté du lieu de fabrication jusqu'au Vietnam puis au magasin."),
      why: byAir
        ? L3("Đi máy bay thải gấp nhiều lần tàu biển cho cùng quãng đường.",
             "Air freight emits many times more than sea freight over the same distance.",
             "Le fret aérien émet bien plus que le fret maritime sur la même distance.")
        : L3("Tàu biển chở rất nhiều hàng một chuyến nên phần này thường nhỏ.",
             "A ship carries a huge load in one trip, so this part is usually small.",
             "Un navire transporte énormément en un trajet : cette part est généralement faible."),
      todo: L3("Gom đơn, tránh giao hỏa tốc và đổi trả nhiều lần.",
               "Group your orders and avoid express delivery and repeated returns.",
               "Groupez vos commandes, évitez l'express et les retours répétés."),
    },
    use: {
      name: L3("Sử dụng", "Use", "Usage"),
      what: L3("Toàn bộ điện máy tiêu thụ trong những năm bạn dùng nó.",
               "All the electricity the device uses over the years you keep it.",
               "Toute l'électricité consommée pendant les années d'usage."),
      why: L3("Lưới điện Việt Nam còn nhiều nhiệt điện than, nên mỗi kWh đều kèm CO₂.",
              "Vietnam's grid still leans on coal, so every kWh carries CO₂.",
              "Le réseau vietnamien dépend encore du charbon : chaque kWh porte du CO₂."),
      todo: L3("Bật chế độ tiết kiệm điện, giảm độ sáng, rút sạc khi đầy.",
               "Turn on power saving, lower the brightness, unplug the charger when full.",
               "Activez l'économie d'énergie, baissez la luminosité, débranchez le chargeur."),
    },
    end_of_life: {
      name: L3("Thải bỏ & tái chế", "End of life & recycling", "Fin de vie & recyclage"),
      what: L3("Thu gom, tháo rời, thu hồi kim loại để làm sản phẩm mới.",
               "Collecting, taking apart and recovering metals for new products.",
               "Collecte, démontage et récupération des métaux pour de nouveaux produits."),
      why: L3("Bản thân việc tái chế thải ít, nhưng vứt sai chỗ làm kim loại nặng ngấm vào đất và nước.",
              "Recycling itself emits little, but dumped e-waste leaks heavy metals into soil and water.",
              "Le recyclage émet peu, mais les déchets abandonnés libèrent des métaux lourds."),
      todo: L3("Mang tới điểm thu gom rác điện tử thay vì bỏ vào thùng rác chung.",
               "Take it to an e-waste collection point instead of the household bin.",
               "Déposez-le en point de collecte au lieu de la poubelle ordinaire."),
    },
  };
  return all[key] || null;
}

/**
 * How to word a stage's size.
 *  - measured: this product's own kilograms;
 *  - otherwise: the share a product of this category typically has, said as such.
 */
export function stageShareLine(key, { measured, kgText, pctText }, lang) {
  const L3 = tri(lang);
  if (measured && kgText) return `${kgText} kg CO₂e${pctText ? ` · ${pctText}` : ""}`;
  if (!pctText) return null;
  return L3(`thường chiếm khoảng ${pctText} với loại này`,
            `usually about ${pctText} for this kind of product`,
            `en général environ ${pctText} pour ce type de produit`);
}
