# Define your item pipelines here
#
# Don't forget to add your pipeline to the ITEM_PIPELINES setting
# See: https://docs.scrapy.org/en/latest/topics/item-pipeline.html


# useful for handling different item types with a single interface
from itemadapter import ItemAdapter
from kafka import KafkaProducer
import json
import scrapy

# Change topic name depending on scrapped e-commerce platform
TOPIC_NAME = "test_topic"
# Change address based on chosen server
SERVER_ADDRESS = "kafka:9092"


class FptScraperPipeline:
    producer = None
    
    def open_spider(self):
        self.producer = KafkaProducer(bootstrap_servers=SERVER_ADDRESS, value_serializer=lambda v: json.dumps(v).encode('utf-8'))
        

    def close_spider(self):
        self.producer.flush()
        self.producer.close()

    def process_item(self, item, spider):
        # return item
        self.producer.send(TOPIC_NAME, item)
        return item
