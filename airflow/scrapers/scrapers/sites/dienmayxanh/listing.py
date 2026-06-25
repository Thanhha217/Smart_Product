"""Dienmayxanh listing via the hidden FilterProductBox API (no browser)."""
from scrapers.base.mwg_listing import get_listing_items as _get_listing_items

BASE_URL = "https://www.dienmayxanh.com"

# MWG category id -> default category name (fallback when a card lacks data-cate).
# Dienmayxanh shares the same FilterProductBox category ids as thegioididong.
CATEGORIES = {
    42: "Điện thoại",
    44: "Laptop",
    54: "Tai nghe",
    5697: "Màn hình máy tính",
    522: "Máy tính bảng",
    7077: "Đồng hồ thông minh",
    2162: "Loa",
    1942: "Tivi",
    2002: "Máy lạnh",
    1943: "Tủ lạnh",
    1944: "Máy giặt",
    1922: "Nồi cơm điện",
    1992: "Quạt",
    5473: "Máy lọc không khí",
    10139: "Robot hút bụi",
}


def get_listing_items() -> list[dict]:
    items: list[dict] = []
    for category_id, default_category in CATEGORIES.items():
        items.extend(_get_listing_items(BASE_URL, category_id, default_category))
    return items
