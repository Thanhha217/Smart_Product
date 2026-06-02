import json
import re
import unicodedata
from datetime import datetime, timezone
from urllib.parse import urlencode, urlparse

import scrapy
from scrapy.http import HtmlResponse

from scrapers.base.spider import BaseProductSpider
from scrapers.sites.phongvu.loader import PhongVuLoader


class PhongVuSpider(BaseProductSpider):
    name = "phongvu"
    kafka_topic = "phongvu_topic"

    # Phong Vu chan bang Cloudflare nen Scrapy thuong khong vao duoc.
    # Moi request duoc gui qua FlareSolverr (service Docker chay trinh duyet an)
    # de vuot Cloudflare + render JS, roi tra ve HTML that.
    custom_settings = {
        "ITEM_PIPELINES": {
            "scrapers.base.pipeline.KafkaPipeline": 300,
            "scrapy.pipelines.files.FilesPipeline": 1,
        },
        # FlareSolverr tu lo viec tai trang -> tat rotating proxies cho spider nay
        "DOWNLOADER_MIDDLEWARES": {},
        "ROBOTSTXT_OBEY": False,
        "CONCURRENT_REQUESTS": 2,      # FlareSolverr chay browser, dung qua tai
        "DOWNLOAD_TIMEOUT": 180,       # moi request co the mat 30-60s
    }

    FLARESOLVERR_URL = "http://flaresolverr:8191/v1"
    FLARESOLVERR_TIMEOUT = 60000  # ms gui cho FlareSolverr
    FLARESOLVERR_MAX_RETRIES = 2  # so lan thu lai khi trang load hut / con challenge

    CATEGORY_URLS = {
        "laptop": "https://phongvu.vn/c/laptop",
        "smartphone": "https://phongvu.vn/c/dien-thoai-may-tinh-bang-phu-kien",
        "earphone": "https://phongvu.vn/c/thiet-bi-am-thanh",
        "computer_monitor": "https://phongvu.vn/c/man-hinh-may-tinh",
    }

    MAX_PAGES_PER_CATEGORY = 20

    # ---------- FlareSolverr helpers ----------
    def _solve(self, url, callback, meta=None, priority=0):
        """Gui URL cho FlareSolverr de no vuot Cloudflare + render JS ho."""
        payload = {"cmd": "request.get", "url": url, "maxTimeout": self.FLARESOLVERR_TIMEOUT}
        return scrapy.Request(
            self.FLARESOLVERR_URL,
            method="POST",
            body=json.dumps(payload),
            headers={"Content-Type": "application/json"},
            callback=self._unwrap,
            meta={
                **(meta or {}),
                "fs_url": url,
                "fs_callback": callback,
                "fs_priority": priority,
            },
            dont_filter=True,
            priority=priority,
        )

    def _unwrap(self, response):
        """Boc HTML that tu ket qua FlareSolverr roi chuyen cho callback that."""
        try:
            data = json.loads(response.text)
        except json.JSONDecodeError:
            return self._maybe_retry(response, "FlareSolverr tra ve khong phai JSON")

        solution = data.get("solution") or {}
        html = solution.get("response", "")
        low = html.lower()
        is_challenge = "just a moment" in low or "challenge-platform" in low
        if data.get("status") != "ok" or not html or is_challenge:
            return self._maybe_retry(response, data.get("message") or "con challenge")

        page = HtmlResponse(
            url=response.meta["fs_url"],
            body=html,
            encoding="utf-8",
            request=response.request,
        )
        return response.meta["fs_callback"](page)

    def _maybe_retry(self, response, reason):
        """Thu lai 1 URL qua FlareSolverr neu chua het luot, het thi bo qua (khong lam chet ca me)."""
        retries = response.meta.get("fs_retries", 0)
        url = response.meta.get("fs_url")
        if retries >= self.FLARESOLVERR_MAX_RETRIES:
            self.logger.warning("Bo qua sau %d lan thu: %s (%s)", retries, url, reason)
            return None
        biz_meta = {"fs_retries": retries + 1}
        if "category" in response.meta:
            biz_meta["category"] = response.meta["category"]
        if "page" in response.meta:
            biz_meta["page"] = response.meta["page"]
        self.logger.info("Thu lai lan %d: %s (%s)", retries + 1, url, reason)
        return self._solve(
            url,
            response.meta["fs_callback"],
            biz_meta,
            priority=response.meta.get("fs_priority", 0),
        )

    async def start(self):
        for category, url in self.CATEGORY_URLS.items():
            yield self._solve(url, self.parse, {"category": category, "page": 1})

    def parse(self, response):
        category = response.meta.get("category")
        page = response.meta.get("page", 1)

        raw_links = response.css("a::attr(href)").getall()
        product_links = []
        seen_links = set()
        for link in raw_links:
            if "--s" not in link:
                continue
            absolute_link = response.urljoin(link)
            if absolute_link in seen_links:
                continue
            seen_links.add(absolute_link)
            product_links.append(absolute_link)

        if not product_links:
            self.logger.warning("No product links found on %s", response.url)
            return

        for link in product_links:
            yield self._solve(
                link,
                self.parse_product,
                {"category": category},
                priority=100,
            )

        if page < self.MAX_PAGES_PER_CATEGORY:
            next_page = page + 1
            parsed = urlparse(response.url)
            base = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            yield self._solve(
                f"{base}?{urlencode({'page': next_page})}",
                self.parse,
                {"category": category, "page": next_page},
                priority=-100,
            )

    def parse_product(self, response):
        loader = PhongVuLoader(response=response)

        loader.add_value("url", response.url)
        loader.add_value("platform", "Phong Vu")
        loader.add_value("seller", "Phong Vu")
        loader.add_value("seller_rating", "-1")
        loader.add_value("category", response.meta.get("category", ""))

        loader.add_css("name", "h1::text")

        product_ld = self._extract_product_jsonld(response)
        next_data = self._extract_next_data(response)
        price_block = self._find_price_block(next_data) if next_data else None
        product_block = self._find_product_block(next_data) if next_data else None

        # Neu trang load hut (khong ten, khong JSON) -> thu lai thay vi luu item rong
        if not response.css("h1::text").get() and not next_data and not product_ld:
            retries = response.meta.get("fs_retries", 0)
            if retries < self.FLARESOLVERR_MAX_RETRIES:
                self.logger.info("San pham load hut, thu lai: %s", response.url)
                yield self._solve(
                    response.url,
                    self.parse_product,
                    {"category": response.meta.get("category", ""), "fs_retries": retries + 1},
                    priority=100,
                )
            return

        final_price_value = None
        if price_block:
            final = price_block.get("price")
            retail = price_block.get("supplierRetailPrice")
            if final is not None:
                final_price_value = final
                loader.add_value("final_price", str(final))
            if retail is not None and retail > 0:
                loader.add_value("original_price", str(retail))
            elif final is not None:
                loader.add_value("original_price", str(final))
        elif product_ld:
            price = product_ld.get("offers", {}).get("price")
            if price is not None:
                final_price_value = price
                loader.add_value("final_price", str(price))
                loader.add_value("original_price", str(price))

        if product_ld:
            image = product_ld.get("image")
            if image:
                images = image if isinstance(image, list) else [image]
                loader.add_value("file_urls", images[:2])

        if product_block:
            desc_html = product_block.get("description")
            short_html = product_block.get("shortDescription")
            if desc_html:
                loader.add_value("description", self._strip_html(desc_html))
            if short_html:
                loader.add_value("short_description", self._strip_html(short_html))
        elif product_ld:
            description = product_ld.get("description")
            if description:
                loader.add_value("description", description)
                loader.add_value("short_description", description)

        if product_ld:
            rating = product_ld.get("aggregateRating") or {}
            rv = rating.get("ratingValue")
            rc = rating.get("reviewCount")
            if rv is not None:
                loader.add_value("product_rating", str(rv))
            if rc is not None:
                loader.add_value("review_count", str(rc))

        visible_text = response.xpath(
            "//body//text()[not(ancestor::script) and not(ancestor::style)]"
        ).getall()
        page_text = self._normalize_text(" ".join(visible_text))

        free_delivery = self._extract_free_delivery(page_text, final_price_value)
        loader.add_value("free_delivery", free_delivery)

        return_days = self._extract_return_days(page_text)
        loader.add_value("days_for_return", str(return_days if return_days is not None else 10))

        warranty_text = self._extract_warranty_text(response, next_data, page_text)
        warranty_months = self._extract_warranty_months(warranty_text)
        if warranty_months is not None:
            loader.add_value("warranty_duration", str(warranty_months))
        else:
            self.logger.warning("Could not extract warranty duration from %s", response.url)

        loader.add_value("scraped_at", datetime.now(timezone.utc).timestamp())
        yield loader.load_item()

    @staticmethod
    def _extract_product_jsonld(response):
        for raw in response.css('script[type="application/ld+json"]::text').getall():
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if isinstance(data, dict) and data.get("@type") == "Product":
                return data
            if isinstance(data, list):
                for entry in data:
                    if isinstance(entry, dict) and entry.get("@type") == "Product":
                        return entry
        return None

    @staticmethod
    def _extract_next_data(response):
        raw = response.css("script#__NEXT_DATA__::text").get()
        if not raw:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None

    @staticmethod
    def _find_price_block(node):
        if isinstance(node, dict):
            block = node.get("priceAndPromotions")
            if isinstance(block, dict) and "price" in block:
                return block
            for value in node.values():
                found = PhongVuSpider._find_price_block(value)
                if found:
                    return found
        elif isinstance(node, list):
            for item in node:
                found = PhongVuSpider._find_price_block(item)
                if found:
                    return found
        return None

    @staticmethod
    def _find_product_block(node):
        if isinstance(node, dict):
            desc = node.get("description")
            short = node.get("shortDescription")
            if isinstance(desc, str) and isinstance(short, str):
                return node
            for value in node.values():
                found = PhongVuSpider._find_product_block(value)
                if found:
                    return found
        elif isinstance(node, list):
            for item in node:
                found = PhongVuSpider._find_product_block(item)
                if found:
                    return found
        return None

    @staticmethod
    def _strip_html(html):
        if not html:
            return ""
        texts = scrapy.Selector(text=html).xpath("//text()").getall()
        return " ".join(t.strip() for t in texts if t.strip())

    @staticmethod
    def _normalize_text(text):
        text = " ".join((text or "").split()).lower()
        decomposed = unicodedata.normalize("NFD", text)
        return "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")

    @classmethod
    def _extract_spec_value(cls, response, labels):
        label_set = tuple(cls._normalize_text(label) for label in labels)
        text_nodes = response.xpath(
            "//body//*[not(self::script) and not(self::style)]"
            "/text()[normalize-space()]"
        )

        for text_node in text_nodes:
            label_text = cls._normalize_text(text_node.get())
            if not any(label in label_text for label in label_set):
                continue

            label_element = text_node.xpath("parent::*")
            sibling_text = label_element.xpath(
                "following-sibling::*[1]//text()[normalize-space()]"
            ).getall()
            sibling_value = " ".join(t.strip() for t in sibling_text if t.strip())
            if sibling_value:
                return sibling_value

            parent_children = label_element.xpath("../*")
            seen_label = False
            for child in parent_children:
                child_text = " ".join(
                    t.strip()
                    for t in child.xpath(".//text()[normalize-space()]").getall()
                    if t.strip()
                )
                if not child_text:
                    continue
                if child.root is label_element.root:
                    seen_label = True
                    continue
                if seen_label:
                    return child_text

        return None

    @classmethod
    def _extract_warranty_text(cls, response, next_data, page_text):
        spec_value = cls._extract_spec_value(response, ("bao hanh", "warranty"))
        if spec_value:
            return spec_value

        json_value = cls._find_labeled_value_in_json(next_data, ("bao hanh", "warranty"))
        if json_value:
            return json_value

        return page_text

    @classmethod
    def _find_labeled_value_in_json(cls, node, labels):
        label_set = tuple(cls._normalize_text(label) for label in labels)
        label_keys = (
            "label",
            "name",
            "title",
            "displayName",
            "specName",
            "attributeName",
            "key",
        )
        value_keys = (
            "value",
            "text",
            "content",
            "displayValue",
            "specValue",
            "attributeValue",
        )

        if isinstance(node, dict):
            for key, value in node.items():
                normalized_key = cls._normalize_text(str(key))
                if any(label in normalized_key for label in label_set) and isinstance(
                    value, (str, int, float)
                ):
                    return str(value)

            for label_key in label_keys:
                label_value = node.get(label_key)
                if not isinstance(label_value, str):
                    continue
                normalized_label = cls._normalize_text(label_value)
                if not any(label in normalized_label for label in label_set):
                    continue
                for value_key in value_keys:
                    value = node.get(value_key)
                    if isinstance(value, (str, int, float)):
                        return str(value)

            for value in node.values():
                found = cls._find_labeled_value_in_json(value, labels)
                if found:
                    return found
        elif isinstance(node, list):
            for item in node:
                found = cls._find_labeled_value_in_json(item, labels)
                if found:
                    return found

        return None

    @staticmethod
    def _extract_return_days(text):
        patterns = (
            r"doi\s*/?\s*tra[^\d]{0,30}(\d{1,3})\s*ngay",
            r"(\d{1,3})\s*ngay[^\d]{0,20}doi\s*/?\s*tra",
        )
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return int(match.group(1))
        return None

    @staticmethod
    def _extract_free_delivery(text, final_price=None):
        patterns = (
            r"mien\s*phi[^\n.]{0,40}(giao\s*hang|van\s*chuyen)",
            r"(giao\s*hang|van\s*chuyen)[^\n.]{0,40}mien\s*phi",
            r"\bfree\s*ship\b",
            r"\bfreeship\b",
        )
        if not any(re.search(pattern, text) for pattern in patterns):
            return False

        threshold_match = re.search(
            r"mien\s*phi[^\n]{0,80}(?:tu|tren|>=)\s*([\d.,]+)\s*(trieu|nghin|k|d|dong)?",
            text,
        )
        if threshold_match and final_price is not None:
            threshold = PhongVuSpider._parse_vnd_amount(
                threshold_match.group(1),
                threshold_match.group(2),
            )
            if threshold is not None:
                return int(final_price) >= threshold

        return True

    @staticmethod
    def _parse_vnd_amount(number, unit=None):
        digits = re.sub(r"\D", "", number or "")
        if not digits:
            return None
        value = int(digits)
        unit = (unit or "").lower()
        if unit == "trieu":
            return value * 1_000_000
        if unit in {"nghin", "k"}:
            return value * 1_000
        return value

    @staticmethod
    def _extract_warranty_months(text):
        text = PhongVuSpider._normalize_text(text)
        if re.search(r"\b(khong|ko)\s+bao\s*hanh\b", text):
            return 0
        match = re.search(r"(?:bao\s*hanh)?[^\d]{0,30}(\d{1,2})\s*(thang|nam)", text)
        if not match:
            return None
        value = int(match.group(1))
        return value * 12 if match.group(2) == "nam" else value
