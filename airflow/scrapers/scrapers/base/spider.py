import scrapy
from abc import abstractmethod


class BaseProductSpider(scrapy.Spider):
    kafka_topic: str

    custom_settings = {
        "ITEM_PIPELINES": {
            "scrapers.base.pipeline.KafkaPipeline": 300,
            "scrapy.pipelines.files.FilesPipeline": 1,
        }
    }

    @abstractmethod
    def parse(self, response):
        ...

    @abstractmethod
    def parse_product(self, response):
        ...
