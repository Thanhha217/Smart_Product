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

EMBED_DIM = 512
TOP_K = 5
LLM_MODEL = os.environ.get("CO2E_LLM_MODEL", "qwen3.5:0.8b")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://ollama:11434")
OLLAMA_KEEP_ALIVE = os.environ.get("OLLAMA_KEEP_ALIVE", "30m")
PROMPT_NEIGHBOURS = 3

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
    _build_reference_index()
    if _ref_index is None or not _ref_by_id:
        return []
    query = np.asarray([product_embedding], dtype="float32")
    faiss.normalize_L2(query)
    pool = min(len(_ref_by_id), max(k * 6, 30))
    _, ids = _ref_index.search(query, pool)
    ranked = [_ref_by_id[int(i)] for i in ids[0] if int(i) in _ref_by_id]
    if category:
        same = [r for r in ranked if r["category"] == category]
        if len(same) >= k:
            return same[:k]
        return (same + [r for r in ranked if r["category"] != category])[:k]
    return ranked[:k]


def _sanitize_neighbours(neighbours):
    if not neighbours or len(neighbours) < 2:
        return neighbours
    values = sorted([n["co2e_kg"] for n in neighbours])
    median_val = values[len(values) // 2]
    filtered = [
        n for n in neighbours
        if (median_val / 8.0) <= n["co2e_kg"] <= (median_val * 8.0)
    ]
    return filtered if filtered else neighbours


def _is_physically_plausible(product_name, co2e_kg):
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
# STAGE 1: Simplified Reasoning
# =====================================================================

def _build_stage1_prompt(product, neighbours):
    examples = "\n".join(
        f"- {(n['brand'] or '')} {n['name']}: {n['co2e_kg']} kg CO2e"
        for n in neighbours
    )
    desc = (product.description or "")[:160]

    return (
        "You are a Life-Cycle Assessment expert estimating cradle-to-grave carbon footprints (kg CO2e) per ISO 14067.\n\n"
        f"Target Product: {product.name}\n"
        f"Description: {desc}\n\n"
        f"Reference Benchmarks:\n{examples}\n\n"
        "Analyze step-by-step:\n"
        "1. Identify the product's physical category, size, and power scale.\n"
        "2. State an estimated kg CO2e.\n"
        "3. Verify how plausible the estimation is and change the value if necessary. \n"
        "4. Explain your estimation in two short sentences"
    )


def _call_ollama_reasoning(prompt):
    payload = {
        "model": LLM_MODEL,
        "prompt": prompt,
        "stream": False,
        "think": False,
        "keep_alive": OLLAMA_KEEP_ALIVE,
        "options": {
            "temperature": 0.1,
            "num_predict": 256,  # Fast execution limit
        },
    }
    try:
        response = requests.post(f"{OLLAMA_HOST}/api/generate", json=payload, timeout=60)
        response.raise_for_status()
        text = response.json().get("response", "")
        if not text or not text.strip():
            print(f"Stage 1 returned empty response payload.", flush=True)
            return None
        return text
    except Exception as error:
        print(f"Stage 1 Ollama call error: {error}", flush=True)
        return None


# =====================================================================
# STAGE 2: Structured JSON Extraction & Translation
# =====================================================================

def _build_stage2_prompt(stage1_analysis):
    return (
        f"Analysis:\n{stage1_analysis}\n\n"
        "Task: Convert the analysis into JSON format.\n"
        "- co2e_kg: numerical value only.\n"
        "- explanation_en: 1 concise English sentence.\n"
        "- explanation_vi: 1 concise Vietnamese translation."
    )


def _call_ollama_extraction(prompt):
    payload = {
        "model": LLM_MODEL,
        "prompt": prompt,
        "stream": False,
        "keep_alive": OLLAMA_KEEP_ALIVE,
        "think": False,
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
            "temperature": 0.0,
            "num_predict": 256,
        },
    }
    try:
        response = requests.post(f"{OLLAMA_HOST}/api/generate", json=payload, timeout=60)
        response.raise_for_status()
        return response.json().get("response", "")
    except Exception as error:
        print(f"Stage 2 Ollama call error: {error}", flush=True)
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


def _estimate_with_llm(product, neighbours):
    # --- STAGE 1 ---
    p1 = _build_stage1_prompt(product, neighbours)
    reasoning_output = _call_ollama_reasoning(p1)

    if not reasoning_output:
        print(f"Stage 1 reasoning failed for '{product.name}'", flush=True)
        return None

    # --- STAGE 2 ---
    p2 = _build_stage2_prompt(reasoning_output)
    raw_json = _call_ollama_extraction(p2)

    if not raw_json:
        print(f"Stage 2 extraction failed for '{product.name}'", flush=True)
        return None

    try:
        co2e, exp_en, exp_vi = _parse_estimate(raw_json)

        if not _is_physically_plausible(product.name, co2e):
            return None

        return co2e, exp_en, exp_vi
    except Exception as error:
        print(f"Could not parse Stage 2 JSON for '{product.name}': {error} | raw={raw_json!r}", flush=True)
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

        neighbours = _find_similar_references(product_embedding, category, k=PROMPT_NEIGHBOURS)
        neighbours = _sanitize_neighbours(neighbours)

        if not neighbours:
            return

        llm = _estimate_with_llm(product, neighbours)
        if llm is not None and 0.0 <= llm[0] <= 15000.0:
            product.co2e_kg = round(llm[0], 1)
            product.co2e_explanation = llm[1]
            product.co2e_explanation_vi = llm[2]
            product.co2e_source = "llm_estimate"
            product.co2e_confidence = 0.6
        else:
            average = sum(n["co2e_kg"] for n in neighbours) / len(neighbours)
            product.co2e_kg = round(average, 1)
            product.co2e_source = "neighbor_fallback"
            product.co2e_confidence = 0.3
            product.co2e_explanation = f"Average of {len(neighbours)} similar reference products."
            product.co2e_explanation_vi = f"Trung bình của {len(neighbours)} sản phẩm tham chiếu tương tự."

        _log_estimate(product, product.co2e_source or "unknown")
    except Exception as error:
        print(f"Carbon estimation skipped: {error}", flush=True)