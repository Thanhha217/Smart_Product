from datetime import datetime, timezone
import json

from scrapy import Request

from scrapers.base.spider import BaseProductSpider
from scrapers.sites.fpt_shop.loader import FptShopLoader
from functools import partial


MAX_PRODUCTS_PER_REQUEST = 50
IMAGES_PER_PRODUCT = 2

class FptShopSpider(BaseProductSpider):
    name = "fpt_shop"
    kafka_topic = "fpt_topic"

    custom_settings = {
        "ITEM_PIPELINES": {"scrapers.base.pipeline.KafkaPipeline": 300},
        "DOWNLOAD_DELAY": 0,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 16,
        "AUTOTHROTTLE_ENABLED": False,
    }

    # The list of starting url the spider will scrape from
    start_urls = [
        "https://fptshop.com.vn/",
    ]

    # We can use the hidden api to fetch all the products from a category
    def fetch_category_products(self, category, skipCount, response):
        api_url = "https://papi.fptshop.com.vn/gw/v1/public/fulltext-search-service/category"

        json_content = {
            "skipCount": skipCount,
            "maxResultCount": MAX_PRODUCTS_PER_REQUEST,
            "sortMethod": "noi-bat",
            "slug": category, #"dien-thoai", #category name
            "categoryType": "category",
            "location": {}
        }

        return Request(
            url=api_url, 
            method='POST',
            body=json.dumps(json_content),
            headers={'Content-Type': 'application/json'},
            callback=partial(self.parse_category, category, skipCount) #self.parse_category
        )


    def parse(self, response):
        # product_page_links = response.css(".grow a") # we find all of the links in the page
        return self.fetch_category_products("dien-thoai", 0, response)
        # yield from response.follow_all(product_page_links, self.parse_product) # we go to each page and parse them


    def parse_category(self, category, skipCount, response):
        data = json.loads(response.text)
        products = data.get('items', [])

        for product in products:
            slug = product.get("slug")
            product_url = f"https://fptshop.com.vn/{slug}"
            yield Request(url=product_url, callback=self.parse_product)
        
        if len(products) != 0:
            yield self.fetch_category_products(category, skipCount+MAX_PRODUCTS_PER_REQUEST, response)
        


    def parse_product(self, response):
        # we create the loader that handles the initial data formatting
        loader = FptShopLoader(response=response)

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

        image_urls = response.css(
            '#ThongTinSanPham > section:nth-of-type(2) > div:first-child > div:first-child > div:first-child > div:first-child > div:first-child > .swiper-slide .\\!\\[width\\:50\\%\\] img::attr(src)'
        ).getall()[:IMAGES_PER_PRODUCT]
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

        # Fixed, not really flexible but it's litteraly the same for every product on this website
        loader.add_value("days_for_return", 30)

        product_tags = response.css("#ThongTinSanPham > section:nth-of-type(2) > div:first-child > div:first-child > div:nth-of-type(3) > div:nth-of-type(2) span::text").getall()
        
        free_delivery = False
        warranty_duration = "0"
        for tag in product_tags:
            if "miễn phí" in tag.lower():
                free_delivery = True

            if "bảo hành" in tag.lower():
                warranty_duration = tag

        loader.add_value("free_delivery", free_delivery)
        loader.add_value("warranty_duration", warranty_duration)

        # we get the scraping time
        loader.add_value("scraped_at", datetime.now(timezone.utc).timestamp())

        return loader.load_item()
