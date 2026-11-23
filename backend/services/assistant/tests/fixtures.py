"""Fake db-search items shaped like db_search_functions.get_product_data_from_ids."""
import json


def item(pid, name, price, kg, source="neighbor_average", category="laptop", green=None, refs=None, detail=None):
    return {
        "platform_name": "FPT Shop", "category_name": "Laptop", "image_url": f"https://img.test/{pid}.jpg",
        "seller": {"name": "FPT", "seller_rating": 0.9},
        "product": {
            "id": pid, "product_url": f"https://shop.test/{pid}", "name": name, "original_price": price,
            "final_price": price, "product_rating": 0.9, "review_count": 10, "co2e_kg": kg,
            "co2e_explanation": "x", "co2e_explanation_vi": "x", "co2e_source": source if kg is not None else None,
            "co2e_category": category, "co2e_references": refs or [], "co2e_confidence": 0.5 if kg else None,
            "co2e_detail": detail, "co2e_breakdown": None, "description": "", "green_score": green,
        },
        "return_policy": {},
    }


LAPTOPS = [
    item(1, "Laptop Dell Latitude 5450 i5", 18_990_000, 332.6, green=1.7,
         refs=[{"name": f"Dell Latitude {i}", "co2e_kg": kg, "cosine": 0.8} for i, kg in enumerate([290, 321, 312, 349, 391])]),
    item(2, "MacBook Air 13 inch M3 8GB", 19_990_000, 135.0, source="manufacturer", green=3.4,
         refs=[{"name": "Apple MacBook Air 13-inch M3", "co2e_kg": 135, "cosine": 1.0}]),
    item(3, "Laptop Acer Aspire 5 15.6 inch", 14_490_000, 270.0, source="category_model", green=2.1,
         detail=json.dumps({"category": "laptop", "n_refs": 587, "brand": "Acer", "brand_n": 25, "screen_inch": 15.6,
                            "category_median_kg": 300.0, "brand_median_kg": 255.0, "slope": 0.53, "ref_inch": 14.0})),
    item(4, "Laptop không rõ CO2", 12_000_000, None, category=None),
    item(5, "Laptop gaming đắt", 35_000_000, 500.0, green=0.9),
]
BY_ID = {str(i["product"]["id"]): i for i in LAPTOPS}
STATS = {"category": "laptop", "n": 120, "median_kg": 300.0, "p25": 250, "p75": 360, "min": 80, "max": 900,
         "product_kg": 135.0, "greener_than_pct": 92.5}
