import scrapy


class BaseProductSpider(scrapy.Spider):
    platform: str = ""
    kafka_topic: str = ""

    custom_settings = {
        "ITEM_PIPELINES": {
            "scrapers.base.pipeline.KafkaPipeline": 300,
            "scrapy.pipelines.files.FilesPipeline": 1,
        }
    }

    def parse(self, response):
        raise NotImplementedError

    def parse_product(self, response):
        raise NotImplementedError
