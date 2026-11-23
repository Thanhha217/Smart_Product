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
    """Consume forever. A bad message is logged and skipped: before, the first exception
    ended the loop and the thread stopped consuming its topic until the next restart."""
    for message in consumer:
        try:
            process_message(message.value)
        except Exception as e:
            print(f"Error in Kafka consumer worker (offset {message.offset}, skipped): {e}", flush=True)
