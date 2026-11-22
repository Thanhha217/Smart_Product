"""The standard category taxonomy.

Every product in the database is filed under exactly one of these, regardless of
which site it was scraped from. Sources label the same thing very differently --
TGDD says "Điện thoại", CellphoneS says "smartphone", FPT says "dien-thoai" --
so this list is the single agreed vocabulary they all resolve onto.

Adding a category: pick a stable `slug` (it is what lands in the database and
must never change), and give it generous `aliases`. Aliases are not just
documentation -- each one is embedded as its own vector by the matcher, so the
more real-world phrasings listed here, the better unseen strings resolve.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# Coverage status, mirroring the category proposal doc.
LIVE = "live"          # solid source coverage, scraper running reliably
PARTIAL = "partial"    # some source coverage, not yet comprehensive
FUTURE = "future"      # no source yet

# Departments.
ELECTRONICS = "Electronics & Tech"
APPLIANCES = "Home Appliances"
BOOKS = "Books & Stationery"
SPORTS = "Sports & Health"
FASHION = "Fashion"
BEAUTY = "Beauty & Personal Care"
FAMILY = "Family, Home & Other"


@dataclass(frozen=True)
class StandardCategory:
    slug: str          # stable id, stored in the DB -- never rename
    name_en: str
    name_vi: str
    department: str
    status: str        # live | partial | future
    aliases: tuple[str, ...] = field(default_factory=tuple)

    @property
    def surface_forms(self) -> tuple[str, ...]:
        """Every phrasing that should resolve to this category."""
        return (self.name_vi, self.name_en, *self.aliases)


STANDARD_CATEGORIES: tuple[StandardCategory, ...] = (
    # --- 1. Electronics & Tech (19) -----------------------------------------
    StandardCategory(
        "smartphones", "Smartphones", "Điện thoại di động", ELECTRONICS, LIVE,
        ("Điện thoại", "dien thoai", "smartphone", "mobile phone", "iPhone",
         "điện thoại thông minh", "mobile"),
    ),
    StandardCategory(
        "feature_phones", "Feature Phones", "Điện thoại phổ thông", ELECTRONICS, LIVE,
        ("dien thoai pho thong", "feature phone", "basic phone",
         "điện thoại bàn phím"),
    ),
    StandardCategory(
        "laptops", "Laptops", "Laptop", ELECTRONICS, LIVE,
        ("máy tính xách tay", "may tinh xach tay", "notebook", "MacBook"),
    ),
    StandardCategory(
        "gaming_laptops", "Gaming Laptops", "Laptop Gaming", ELECTRONICS, LIVE,
        ("gaming laptop", "laptop chơi game"),
    ),
    StandardCategory(
        "tablets", "Tablets", "Máy tính bảng", ELECTRONICS, LIVE,
        ("may tinh bang", "tablet", "iPad"),
    ),
    StandardCategory(
        "desktops", "Desktops & PCs", "Máy tính để bàn & PC", ELECTRONICS, LIVE,
        ("Máy tính để bàn", "may tinh de ban", "desktop", "PC", "máy bộ",
         "all in one", "PC gaming"),
    ),
    StandardCategory(
        "monitors", "Monitors", "Màn hình máy tính", ELECTRONICS, LIVE,
        ("man hinh may tinh", "Màn hình", "man hinh", "computer monitor",
         "monitor", "display", "màn hình gaming"),
    ),
    StandardCategory(
        "pc_components", "PC Components", "Linh kiện PC", ELECTRONICS, LIVE,
        ("linh kien PC", "linh kiện máy tính", "GPU", "card màn hình", "RAM",
         "ổ cứng", "SSD", "HDD", "mainboard", "bo mạch chủ", "CPU", "PSU",
         "nguồn máy tính", "USB", "usb flash drive", "thẻ nhớ"),
    ),
    StandardCategory(
        "computer_peripherals", "Computer Peripherals", "Phụ kiện máy tính",
        ELECTRONICS, LIVE,
        ("phu kien may tinh", "Chuột", "chuot", "chuột máy tính", "mouse",
         "Bàn phím", "ban phim", "keyboard", "webcam", "mousepad", "lót chuột",
         "Máy in", "may in", "printer", "docking", "hub USB"),
    ),
    StandardCategory(
        "networking", "Networking Equipment", "Thiết bị mạng", ELECTRONICS, LIVE,
        ("thiet bi mang", "router", "bộ phát wifi", "switch", "modem",
         "mesh wifi", "network"),
    ),
    StandardCategory(
        "smartwatches", "Smartwatches", "Đồng hồ thông minh", ELECTRONICS, LIVE,
        ("dong ho thong minh", "smartwatch", "smart watch", "Apple Watch",
         "đồng hồ định vị"),
    ),
    StandardCategory(
        "wearables", "Wearables & Fitness Bands",
        "Thiết bị đeo & Vòng tay sức khỏe", ELECTRONICS, LIVE,
        ("thiet bi deo", "vòng tay thông minh", "vòng đeo tay sức khỏe",
         "fitness band", "fitness tracker", "wearable"),
    ),
    StandardCategory(
        "headphones", "Headphones & Earbuds", "Tai nghe", ELECTRONICS, LIVE,
        ("earphone", "headphone", "earbuds", "tai nghe bluetooth",
         "tai nghe có dây", "tai nghe không dây", "AirPods"),
    ),
    StandardCategory(
        "speakers", "Speakers", "Loa", ELECTRONICS, LIVE,
        ("speaker", "loa bluetooth", "soundbar", "loa di động",
         "loa vi tính", "loa kéo"),
    ),
    StandardCategory(
        "phone_accessories", "Phone Accessories", "Phụ kiện điện thoại",
        ELECTRONICS, LIVE,
        ("phu kien dien thoai", "ốp lưng", "op lung", "phone case", "cáp sạc",
         "củ sạc", "charger", "Sạc dự phòng", "sac du phong", "power bank",
         "pin sạc dự phòng", "miếng dán màn hình", "screen protector"),
    ),
    StandardCategory(
        "cameras", "Cameras", "Camera & Máy ảnh", ELECTRONICS, LIVE,
        ("máy ảnh", "may anh", "camera", "DSLR", "mirrorless", "action cam",
         "máy quay phim", "ống kính", "lens"),
    ),
    StandardCategory(
        "drones", "Drones", "Flycam & Thiết bị bay", ELECTRONICS, PARTIAL,
        ("flycam", "drone", "thiết bị bay", "máy bay điều khiển"),
    ),
    StandardCategory(
        "software", "Software & Licenses", "Phần mềm & Bản quyền",
        ELECTRONICS, LIVE,
        ("phan mem", "software", "bản quyền", "license", "key bản quyền",
         "Windows", "Office", "phần mềm diệt virus"),
    ),
    StandardCategory(
        "gaming_consoles", "Gaming Consoles & Accessories",
        "Máy chơi game & Phụ kiện", ELECTRONICS, PARTIAL,
        ("may choi game", "console", "PS5", "PlayStation", "Xbox",
         "Nintendo Switch", "tay cầm chơi game", "gamepad"),
    ),

    # --- 2. Home Appliances (15) --------------------------------------------
    StandardCategory(
        "televisions", "Televisions", "Tivi", APPLIANCES, LIVE,
        ("TV", "smart tivi", "android tivi", "television", "ti vi"),
    ),
    StandardCategory(
        "refrigerators", "Refrigerators", "Tủ lạnh", APPLIANCES, LIVE,
        ("tu lanh", "refrigerator", "fridge", "tủ đông", "tủ mát"),
    ),
    StandardCategory(
        "washing_machines", "Washing Machines", "Máy giặt", APPLIANCES, LIVE,
        ("may giat", "washing machine", "washer", "máy giặt sấy"),
    ),
    StandardCategory(
        "clothes_dryers", "Clothes Dryers", "Máy sấy quần áo", APPLIANCES, PARTIAL,
        ("may say quan ao", "clothes dryer", "tumble dryer", "máy sấy"),
    ),
    StandardCategory(
        "air_conditioners", "Air Conditioners", "Điều hòa", APPLIANCES, LIVE,
        ("dieu hoa", "Máy lạnh", "may lanh", "air conditioner", "điều hoà",
         "máy điều hòa"),
    ),
    StandardCategory(
        "electric_fans", "Electric Fans", "Quạt điện", APPLIANCES, LIVE,
        ("Quạt", "quat", "quat dien", "electric fan", "quạt đứng",
         "quạt trần", "quạt điều hòa"),
    ),
    StandardCategory(
        "air_purifiers", "Air Purifiers", "Máy lọc không khí", APPLIANCES, LIVE,
        ("may loc khong khi", "air purifier", "máy hút ẩm"),
    ),
    StandardCategory(
        "water_purifiers", "Water Purifiers", "Máy lọc nước", APPLIANCES, LIVE,
        ("may loc nuoc", "water purifier", "máy nước nóng",
         "cây nước nóng lạnh"),
    ),
    StandardCategory(
        "vacuum_cleaners", "Vacuum Cleaners", "Máy hút bụi", APPLIANCES, LIVE,
        ("may hut bui", "vacuum cleaner", "Robot hút bụi", "robot hut bui",
         "robot vacuum", "máy lau nhà"),
    ),
    StandardCategory(
        "rice_cookers", "Rice Cookers & Pressure Cookers",
        "Nồi cơm điện & Nồi áp suất", APPLIANCES, LIVE,
        ("Nồi cơm điện", "noi com dien", "rice cooker", "nồi áp suất",
         "pressure cooker", "nồi chiên không dầu", "air fryer", "nồi lẩu điện"),
    ),
    StandardCategory(
        "microwaves_ovens", "Microwaves & Ovens", "Lò vi sóng & Lò nướng",
        APPLIANCES, LIVE,
        ("lo vi song", "microwave", "lò nướng", "oven", "lò nướng bánh"),
    ),
    StandardCategory(
        "blenders_juicers", "Blenders & Juicers", "Máy xay & Máy ép",
        APPLIANCES, LIVE,
        ("may xay", "blender", "máy xay sinh tố", "máy ép", "juicer",
         "máy ép trái cây", "máy xay thịt"),
    ),
    StandardCategory(
        "stoves", "Electric & Induction Stoves", "Bếp điện & Bếp từ",
        APPLIANCES, LIVE,
        ("bep dien", "bếp từ", "bep tu", "induction stove", "electric stove",
         "bếp hồng ngoại", "bếp gas"),
    ),
    StandardCategory(
        "lighting", "Lighting", "Đèn & Chiếu sáng", APPLIANCES, LIVE,
        ("den", "đèn", "đèn LED", "bóng đèn", "đèn bàn", "lamp"),
    ),
    StandardCategory(
        "smart_home", "Smart Home Devices", "Thiết bị nhà thông minh",
        APPLIANCES, PARTIAL,
        ("nha thong minh", "smart home", "camera an ninh", "camera giám sát",
         "security camera", "khóa thông minh", "smart lock", "cảm biến",
         "sensor"),
    ),

    # --- 3. Books & Stationery (4) ------------------------------------------
    StandardCategory(
        "books_vi", "Vietnamese Books", "Sách tiếng Việt", BOOKS, LIVE,
        ("sach tieng viet", "sách", "book", "tiểu thuyết", "sách giáo khoa",
         "textbook", "sách self-help", "truyện"),
    ),
    StandardCategory(
        "books_foreign", "Foreign Language Books", "Sách ngoại văn", BOOKS, PARTIAL,
        ("sach ngoai van", "foreign language book", "sách tiếng Anh",
         "english book", "imported book"),
    ),
    StandardCategory(
        "stationery", "Stationery & Office Supplies", "Văn phòng phẩm", BOOKS, LIVE,
        ("van phong pham", "stationery", "office supplies", "bút", "vở",
         "giấy in", "dụng cụ văn phòng"),
    ),
    StandardCategory(
        "arts_crafts", "Arts & Crafts", "Đồ thủ công & Nghệ thuật", BOOKS, PARTIAL,
        ("do thu cong", "arts and crafts", "màu vẽ", "dụng cụ vẽ",
         "handmade", "đồ handmade"),
    ),

    # --- 4. Sports & Health (7) ---------------------------------------------
    StandardCategory(
        "sports_equipment", "Sports Equipment", "Dụng cụ thể thao", SPORTS, PARTIAL,
        ("dung cu the thao", "bóng đá", "vợt cầu lông",
         "bóng rổ", "đồ thể thao"),
    ),
    StandardCategory(
        "fitness_equipment", "Fitness & Gym Equipment", "Dụng cụ Fitness & Gym",
        SPORTS, PARTIAL,
        ("dung cu gym", "gym equipment", "fitness", "tạ tay", "máy chạy bộ",
         "thảm yoga", "xe đạp tập"),
    ),
    StandardCategory(
        "sportswear", "Sportswear", "Trang phục thể thao", SPORTS, FUTURE,
        ("trang phuc the thao", "quần áo thể thao", "áo thể thao"),
    ),
    StandardCategory(
        "sports_shoes", "Sports Shoes", "Giày thể thao", SPORTS, FUTURE,
        ("giay the thao", "sneakers", "giày chạy bộ",
         "giày đá bóng"),
    ),
    StandardCategory(
        "supplements", "Health Supplements", "Thực phẩm chức năng", SPORTS, PARTIAL,
        ("thuc pham chuc nang", "health supplement", "vitamin", "whey protein",
         "thực phẩm bổ sung"),
    ),
    StandardCategory(
        "medical_devices", "Home Medical Devices", "Thiết bị y tế gia đình",
        SPORTS, PARTIAL,
        ("thiet bi y te", "medical device", "máy đo huyết áp",
         "blood pressure monitor", "nhiệt kế", "thermometer",
         "máy đo đường huyết"),
    ),
    StandardCategory(
        "bicycles", "Bicycles & Accessories", "Xe đạp & Phụ kiện", SPORTS, FUTURE,
        ("xe dap", "bicycle", "bike", "xe đạp thể thao", "phụ kiện xe đạp"),
    ),

    # --- 5. Fashion (7) ------------------------------------------------------
    StandardCategory(
        "fashion_men", "Men's Fashion", "Thời trang nam", FASHION, FUTURE,
        ("thoi trang nam", "men fashion", "áo sơ mi nam", "quần nam",
         "áo khoác nam"),
    ),
    StandardCategory(
        "fashion_women", "Women's Fashion", "Thời trang nữ", FASHION, FUTURE,
        ("thoi trang nu", "women fashion", "váy", "đầm", "áo nữ", "chân váy"),
    ),
    StandardCategory(
        "fashion_kids", "Kids' Fashion", "Thời trang trẻ em", FASHION, FUTURE,
        ("thoi trang tre em", "kids fashion", "quần áo trẻ em", "đồ bé trai",
         "đồ bé gái"),
    ),
    StandardCategory(
        "underwear", "Underwear & Sleepwear", "Đồ lót & Đồ ngủ", FASHION, FUTURE,
        ("do lot", "underwear", "đồ ngủ", "sleepwear", "pyjama"),
    ),
    StandardCategory(
        "shoes", "Shoes", "Giày dép", FASHION, FUTURE,
        ("giay dep", "sandals", "dép", "giày cao gót", "giày tây"),
    ),
    StandardCategory(
        "bags", "Bags & Wallets", "Túi xách & Ví", FASHION, FUTURE,
        ("tui xach", "bag", "wallet", "ví", "balo", "backpack", "túi đeo chéo"),
    ),
    StandardCategory(
        "jewelry", "Jewelry & Fashion Accessories",
        "Trang sức & Phụ kiện thời trang", FASHION, FUTURE,
        ("trang suc", "jewelry", "đồng hồ thời trang", "fashion watch",
         "kính mát", "sunglasses", "thắt lưng", "belt"),
    ),

    # --- 6. Beauty & Personal Care (6) ---------------------------------------
    StandardCategory(
        "makeup", "Makeup", "Mỹ phẩm trang điểm", BEAUTY, FUTURE,
        ("my pham trang diem", "son môi", "lipstick", "phấn nền",
         "kem nền"),
    ),
    StandardCategory(
        "skincare", "Skincare", "Chăm sóc da", BEAUTY, FUTURE,
        ("cham soc da", "kem dưỡng da", "sữa rửa mặt", "serum",
         "kem chống nắng"),
    ),
    StandardCategory(
        "hair_care", "Hair Care", "Chăm sóc tóc", BEAUTY, FUTURE,
        ("cham soc toc", "dầu gội", "shampoo", "dầu xả",
         "thuốc nhuộm tóc"),
    ),
    StandardCategory(
        "perfumes", "Perfumes", "Nước hoa", BEAUTY, FUTURE,
        ("nuoc hoa", "perfume", "fragrance", "nước hoa nam", "nước hoa nữ"),
    ),
    StandardCategory(
        "personal_care", "Personal Care", "Chăm sóc cá nhân", BEAUTY, FUTURE,
        ("cham soc ca nhan", "kem đánh răng", "oral care",
         "sữa tắm", "body wash", "lăn khử mùi", "deodorant"),
    ),
    StandardCategory(
        "beauty_tools", "Beauty Tools", "Dụng cụ làm đẹp", BEAUTY, FUTURE,
        ("dung cu lam dep", "máy sấy tóc", "hair dryer",
         "máy duỗi tóc", "cọ trang điểm", "makeup brush"),
    ),

    # --- 7. Family, Home & Other (6) -----------------------------------------
    StandardCategory(
        "toys", "Toys", "Đồ chơi trẻ em", FAMILY, FUTURE,
        ("do choi tre em", "đồ chơi", "lego", "búp bê", "xe đồ chơi"),
    ),
    StandardCategory(
        "mom_baby", "Mom & Baby Supplies", "Đồ dùng cho mẹ & bé", FAMILY, FUTURE,
        ("do dung cho me va be", "mom and baby", "bỉm", "tã", "diaper",
         "sữa bột", "formula", "xe đẩy", "stroller"),
    ),
    StandardCategory(
        "pet_supplies", "Pet Supplies", "Thú cưng", FAMILY, FUTURE,
        ("thu cung", "thức ăn cho chó", "thức ăn cho mèo",
         "đồ chơi thú cưng", "pet food"),
    ),
    StandardCategory(
        "food_beverages", "Food & Beverages", "Thực phẩm & Đồ uống", FAMILY, FUTURE,
        ("thuc pham do uong", "food and beverages", "đồ ăn", "nước giải khát",
         "bánh kẹo", "cà phê", "trà"),
    ),
    StandardCategory(
        "home_furniture", "Home & Furniture", "Đồ gia dụng & Nội thất",
        FAMILY, FUTURE,
        ("do gia dung noi that", "furniture", "nội thất", "bàn ghế",
         "chăn ga gối", "bedding", "trang trí nhà cửa", "home decor"),
    ),
    StandardCategory(
        "automotive", "Automotive", "Ô tô & Xe máy", FAMILY, FUTURE,
        ("o to xe may", "phụ tùng ô tô", "phụ kiện xe máy",
         "car accessories", "đồ chăm sóc xe"),
    ),
)

# Fallback for strings the matcher cannot resolve confidently. Deliberately not
# a real category -- a product landing here means the taxonomy has a gap, or the
# source sent something unexpected. Query for it to find both.
UNCATEGORIZED = StandardCategory(
    "uncategorized", "Uncategorized", "Chưa phân loại", "Uncategorized", PARTIAL,
)

BY_SLUG: dict[str, StandardCategory] = {c.slug: c for c in STANDARD_CATEGORIES}
BY_SLUG[UNCATEGORIZED.slug] = UNCATEGORIZED
