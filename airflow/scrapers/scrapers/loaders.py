from itemloaders.processors import TakeFirst, MapCompose, Join
from scrapy.loader import ItemLoader
import re

from scrapers.items import Product



def keep_only_numbers(text):
    return re.sub(r"\D", "", text)

# The loaders handle the initial cleaning and formatting of the scrapped data, which is then saved to a 
# Product item and then sent to the corresponding Kafka topic with the Pipeline

class FPTProductLoader(ItemLoader):
    # we set the default class to product (don't change)
    default_item_class = Product

    # by default the output takes the first value, works for most values that aren't arrays
    default_output_processor = TakeFirst()

    # for the name we just strip and then titlecase the name
    name_in = MapCompose(str.strip, str.title)

    # for the prices we only keep the numbers, we remove things like the dong symbol or the dots
    original_price_in = MapCompose(str.strip, keep_only_numbers)
    final_price_in = MapCompose(str.strip, keep_only_numbers)

    # for each text in the description, we strip
    description_in = MapCompose(str.strip)
    # we then join at output to merge into a single text
    description_out = Join(" ")