import logging
import time

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

logger = logging.getLogger(__name__)

LISTING_URL = "https://www.dienmayxanh.com/dien-thoai"
LOAD_MORE_SELECTOR = ".view-more a"
PRODUCT_LINK_SELECTOR = ".main-contain"


def _build_driver() -> webdriver.Chrome:
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    return webdriver.Chrome(options=options)


def _extract_item(element) -> dict | None:
    url = element.get_attribute("href")
    if not url:
        return None
    price_raw = element.get_attribute("data-price")
    price = str(int(float(price_raw))) if price_raw else None
    try:
        img_el = element.find_element(By.CSS_SELECTOR, ".item-img img")
        img_url = img_el.get_attribute("src") or img_el.get_attribute("data-src")
    except Exception:
        img_url = None
    return {
        "url": url,
        "name": element.get_attribute("data-name"),
        "final_price": price,
        "category": element.get_attribute("data-cate"),
        "brand": element.get_attribute("data-brand"),
        "file_urls": [img_url] if img_url else [],
    }


def get_listing_items() -> list[dict]:
    logger.info("[selenium_listing] Starting get_listing_items()")
    try:
        driver = _build_driver()
        logger.info("[selenium_listing] Chrome driver built successfully")
    except Exception as e:
        logger.error(f"[selenium_listing] Failed to build Chrome driver: {e}")
        return []

    seen_urls: set[str] = set()
    items: list[dict] = []

    def collect_current_items():
        elements = driver.find_elements(By.CSS_SELECTOR, PRODUCT_LINK_SELECTOR)
        before = len(items)
        for el in elements:
            item = _extract_item(el)
            if item and item["url"] not in seen_urls:
                seen_urls.add(item["url"])
                items.append(item)
        logger.info(f"[selenium_listing] Collected {len(items)} items total (+{len(items) - before} new)")

    try:
        driver.get(LISTING_URL)
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, PRODUCT_LINK_SELECTOR))
        )

        collect_current_items()

        click_count = 0
        while True:
            try:
                load_more = WebDriverWait(driver, 3).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, LOAD_MORE_SELECTOR))
                )
                driver.execute_script("arguments[0].click();", load_more)
                click_count += 1
                time.sleep(3)
                collect_current_items()
            except Exception:
                logger.info(f"[selenium_listing] Load-more done after {click_count} clicks")
                break

        logger.info(f"[selenium_listing] Final total: {len(items)} unique items")

    except Exception as e:
        logger.error(f"[selenium_listing] Error during scraping: {e}", exc_info=True)
    finally:
        driver.quit()

    return items
