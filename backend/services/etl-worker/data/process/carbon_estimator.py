import json
import os
import threading

import faiss
import numpy as np
import requests
from sqlmodel import Session, select

from data import engine
from data.schemes.carbon_reference import CarbonReference
from data.schemes.product import Product
from data.process.data_transformer import encode_text

EMBED_DIM = 512
TOP_K = 5
LLM_MODEL = os.environ.get("CO2E_LLM_MODEL", "qwen3.5:0.8b")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://ollama:11434")
OLLAMA_KEEP_ALIVE = os.environ.get("OLLAMA_KEEP_ALIVE", "30m")
PROMPT_NEIGHBOURS = 5
# Cosine similarity threshold (0–1): neighbours below this are considered
# semantically unrelated and will NOT be used as anchors.
SIMILARITY_THRESHOLD = 0.5

# Hard CO2e plausibility bounds per reference category (min_kg, max_kg).
# These are intentionally generous but eliminate clearly wrong LLM outputs.
CATEGORY_BOUNDS: dict[str, tuple[float, float]] = {
    "smartphone":       (10,   200),
    "laptop":           (60,   800),
    "gaming_laptop":    (80,   900),
    "computer_monitor": (50,  2000),
    "tablet":           (20,   300),
    "earphone":         (0.5,   80),
    "desktop":          (100, 1500),
}

# Maps taxonomy slug / name_en variants → reference-seed category strings.
# Add entries here whenever a new reference category is added to the seed.
_SLUG_TO_REF: dict[str, str] = {
    # taxonomy slug -> ref category
    "smartphones":      "smartphone",
    "feature_phones":   "smartphone",
    "laptops":          "laptop",
    "gaming_laptops":   "laptop",
    "tablets":          "tablets",   # note: seed uses "tablet" (singular)
    "monitors":         "computer_monitor",
    "earphones":        "earphone",
    # name_en variants (lowercase) -> ref category
    "smartphones":      "smartphone",
    "laptops":          "laptop",
    "gaming laptops":   "laptop",
    "tablets":          "tablet",
    "monitors":         "computer_monitor",
    "earphones":        "earphone",
    "headphones":       "earphone",
    # exact ref category strings pass through unchanged
    "smartphone":       "smartphone",
    "laptop":           "laptop",
    "computer_monitor": "computer_monitor",
    "tablet":           "tablet",
    "earphone":         "earphone",
}

_lock = threading.Lock()
_ref_index = None
_ref_by_id = None


def _reference_text(ref):
    return f"{ref.brand or ''} {ref.name} {ref.category}".strip()


def _build_reference_index():
    global _ref_index, _ref_by_id
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
                    "category": ref.category,
                    "brand": ref.brand,
                    "co2e_kg": ref.co2e_kg,
                }
            matrix = np.asarray(vectors, dtype="float32")
            faiss.normalize_L2(matrix)
            index.add_with_ids(matrix, np.asarray(ids, dtype=np.int64))
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


def _build_prompt_unanchored(product):
    desc = (product.description or "")[:300]
    desc_line = f"Description (Vietnamese): {desc}\n" if desc.strip() else ""

    return (
        "You are a Life-Cycle Assessment expert. Estimate the cradle-to-grave carbon footprint (kg CO2e per ISO 14067).\n"
        "The product name and description may be in Vietnamese — identify the product type carefully before estimating.\n\n"
        f"Product name: {product.name}\n"
        f"{desc_line}"
        "\nNo closely matched reference data is available for this product.\n"
        "\nInstructions:\n"
        "1. Identify what type of product this is from its name and description.\n"
        "2. Estimate based on typical LCA values for that product type: consider physical size, materials, "
        "   manufacturing complexity, and typical use-phase energy consumption.\n"
        "3. Write explanation_en and explanation_vi for a customer audience: plain language, no mention of references or data sources.\n"
        "4. Return ONLY valid JSON:\n"
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
        prompt = _build_prompt_unanchored(product)

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


def estimate_product_co2e(product, product_embedding, category=None):
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

        ref_category = _normalize_to_ref_category(category)
        scored = _find_similar_references(product_embedding, ref_category, k=PROMPT_NEIGHBOURS)
        scored = _sanitize_neighbours(scored)

        close, distant = _split_by_similarity(scored)
        print(
            f"Neighbours for '{product.name}' (ref_cat={ref_category!r}): "
            f"{len(close)} close (>={SIMILARITY_THRESHOLD}), {len(distant)} distant.",
            flush=True,
        )

        # Use the LLM regardless; close_neighbours may be empty (unanchored mode).
        llm = _estimate_with_llm(product, close, ref_category=ref_category)
        if llm is not None and 0.0 <= llm[0] <= 15000.0:
            product.co2e_kg = round(llm[0], 1)
            product.co2e_explanation = llm[1]
            product.co2e_explanation_vi = llm[2]
            product.co2e_source = "llm_estimate"
            product.co2e_confidence = 0.6 if close else 0.4
        elif close:
            # LLM failed but we have trustworthy close neighbours — use their average.
            average = _neighbour_average(close)
            product.co2e_kg = round(average, 1)
            product.co2e_source = "neighbor_fallback"
            product.co2e_confidence = 0.3
            product.co2e_explanation = f"Estimated based on similar products in the same category."
            product.co2e_explanation_vi = "Ước tính dựa trên các sản phẩm tương tự trong cùng danh mục."
        else:
            # No close neighbours and LLM failed — skip rather than show a misleading value.
            print(f"No reliable estimate possible for '{product.name}' — skipping.", flush=True)
            return

        _log_estimate(product, product.co2e_source or "unknown")
    except Exception as error:
        print(f"Carbon estimation skipped: {error}", flush=True)