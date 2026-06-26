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
LLM_PROVIDER = os.environ.get("CO2E_LLM_PROVIDER", "anthropic").lower()
_DEFAULT_MODEL = {"ollama": "llama3.2", "anthropic": "claude-opus-4-8"}
LLM_MODEL = os.environ.get("CO2E_LLM_MODEL") or _DEFAULT_MODEL.get(LLM_PROVIDER, "claude-opus-4-8")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://host.docker.internal:11434")

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
    if not _ref_by_id:
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
        f"- {(n['brand'] or '')} {n['name']} ({n['category']}): {n['co2e_kg']} kg CO2e"
        for n in neighbours
    )
    return (
        "You are a Life-Cycle Assessment expert estimating a product's carbon "
        "footprint (cradle-to-grave, in kg CO2-equivalent) following ISO 14067 and "
        "the GHG Protocol.\n\n"
        "Similar products with VERIFIED carbon footprints from manufacturer "
        "environmental reports:\n"
        f"{examples}\n\n"
        "Estimate the carbon footprint of this product by reasoning from the most "
        "similar references above (category, brand, size, materials):\n"
        f"- {product.name}\n"
        f"Description: {(product.description or '')[:500]}\n\n"
        'Reply with ONLY a JSON object: '
        '{"co2e_kg": <number>, "explanation": "<one short sentence>"}'
    )


def _parse_estimate(text):
    data = json.loads(text[text.index("{"): text.rindex("}") + 1])
    return float(data["co2e_kg"]), str(data.get("explanation", ""))


def _call_anthropic(prompt):
    try:
        import anthropic
    except ImportError:
        return None
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return None
    try:
        client = anthropic.Anthropic()
        response = client.messages.create(
            model=LLM_MODEL, max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        return "".join(b.text for b in response.content if b.type == "text")
    except Exception as error:
        print(f"Anthropic call failed: {error}", flush=True)
        return None


def _call_ollama(prompt):
    try:
        response = requests.post(
            f"{OLLAMA_HOST}/api/chat",
            json={"model": LLM_MODEL,
                  "messages": [{"role": "user", "content": prompt}],
                  "stream": False, "format": "json"},
            timeout=180,
        )
        response.raise_for_status()
        return response.json()["message"]["content"]
    except Exception as error:
        print(f"Ollama call failed: {error}", flush=True)
        return None


def _estimate_with_llm(product, neighbours):
    prompt = _build_prompt(product, neighbours)
    raw = _call_ollama(prompt) if LLM_PROVIDER == "ollama" else _call_anthropic(prompt)
    if raw is None:
        return None
    try:
        return _parse_estimate(raw)
    except Exception as error:
        print(f"Could not parse LLM estimate: {error}", flush=True)
        return None


def _already_estimated(product):
    with Session(engine) as session:
        existing = session.exec(
            select(Product).where(Product.product_url == product.product_url)
        ).first()
    return existing is not None and existing.co2e_kg is not None


def estimate_product_co2e(product, product_embedding, category=None):
    try:
        if _already_estimated(product):
            return
        neighbours = _find_similar_references(product_embedding, category)
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
        print(f"CO2e for '{product.name}': {product.co2e_kg} kg ({product.co2e_source})", flush=True)
    except Exception as error:
        print(f"Carbon estimation skipped: {error}", flush=True)
