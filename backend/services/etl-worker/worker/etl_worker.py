import json
import os
import time

from kafka import KafkaConsumer


TOPIC_NAME = "test"
SERVER_ADDRESS = os.environ.get("KAFKA_SERVER_ADDRESS")

data = {"message": "Hello, World!"}


print(f"Connecting to Kafka at {SERVER_ADDRESS}...", flush=True)
consumer = KafkaConsumer(
    TOPIC_NAME, 
    bootstrap_servers=SERVER_ADDRESS,
    auto_offset_reset='earliest',
    enable_auto_commit=True,
    group_id='etl-worker-group',
)
print("Connected to Kafka!", flush=True)
def start_worker():
    while True:
        try:
            for message in consumer:
                print(f"Received message: {message.value}", flush=True)
        except Exception as e:
            print(f"Error in Kafka consumer worker: {e}", flush=True)
            time.sleep(5)