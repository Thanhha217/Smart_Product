import json
import os
import re
import threading

import faiss
import numpy as np
import requests
from sqlmodel import Session, select

from data import engine
from data.schemes.carbon_reference import CarbonReference
from data.schemes.product import Product
from data.process.data_transformer import encode_text
from green.fallback import CategoryStats, canonical_category, estimate_without_neighbours

EMBED_DIM = 512          # Dimensionality of the CLIP text embedding vectors
TOP_K = 5               # Number of candidate neighbours retrieved from the FAISS index before similarity filtering
LLM_MODEL = os.environ.get("CO2E_LLM_MODEL", "qwen3.5:0.8b")
# The number comes from reference products (or green.fallback), never from the LLM
# unless this is set to 1 -- then Qwen may adjust the average of the close neighbours,
# as in the paper experiments.  Without close neighbours the LLM is never asked.
USE_LLM = os.environ.get("CO2E_USE_LLM", "0") == "1"
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://ollama:11434")
OLLAMA_KEEP_ALIVE = os.environ.get("OLLAMA_KEEP_ALIVE", "30m")
PROMPT_NEIGHBOURS = 5   # Maximum number of close neighbours shown to the LLM in the anchored prompt

# ---------------------------------------------------------------------------
# SIMILARITY_THRESHOLD
# ---------------------------------------------------------------------------
# Cosine similarity gate that separates "semantically close" neighbours from
# unrelated ones.  The FAISS index uses inner-product on L2-normalised vectors,
# so scores lie in [−1, 1] and are equivalent to cosine similarity.
#
# Empirically, products from the same physical category (e.g. all laptops)
# score ≥ 0.66 against one another, while cross-category pairs (e.g. a laptop
# query matched against monitor references) typically score < 0.65.
#
# When a product has NO neighbours above this threshold the estimator does not
# guess with the LLM any more: green.fallback tries, in order, the lifecycle
# formula (appliances), the category model of the reference catalogue (brand +
# screen size) and the price-based EEIO factor, and leaves the product empty when
# none applies.  See docs/research/co2-fallback.md.
SIMILARITY_THRESHOLD = 0.66

