from itemloaders.processors import MapCompose
from scrapers.base.loader import BaseProductLoader, normalize_rating


class FptShopLoader(BaseProductLoader):
    product_rating_in = MapCompose(str.strip, lambda x: normalize_rating(x, max_value=5.0))
