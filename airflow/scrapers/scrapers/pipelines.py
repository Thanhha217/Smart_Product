# Moved to scrapers/base/pipeline.py
# KafkaPipeline is now generic — topic is read from spider.kafka_topic
from scrapers.base.pipeline import KafkaPipeline as FptScraperPipeline

__all__ = ["FptScraperPipeline"]