# ---------------------------------------------------------------------------
# CATEGORY_BOUNDS
# ---------------------------------------------------------------------------
# Hard plausibility gates (min_kg, max_kg) applied after LLM inference.
# If the model output falls outside these bounds the estimate is DISCARDED and
# the pipeline falls back to the close-neighbour average (if any), or skips.
#
# Methodological basis (cradle-to-grave, ISO 14067 scope):
#   • Smartphones:  Apple / Google / Samsung environmental reports (2021-2024)
#                   typical range 40–100 kg; upper bound generously set at 200
#                   to accommodate foldables and niche high-end devices.
#   • Laptops:      Dell, Lenovo, Apple, Asus PCF datasheets (PAIA methodology)
#                   range 120–450 kg for consumer; up to 800 for workstations.
#   • Gaming laptops: same methodology, higher TDP/components push range higher.
#   • Monitors:     Dell U-series / P-series PCF reports; 27" ≈ 500–900 kg.
#   • Tablets:      Apple iPad / Samsung Tab reports; 65–155 kg.
#   • Headphones/earphones: Apple AirPods report (13 kg); typical range 2–50 kg.
#   • Desktops:     PAIA estimates for tower PCs; 300–1 200 kg depending on GPU.
#   • Speakers:     Portable BT speakers ≈ 5–40 kg; larger soundbars up to 100.
#   • Smartwatches: Apple Watch reports ≈ 30–70 kg; Samsung slightly higher.
#   • Wearables:    Fitness bands are lighter; generous upper 60 kg.
#   • Cameras:      DSLR / mirrorless bodies 40–200 kg; with heavy lenses higher.
#   • Gaming consoles: PS5/Xbox Series X reports ≈ 70–120 kg.
#   • TVs:          32"–65" range 200–700 kg based on IEC TR 62921 estimates.
#   • Refrigerators, washing machines, ACs: major appliance LCAs 100–1 500 kg.
#   • Smaller appliances (fans, rice cookers, blenders): 5–150 kg.
#   • Networking gear (routers, switches): 20–200 kg.
#   • PC components: highly variable; GPU alone can be 50–300 kg.
#   • Non-electronic categories (fashion, books, beauty, etc.): typically 0.1–30 kg
#     but bounds are set permissively to avoid blocking unusual high-end goods.
#
# Bounds are intentionally wide.  The goal is only to catch catastrophic
# hallucinations (e.g. 300 kg for a headset), not to constrain fine-grained
# variation within a category.
CATEGORY_BOUNDS: dict[str, tuple[float, float]] = {
    # --- Electronics & Tech ---------------------------------------------------
    "smartphone":           (10,    200),   # incl. foldables
    "feature_phone":        (5,     80),    # simpler hardware → lower footprint
    "laptop":               (60,    800),
    "gaming_laptop":        (80,    900),   # higher TDP, more RAM/storage
    "tablet":               (20,    300),
    "desktop":              (100,  1500),   # towers with discrete GPUs
    "computer_monitor":     (50,   2000),   # 21"–49" ultrawide
    "pc_component":         (5,    500),    # single component (GPU, RAM, SSD…)
    "computer_peripheral":  (1,    150),    # mouse, keyboard, webcam, hub…
    "networking":           (5,    200),    # routers, switches, mesh nodes
    "smartwatch":           (10,    120),
    "wearable":             (2,     80),    # fitness bands, trackers
    "headphone":            (1,     80),    # over-ear, on-ear, earbuds, IEMs
    "speaker":              (1,    150),    # portable BT speakers → soundbars
    "phone_accessory":      (0.5,   50),    # cases, cables, chargers, screen protectors
    "camera":               (20,   300),    # body only; lens/kit sets higher
    "drone":                (10,   200),    # consumer drones; professional higher
    "gaming_console":       (20,   250),    # current-gen home consoles + handhelds
    # --- Home Appliances ------------------------------------------------------
    "television":           (50,   800),    # 32"–85" smart TVs
    "refrigerator":         (200, 1500),    # single-door → side-by-side
    "washing_machine":      (150, 1000),
    "clothes_dryer":        (150,  800),
    "air_conditioner":      (100, 1200),    # split / inverter units
    "electric_fan":         (5,   100),
    "air_purifier":         (20,  200),
    "water_purifier":       (20,  200),
    "vacuum_cleaner":       (15,  200),     # incl. robot vacuums
    "rice_cooker":          (5,   150),     # incl. air fryers, pressure cookers
    "microwave_oven":       (20,  250),
    "blender_juicer":       (5,   100),
    "stove":                (20,  300),     # electric / induction hobs
    "lighting":             (1,    50),     # LED bulbs, desk lamps
    "smart_home":           (5,   150),     # smart locks, sensors, security cams
    # --- Books & Stationery ---------------------------------------------------
    "book":                 (0.5,  10),     # per-volume; paperback < hardcover
    "stationery":           (0.1,  30),
    "arts_craft":           (0.5,  20),
    # --- Sports & Health ------------------------------------------------------
    "sports_equipment":     (1,   200),     # wide range: ball → treadmill
    "fitness_equipment":    (5,   500),     # dumbbells → rowing machine
    "sportswear":           (1,    20),
    "sports_shoe":          (2,    30),
    "supplement":           (0.1,  10),     # powder/capsule packaging-dominated
    "medical_device":       (2,   100),     # BP monitors, glucometers
    "bicycle":              (20,  300),     # pedal bikes; e-bikes higher
    # --- Fashion --------------------------------------------------------------
    "fashion_clothing":     (1,    30),
    "shoe":                 (2,    30),
    "bag":                  (2,    40),
    "jewelry":              (0.5,  30),
    # --- Beauty & Personal Care -----------------------------------------------
    "makeup":               (0.1,  10),
    "skincare":             (0.1,  10),
    "hair_care":            (0.1,   8),
    "perfume":              (0.5,  10),
    "personal_care":        (0.1,   8),
    "beauty_tool":          (1,    50),     # hair dryers, straighteners
    # --- Family, Home & Other -------------------------------------------------
    "toy":                  (0.5,  50),
    "mom_baby":             (0.5,  80),
    "pet_supply":           (0.1,  20),
    "food_beverage":        (0.05, 10),     # per-item / per-package
    "home_furniture":       (5,   500),
    "automotive_accessory": (0.5, 100),
}

