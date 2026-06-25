"""TGDD listing via the hidden FilterProductBox API (no browser)."""
from scrapers.base.mwg_listing import get_listing_items as _get_listing_items

BASE_URL = "https://www.thegioididong.com"

# MWG category id -> default category name (fallback when a card lacks data-cate).
# Ids verified against the FilterProductBox API.
CATEGORIES = {
    42: "Điện thoại",
    44: "Laptop",
    54: "Tai nghe",
    5697: "Màn hình máy tính",
    522: "Máy tính bảng",
    7077: "Đồng hồ thông minh",
    2162: "Loa",
    86: "Chuột",
    4547: "Bàn phím",
    5698: "Máy tính để bàn",
    57: "Sạc dự phòng",
    75: "USB",
}


def get_listing_items() -> list[dict]:
    items: list[dict] = []
    for category_id, default_category in CATEGORIES.items():
        items.extend(_get_listing_items(BASE_URL, category_id, default_category))
    return items
