from pathlib import Path

import scrapy
import json

from scrapers.loaders import FPTProductLoader

from datetime import datetime, timezone


class FPTProductSpider(scrapy.Spider):
    name = "fpt_products" # the name of the spider, needs to be unique

    # associates the pipeline to the spider
    custom_settings = {
        "ITEM_PIPELINES": {
            "scrapers.pipelines.FptScraperPipeline": 300,
            "scrapy.pipelines.files.FilesPipeline": 1
        }
    }

    # The list of starting url the spider will scrape from
    start_urls = [
        "https://fptshop.com.vn/dien-thoai?sort=noi-bat",
    ]

    # TEST
    # start_urls = [
    #     "https://fptshop.com.vn/dien-thoai/xiaomi-redmi-note-15"
    #     "https://fptshop.com.vn/camera/camera-giam-sat-ip-3mp-365-selection-c1"
    # ]

    def parse(self, response):
        product_page_links = response.css(".grow a") # we find all of the links in the page
        yield from response.follow_all(product_page_links, self.parse_product) # we go to each page and parse them
    
    def parse_product(self, response):
        # we create the loader that handles the initial data formatting
        loader = FPTProductLoader(response=response)

        # we get the url of the product
        loader.add_value("url", response.url) 

        # we add the platform (we put it manually)
        loader.add_value("platform", "FPT Shop") 

        # we add the seller (for FPT Shop, it's always the same)
        loader.add_value("seller", "FPT Shop") 

        # we add the seller (for FPT Shop, it's always the same)
        loader.add_value("seller_rating", "-1") 

        # we get the name from css
        loader.add_css("name", "h1::text")

        # we get the category from css
        loader.add_css("category", "#ThongTinSanPham > section:first-child > nav:first-child > ol:first-child > li:nth-of-type(2) span::text") 

        # we take the first image from the products TODO : improve with selenium
        # image_urls = response.css("#ThongTinSanPham > section:nth-of-type(2) > div:first-child > div:first-child > div:first-child > div:first-child > div:first-child > .swiper-slide img::attr(src)").getall()[:2]
        image_urls = response.css('#ThongTinSanPham > section:nth-of-type(2) > div:first-child > div:first-child > div:first-child > div:first-child > div:first-child > .swiper-slide .\\!\\[width\\:50\\%\\] img::attr(src)').getall()[:2]

        loader.add_value("file_urls", image_urls)

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

        # a shorter version of the description, gets the bold text
        loader.add_css("short_description", "#MoTaSanPham strong::text")

        loader.add_css("product_rating", "#CommentRating > div:first-child > div:first-child > div:nth-of-type(2) > div:first-child > div:first-child > div:first-child > div:first-child > div:nth-of-type(2)::text")
        
        loader.add_css("review_count", "#CommentRating > div:first-child > div:first-child > div:nth-of-type(2) > div:first-child > div:first-child > div:first-child > div:first-child > div:nth-of-type(3)::text")

        # we get the scraping time
        # loader.add_value("scraped_at", datetime.now(timezone.utc).isoformat()) 
        loader.add_value("scraped_at", datetime.now(timezone.utc).timestamp()) 

        return loader.load_item()