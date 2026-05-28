import json
from datetime import datetime, timezone
from urllib.parse import urlencode, urlparse

import scrapy

from scrapers.base.spider import BaseProductSpider
from scrapers.sites.phongvu.loader import PhongVuLoader


class PhongVuSpider(BaseProductSpider):
    name = "phongvu"
    kafka_topic = "phongvu_topic"

    CATEGORY_URLS = {
        "laptop": "https://phongvu.vn/c/laptop",
        "smartphone": "https://phongvu.vn/c/dien-thoai-may-tinh-bang-phu-kien",
        "earphone": "https://phongvu.vn/c/thiet-bi-am-thanh",
        "computer_monitor": "https://phongvu.vn/c/man-hinh-may-tinh",
    }

    MAX_PAGES_PER_CATEGORY = 20

    async def start(self):
        for category, url in self.CATEGORY_URLS.items():
            yield scrapy.Request(
                url,
                callback=self.parse,
                meta={"category": category, "page": 1},
            )

    def parse(self, response):
        category = response.meta.get("category")
        page = response.meta.get("page", 1)

        product_links = response.css('div.product-card a::attr(href)').getall()
        product_links = [link for link in product_links if "--s" in link]

        if not product_links:
            return

        for link in product_links:
            yield response.follow(
                link,
                callback=self.parse_product,
                meta={"category": category},
            )

        if page < self.MAX_PAGES_PER_CATEGORY:
            next_page = page + 1
            parsed = urlparse(response.url)
            base = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            yield scrapy.Request(
                f"{base}?{urlencode({'page': next_page})}",
                callback=self.parse,
                meta={"category": category, "page": next_page},
            )

    def parse_product(self, response):
        loader = PhongVuLoader(response=response)

        loader.add_value("url", response.url)
        loader.add_value("platform", "Phong Vu")
        loader.add_value("seller", "Phong Vu")
        loader.add_value("seller_rating", "-1")
        loader.add_value("category", response.meta.get("category", ""))

        loader.add_css("name", "h1::text")

        product_ld = self._extract_product_jsonld(response)
        next_data = self._extract_next_data(response)
        price_block = self._find_price_block(next_data) if next_data else None
        product_block = self._find_product_block(next_data) if next_data else None

        if price_block:
            final = price_block.get("price")
            retail = price_block.get("supplierRetailPrice")
            if final is not None:
                loader.add_value("final_price", str(final))
            if retail is not None and retail > 0:
                loader.add_value("original_price", str(retail))
            elif final is not None:
                loader.add_value("original_price", str(final))
        elif product_ld:
            price = product_ld.get("offers", {}).get("price")
            if price is not None:
                loader.add_value("final_price", str(price))
                loader.add_value("original_price", str(price))

        if product_ld:
            image = product_ld.get("image")
            if image:
                images = image if isinstance(image, list) else [image]
                loader.add_value("file_urls", images[:2])

        if product_block:
            desc_html = product_block.get("description")
            short_html = product_block.get("shortDescription")
            if desc_html:
                loader.add_value("description", self._strip_html(desc_html))
            if short_html:
                loader.add_value("short_description", self._strip_html(short_html))
        elif product_ld:
            description = product_ld.get("description")
            if description:
                loader.add_value("description", description)
                loader.add_value("short_description", description)

        if product_ld:
            rating = product_ld.get("aggregateRating") or {}
            rv = rating.get("ratingValue")
            rc = rating.get("reviewCount")
            if rv is not None:
                loader.add_value("product_rating", str(rv))
            if rc is not None:
                loader.add_value("review_count", str(rc))

        loader.add_value("scraped_at", datetime.now(timezone.utc).timestamp())
        return loader.load_item()

    @staticmethod
    def _extract_product_jsonld(response):
        for raw in response.css('script[type="application/ld+json"]::text').getall():
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if isinstance(data, dict) and data.get("@type") == "Product":
                return data
            if isinstance(data, list):
                for entry in data:
                    if isinstance(entry, dict) and entry.get("@type") == "Product":
                        return entry
        return None

    @staticmethod
    def _extract_next_data(response):
        raw = response.css('script#__NEXT_DATA__::text').get()
        if not raw:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None

    @staticmethod
    def _find_price_block(node):
        if isinstance(node, dict):
            block = node.get("priceAndPromotions")
            if isinstance(block, dict) and "price" in block:
                return block
            for value in node.values():
                found = PhongVuSpider._find_price_block(value)
                if found:
                    return found
        elif isinstance(node, list):
            for item in node:
                found = PhongVuSpider._find_price_block(item)
                if found:
                    return found
        return None

    @staticmethod
    def _find_product_block(node):
        if isinstance(node, dict):
            desc = node.get("description")
            short = node.get("shortDescription")
            if isinstance(desc, str) and isinstance(short, str):
                return node
            for value in node.values():
                found = PhongVuSpider._find_product_block(value)
                if found:
                    return found
        elif isinstance(node, list):
            for item in node:
                found = PhongVuSpider._find_product_block(item)
                if found:
                    return found
        return None

    @staticmethod
    def _strip_html(html):
        if not html:
            return ""
        texts = scrapy.Selector(text=html).xpath('//text()').getall()
        return " ".join(t.strip() for t in texts if t.strip())
