# Define your item pipelines here
#
# Don't forget to add your pipeline to the ITEM_PIPELINES setting
# See: https://docs.scrapy.org/en/latest/topics/item-pipeline.html


# useful for handling different item types with a single interface
from itemadapter import ItemAdapter
from kafka import KafkaProducer
import json
import scrapy




class FptScraperPipeline:
    producer = None
    # Change topic name depending on scrapped e-commerce platform
    TOPIC_NAME = "fpt_topic"
    # Change address based on chosen server
    SERVER_ADDRESS = "kafka:9092"

    
    # create producer when starting the pipeline
    def open_spider(self):
        self.producer = KafkaProducer(bootstrap_servers = self.SERVER_ADDRESS, value_serializer = lambda v: json.dumps(v).encode('utf-8'))
        
    # flush and close producer when it's done
    def close_spider(self):
        self.producer.flush()
        self.producer.close()

    def process_item(self, item, spider):
        # we send the item to the topic (will be sent as json)
        self.producer.send(self.TOPIC_NAME, dict(item))
        return item
