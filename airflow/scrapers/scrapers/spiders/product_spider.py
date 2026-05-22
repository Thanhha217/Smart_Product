from pathlib import Path

import scrapy
import json

from scrapers.loaders import FPTProductLoader

from datetime import datetime, timezone


class FPTProductSpider(scrapy.Spider):
    name = "fpt_products" # the name of the spider, needs to be unique

    # The list of starting url the spider will scrape from
    start_urls = [
        "https://fptshop.com.vn/dien-thoai?sort=noi-bat",
    ]

    def parse(self, response):
        product_page_links = response.css(".grow a") # we find all of the links in the page
        yield from response.follow_all(product_page_links, self.parse_product) # we go to each page and parse them
    
    def parse_product(self, response):
        # we create the loader that handles the initial data formatting
        loader = FPTProductLoader(response=response)

        # we get the name from css
        loader.add_css("name", "h1::text") 

        # we get the final price
        loader.add_css("final_price", "#price-product > div > span::text") 

        # we check if there's a discount, if not then original_price = final_price
        temp_price = response.css("#price-product > div > div > span:first-child::text").get(default="")
        if temp_price == "" or "+" in temp_price:
            loader.add_css("original_price", "#price-product > div > span::text")
        else:
            loader.add_value("original_price", temp_price)

        # we get the description array (the text of every child of #MoTaSanPham)
        loader.add_css("description", "#MoTaSanPham ::text")

        # we get the scraping time
        loader.add_value("scraped_at", datetime.now(timezone.utc).isoformat()) 

        return loader.load_item()