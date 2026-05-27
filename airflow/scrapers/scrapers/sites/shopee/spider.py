from scrapers.base.spider import BaseProductSpider
from scrapers.sites.shopee.loader import ShopeeLoader


class ShopeeSpider(BaseProductSpider):
    name = "shopee"
    kafka_topic = "shopee_topic"

    start_urls = []

    def parse(self, response):
        raise NotImplementedError

    def parse_product(self, response):
        raise NotImplementedError
