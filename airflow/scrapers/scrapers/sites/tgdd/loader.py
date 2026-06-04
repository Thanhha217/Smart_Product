import re

from itemloaders.processors import MapCompose, TakeFirst

from scrapers.base.loader import BaseProductLoader


def keep_original_rating(value):
    if value is None:
        return 0.0

    value = str(value).replace(",", ".")
    match = re.search(r"\d+(\.\d+)?", value)

    if not match:
        return 0.0

    rating = float(match.group(0))

    if 0 <= rating <= 5:
        return rating

    return 0.0


class TGDDLoader(BaseProductLoader):
    # Override BaseProductLoader so TGDD rating stays in the original 0–5 scale.
    product_rating_in = MapCompose(keep_original_rating)
    product_rating_out = TakeFirst()