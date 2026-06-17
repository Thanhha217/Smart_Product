"""Shared listing fetcher for MWG sites (dienmayxanh.com, thegioididong.com).

Both sites expose a hidden pagination API used by the "Xem them" (load more)
button, returning JSON whose ``listproducts`` field is an HTML fragment of
``<a class="main-contain">`` cards carrying all the data we need as attributes:

    POST {base_url}/Category/FilterProductBox?c={category_id}&o=13&pi={page}
    body: IsParentCate=False&IsShowCompare=True&prevent=true

The API only returns products when a province is set, so we send a minimal
``DMX_Personal`` cookie pinned to Ho Chi Minh (ProvinceId 1027). This replaces
the old headless-browser listing entirely -- it is plain concurrent HTTP.
"""
import json
import logging
import urllib.request
from urllib.parse import urljoin

logger = logging.getLogger(__name__)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Minimal personalization cookie pinned to Ho Chi Minh; without a province the
# API returns the empty {"total": 0} fallback.
PROVINCE_COOKIE = (
    "DMX_Personal=%7B%22CustomerId%22%3A0%2C%22ProvinceId%22%3A1027%2C"
    "%22ProvinceName%22%3A%22H%E1%BB%93%20Ch%C3%AD%20Minh%22%2C%22HasLocation%22%3Afalse%7D"
)

_BODY = b"IsParentCate=False&IsShowCompare=True&prevent=true"
_SORT = 13            # "o" param: default sort
_PER_PAGE = 20        # items the API returns per page
_PAGE_CAP = 60        # safety stop (60 * 20 = 1200 products)
_TIMEOUT = 30


def _fetch_page(base_url: str, category_id: int, page: int) -> tuple[str, int]:
    """Return (html_fragment, total) for one page, or ("", 0) on failure."""
    url = f"{base_url}/Category/FilterProductBox?c={category_id}&o={_SORT}&pi={page}"
    req = urllib.request.Request(
        url,
        data=_BODY,
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            "User-Agent": USER_AGENT,
            "Origin": base_url,
            "Referer": base_url,
            "Cookie": PROVINCE_COOKIE,
            "Accept": "*/*",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8", "replace"))
    except Exception as exc:  # noqa: BLE001 - network/parse failures are non-fatal
        logger.error("[mwg_listing] page %d failed: %s", page, exc)
        return "", 0
    fragment = data.get("listproducts") or data.get("lstProducts") or ""
    return fragment, int(data.get("total") or 0)


def _parse_fragment(fragment: str, base_url: str, default_category: str) -> list[dict]:
    # Imported here so this module stays importable without Scrapy at call sites
    # that only need the cookie/constants.
    from scrapy import Selector

    items: list[dict] = []
    selector = Selector(text=fragment)
    for card in selector.css("a.main-contain"):
        href = card.attrib.get("href")
        if not href:
            continue
        url = urljoin(base_url, href.split("?")[0])

        price_raw = card.attrib.get("data-price")
        try:
            price = str(int(float(price_raw))) if price_raw else None
        except ValueError:
            price = None

        img = card.css(".item-img img::attr(src), .item-img img::attr(data-src)").get()
        img_url = urljoin(base_url, img) if img else None

        items.append(
            {
                "url": url,
                "name": card.attrib.get("data-name"),
                "final_price": price,
                "category": card.attrib.get("data-cate") or default_category,
                "brand": card.attrib.get("data-brand"),
                "file_urls": [img_url] if img_url else [],
            }
        )
    return items


def get_listing_items(
    base_url: str,
    category_id: int,
    default_category: str = "",
) -> list[dict]:
    """Paginate the FilterProductBox API and return all listing items."""
    logger.info("[mwg_listing] %s c=%s starting", base_url, category_id)

    seen: set[str] = set()
    items: list[dict] = []

    for page in range(1, _PAGE_CAP + 1):
        fragment, total = _fetch_page(base_url, category_id, page)
        if not fragment:
            break

        page_items = _parse_fragment(fragment, base_url, default_category)
        new = 0
        for item in page_items:
            if item["url"] in seen:
                continue
            seen.add(item["url"])
            items.append(item)
            new += 1

        logger.info(
            "[mwg_listing] page %d: +%d new (total collected %d / reported %d)",
            page, new, len(items), total,
        )

        # Stop when the page is empty or we've gathered everything reported.
        if new == 0 or (total and len(items) >= total):
            break

    logger.info("[mwg_listing] %s done: %d unique items", base_url, len(items))
    return items
