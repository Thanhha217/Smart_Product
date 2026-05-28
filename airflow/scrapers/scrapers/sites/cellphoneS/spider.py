import json
from datetime import datetime, timezone

from scrapy.exceptions import DropItem
from scrapy.spiders import SitemapSpider

from scrapers.base.spider import BaseProductSpider
from scrapers.sites.cellphoneS.loader import CellphoneSLoader


# Maps a (position-2, position-3) breadcrumb pair to our normalized category enum.
# We mirror PhongVu's 4 categories: laptop, smartphone, earphone, computer_monitor.
# For new products, position 2 is the top-level CellphoneS category.
# For used products everything goes under "Hàng cũ" so we have to look at position 3.
_BREADCRUMB_CATEGORY_MAP = {
    # New products
    "Điện thoại": "smartphone",
    "Laptop": "laptop",
    "Màn hình": "computer_monitor",
    "Màn hình máy tính": "computer_monitor",
    # Used products (pos 3 lookups, prefixed with "Hàng cũ/" so we can distinguish)
    "Hàng cũ/Laptop cũ": "laptop",
    "Hàng cũ/Màn hình cũ": "computer_monitor",
    "Hàng cũ/Điện thoại cũ": "smartphone",
    "Hàng cũ/Tai nghe cũ": "earphone",
}

# Used products often have only "Hàng cũ > BrandName cũ" (no type sub-category),
# so we fall back to URL slug heuristics to recover the type.
_URL_SLUG_PREFIX_CATEGORY = {
    "laptop-": "laptop",
    "man-hinh-": "computer_monitor",
    "tai-nghe-": "earphone",
}

# Slug prefixes that look like a real category but are actually accessories — skip them.
_URL_SLUG_ACCESSORY_PREFIXES = (
    "thay-cap-", "gia-do-", "dan-", "op-lung-", "bao-da-", "sac-", "cap-",
)

# Phone-brand keywords. When breadcrumb is ambiguous, presence of any of these
# in the URL slug means it's almost certainly a smartphone.
_URL_PHONE_BRAND_KEYWORDS = (
    "iphone-", "samsung-galaxy", "xiaomi-redmi", "xiaomi-mi-", "redmi-",
    "oppo-", "vivo-", "realme-note", "realme-c", "realme-gt",
    "asus-zenfone", "zenfone-", "xperia-", "vsmart-", "huawei-p", "nokia-",
)


class CellphoneSSpider(SitemapSpider, BaseProductSpider):
    name = "cellphone_s"
    kafka_topic = "cellphone_s_topic"

    # We list product sitemaps in reverse (59 -> 1) so the spider visits the
    # newest products first; CellphoneS's sitemap index appends new sitemaps at
    # the end, so iterating in reverse puts fresh inventory at the top of the
    # crawl instead of refurbished items from 2014-2018.
    sitemap_urls = (
        [f"https://cellphones.com.vn/sitemap/product-sitemap{i}.xml" for i in range(59, 1, -1)]
        + ["https://cellphones.com.vn/sitemap/product-sitemap.xml"]
    )
    sitemap_rules = [
        (r"https://cellphones\.com\.vn/[^/]+\.html$", "parse_product"),
    ]

    def parse_product(self, response):
        product_ld = self._extract_jsonld(response, "Product")
        breadcrumb_ld = self._extract_jsonld(response, "BreadcrumbList")

        category = self._resolve_category(breadcrumb_ld, response.url)
        if category is None:
            raise DropItem(f"Unmapped category for {response.url}")

        loader = CellphoneSLoader(response=response)

        loader.add_value("url", response.url)
        loader.add_value("platform", "CellphoneS")
        loader.add_value("seller", "CellphoneS")
        loader.add_value("seller_rating", "-1")
        loader.add_value("category", category)

        if product_ld and product_ld.get("name"):
            loader.add_value("name", product_ld["name"])
        else:
            loader.add_css("name", "h1::text")

        if product_ld and product_ld.get("image"):
            image = product_ld["image"]
            images = image if isinstance(image, list) else [image]
            loader.add_value("file_urls", images[:2])

        if product_ld:
            offers = product_ld.get("offers") or {}
            price = offers.get("price")
            if price is not None:
                loader.add_value("final_price", str(price))
        else:
            loader.add_css("final_price", ".sale-price::text")

        if response.css(".base-price::text").get():
            loader.add_css("original_price", ".base-price::text")
        else:
            loader.add_css("original_price", ".sale-price::text")

        loader.add_css("description", ".cps-block-content ::text")
        loader.add_css("short_description", ".cps-block-content strong::text")

        loader.add_css("product_rating", ".box-rating span:first-of-type::text")
        loader.add_css("review_count", ".box-rating .total-rating::text")

        loader.add_value("scraped_at", datetime.now(timezone.utc).timestamp())

        return self._fill_defaults(loader.load_item())

    @staticmethod
    def _resolve_category(breadcrumb_ld, url):
        pos2, pos3 = None, None
        if breadcrumb_ld:
            for item in breadcrumb_ld.get("itemListElement") or []:
                name = (item.get("item") or {}).get("name")
                if item.get("position") == 2:
                    pos2 = name
                elif item.get("position") == 3:
                    pos3 = name

        if pos2 in _BREADCRUMB_CATEGORY_MAP:
            return _BREADCRUMB_CATEGORY_MAP[pos2]
        if pos2 == "Âm thanh" and pos3 == "Tai nghe":
            return "earphone"
        if pos2 == "Hàng cũ" and pos3:
            mapped = _BREADCRUMB_CATEGORY_MAP.get(f"Hàng cũ/{pos3}")
            if mapped:
                return mapped

        # Fallback: derive from URL slug
        slug = url.rsplit("/", 1)[-1].lower()
        if slug.startswith(_URL_SLUG_ACCESSORY_PREFIXES):
            return None
        for prefix, cat in _URL_SLUG_PREFIX_CATEGORY.items():
            if slug.startswith(prefix):
                return cat
        if any(kw in slug for kw in _URL_PHONE_BRAND_KEYWORDS):
            return "smartphone"
        return None

    @staticmethod
    def _fill_defaults(item):
        defaults = {
            "name": "",
            "category": "",
            "description": "",
            "short_description": "",
            "product_rating": 0.0,
            "review_count": 0,
            "final_price": 0,
            "original_price": 0,
            "file_urls": [],
        }
        for key, default in defaults.items():
            item.setdefault(key, default)
        return item

    @staticmethod
    def _extract_jsonld(response, type_name):
        for raw in response.css('script[type="application/ld+json"]::text').getall():
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if isinstance(data, dict) and data.get("@type") == type_name:
                return data
            if isinstance(data, list):
                for entry in data:
                    if isinstance(entry, dict) and entry.get("@type") == type_name:
                        return entry
        return None
