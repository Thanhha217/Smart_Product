from kafka import KafkaProducer
import json


class KafkaPipeline:
    producer = None
    SERVER_ADDRESS = "kafka:9092"

    def open_spider(self, spider):
        self.producer = KafkaProducer(
            bootstrap_servers=self.SERVER_ADDRESS,
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )

    def close_spider(self, spider):
        self.producer.flush()
        self.producer.close()

    def process_item(self, item, spider):
        topic = getattr(spider, 'kafka_topic', 'default_topic')
        self.producer.send(topic, dict(item))
        return item