# ---------------------------------------------------------------------------
# _REF_CATEGORY_LABEL
# ---------------------------------------------------------------------------
# Maps internal reference-category keys to plain-English strings that are
# injected into the LLM prompt when operating in "unanchored mode" (i.e. when
# no reference product with sufficient embedding similarity is available).
#
# The label deliberately uses common English terminology (e.g. "laptop /
# notebook computer") rather than the internal slug so the LLM — which was
# trained on English corpora — reliably recognises the product type.
_REF_CATEGORY_LABEL: dict[str, str] = {
    # Electronics
    "smartphone":           "smartphone",
    "feature_phone":        "basic / feature phone",
    "laptop":               "laptop / notebook computer",
    "gaming_laptop":        "gaming laptop",
    "tablet":               "tablet",
    "desktop":              "desktop computer",
    "computer_monitor":     "computer monitor / display",
    "pc_component":         "PC component (e.g. GPU, RAM, SSD, CPU, PSU)",
    "computer_peripheral":  "computer peripheral (e.g. mouse, keyboard, webcam)",
    "networking":           "networking equipment (e.g. router, switch, modem)",
    "smartwatch":           "smartwatch",
    "wearable":             "wearable / fitness band",
    "headphone":            "headphone / earphone / earbuds",
    "speaker":              "speaker (portable Bluetooth speaker or soundbar)",
    "phone_accessory":      "phone accessory (e.g. case, cable, charger, power bank)",
    "camera":               "camera (DSLR, mirrorless, or action cam)",
    "drone":                "drone / flying camera",
    "gaming_console":       "gaming console",
    # Appliances
    "television":           "television (smart TV)",
    "refrigerator":         "refrigerator / freezer",
    "washing_machine":      "washing machine",
    "clothes_dryer":        "clothes dryer",
    "air_conditioner":      "air conditioner",
    "electric_fan":         "electric fan",
    "air_purifier":         "air purifier / dehumidifier",
    "water_purifier":       "water purifier / water dispenser",
    "vacuum_cleaner":       "vacuum cleaner / robot vacuum",
    "rice_cooker":          "rice cooker / air fryer / pressure cooker",
    "microwave_oven":       "microwave or oven",
    "blender_juicer":       "blender / juicer / food processor",
    "stove":                "electric or induction stove / hob",
    "lighting":             "light bulb / desk lamp / LED fixture",
    "smart_home":           "smart home device (security camera, smart lock, sensor)",
    # Books & Stationery
    "book":                 "book (printed)",
    "stationery":           "stationery / office supply",
    "arts_craft":           "arts and crafts supply",
    # Sports & Health
    "sports_equipment":     "sports equipment",
    "fitness_equipment":    "fitness / gym equipment",
    "sportswear":           "sportswear / athletic clothing",
    "sports_shoe":          "sports shoe / sneaker",
    "supplement":           "health supplement / vitamin",
    "medical_device":       "home medical device (blood pressure monitor, thermometer)",
    "bicycle":              "bicycle",
    # Fashion
    "fashion_clothing":     "clothing / garment",
    "shoe":                 "shoe / footwear",
    "bag":                  "bag / wallet / backpack",
    "jewelry":              "jewelry / fashion accessory",
    # Beauty
    "makeup":               "makeup / cosmetic",
    "skincare":             "skincare product",
    "hair_care":            "hair care product",
    "perfume":              "perfume / fragrance",
    "personal_care":        "personal care product (toothpaste, body wash, deodorant)",
    "beauty_tool":          "beauty tool (hair dryer, straightener, makeup brush)",
    # Family & Home
    "toy":                  "toy / children's plaything",
    "mom_baby":             "baby / toddler product",
    "pet_supply":           "pet supply / pet food",
    "food_beverage":        "food or beverage (packaged)",
    "home_furniture":       "home furniture / home décor / bedding",
    "automotive_accessory": "automotive / motorbike accessory",
}

