import json
from datetime import datetime, timezone

import scrapy

from scrapers.base.spider import BaseProductSpider
from scrapers.sites.cellphoneS.loader import CellphoneSLoader


BASE_URL = "https://cellphones.com.vn"
SEARCH_API_URL = "https://api.cellphones.com.vn/graphql-search/v2/graphql/query"

API_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Origin": "https://cellphones.com.vn",
    "Referer": "https://cellphones.com.vn/",
    "X-Client-Type": "web",
}

HTML_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    "Accept": "text/html",
    "Referer": "https://cellphones.com.vn/",
}

CATEGORY_SEARCH_QUERIES = {
    "smartphone": "dien thoai",
    "laptop": "laptop",
    "earphone": "tai nghe",
    "computer_monitor": "man hinh may tinh",
    "tablet": "may tinh bang",
    "smartwatch": "dong ho thong minh",
    "speaker": "loa",
    "mouse": "chuot may tinh",
    "power_bank": "sac du phong",
}

CATEGORY_URI_MAP = {
    "mobile": "smartphone",
    "laptop": "laptop",
    "tai-nghe": "earphone",
    "tai-nghe-bluetooth": "earphone",
    "tai-nghe-co-day": "earphone",
    "man-hinh": "computer_monitor",
    "tablet": "tablet",
    "ipad": "tablet",
    "dong-ho-thong-minh": "smartwatch",
    "dong-ho-thong-minh-nghe-goi": "smartwatch",
    "dong-ho-thong-minh-chong-nuoc": "smartwatch",
    "dong-ho-the-thao": "smartwatch",
    "loa": "speaker",
    "loa-bluetooth": "speaker",
    "chuot": "mouse",
    "chuot-khong-day": "mouse",
    "pin-du-phong": "power_bank",
}

SEARCH_QUERY = """
query advanced_search {
  advanced_search(
    user_query: { terms: "%s", province: 15 }
    page: %d
  ) {
    products {
      product_id name product_condition sku url_path price
      special_price stock_available_id thumbnail
      promotion_information
      category_objects { path category_id level name uri }
      display_price display_root_price
    }
    meta { total page }
  }
}
"""


class CellphoneSSpider(BaseProductSpider):
    name = "cellphone_s"
    kafka_topic = "cellphone_s_topic"

    custom_settings = {
        "ITEM_PIPELINES": {"scrapers.base.pipeline.KafkaPipeline": 300},
        "DOWNLOAD_DELAY": 0,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 16,
        "AUTOTHROTTLE_ENABLED": False,
    }

    async def start(self):
        for std_category, search_terms in CATEGORY_SEARCH_QUERIES.items():
            yield scrapy.Request(
                url=SEARCH_API_URL,
                method="POST",
                body=json.dumps({
                    "query": SEARCH_QUERY % (search_terms, 1),
                    "variables": {},
                }),
                headers=API_HEADERS,
                callback=self.parse,
                cb_kwargs={
                    "page": 1,
                    "std_category": std_category,
                    "search_terms": search_terms,
                },
            )

    def parse(self, response, page, std_category, search_terms):
        payload = response.json()
        search_data = payload["data"]["advanced_search"]
        products = search_data.get("products") or []
        meta = search_data.get("meta") or {}
        total = meta.get("total", 0)
        page_size = len(products) if products else 20
        total_pages = (total + page_size - 1) // page_size

        for product in products:
            if self._get_category(product) != std_category:
                continue

            yield scrapy.Request(
                url=f"{BASE_URL}/{product['url_path']}",
                headers=HTML_HEADERS,
                callback=self.parse_product,
                cb_kwargs={
                    "api_product": product,
                    "std_category": std_category,
                },
            )

        if page < total_pages:
            yield scrapy.Request(
                url=SEARCH_API_URL,
                method="POST",
                body=json.dumps({
                    "query": SEARCH_QUERY % (search_terms, page + 1),
                    "variables": {},
                }),
                headers=API_HEADERS,
                callback=self.parse,
                cb_kwargs={
                    "page": page + 1,
                    "std_category": std_category,
                    "search_terms": search_terms,
                },
            )

    def parse_product(self, response, api_product, std_category):
        loader = CellphoneSLoader(response=response)

        loader.add_value("url", f"{BASE_URL}/{api_product['url_path']}")
        loader.add_value("platform", "CellPhones")
        loader.add_value("seller", "CellPhones")
        loader.add_value("seller_rating", "-1")
        loader.add_value("name", api_product["name"])
        loader.add_value("category", std_category)

        image_url = response.xpath("//meta[@property='og:image']/@content").get()

        if not image_url or not image_url.strip():
            image_url = response.css(".box-product-infomation-img img::attr(src)").get()

        if not image_url:
            thumbnail = api_product.get("thumbnail")
            if thumbnail:
                if thumbnail.startswith("http"):
                    image_url = thumbnail
                else:
                    clean_path = thumbnail.lstrip("/")
                    image_url = f"https://cdn.cellphones.com.vn/media/catalog/product/{clean_path}"

        if image_url:
            loader.add_value("file_urls", [image_url])

        # API returns prices as floats in scientific notation (e.g. 1.69e+06),
        # so we cast to int BEFORE str() to avoid a trailing ".0" that the
        # loader's keep_only_numbers would strip and turn into a 10x value.
        loader.add_value("final_price", str(int(api_product.get("display_price") or 0)))
        loader.add_value("original_price", str(int(api_product.get("display_root_price") or 0)))

        promo_html = api_product.get("promotion_information") or ""
        promo_text = " ".join(
            t.strip()
            for t in scrapy.Selector(text=promo_html).xpath("//text()").getall()
            if t.strip()
        ).lower()
        loader.add_value(
            "free_delivery",
            "miễn phí" in promo_text or "free ship" in promo_text,
        )

        loader.add_value("days_for_return", "30")
        loader.add_value("warranty_duration", "12")

        loader.add_css("description", ".cps-block-content ::text")
        loader.add_css("short_description", ".cps-block-content strong::text")

        rating_text = response.css(".box-rating span:first-of-type::text").get()
        if rating_text and rating_text.strip():
            loader.add_value("product_rating", rating_text.strip())

        loader.add_css("review_count", ".box-rating .total-rating::text")

        loader.add_value("scraped_at", datetime.now(timezone.utc).timestamp())

        item = loader.load_item()

        # Fill schema defaults for fields that may be missing when the product
        # page has no rating, reviews, or description (e.g. brand-new products).
        item.setdefault("description", "")
        item.setdefault("short_description", "")
        item.setdefault("product_rating", -1)
        item.setdefault("review_count", 0)

        return item

    @staticmethod
    def _get_category(product):
        for cat in product.get("category_objects") or []:
            uri = cat.get("uri", "")
            if uri in CATEGORY_URI_MAP:
                return CATEGORY_URI_MAP[uri]
        return ""
