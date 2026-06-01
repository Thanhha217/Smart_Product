from scrapers.base.loader import BaseProductLoader
from itemloaders.processors import MapCompose

class FptShopLoader(BaseProductLoader):
    days_for_return_in = MapCompose(int)