# ---------------------------------------------------------------------------
# _SLUG_TO_REF
# ---------------------------------------------------------------------------
# Maps taxonomy slugs and their common name_en / name_vi lowercase forms to
# the internal reference-category keys used by CATEGORY_BOUNDS and
# _REF_CATEGORY_LABEL.
#
# Design notes:
#   • Multiple taxonomy slugs can map to the same reference category when the
#     distinction is not meaningful for LCA purposes (e.g. "laptops" and
#     "gaming_laptops" both map to "laptop" because the reference seed covers
#     both classes and the FAISS index will naturally surface the closest match).
#   • For categories without dedicated reference data in the seed, the mapping
#     still provides CATEGORY_BOUNDS and _REF_CATEGORY_LABEL information so the
#     unanchored LLM prompt receives a meaningful prior range.
#   • Keys are stored lowercase; _normalize_to_ref_category() applies .lower()
#     before lookup so casing differences in the ingested category name_en are
#     handled transparently.
_SLUG_TO_REF: dict[str, str] = {
    # ── Electronics & Tech ────────────────────────────────────────────────────
    # Smartphones & feature phones
    "smartphones":              "smartphone",
    "feature_phones":           "feature_phone",
    "smartphone":               "smartphone",       # passthrough (ref-seed key)
    "feature_phone":            "feature_phone",
    "mobile phone":             "smartphone",
    # Laptops & desktops
    "laptops":                  "laptop",
    "gaming_laptops":           "gaming_laptop",
    "laptop":                   "laptop",           # passthrough
    "gaming_laptops":           "gaming_laptop",
    "gaming laptop":            "gaming_laptop",
    "gaming laptops":           "gaming_laptop",
    "notebook":                 "laptop",
    "desktops":                 "desktop",
    "desktops & pcs":           "desktop",
    "desktop":                  "desktop",          # passthrough
    # Tablets
    "tablets":                  "tablet",
    "tablet":                   "tablet",           # passthrough
    # Monitors
    "monitors":                 "computer_monitor",
    "computer_monitor":         "computer_monitor", # passthrough
    "monitor":                  "computer_monitor",
    # PC components & peripherals
    "pc_components":            "pc_component",
    "pc components":            "pc_component",
    "computer_peripherals":     "computer_peripheral",
    "computer peripherals":     "computer_peripheral",
    # Networking
    "networking":               "networking",
    "networking equipment":     "networking",
    # Wearables
    "smartwatches":             "smartwatch",
    "smartwatch":               "smartwatch",
    "wearables":                "wearable",
    "wearables & fitness bands":"wearable",
    "wearable":                 "wearable",
    # Audio
    "headphones":               "headphone",
    "headphones & earbuds":     "headphone",
    "headphone":                "headphone",
    "earphone":                 "headphone",        # seed uses "earphone" but same bounds
    "earphones":                "headphone",
    "speakers":                 "speaker",
    "speaker":                  "speaker",
    # Phone accessories
    "phone_accessories":        "phone_accessory",
    "phone accessories":        "phone_accessory",
    # Cameras & drones
    "cameras":                  "camera",
    "camera":                   "camera",
    "drones":                   "drone",
    "drone":                    "drone",
    # Gaming consoles
    "gaming_consoles":          "gaming_console",
    "gaming consoles & accessories": "gaming_console",
    "gaming console":           "gaming_console",
    # Software (digital; no physical footprint → no meaningful LCA bounds)
    # Intentionally omitted so the estimator skips it gracefully.

    # ── Home Appliances ───────────────────────────────────────────────────────
    "televisions":              "television",
    "television":               "television",
    "tivi":                     "television",
    "refrigerators":            "refrigerator",
    "refrigerator":             "refrigerator",
    "washing_machines":         "washing_machine",
    "washing machines":         "washing_machine",
    "washing machine":          "washing_machine",
    "clothes_dryers":           "clothes_dryer",
    "clothes dryers":           "clothes_dryer",
    "clothes dryer":            "clothes_dryer",
    "air_conditioners":         "air_conditioner",
    "air conditioners":         "air_conditioner",
    "air conditioner":          "air_conditioner",
    "electric_fans":            "electric_fan",
    "electric fans":            "electric_fan",
    "electric fan":             "electric_fan",
    "air_purifiers":            "air_purifier",
    "air purifiers":            "air_purifier",
    "air purifier":             "air_purifier",
    "water_purifiers":          "water_purifier",
    "water purifiers":          "water_purifier",
    "water purifier":           "water_purifier",
    "vacuum_cleaners":          "vacuum_cleaner",
    "vacuum cleaners":          "vacuum_cleaner",
    "vacuum cleaner":           "vacuum_cleaner",
    "rice_cookers":             "rice_cooker",
    "rice cookers & pressure cookers": "rice_cooker",
    "rice cooker":              "rice_cooker",
    "microwaves_ovens":         "microwave_oven",
    "microwaves & ovens":       "microwave_oven",
    "microwave":                "microwave_oven",
    "blenders_juicers":         "blender_juicer",
    "blenders & juicers":       "blender_juicer",
    "blender":                  "blender_juicer",
    "stoves":                   "stove",
    "electric & induction stoves": "stove",
    "stove":                    "stove",
    "lighting":                 "lighting",
    "smart_home":               "smart_home",
    "smart home devices":       "smart_home",

    # ── Books & Stationery ────────────────────────────────────────────────────
    "books_vi":                 "book",
    "books_foreign":            "book",
    "vietnamese books":         "book",
    "foreign language books":   "book",
    "book":                     "book",
    "stationery":               "stationery",
    "stationery & office supplies": "stationery",
    "arts_crafts":              "arts_craft",
    "arts & crafts":            "arts_craft",

    # ── Sports & Health ───────────────────────────────────────────────────────
    "sports_equipment":         "sports_equipment",
    "sports equipment":         "sports_equipment",
    "fitness_equipment":        "fitness_equipment",
    "fitness & gym equipment":  "fitness_equipment",
    "sportswear":               "sportswear",
    "sports_shoes":             "sports_shoe",
    "sports shoes":             "sports_shoe",
    "sports shoe":              "sports_shoe",
    "supplements":              "supplement",
    "health supplements":       "supplement",
    "medical_devices":          "medical_device",
    "home medical devices":     "medical_device",
    "bicycles":                 "bicycle",
    "bicycles & accessories":   "bicycle",

    # ── Fashion ───────────────────────────────────────────────────────────────
    "fashion_men":              "fashion_clothing",
    "fashion_women":            "fashion_clothing",
    "fashion_kids":             "fashion_clothing",
    "men's fashion":            "fashion_clothing",
    "women's fashion":          "fashion_clothing",
    "kids' fashion":            "fashion_clothing",
    "underwear":                "fashion_clothing",
    "underwear & sleepwear":    "fashion_clothing",
    "shoes":                    "shoe",
    "bags":                     "bag",
    "bags & wallets":           "bag",
    "jewelry":                  "jewelry",
    "jewelry & fashion accessories": "jewelry",

    # ── Beauty & Personal Care ────────────────────────────────────────────────
    "makeup":                   "makeup",
    "skincare":                 "skincare",
    "hair_care":                "hair_care",
    "hair care":                "hair_care",
    "perfumes":                 "perfume",
    "perfume":                  "perfume",
    "personal_care":            "personal_care",
    "personal care":            "personal_care",
    "beauty_tools":             "beauty_tool",
    "beauty tools":             "beauty_tool",

    # ── Family, Home & Other ──────────────────────────────────────────────────
    "toys":                     "toy",
    "toy":                      "toy",
    "mom_baby":                 "mom_baby",
    "mom & baby supplies":      "mom_baby",
    "pet_supplies":             "pet_supply",
    "pet supplies":             "pet_supply",
    "food_beverages":           "food_beverage",
    "food & beverages":         "food_beverage",
    "home_furniture":           "home_furniture",
    "home & furniture":         "home_furniture",
    "automotive":               "automotive_accessory",
}

