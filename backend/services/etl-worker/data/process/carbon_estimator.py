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
OLLAMA_NUM_PREDICT = int(os.environ.get("OLLAMA_NUM_PREDICT", "48"))
PROMPT_NEIGHBOURS = 2

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
                by_id[ref.id] = {"name": ref.name, "category": ref.category,
                                 "brand": ref.brand, "co2e_kg": ref.co2e_kg}
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


def _build_prompt(product, neighbours):
    examples = "\n".join(
        f"- {(n['brand'] or '')} {n['name']}: {n['co2e_kg']} kg CO2e"
        for n in neighbours
    )
    return (
        "Estimate product carbon footprint in kg CO2e.\n"
        "Use the examples as anchors. Reply in one line only.\n\n"
        "Examples:\n"
        f"{examples}\n\n"
        f"Product: {product.name}\n"
        f"Desc: {(product.description or '')[:160]}\n\n"
        'Format exactly: co2e_kg=<number>; explanation=<short sentence>'
    )


def _parse_estimate(text):
    normalized = text.strip()
    if not normalized:
        raise ValueError("empty model response")

    kv_match = re.search(
        r"co2e_kg\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*;?\s*explanation\s*[:=]\s*(.+)",
        normalized,
        re.IGNORECASE | re.DOTALL,
    )
    if kv_match:
        return float(kv_match.group(1)), kv_match.group(2).strip().strip('"')

    if "{" in normalized and "}" in normalized:
        try:
            data = json.loads(normalized[normalized.index("{"): normalized.rindex("}") + 1])
            if isinstance(data, dict) and "co2e_kg" in data:
                return float(data["co2e_kg"]), str(data.get("explanation", "")).strip()
        except Exception:
            pass

    number_match = re.search(r"(-?\d+(?:\.\d+)?)", normalized)
    if number_match:
        return float(number_match.group(1)), normalized[:240]

    raise ValueError(f"Could not parse estimate output: {normalized[:200]!r}")


def _post_ollama(endpoint, payload):
    try:
        response = requests.post(
            f"{OLLAMA_HOST}{endpoint}",
            json=payload,
            timeout=180,
        )
        response.raise_for_status()
        data = response.json()
        if data.get("error"):
            print(f"Ollama error on {endpoint}: {data['error']}", flush=True)
            return None
        return data
    except Exception as error:
        print(f"Ollama call failed on {endpoint}: {error}", flush=True)
        return None


def _call_ollama(prompt):
    chat_payload = {
        "model": LLM_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "keep_alive": OLLAMA_KEEP_ALIVE,
        "think": False,
        "options": {
            "temperature": 0,
            "num_predict": OLLAMA_NUM_PREDICT,
        },
    }
    chat_data = _post_ollama("/api/chat", chat_payload)
    if chat_data is not None:
        message = chat_data.get("message") or {}
        response_text = message.get("content", "")
        if response_text:
            return response_text

    generate_payload = {
        "model": LLM_MODEL,
        "prompt": prompt,
        "stream": False,
        "keep_alive": OLLAMA_KEEP_ALIVE,
        "think": False,
        "options": {
            "temperature": 0,
            "num_predict": OLLAMA_NUM_PREDICT,
        },
    }
    generate_data = _post_ollama("/api/generate", generate_payload)
    if generate_data is not None:
        return generate_data.get("response", "")
    return None


def _estimate_with_llm(product, neighbours):
    prompt = _build_prompt(product, neighbours)
    raw = _call_ollama(prompt)
    if raw is None:
        return None
    try:
        return _parse_estimate(raw)
    except Exception as error:
        print(f"Could not parse LLM estimate for '{product.name}': {error} | raw={raw[:500]!r}", flush=True)
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
    print(
        f"CO2e for '{product.name}': {product.co2e_kg} kg ({source}) | explanation: {explanation}",
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
            _log_estimate(product, f"already_estimated:{product.co2e_source or 'unknown'}")
            return
        neighbours = _find_similar_references(product_embedding, category, k=PROMPT_NEIGHBOURS)
        if not neighbours:
            return
        llm = _estimate_with_llm(product, neighbours)
        if llm is not None:
            product.co2e_kg = round(llm[0], 1)
            product.co2e_explanation = llm[1]
            product.co2e_source = "llm_estimate"
            product.co2e_confidence = 0.6
        else:
            average = sum(n["co2e_kg"] for n in neighbours) / len(neighbours)
            product.co2e_kg = round(average, 1)
            product.co2e_source = "neighbor_fallback"
            product.co2e_confidence = 0.3
            product.co2e_explanation = f"Average of {len(neighbours)} similar reference products."
        _log_estimate(product, product.co2e_source or "unknown")
    except Exception as error:
        print(f"Carbon estimation skipped: {error}", flush=True)
