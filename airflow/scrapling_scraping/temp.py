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
    "Điện-thoại-di-động", # smartphone
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

# fetcher = StealthyFetcher()



# def scrape_product():
#     page = fetcher.fetch('https://www.lazada.vn/products/pdp-i13339824849-s116585819507.html')#, headless=True, network_idle=True)
#     print(page.css("h1.pdp-mod-product-badge-title-v2::text"))
#     # we get the final price
#     sale_price = page.css(".pdp-v2-product-price-content-salePrice-amount::text")

#     # we check if there's a discount, if not then original_price = final_price
#     temp_price = page.css(".pdp-v2-product-price-content-originalPrice-amount::text")
#     # if temp_price == "" or "+" in temp_price:
#     #     loader.add_css("original_price", "#price-product > div > span::text")
#     # else:
#     #     loader.add_value("original_price", temp_price)
#     print(sale_price)
#     print(temp_price)


# async def wait_for_specific_request(page):
#     """
#     This function gives you direct access to the Playwright Page API.
#     It runs right after the initial page navigation.
#     """
#     # Define a lambda or regex to match your target request URL or predicate
#     # E.g., waiting for an API endpoint that loads the price/review details
#     target_url_pattern = re.compile(r".*mtop.global.detail.web.getdetailinfo.*")
    
#     try:
#         # Wait until the specific request is triggered by the page
#         print("Waiting for specific background request...")
#         async with page.expect_request(target_url_pattern, timeout=20000) as request_info:
#             # If the request isn't already fired, you can add an artificial small timeout or action here
#             pass
#         request = await request_info.value
#         print(f"Successfully captured requested URL: {request.url}")
#     except Exception as e:
#         print(f"Timed out waiting for the specific request: {e}")


# def my_page_interactions(page):
#     page.evaluate("window.scrollTo(0, document.body.scrollHeight);")
    
#     # 3. Wait for the dynamic content or network to settle down
    


async def scroll_page(page: Page):
    await page.mouse.wheel(random.randint(40, 60), 0)
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight);")

    await page.click("div.tab-list-main-item:nth-child(2) > div:nth-child(1)")

    # await page.mouse.move(100, 400)
    # await page.mouse.up()


class LazadaSpider(Spider):
    name = "my_spider"
    start_urls = ["https://www.lazada.vn/products/pdp-i3179790739-s15133698080.html"]
    
    concurrent_requests = 4
    concurrent_requests_per_domain = 2
    download_delay = 1.0 

    def configure_sessions(self, manager):
        # 2. Assign the callback inside your session configuration
        manager.add("default", AsyncStealthySession(
                network_idle=True,  # Turn off global network idle
                headless=True,
                disable_resources=False,
                page_action=scroll_page # Pass the automation function here
            )
        )

    async def parse(self, response: Response):
        # we get the url of the product
        url = response.url
        print(response.url)

        # we add the seller 
        seller = response.css(".seller-name-v2__detail-name::text").get(default="")

        # we add the seller rating
        seller_rating = response.css(".ratings-tag::text").get(default="")

        # we get the name from css
        name = response.css("h1.pdp-mod-product-badge-title-v2::text").get(default="")

        # we get the category from css breadcrumbs
        breadcrumbs = response.css("#J_breadcrumb li span::text").getall()
        print(breadcrumbs)
        category = breadcrumbs[0]

        final_price = response.css(".pdp-v2-product-price-content-salePrice-amount::text").get(default="")
        original_price = response.css(".pdp-v2-product-price-content-originalPrice-amount::text").get(default="")
        
        if original_price == "":
            original_price = final_price


        description = response.css(".detail-content ::text").getall()

        short_description = description

        product_rating = response.css("#module_product_review .score-average::text").get()
        review_count = response.css("#module_product_review .title-text::text").get()

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

        print("details : " , delivery_details)

        free_delivery = "Miễn phí" in delivery_details

        # we get the scraping time
        scraped_at = datetime.now(timezone.utc).timestamp()

        item = ProductModel(
            url=url, 
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