_lock = threading.Lock()
_ref_index = None
_ref_by_id = None
_category_stats = None  # green.fallback.CategoryStats, built with the index


def _reference_text(ref):
    return f"{ref.brand or ''} {ref.name} {ref.category}".strip()


def _build_reference_index():
    global _ref_index, _ref_by_id, _category_stats
    if _ref_index is not None:
        return
    with _lock:
        if _ref_index is not None:
            return
        with Session(engine) as session:
            references = session.exec(select(CarbonReference)).all()
        index = faiss.IndexIDMap2(faiss.IndexFlatIP(EMBED_DIM))
        by_id = {}
        if references:
            vectors, ids = [], []
            for ref in references:
                vectors.append(encode_text(_reference_text(ref)))
                ids.append(ref.id)
                by_id[ref.id] = {
                    "name": ref.name,
                    "category": canonical_category(ref.category),
                    "brand": ref.brand,
                    "co2e_kg": ref.co2e_kg,
                }
            matrix = np.asarray(vectors, dtype="float32")
            faiss.normalize_L2(matrix)
            index.add_with_ids(matrix, np.asarray(ids, dtype=np.int64))
        _category_stats = CategoryStats.from_references(by_id.values())
        _ref_index = index
        _ref_by_id = by_id
        print(f"Carbon reference index built with {len(by_id)} products.", flush=True)


def _find_similar_references(product_embedding, category=None, k=TOP_K):
    """Return list of (neighbour_dict, cosine_similarity_score)."""
    _build_reference_index()
    if _ref_index is None or not _ref_by_id:
        return []
    query = np.asarray([product_embedding], dtype="float32")
    faiss.normalize_L2(query)
    pool = min(len(_ref_by_id), max(k * 6, 30))
    scores, ids = _ref_index.search(query, pool)
    scored = [
        (_ref_by_id[int(i)], float(s))
        for i, s in zip(ids[0], scores[0])
        if int(i) in _ref_by_id
    ]
    if category:
        same = [(r, s) for r, s in scored if r["category"] == category]
        if len(same) >= k:
            return same[:k]
        return (same + [(r, s) for r, s in scored if r["category"] != category])[:k]
    return scored[:k]


