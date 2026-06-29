import random
import re
import json
from datetime import datetime, timezone
from scrapling.fetchers import StealthyFetcher, AsyncStealthySession
from scrapling.spiders import Spider, Response

from product_model import ProductModel
from playwright.async_api import async_playwright, Page
from camoufox.utils import launch_options as generate_launch_options

# --- CONFIGURATION ---
MAX_PAGE_PER_CATEGORY = 1
CATEGORIES = [
    # "Điện-thoại-di-động", # smartphone
    "dien-thoai-di-dong",
]
KAFKA_TOPIC = "lazada_topic"


# --- DATA PROCESSING HELPERS (Replaces Scrapy MapCompose) ---
def keep_only_numbers(text):
    if not text:
        return -2
    result = re.sub(r"\D", "", str(text))
    return int(result) if result else -2

def normalize_rating(rating, max_value=5.0):
    try:
        value = float(rating)
        if value < 0:
            return value
        if value > max_value:
            raise ValueError("Rating exceeds max value")
        return value / max_value
    except (ValueError, TypeError):
        return -1.0

async def scroll_page(page: Page):
    await page.mouse.wheel(random.randint(100, 200), 0)
    # await page.evaluate("window.scrollTo(0, document.body.scrollHeight);")

    await page.click("div.tab-list-main-item:nth-child(2) > div:nth-child(1)")


class LazadaSpider(Spider):
    name = "my_spider"
    start_urls = ["https://www.lazada.vn"] # Start at lazada mainpage to simulate natural progression
    
    concurrent_requests = 1
    concurrent_requests_per_domain = 1
    download_delay = 2.0 

    def configure_sessions(self, manager):
        manager.add("default", AsyncStealthySession(
                network_idle=True,
                headless=True,
                disable_resources=False,
                # locale='vi-VN',
                # --- CRITICAL DEFENSES ---
                hide_canvas=True,          # Leave this enabled to spoof canvas fingerprinting
                solve_cloudflare=True,     # Keep this active
                block_webrtc=True,         # Prevent real IP leaks if using proxies
                # Provide a realistic window size instead of default headless square sizes
                # viewport={"width": 1920, "height": 1080}
            )
        )
    
    async def parse(self, response: Response):
        for c in CATEGORIES:
            for i in range(MAX_PAGE_PER_CATEGORY):  
                yield response.follow(f"https://www.lazada.vn/{c}/?page={i+1}&rating=4&service=official&sort=popularity", callback=self.parse_category_page)


    async def parse_category_page(self, response):
        product_urls = response.css("#root > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(3) > div > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > a::attr(href)").getall()
        
        for url in product_urls:
            yield response.follow(url, callback=self.parse_product, page_action=scroll_page)


    async def parse_product(self, response: Response):
        # we get the url of the product
        url = response.url
        print(response.url)

        image = response.css(".pdp-mod-common-image gallery-preview-panel-v2__image::attr(src)").get(default="")
        file_urls = []
        if image:
            file_urls = [image]

        # we add the seller 
        seller = response.css(".seller-name-v2__detail-name::text").get(default="")

        # we add the seller rating
        seller_rating = response.css(".ratings-tag::text").get(default="")

        # we get the name from css
        name = response.css("h1.pdp-mod-product-badge-title-v2::text").get(default="")

        # we get the category from css breadcrumbs
        breadcrumbs = response.css("#J_breadcrumb li span::text").getall()
        category = breadcrumbs[0]

        final_price = response.css(".pdp-v2-product-price-content-salePrice-amount::text").get(default="")
        original_price = response.css(".pdp-v2-product-price-content-originalPrice-amount::text").get(default="")
        
        if original_price == "":
            original_price = final_price


        description = response.css(".detail-content ::text").getall()

        short_description = description

        product_rating = response.css(".container-star-v2-score::text").get(default="")
        review_count = response.css(".container-star-v2-count::text").get(default="")

        tags = response.css(".warranty-v2-label-text::text").get().split("·")

        def keep_only_numbers(text):
            result = re.sub(r"\D", "", text)
            return int(result) if result else -2
        
        days_for_return = 0
        warranty_duration = 0
        for t in tags:
            t = t.lower()
            if "ngày miễn phí trả hàng" in t:
                days_for_return = keep_only_numbers(t)
            elif "hóa đơn" in t:
                if "tháng" in t:
                    warranty_duration = keep_only_numbers(t)
                elif "năm" in t:
                    warranty_duration = keep_only_numbers(t)*12

        delivery_details = response.css(".delivery__option-desc::text").get(default="")
        free_delivery = False

        free_delivery = "Miễn phí" in delivery_details

        # we get the scraping time
        scraped_at = datetime.now(timezone.utc).timestamp()

        item = ProductModel(
            url=url, 
            file_urls=file_urls,
            seller=seller,
            seller_rating=seller_rating,
            name=name,
            category=category,
            final_price=final_price,
            original_price=original_price,
            description=description,
            short_description=short_description,
            product_rating=product_rating,
            review_count=review_count,
            days_for_return=days_for_return,
            free_delivery=free_delivery,
            warranty_duration=warranty_duration,
            scraped_at=scraped_at,
        )

        yield item.model_dump()


if __name__ == "__main__":
    result = LazadaSpider().start()

    print(f"RESULT : \n{result}")