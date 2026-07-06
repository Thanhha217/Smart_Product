from itemloaders.processors import MapCompose, TakeFirst

from scrapers.base.loader import BaseProductLoader


def normalize_rating(value):
    if value is None:
        return -1

    rating = float(value)

    if rating == -1:
        return -1

    return rating / 5


class TGDDLoader(BaseProductLoader):
    product_rating_in = MapCompose(normalize_rating)
    product_rating_out = TakeFirst()

    seller_rating_in = MapCompose(normalize_rating)
    seller_rating_out = TakeFirst()