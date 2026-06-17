import asyncio
import re
from datetime import datetime, timezone

import scrapy

from scrapers.base.spider import BaseProductSpider
from scrapers.sites.tgdd.loader import TGDDLoader
from scrapers.sites.tgdd.listing import get_listing_items


class TGDDSpider(BaseProductSpider):
    name = "tgdd_products"
    kafka_topic = "tgdd_topic"

    custom_settings = {
        "ITEM_PIPELINES": {"scrapers.base.pipeline.KafkaPipeline": 300},
        "DOWNLOAD_DELAY": 0.25,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 8,
        "AUTOTHROTTLE_ENABLED": False,
    }

    async def start(self):
        self.logger.info("[tgdd spider] start() called")

        listing_items = await asyncio.to_thread(get_listing_items)

        self.logger.info(
            f"[tgdd spider] get_listing_items returned {len(listing_items)} items"
        )

        for item in listing_items:
            yield scrapy.Request(
                item["url"],
                callback=self.parse_product,
                cb_kwargs={"listing_data": item},
            )

    def parse(self, _response):
        pass

    def clean_text(self, value):
        if not value:
            return ""
        return " ".join(str(value).split()).strip()

    def extract_original_price(self, response, final_price):
        selectors = [
            ".box-price-old::text",
            ".box-price__old::text",
            "p.price-old::text",
            ".price-old::text",
            ".box-price del::text",
            "del::text",
            "[class*='old']::text",
        ]

        for selector in selectors:
            values = response.css(selector).getall()

            for value in values:
                value = self.clean_text(value)

                if not value:
                    continue

                if "₫" in value or "đ" in value.lower():
                    numbers = re.sub(r"\D", "", value)

                    if numbers and len(numbers) >= 5:
                        return numbers

        return str(final_price or "0")

    def extract_description(self, response):
        selectors = [
            ".description.tab-content .text-detail ::text",
            ".article__content ::text",
            ".boxArticle ::text",
            ".content-t-wrap ::text",
            ".content-article ::text",
            ".text-detail ::text",
        ]

        for selector in selectors:
            values = response.css(selector).getall()
            cleaned_values = [self.clean_text(value) for value in values]
            cleaned_values = [value for value in cleaned_values if value]

            if cleaned_values:
                return cleaned_values

        return []

    def extract_short_description(self, response):
        selectors = [
            "#tab-1 ul li ::text",
            ".parameter__list ::text",
            ".parameter ::text",
            ".box-specifi ::text",
            ".parameter-item ::text",
        ]

        for selector in selectors:
            values = response.css(selector).getall()
            cleaned_values = [self.clean_text(value) for value in values]
            cleaned_values = [value for value in cleaned_values if value]

            if cleaned_values:
                return cleaned_values

        return []

    def extract_rating(self, response):
        selectors = [
            ".vote-txt b::text",
            ".rating-top .point::text",
            ".boxReview-score .point::text",
            ".boxReview-score::text",
            ".point::text",
            "[class*='rating'] [class*='point']::text",
        ]

        for selector in selectors:
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
                        return str(rating)
                except ValueError:
                    continue

        return "0"

    def extract_review_count(self, response):
        selectors = [
            ".point-alltimerate::text",
            ".rating-total::text",
            ".totalcomment::text",
            ".boxReview-review-count::text",
            "[class*='review']::text",
            "[class*='comment']::text",
            "[class*='rating']::text",
        ]

        for selector in selectors:
            values = response.css(selector).getall()

            for value in values:
                value = self.clean_text(value)

                if not value:
                    continue

                lower_value = value.lower()

                if (
                    "đánh giá" in lower_value
                    or "bình luận" in lower_value
                    or "review" in lower_value
                    or "nhận xét" in lower_value
                ):
                    numbers = re.sub(r"\D", "", value)

                    if numbers:
                        return str(numbers)

        return "0"

    def extract_warranty_duration(self, response):
        selectors = [
            "#policy .policy__list > li ::text",
            "#policy ::text",
            "[class*='policy'] ::text",
            "[class*='warranty'] ::text",
            ".policy__list ::text",
        ]

        product_tags = []

        for selector in selectors:
            product_tags.extend(response.css(selector).getall())

        cleaned_tags = [self.clean_text(tag).lower() for tag in product_tags]
        cleaned_tags = [tag for tag in cleaned_tags if tag]

        warranty_text = " ".join(
            tag
            for tag in cleaned_tags
            if "bảo hành" in tag or "chính hãng" in tag
        )

        if not warranty_text:
            return "0"

        year_match = re.search(r"(\d+)\s*năm", warranty_text)
        if year_match:
            return str(int(year_match.group(1)) * 12)

        month_match = re.search(r"(\d+)\s*tháng", warranty_text)
        if month_match:
            return str(month_match.group(1))

        return "0"

    def parse_product(self, response, listing_data: dict):
        loader = TGDDLoader(response=response)

        final_price = str(listing_data.get("final_price") or "0")
        original_price = self.extract_original_price(response, final_price)

        short_description = self.extract_short_description(response)
        description = self.extract_description(response)

        loader.add_value("url", str(response.url))
        loader.add_value("platform", "Thế Giới Di Động")
        loader.add_value("seller", "Thế Giới Di Động")
        loader.add_value("seller_rating", "-1")

        loader.add_value("name", str(listing_data.get("name") or ""))
        loader.add_value("category", str(listing_data.get("category") or "Điện thoại"))
        loader.add_value("final_price", final_price)
        loader.add_value("original_price", original_price)

        loader.add_value("file_urls", listing_data.get("file_urls", []))

        if description:
            loader.add_value("description", description)
        else:
            loader.add_value("description", short_description)

        loader.add_value("short_description", short_description)

        loader.add_value("product_rating", str(self.extract_rating(response)))
        loader.add_value("review_count", str(self.extract_review_count(response)))

        # Keep as string because loader processors may expect text.
        loader.add_value("free_delivery", False)
        loader.add_value("days_for_return", "30")
        loader.add_value("warranty_duration", str(self.extract_warranty_duration(response)))
        loader.add_value("scraped_at", str(datetime.now(timezone.utc).timestamp()))

        return loader.load_item()