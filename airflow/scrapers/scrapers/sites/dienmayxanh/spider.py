import asyncio
from datetime import datetime, timezone

import scrapy

from scrapers.base.spider import BaseProductSpider
from scrapers.sites.dienmayxanh.loader import DienmayxanhLoader
from scrapers.sites.dienmayxanh.selenium_listing import get_listing_items


class DienmayxanhSpider(BaseProductSpider):
    name = "dienmayxanh"
    kafka_topic = "dienmayxanh_topic"

    async def start(self):
        self.logger.info("[spider] start() called")
        listing_items = await asyncio.get_event_loop().run_in_executor(None, get_listing_items)
        self.logger.info(f"[spider] get_listing_items returned {len(listing_items)} items")
        for item in listing_items:
            yield scrapy.Request(
                item["url"],
                callback=self.parse_product,
                cb_kwargs={"listing_data": item},
            )

    def parse(self, _response):
        pass

    def parse_product(self, response, listing_data: dict):
        loader = DienmayxanhLoader(response=response)

        loader.add_value("url", response.url)
        loader.add_value("platform", "Điện Máy Xanh")
        loader.add_value("seller", "Điện Máy Xanh")
        loader.add_value("seller_rating", "-1")

        loader.add_value("name", listing_data.get("name"))
        loader.add_value("category", listing_data.get("category"))
        loader.add_value("final_price", listing_data.get("final_price"))
        loader.add_value("file_urls", listing_data.get("file_urls", []))

        temp_price = response.css(".box-price__old::text").get(default="")
        if temp_price:
            loader.add_value("original_price", temp_price)
        else:
            loader.add_value("original_price", listing_data.get("final_price"))

        loader.add_css("description", ".description.tab-content .text-detail ::text")
        loader.add_css("short_description", "#tab-1 ul.parameterfull li label::text")

        loader.add_css("product_rating", ".vote-txt b::text")
        loader.add_css("review_count", ".point-alltimerate::text")

        loader.add_value("scraped_at", datetime.now(timezone.utc).timestamp())

        return loader.load_item()
