"""Dienmayxanh listing via the hidden FilterProductBox API (no browser)."""
from scrapers.base.mwg_listing import get_listing_items as _get_listing_items

BASE_URL = "https://www.dienmayxanh.com"
CATEGORY_ID = 42  # dien-thoai (phones)
DEFAULT_CATEGORY = "Điện thoại"


def get_listing_items() -> list[dict]:
    return _get_listing_items(BASE_URL, CATEGORY_ID, DEFAULT_CATEGORY)
