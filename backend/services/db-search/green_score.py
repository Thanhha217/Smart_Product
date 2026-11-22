"""0-5 green score within a product category (Kalisvaart et al. 2025, P1):

    score = 5 * ln(U / c) / ln(U / L)

c is the product's kg CO2e, [L, U] the plausible range of its reference category
(same values as CATEGORY_BOUNDS in etl-worker/data/process/carbon_estimator.py).
Higher = greener. Clamped to [0, 5]; None when the number or category is missing.
"""
import json
import math

CATEGORY_BOUNDS = {
    "smartphone": (10, 200), "feature_phone": (5, 80), "laptop": (60, 800), "gaming_laptop": (80, 900),
    "tablet": (20, 300), "desktop": (100, 1500), "computer_monitor": (50, 2000), "pc_component": (5, 500),
    "computer_peripheral": (1, 150), "networking": (5, 200), "smartwatch": (10, 120), "wearable": (2, 80),
    "headphone": (1, 80), "earphone": (1, 80), "speaker": (1, 150), "phone_accessory": (0.5, 50),
    "camera": (20, 300), "drone": (10, 200), "gaming_console": (20, 250), "television": (50, 800),
    "refrigerator": (200, 1500), "washing_machine": (150, 1000), "clothes_dryer": (150, 800),
    "air_conditioner": (100, 1200), "electric_fan": (5, 100), "air_purifier": (20, 200),
    "water_purifier": (20, 200), "vacuum_cleaner": (15, 200), "rice_cooker": (5, 150),
    "microwave_oven": (20, 250), "blender_juicer": (5, 100), "stove": (20, 300), "lighting": (1, 50),
    "smart_home": (5, 150),
}


def green_score(co2e_kg, category):
    bounds = CATEGORY_BOUNDS.get(category or "")
    if co2e_kg is None or bounds is None or co2e_kg <= 0:
        return None
    low, high = bounds
    score = 5 * math.log(high / co2e_kg) / math.log(high / low)
    return round(min(5.0, max(0.0, score)), 1)


def parse_references(raw):
    if not raw:
        return []
    try:
        refs = json.loads(raw)
        return refs if isinstance(refs, list) else []
    except (TypeError, ValueError):
        return []
