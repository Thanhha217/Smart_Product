from itemloaders.processors import TakeFirst, MapCompose, Join, Identity
from scrapy.loader import ItemLoader
import re

from scrapers.items import Product



def keep_only_numbers(text):
    return re.sub(r"\D", "", text)

def normalize_rating(rating, max_value):
    value = float(rating)
    if value > max_value:
        raise ValueError("The rating provided is incorrect")
    return value/max_value

# The loaders handle the initial cleaning and formatting of the scrapped data, which is then saved to a 
# Product item and then sent to the corresponding Kafka topic with the Pipeline

class FPTProductLoader(ItemLoader):
    # we set the default class to product (don't change)
    default_item_class = Product

    # by default the output takes the first value, works for most values that aren't arrays
    default_output_processor = TakeFirst()

    # for the url we just strip it
    url_in = MapCompose(str.strip)

    # same for the platform (espetially since it's set manually)
    platform_in = MapCompose(str.strip)

    # you get the idea
    seller_in = MapCompose(str.strip)

    # We can't really get ratings here
    seller_rating_in = MapCompose(str.strip)

    name_in = MapCompose(str.strip)

    category_in = MapCompose(str.strip)

    file_urls_in = MapCompose(str.strip)
    file_urls_out = Identity()

    # for the prices we only keep the numbers, we remove things like the dong symbol or the dots
    original_price_in = MapCompose(str.strip, keep_only_numbers)
    final_price_in = MapCompose(str.strip, keep_only_numbers)

    # for each text in the description, we strip
    description_in = MapCompose(str.strip)
    # we then join at output to merge into a single text
    description_out = Join(" ")

    # same for the short description
    short_description_in = MapCompose(str.strip)
    short_description_out = Join(" ")

    product_rating_in = MapCompose(str.strip, lambda x: normalize_rating(x, max_value=5.0))

    review_count_in = MapCompose(str.strip, keep_only_numbers)