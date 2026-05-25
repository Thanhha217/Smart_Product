# Define here the models for your scraped items
#
# See documentation in:
# https://docs.scrapy.org/en/latest/topics/items.html

import scrapy

# This class contains all of the info we want to send to the topic to be processed and saved in the database later
# It's the same for every product no matter the platform
class Product(scrapy.Item):
    name = scrapy.Field()
    file_urls = scrapy.Field()
    files = scrapy.Field()
    original_price = scrapy.Field()
    final_price = scrapy.Field()
    description = scrapy.Field()
    product_rating = scrapy.Field()
    review_count = scrapy.Field()
    scraped_at = scrapy.Field()
    
