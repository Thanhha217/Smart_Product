from datetime import datetime, timezone
import re

from scrapy import Request

from scrapers.base.spider import BaseProductSpider
from scrapers.sites.tgdd.loader import TGDDLoader


IMAGES_PER_PRODUCT = 2


class TGDDSpider(BaseProductSpider):
    name = "tgdd_products"
    kafka_topic = "tgdd_topic"

    start_urls = [
        "https://www.thegioididong.com/dtdd",
    ]

    def parse(self, response):
        product_links = response.css("a::attr(href)").getall()
        seen_urls = set()

        for link in product_links:
            if not link:
                continue

            if "/dtdd/" not in link:
                continue

            product_url = response.urljoin(link)

            if product_url in seen_urls:
                continue

            seen_urls.add(product_url)

            yield Request(url=product_url, callback=self.parse_product)

    def clean_text(self, value):
        if not value:
            return ""

        return " ".join(value.split()).strip()

    def extract_price(self, response):
        price_selectors = [
            ".box-price-present::text",
            ".price-one::text",
            "p.price::text",
            ".price::text",
            ".detail-price span::text",
            ".box-price span::text",
            "[class*='price']::text",
        ]

        for selector in price_selectors:
            values = response.css(selector).getall()

            for value in values:
                value = self.clean_text(value)

                if not value:
                    continue

                if "₫" in value or "đ" in value.lower():
                    numbers = re.sub(r"\D", "", value)

                    if numbers and len(numbers) >= 5:
                        return value

        text = response.text

        price_patterns = [
            r'"price"\s*:\s*"?([0-9]{6,})"?',
            r'"finalPrice"\s*:\s*"?([0-9]{6,})"?',
            r'"priceSale"\s*:\s*"?([0-9]{6,})"?',
            r'"priceOnline"\s*:\s*"?([0-9]{6,})"?',
            r'([0-9]{1,3}(?:\.[0-9]{3}){2,})\s*₫',
            r'([0-9]{1,3}(?:\.[0-9]{3}){2,})\s*đ',
        ]

        for pattern in price_patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE)

            if match:
                return match.group(1)

        return "0"

    def extract_original_price(self, response, final_price):
        original_price_selectors = [
            ".box-price-old::text",
            "p.price-old::text",
            ".price-old::text",
            ".box-price del::text",
            "del::text",
            "[class*='old']::text",
        ]

        for selector in original_price_selectors:
            values = response.css(selector).getall()

            for value in values:
                value = self.clean_text(value)

                if not value:
                    continue

                if "₫" in value or "đ" in value.lower():
                    numbers = re.sub(r"\D", "", value)

                    if numbers and len(numbers) >= 5:
                        return value

        return final_price

    def extract_product_images(self, response):
        image_urls = []

        image_candidates = []
        image_candidates.extend(response.css("img::attr(src)").getall())
        image_candidates.extend(response.css("img::attr(data-src)").getall())
        image_candidates.extend(response.css("img::attr(data-original)").getall())
        image_candidates.extend(response.css("source::attr(srcset)").getall())

        for candidate in image_candidates:
            if not candidate:
                continue

            candidate = candidate.strip()

            if not candidate:
                continue

            if "," in candidate:
                candidate = candidate.split(",")[0].strip()

            if " " in candidate:
                candidate = candidate.split(" ")[0].strip()

            if candidate.startswith("//"):
                candidate = "https:" + candidate

            if candidate.startswith("/"):
                candidate = response.urljoin(candidate)

            if not candidate.startswith("http"):
                continue

            lower_candidate = candidate.lower()

            ignored_keywords = [
                "logo",
                "icon",
                "content/",
                "phonne-24x24",
                "laptop-24x24",
                "cart",
                "sprite",
                "loading",
                "placeholder",
                "no-image",
            ]

            if any(keyword in lower_candidate for keyword in ignored_keywords):
                continue

            product_keywords = [
                "/products/",
                "/product/",
                "/uploads/",
                "/tgdd/",
                "cdn.tgdd.vn",
                "cdnv2.tgdd.vn",
            ]

            if not any(keyword in lower_candidate for keyword in product_keywords):
                continue

            if candidate not in image_urls:
                image_urls.append(candidate)

            if len(image_urls) >= IMAGES_PER_PRODUCT:
                break

        return image_urls

    def extract_rating(self, response):
        rating_selectors = [
            ".rating-top .point::text",
            ".boxReview-score .point::text",
            ".boxReview-score::text",
            ".point::text",
        ]

        for selector in rating_selectors:
            values = response.css(selector).getall()

            for value in values:
                value = self.clean_text(value).replace(",", ".")

                if not value:
                    continue

                match = re.search(r"\d+(\.\d+)?", value)

                if not match:
                    continue

                rating = match.group(0)

                try:
                    rating_float = float(rating)

                    if 0 <= rating_float <= 5:
                        return rating
                except ValueError:
                    continue

        return "0"

    def extract_review_count(self, response):
        review_selectors = [
            ".rating-total::text",
            ".totalcomment::text",
            ".boxReview-review-count::text",
            "[class*='review']::text",
            "[class*='comment']::text",
        ]

        for selector in review_selectors:
            values = response.css(selector).getall()

            for value in values:
                value = self.clean_text(value)

                if not value:
                    continue

                if "đánh giá" in value.lower() or "bình luận" in value.lower() or "review" in value.lower():
                    numbers = re.sub(r"\D", "", value)

                    if numbers:
                        return numbers

        return "0"

    def parse_product(self, response):
        loader = TGDDLoader(response=response)

        loader.add_value("url", response.url)
        loader.add_value("platform", "The Gioi Di Dong")
        loader.add_value("seller", "The Gioi Di Dong")
        loader.add_value("seller_rating", "-1")

        loader.add_css("name", "h1::text")
        loader.add_value("category", "Điện thoại")

        image_urls = self.extract_product_images(response)
        loader.add_value("file_urls", image_urls)

        final_price = self.extract_price(response)
        original_price = self.extract_original_price(response, final_price)

        loader.add_value("final_price", final_price)
        loader.add_value("original_price", original_price)

        loader.add_css("description", ".article__content ::text")
        loader.add_css("description", ".parameter ::text")
        loader.add_css("description", ".boxArticle ::text")
        loader.add_css("description", ".content-t-wrap ::text")

        loader.add_css("short_description", ".parameter__list ::text")
        loader.add_css("short_description", ".parameter ::text")
        loader.add_css("short_description", ".box-specifi ::text")

        loader.add_value("product_rating", self.extract_rating(response))
        loader.add_value("review_count", self.extract_review_count(response))

        loader.add_value("days_for_return", "30")
        loader.add_value("free_delivery", False)
        loader.add_value("warranty_duration", "0")
        loader.add_value("scraped_at", datetime.now(timezone.utc).timestamp())

        return loader.load_item()
    