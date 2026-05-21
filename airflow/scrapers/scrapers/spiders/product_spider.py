from pathlib import Path

import scrapy
import json


class FPTProductSpider(scrapy.Spider):
    name = "fpt_products"
    start_urls = [
        "https://fptshop.com.vn/dien-thoai?sort=noi-bat",
    ]

    def parse(self, response):
        author_page_links = response.css(".grow a")
        yield from response.follow_all(author_page_links, self.parse_product)
    
    def parse_product(self, response):
        def extract_with_css(query):
            return response.css(query).get(default="").strip()

        yield {
            "name": extract_with_css("h1::text"),
        }