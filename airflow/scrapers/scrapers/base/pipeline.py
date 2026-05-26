import json
import os
from kafka import KafkaProducer


class KafkaPipeline:
    def open_spider(self, spider):
        server = os.getenv("KAFKA_SERVER_ADDRESS", "kafka:9092")
        self.producer = KafkaProducer(
            bootstrap_servers=server,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        )

    def close_spider(self, spider):
        self.producer.flush()
        self.producer.close()

    def process_item(self, item, spider):
        self.producer.send(spider.kafka_topic, dict(item))
        return item