def _sanitize_neighbours(scored_neighbours):
    """Filter out CO2e outliers. Input/output: list of (neighbour_dict, score)."""
    if not scored_neighbours or len(scored_neighbours) < 2:
        return scored_neighbours
    values = sorted([n["co2e_kg"] for n, _ in scored_neighbours])
    median_val = values[len(values) // 2]
    filtered = [
        (n, s) for n, s in scored_neighbours
        if (median_val / 8.0) <= n["co2e_kg"] <= (median_val * 8.0)
    ]
    return filtered if filtered else scored_neighbours


def _split_by_similarity(scored_neighbours, threshold=SIMILARITY_THRESHOLD):
    """Split into close neighbours (score >= threshold) and distant ones."""
    close = [(n, s) for n, s in scored_neighbours if s >= threshold]
    distant = [(n, s) for n, s in scored_neighbours if s < threshold]
    return close, distant


def _neighbour_average(scored_neighbours):
    """Average CO2e over a list of (neighbour_dict, score)."""
    return sum(n["co2e_kg"] for n, _ in scored_neighbours) / len(scored_neighbours)


def _normalize_to_ref_category(category: str | None) -> str | None:
    """Map a taxonomy slug or name_en to a carbon-reference category string."""
    if not category:
        return None
    key = category.strip().lower()
    return _SLUG_TO_REF.get(key)


def _is_physically_plausible(product_name: str, co2e_kg: float, ref_category: str | None = None) -> bool:
    """Return False if co2e_kg is outside known bounds for the product category."""
    # Category-level bounds check (most reliable)
    if ref_category and ref_category in CATEGORY_BOUNDS:
        lo, hi = CATEGORY_BOUNDS[ref_category]
        if not (lo <= co2e_kg <= hi):
            print(
                f"Sanity Check Failed: '{product_name}' ({ref_category}) estimate "
                f"{co2e_kg} kg outside [{lo}, {hi}]",
                flush=True,
            )
            return False

    # Keyword fallback for categories not in the bounds table
    name_lower = product_name.lower()
    small_tech_keywords = [
        "loa", "speaker", "tai nghe", "earphone", "headphone", "sạc", "charger",
        "cáp", "cable", "chuột", "mouse", "bàn phím", "keyboard", "đồng hồ",
        "watch", "ốp lưng", "thẻ nhớ", "usb", "pin dự phòng", "powerbank", "cân", "scale"
    ]
    if any(k in name_lower for k in small_tech_keywords) and co2e_kg > 150:
        print(f"Sanity Check Failed: '{product_name}' estimate too high ({co2e_kg} kg)", flush=True)
        return False

    if co2e_kg < 0.1 or co2e_kg > 5000:
        return False

    return True


# =====================================================================
# Prompts: anchored (close neighbours) and unanchored (no close match)
# =====================================================================

def _build_prompt_anchored(product, close_neighbours, neighbour_avg):
    examples = "\n".join(
        f"  - {(n['brand'] or '').strip() + ' ' if n.get('brand') else ''}{n['name']} ({n['category']}): {n['co2e_kg']} kg CO2e"
        for n, _ in close_neighbours
    )
    desc = (product.description or "")[:300]
    desc_line = f"Description (Vietnamese): {desc}\n" if desc.strip() else ""

    return (
        "You are a Life-Cycle Assessment expert. Estimate the cradle-to-grave carbon footprint (kg CO2e per ISO 14067).\n"
        "The product name and description may be in Vietnamese — identify the product type carefully before estimating.\n\n"
        f"Product name: {product.name}\n"
        f"{desc_line}"
        f"\nVerified reference products from the same or a closely related category:\n{examples}\n"
        f"Reference average: {round(neighbour_avg, 1)} kg CO2e\n"
        "\nInstructions:\n"
        "1. First identify what type of product this actually is (e.g. wired gaming headset, smartphone, laptop).\n"
        "2. The references are from the same or a closely related category — use them as your primary calibration.\n"
        "3. Adjust up or down only for clear physical differences (size, battery, display, etc.).\n"
        "4. Do NOT copy reference names or claim the product is identical to a reference.\n"
        "5. Write explanation_en and explanation_vi for a customer audience: plain language, no mention of references or data sources.\n"
        "6. Return ONLY valid JSON:\n"
        '   {"co2e_kg": <number>, "explanation_en": "<1 sentence>", "explanation_vi": "<1 sentence in Vietnamese>"}'
    )


def _build_prompt_unanchored(product, ref_category=None):
    desc = (product.description or "")[:300]
    desc_line = f"Description (Vietnamese): {desc}\n" if desc.strip() else ""

    # Give the LLM a product-type label and a numeric ballpark if we know the category.
    if ref_category:
        label = _REF_CATEGORY_LABEL.get(ref_category, ref_category)
        category_line = f"Product category: {label}\n"
        if ref_category in CATEGORY_BOUNDS:
            lo, hi = CATEGORY_BOUNDS[ref_category]
            mid = round((lo + hi) / 2)
            range_hint = (
                f"\nTypical cradle-to-grave CO2e for this product category: {lo}\u2013{hi} kg "
                f"(midpoint ~{mid} kg). Use this range as your starting point and adjust "
                f"based on product size, features, and materials.\n"
            )
        else:
            range_hint = ""
    else:
        category_line = ""
        range_hint = ""

    return (
        "You are a Life-Cycle Assessment expert. Estimate the cradle-to-grave carbon footprint (kg CO2e per ISO 14067).\n"
        "The product name and description may be in Vietnamese.\n\n"
        f"Product name: {product.name}\n"
        f"{category_line}"
        f"{desc_line}"
        f"{range_hint}"
        "\nNo specific reference LCA data is available for this product.\n"
        "\nInstructions:\n"
        "1. Use the product name, category, and description to understand what this product is.\n"
        "2. Estimate based on typical LCA values for this product type: consider physical size, "
        "   materials, manufacturing complexity, and use-phase energy.\n"
        "3. Stay within the typical range given above unless there is a strong physical reason to deviate.\n"
        "4. Write explanation_en and explanation_vi for a customer audience: plain language, no mention of references or data sources.\n"
        "5. Return ONLY valid JSON:\n"
        '   {"co2e_kg": <number>, "explanation_en": "<1 sentence>", "explanation_vi": "<1 sentence in Vietnamese>"}'
    )


def _call_ollama(prompt):
    payload = {
        "model": LLM_MODEL,
        "prompt": prompt,
        "stream": False,
        "think": False,
        "keep_alive": OLLAMA_KEEP_ALIVE,
        "format": {
            "type": "object",
            "properties": {
                "co2e_kg": {"type": "number"},
                "explanation_en": {"type": "string"},
                "explanation_vi": {"type": "string"},
            },
            "required": ["co2e_kg", "explanation_en", "explanation_vi"],
        },
        "options": {
            "temperature": 0.05,
            "num_predict": 300,
        },
    }
    try:
        response = requests.post(f"{OLLAMA_HOST}/api/generate", json=payload, timeout=90)
        response.raise_for_status()
        text = response.json().get("response", "")
        if not text or not text.strip():
            print("LLM returned empty response.", flush=True)
            return None
        return text
    except Exception as error:
        print(f"Ollama call error: {error}", flush=True)
        return None


# =====================================================================
# Pipeline Orchestration
# =====================================================================

def _parse_estimate(text):
    data = json.loads(text)
    return (
        float(data["co2e_kg"]),
        str(data.get("explanation_en", "")).strip(),
        str(data.get("explanation_vi", "")).strip(),
    )


def _estimate_with_llm(product, close_neighbours, ref_category=None):
    """
    Estimate CO2e using the LLM.
    close_neighbours: list of (neighbour_dict, score) that passed the similarity
    threshold. May be empty — in that case an unanchored prompt is used.
    ref_category: normalised reference category string for bounds checking.
    """
    anchored = bool(close_neighbours)
    # Make ref_category accessible inside the nested try block
    self_ref_category = ref_category

    if anchored:
        neighbour_avg = _neighbour_average(close_neighbours)
        prompt = _build_prompt_anchored(product, close_neighbours, neighbour_avg)
    else:
        neighbour_avg = None
        prompt = _build_prompt_unanchored(product, ref_category=ref_category)

    raw_json = _call_ollama(prompt)

    if not raw_json:
        print(f"LLM call failed for '{product.name}'", flush=True)
        return None

    try:
        co2e, exp_en, exp_vi = _parse_estimate(raw_json)

        # Only apply the deviation guard when we have trustworthy anchor neighbours.
        # When unanchored, the LLM is our only signal — let it speak freely.
        if anchored and neighbour_avg and neighbour_avg > 0:
            ratio = co2e / neighbour_avg
            if ratio > 4.0 or ratio < 0.25:
                print(
                    f"LLM estimate ({co2e}) deviates too far from close-neighbour avg "
                    f"({round(neighbour_avg, 1)}) for '{product.name}' — discarding.",
                    flush=True,
                )
                return None

        if not _is_physically_plausible(product.name, co2e, self_ref_category):
            return None

        return co2e, exp_en, exp_vi
    except Exception as error:
        print(f"Could not parse LLM JSON for '{product.name}': {error} | raw={raw_json!r}", flush=True)
        return None


def _already_estimated(product):
    with Session(engine) as session:
        existing = session.exec(
            select(Product).where(Product.product_url == product.product_url)
        ).first()
    if existing is not None and existing.co2e_kg is not None:
        return existing
    return None


def _log_estimate(product, source):
    explanation = product.co2e_explanation or ""
    explanation_vi = product.co2e_explanation_vi or ""
    print(
        f"CO2e for '{product.name}': {product.co2e_kg} kg ({source}) | explanation_en: {explanation} | explanation_vi: {explanation_vi}",
        flush=True,
    )


def _round_kg(value):
    return round(value, 2) if value < 1 else round(value, 1)


# Step 1 of the final method: the manufacturer published a figure for this exact model.
USE_FALLBACK = os.environ.get("CO2E_FALLBACK", "0") == "1"


def _tokens(text):
    return " ".join(re.findall(r"[a-z0-9]+", (text or "").lower()))


def _exact_reference(name):
    """Longest reference name (>= 3 tokens) contained word-for-word in the product name."""
    _build_reference_index()
    haystack = f" {_tokens(name)} "
    best = None
    for ref in (_ref_by_id or {}).values():
        key = _tokens(ref["name"])
        if len(key.split()) >= 3 and f" {key} " in haystack and (best is None or len(key) > len(_tokens(best["name"]))):
            best = ref
    return best


def estimate_product_co2e(product, product_embedding, category=None):
    """Fill product.co2e_* in place.

    1. Reuse a number already stored for the same product_url.
    2. Close neighbours (cosine >= SIMILARITY_THRESHOLD, outliers removed): their
       average (optionally adjusted by the LLM when CO2E_USE_LLM=1).
    3. No close neighbour: green.fallback (formula -> category model -> price/EEIO).
    4. Nothing applies: leave co2e_kg empty.
    """
    try:
        existing = _already_estimated(product)
        if existing is not None:
            product.co2e_kg = existing.co2e_kg
            product.co2e_source = existing.co2e_source
            product.co2e_confidence = existing.co2e_confidence
            product.co2e_explanation = existing.co2e_explanation
            product.co2e_explanation_vi = existing.co2e_explanation_vi
            _log_estimate(product, f"already_estimated:{product.co2e_source or 'unknown'}")
            return

        exact = _exact_reference(product.name)
        if exact is not None:
            product.co2e_kg = _round_kg(exact["co2e_kg"])
            product.co2e_source = "manufacturer"
            product.co2e_confidence = 0.9
            product.co2e_explanation = f"Manufacturer-published figure for {exact['name']}."
            product.co2e_explanation_vi = f"Số CO₂ do hãng công bố cho đúng mẫu {exact['name']}."
            _log_estimate(product, "manufacturer")
            return

        ref_category = canonical_category(_normalize_to_ref_category(category))
        scored = _find_similar_references(product_embedding, ref_category, k=PROMPT_NEIGHBOURS)
        scored = _sanitize_neighbours(scored)

        close, distant = _split_by_similarity(scored)
        print(
            f"Neighbours for '{product.name}' (ref_cat={ref_category!r}): "
            f"{len(close)} close (>={SIMILARITY_THRESHOLD}), {len(distant)} distant.",
            flush=True,
        )

        if close:
            llm = _estimate_with_llm(product, close, ref_category=ref_category) if USE_LLM else None
            if llm is not None and 0.0 <= llm[0] <= 15000.0:
                product.co2e_kg = _round_kg(llm[0])
                product.co2e_explanation = llm[1]
                product.co2e_explanation_vi = llm[2]
                product.co2e_source = "llm_estimate"
                product.co2e_confidence = 0.6
            else:
                average = _neighbour_average(close)
                product.co2e_kg = _round_kg(average)
                product.co2e_source = "neighbor_average"
                product.co2e_confidence = 0.5
                product.co2e_explanation = (
                    f"Average of {len(close)} similar products whose manufacturers published their carbon footprint."
                )
                product.co2e_explanation_vi = (
                    f"Trung bình của {len(close)} sản phẩm tương tự có số CO₂ do hãng công bố."
                )
                print(f"  references used: {[n['name'] for n, _ in close]}", flush=True)
        else:
            if not USE_FALLBACK:
                print(f"No reference with cosine >= {SIMILARITY_THRESHOLD} for '{product.name}' — leaving empty.", flush=True)
                return
            estimate = estimate_without_neighbours(
                ref_category, product.name, product.description,
                getattr(product, "final_price", None), _category_stats,
            )
            if estimate is None:
                print(f"No reliable estimate possible for '{product.name}' (ref_cat={ref_category!r}) — leaving empty.", flush=True)
                return
            product.co2e_kg = _round_kg(estimate.co2e_kg)
            product.co2e_source = estimate.source
            product.co2e_confidence = estimate.confidence
            product.co2e_explanation = estimate.explanation_en
            product.co2e_explanation_vi = estimate.explanation_vi
            print(f"  fallback detail: {estimate.detail}", flush=True)

        _log_estimate(product, product.co2e_source or "unknown")
    except Exception as error:
        print(f"Carbon estimation skipped: {error}", flush=True)
