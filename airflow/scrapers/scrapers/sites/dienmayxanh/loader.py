import re

from scrapers.base.loader import BaseProductLoader
from itemloaders.processors import MapCompose

def keep_only_numbers(text):
    result = re.sub(r"\D", "", text)
    return int(result) if result else -2


class DienmayxanhLoader(BaseProductLoader):
    days_for_return_in = MapCompose(int)
    warranty_duration_in = MapCompose(keep_only_numbers, lambda val : val * 12)
