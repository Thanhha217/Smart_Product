from datetime import datetime, timezone
from scrapers.base.spider import BaseProductSpider
from scrapers.sites.fpt_shop.loader import FptShopLoader


class FptShopSpider(BaseProductSpider):
    name = "fpt_shop"
    platform = "FPT Shop"
    kafka_topic = "products.fpt_shop"

    start_urls = ["https://fptshop.com.vn/dien-thoai?sort=noi-bat"]

    def parse(self, response):
        product_page_links = response.css(".grow a")
        yield from response.follow_all(product_page_links, self.parse_product)

    def parse_product(self, response):
        loader = FptShopLoader(response=response)

        loader.add_value("url", response.url)
        loader.add_value("platform", self.platform)
        loader.add_value("seller", "FPT Shop")
        loader.add_value("seller_rating", "-1")
        loader.add_css("name", "h1::text")
        loader.add_css(
            "category",
            "#ThongTinSanPham > section:first-child > nav:first-child > ol:first-child > li:nth-of-type(2) span::text",
        )

        image_urls = response.css(
            '#ThongTinSanPham > section:nth-of-type(2) > div:first-child > div:first-child > div:first-child > div:first-child > div:first-child > .swiper-slide .\\!\\[width\\:50\\%\\] img::attr(src)'
        ).getall()[:2]
        loader.add_value("file_urls", image_urls)

        loader.add_css("final_price", "#price-product > div > span::text")

        temp_price = response.css("#price-product > div > div > span:first-child::text").get(default="")
        if temp_price == "" or "+" in temp_price:
            loader.add_css("original_price", "#price-product > div > span::text")
        else:
            loader.add_value("original_price", temp_price)

        loader.add_css("description", "#MoTaSanPham ::text")
        loader.add_css("short_description", "#MoTaSanPham strong::text")
        loader.add_css(
            "product_rating",
            "#CommentRating > div:first-child > div:first-child > div:nth-of-type(2)"
            " > div:first-child > div:first-child > div:first-child > div:first-child > div:nth-of-type(2)::text",
        )
        loader.add_css(
            "review_count",
            "#CommentRating > div:first-child > div:first-child > div:nth-of-type(2)"
            " > div:first-child > div:first-child > div:first-child > div:first-child > div:nth-of-type(3)::text",
        )
        loader.add_value("scraped_at", datetime.now(timezone.utc).timestamp())

        return loader.load_item()
