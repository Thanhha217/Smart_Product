from scrapers.base.loader import BaseProductLoader, keep_only_numbers, normalize_rating
from itemloaders.processors import MapCompose

class LazadaLoader(BaseProductLoader):
    product_rating_in = MapCompose(keep_only_numbers, lambda x: normalize_rating(x, max_value=5.0))

    seller_rating_in = MapCompose(keep_only_numbers, lambda x: normalize_rating(x, max_value=100.0))
