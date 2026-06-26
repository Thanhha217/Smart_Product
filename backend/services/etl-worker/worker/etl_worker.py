import json

from kafka import KafkaConsumer

from data.process.data_processing import process_message


def create_worker_for_shop(server_address: str, topic_name: str):
    print(f"Connecting to Topic {topic_name} of server {server_address}", flush=True)

    consumer = KafkaConsumer(
        topic_name, 
        bootstrap_servers=server_address,
        auto_offset_reset='earliest',
        enable_auto_commit=True,
        group_id='etl-worker-group',
        value_deserializer=lambda msg: json.loads(msg.decode('utf-8'))
    )
    print("Connected to Topic !", flush=True)

    return consumer

def start_worker(consumer: KafkaConsumer):
    try:
        for message in consumer:
            process_message(message.value)
    except Exception as e:
        print(f"Error in Kafka consumer worker: {e}", flush=True)
