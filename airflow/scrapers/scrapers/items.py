# Define here the models for your scraped items
#
# See documentation in:
# https://docs.scrapy.org/en/latest/topics/items.html

import scrapy

# This class contains all of the info we want to send to the topic to be processed and saved in the database later
# It's the same for every product no matter the platform
class Product(scrapy.Item):
    url = scrapy.Field()
    platform = scrapy.Field()
    seller = scrapy.Field()
    seller_rating = scrapy.Field() # normalized from 0 to 1, -1 if missing
    name = scrapy.Field()
    category = scrapy.Field()
    file_urls = scrapy.Field()
    files = scrapy.Field()
    original_price = scrapy.Field()
    final_price = scrapy.Field()
    description = scrapy.Field()
    short_description = scrapy.Field()
    product_rating = scrapy.Field() # normalized from 0 to 1, -1 if missing
    review_count = scrapy.Field()
    free_delivery = scrapy.Field() # bool
    days_for_return = scrapy.Field()
    warranty_duration = scrapy.Field() # in months
    scraped_at = scrapy.Field()
