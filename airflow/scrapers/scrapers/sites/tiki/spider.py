from scrapers.base.spider import BaseProductSpider
from scrapers.sites.tiki.loader import TikiLoader


class TikiSpider(BaseProductSpider):
    name = "tiki"
    kafka_topic = "tiki_topic"

    start_urls = []

    def parse(self, response):
        raise NotImplementedError

    def parse_product(self, response):
        raise NotImplementedError
