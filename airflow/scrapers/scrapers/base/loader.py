import re
from itemloaders.processors import TakeFirst, MapCompose, Join, Identity
from scrapy.loader import ItemLoader
from scrapers.items import Product


def keep_only_numbers(text):
    result = re.sub(r"\D", "", text)
    return int(result) if result else -2


def normalize_rating(rating, max_value):
    value = float(rating)
    if value > max_value:
        raise ValueError(f"Rating {value} exceeds max {max_value}")
    return value / max_value


class BaseProductLoader(ItemLoader):
    default_item_class = Product
    default_output_processor = TakeFirst()

    url_in = MapCompose(str.strip)
    platform_in = MapCompose(str.strip)
    seller_in = MapCompose(str.strip)
    seller_rating_in = MapCompose(str.strip, float)
    name_in = MapCompose(str.strip)
    category_in = MapCompose(str.strip)
    file_urls_in = MapCompose(str.strip)
    file_urls_out = Identity()
    original_price_in = MapCompose(str.strip, keep_only_numbers)
    final_price_in = MapCompose(str.strip, keep_only_numbers)
    description_in = MapCompose(str.strip)
    description_out = Join(" ")
    short_description_in = MapCompose(str.strip)
    short_description_out = Join(" ")
    review_count_in = MapCompose(str.strip, keep_only_numbers)
