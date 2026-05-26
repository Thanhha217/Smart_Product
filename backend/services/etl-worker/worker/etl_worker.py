import json
import os

from kafka import KafkaConsumer

from data.process.data_processing import process_message

SHOP_1_TOPIC_NAME = os.environ.get("SHOP_1_TOPIC_NAME")
SERVER_ADDRESS = os.environ.get("KAFKA_SERVER_ADDRESS")


print(f"Connecting to Kafka at {SERVER_ADDRESS}...", flush=True)
print(f"Connecting to Topic {SHOP_1_TOPIC_NAME}", flush=True)
consumer = KafkaConsumer(
    SHOP_1_TOPIC_NAME, 
    bootstrap_servers=SERVER_ADDRESS,
    auto_offset_reset='earliest',
    enable_auto_commit=True,
    group_id='etl-worker-group',
    value_deserializer=lambda msg: json.loads(msg.decode('utf-8'))
)

print("Connected to Kafka!", flush=True)

def start_worker():
    try:
        for message in consumer:
            process_message(message.value)
    except Exception as e:
        print(f"Error in Kafka consumer worker: {e}", flush=True)
