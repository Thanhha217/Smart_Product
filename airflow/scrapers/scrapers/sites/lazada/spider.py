import asyncio
from datetime import datetime, timezone
import json
import re

import scrapy
from scrapy.http import HtmlResponse
from scrapers.base.spider import BaseProductSpider
from scrapers.sites.lazada.loader import LazadaLoader
from scrapy_playwright.page import PageMethod

MAX_PAGE_PER_CATEGORY = 1

categories = [
    "Điện-thoại-di-động", #smartphone
]



class LazadaSpider(BaseProductSpider):
    name = "lazada"
    kafka_topic = "lazada_topic"

    # Explicitly merge parent settings with the mandatory Playwright settings
    custom_settings = {
        "ITEM_PIPELINES": {
            "scrapers.base.pipeline.KafkaPipeline": 300,
        },
        "DOWNLOADER_MIDDLEWARES": {
            # 'scrapy.downloadermiddlewares.useragent.UserAgentMiddleware': None,
            # 'scrapy.downloadermiddlewares.retry.RetryMiddleware': None,
            # 'scrapy_fake_useragent.middleware.RandomUserAgentMiddleware': None,
        },
        "COOKIES_ENABLED": True,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 1,
        "DOWNLOAD_DELAY": 4.0
    }

    intercepted_xhr = None

    def api_interceptor(self, page, request, api, method):
        future = asyncio.Future()

        async def handle_response(response):
            if (
                response.request.method == method
                and api in response.url
            ):
                print(f"Target API detected and captured!")
                # print(request.headers)
                if not future.done():
                    future.set_result(await response.json())

        page.on("response", handle_response)
        request.meta["api_future"] = future
        # asyncio_future = asyncio.Future()

        # async def handle_response(response):
        #     if response.request.method != "POST":
        #         return
            
        #     if api in response.url:
        #         try:
        #             json_data = await response.json()
        #             print(f"Target API detected and captured!", response.request.method)
                    
        #             if "getdetailinfo" in request.url:
        #                 print(request.headers)
                    
        #             # Resolve the future with the data if it hasn't been resolved yet
        #             future = asyncio_future
        #             if not future.done():
        #                 future.set_result(json_data)
        #         except Exception as e:
        #             print(f"Found the API endpoint, but failed to parse JSON: {e}")

        # page.on("response", handle_response)
        # page._detail_future = asyncio_future
    
    async def product_api_interceptor(self, page, request):
        self.api_interceptor(page, request, "mtop.global.detail.web.getdetailinfo", "POST")

    

    async def start(self):
        # start_urls = [
        #     "https://www.lazada.vn/products/pdp-i1216257-s1509400.html?scm=1007.17760.398138.0&pvid=1b758099-eed4-4104-a6ef-53468c1869b1&search=flashsale&spm=a2o4n.homepage.FlashSale.d_1216257",
        #     "https://www.lazada.vn/products/pdp-i1269083219-s4782493768.html?spm=a2o4n.10441748.0.0.3b8954a3L2hf52&search=store",
        # ]
        print("YOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO")

        meta = {
            "playwright": True,
            "playwright_page_methods": [
                # Force Playwright to wait for the network to sit idle
                PageMethod("wait_for_load_state", "networkidle"),
            ],
            "playwright_context": "context_user",
            "playwright_context_kwargs": {
                "ignore_https_errors": True,
                "locale": "vi-VN",
            }
            # "playwright_include_page": True,
            # "playwright_page_init_callback": self.category_api_interceptor,
        }

        yield scrapy.Request(
            url=f"https://www.lazada.vn/",
            callback=self.crawl_categories,
            meta=meta,
            dont_filter=True
        )
    

    # async def category_api_interceptor(self, page, request):
    #     self.api_interceptor(page, request, "mtop.global.detail.web.getdetailinfo")

    async def crawl_categories(self, response):
        meta = {
            "playwright": True,
            # "playwright_include_page": True,
            # "playwright_page_init_callback": self.category_api_interceptor,
            "playwright_context": "context_user",
            "playwright_context_kwargs": {
                "ignore_https_errors": True,
                "locale": "vi-VN",
            }
        }

        for c in categories:
            for i in range(MAX_PAGE_PER_CATEGORY):
                yield scrapy.Request(
                    url=f"https://www.lazada.vn/tag/{c}/?page={i+1}&&rating=4&service=official&sort=popularity",
                    callback=self.parse_category_page,
                    meta=meta,
                    dont_filter=True
                )

    async def parse_category_page(self, response):
        product_urls = response.css("#root > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(3) > div > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > a::attr(href)").getall()
        print(f"product urls = {product_urls}")
        meta = {
            "playwright": True,
            "playwright_include_page": True,
            "playwright_page_init_callback": self.product_api_interceptor,
            "playwright_context": "context_user",
            "playwright_context_kwargs": {
                "ignore_https_errors": True,
                "locale": "vi-VN",
            }
        }
        
        for url in product_urls:
            yield scrapy.Request(
                url=response.urljoin(url),
                callback=self.parse_product,
                meta=meta,
                dont_filter=True
            )

    async def parse_product(self, response):
        page = response.meta["playwright_page"]
        # cookies = await page.context.cookies()

        # for c in cookies:
        #     print(c["name"], c["value"][:30])

        # api_data = await page.api_future

        # html_content = await page.content()

        # response = response.replace(body=html_content)
        

        api_data = None
        if response.meta["api_future"]:
            try:
                # 2. Explicitly wait up to 7 seconds for this specific background call to resolve
                api_data = await asyncio.wait_for(response.meta["api_future"], timeout=7.0)
                print("Successfully recovered API data in parse()!")
            except asyncio.TimeoutError:
                print("Timed out waiting for getdetailinfo API.")

        print("resquest :", api_data)
        

        # we create the loader that handles the initial data formatting
        loader = LazadaLoader(response=response)

        # we get the url of the product
        loader.add_value("url", response.url)

        # we add the platform (we put it manually)
        loader.add_value("platform", "Lazada")

        # we add the seller 
        loader.add_css("seller", ".seller-name-v2__detail-name::text")

        # we add the seller rating
        loader.add_css("seller_rating", ".ratings-tag::text")

        # we get the name from css
        loader.add_css("name", "h1.pdp-mod-product-badge-title-v2::text")

        # we get the category from css breadcrumbs
        breadcrumbs = response.css("#J_breadcrumb li span::text").getall()
        print("breadcrumbs:", breadcrumbs)
        # loader.add_value("category", breadcrumbs[-2])

        sale_price = response.css(".pdp-v2-product-price-content-salePrice-amount::text").get(default="")
        original_price = response.css(".pdp-v2-product-price-content-originalPrice-amount::text").get(default="")

        print(f"sale_price = {sale_price}")
        print(f"original_price = {original_price}")

        loader.add_value("final_price", sale_price)
        
        if original_price == "":
            loader.add_value("original_price", sale_price)
        else:
            loader.add_value("original_price", original_price)


        loader.add_css("description", ".detail-content ::text")

        # a shorter version of the description, gets the bold text
        loader.add_css("short_description", ".detail-content ::text")

        loader.add_css("product_rating", "#module_product_review .score-average::text")
        loader.add_css("review_count", "#module_product_review .title-text::text")

        # tags = response.css(".warranty-v2-label-text::text").get().split("·")

        # def keep_only_numbers(text):
        #     result = re.sub(r"\D", "", text)
        #     return int(result) if result else -2
        
        # days_for_return = 0
        # warranty_duration = 0
        # for t in tags:
        #     t = t.lower()
        #     if "ngày miễn phí trả hàng" in t:
        #         days_for_return = keep_only_numbers(t)
        #     elif "hóa đơn" in t:
        #         if "tháng" in t:
        #             warranty_duration = keep_only_numbers(t)
        #         elif "năm" in t:
        #             warranty_duration = keep_only_numbers(t)*12

        # # # Fixed, not really flexible but it's litteraly the same for every product on this website
        # loader.add_value("days_for_return", days_for_return)

        # loader.add_value("warranty_duration", warranty_duration)

        # free_delivery = "phí vận chuyển Miễn phí" in response.css("delivery__option-desc").get(default="").split(",")[1]

        # loader.add_value("free_delivery", free_delivery)

        # we get the scraping time
        loader.add_value("scraped_at", datetime.now(timezone.utc).timestamp())

        await page.close()
        return loader.load_item()