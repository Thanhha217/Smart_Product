import os

from .etl_worker import create_worker_for_shop

SERVER_ADDRESS = os.environ.get("KAFKA_SERVER_ADDRESS")
TOPIC_NAME = os.environ.get("SHOP_3_TOPIC_NAME")

shopee_worker = create_worker_for_shop(SERVER_ADDRESS, TOPIC_NAME)