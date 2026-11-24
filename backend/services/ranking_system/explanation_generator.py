import json
import os
import requests

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://ollama:11434")
OLLAMA_KEEP_ALIVE = os.environ.get("OLLAMA_KEEP_ALIVE", "30m")
LLM_MODEL = os.environ.get("LLM_MODEL", os.environ.get("CO2E_LLM_MODEL", "qwen3.5:0.8b"))
# The local model can be slow on CPU: every search waited for it. These let a deployment switch the
# LLM wording off (the rule-based reasons are used) or wait less.
LLM_EXPLANATIONS = os.environ.get("RANKING_LLM_EXPLANATIONS", "1").strip().lower() not in ("0", "false", "no", "off")
LLM_TIMEOUT_S = float(os.environ.get("RANKING_LLM_TIMEOUT_S", "10"))


def generate_ranking_explanations(query, top_products):
    """
    Generates very brief recommendation explanations for the top 4 highest ranked products
    using the local LLM (Ollama), inspired by the CO2 estimation implementation.
    
    Falls back gracefully to dynamic heuristic explanations if Ollama is unreachable.
    """
    if not top_products:
        return {}

    top_4 = top_products[:4]

    explanations = _call_ollama_explanations(query, top_4) if LLM_EXPLANATIONS else None
    if explanations and len(explanations) > 0:
        return explanations

    return _generate_heuristic_explanations(top_4)


def _call_ollama_explanations(query, top_4):
    prompt = f"Search Query: '{query or 'General search'}'\n\n"
    prompt += "Top 4 Ranked Products:\n"

    for idx, p in enumerate(top_4, 1):
        pid = str(getattr(p, 'product_id', getattr(p, 'id', idx)))
        pname = getattr(p, 'product_name', getattr(p, 'name', 'Product'))
        orig_price = float(getattr(p, 'original_price', 0) or 0)
        final_price = float(getattr(p, 'final_price', 0) or 0)
        disc_pct = int((1 - final_price / orig_price) * 100) if orig_price > final_price > 0 else 0
        raw_rating = float(getattr(p, 'product_rating', 0) or 0)
        rating = raw_rating * 5.0 if raw_rating <= 1.0 else raw_rating
        reviews = int(getattr(p, 'review_count', 0) or 0)
        co2e = getattr(p, 'co2e_kg', None)
        co2_str = f"{co2e}kg" if co2e is not None else "N/A"

        prompt += (
            f"Rank #{idx} [ID: {pid}]: {pname} | Price: {final_price:,.0f} VND (Discount: {disc_pct}%) | "
            f"Rating: {rating:.1f}/5 ({reviews} reviews) | CO2e: {co2_str}\n"
        )

    prompt += (
        "\nTask: For EACH product ID above, generate a VERY BRIEF recommendation reason (3 to 7 words) "
        "explaining why it was recommended over the other products.\n"
        "Examples of valid brief reasons:\n"
        "- 'Best price/quality ratio'\n"
        "- 'Great customer ratings'\n"
        "- 'Huge sale discount'\n"
        "- 'Eco-friendly low carbon choice'\n"
        "- 'Top-rated seller selection'\n\n"
        "Respond ONLY with a JSON object mapping string Product ID to explanation string.\n"
        "Example format:\n"
        "{\n"
        '  "123": "Best price/quality ratio",\n'
        '  "456": "Great customer ratings"\n'
        "}"
    )

    payload = {
        "model": LLM_MODEL,
        "prompt": prompt,
        "stream": False,
        "think": False,
        "keep_alive": OLLAMA_KEEP_ALIVE,
        "format": "json",
        "options": {
            "temperature": 0.2,
            "num_predict": 256,
        },
    }

    try:
        response = requests.post(f"{OLLAMA_HOST}/api/generate", json=payload, timeout=LLM_TIMEOUT_S)
        response.raise_for_status()
        raw_resp = response.json().get("response", "")
        if not raw_resp:
            return None

        parsed = json.loads(raw_resp)
        if isinstance(parsed, dict):
            cleaned = {}
            for p in top_4:
                pid_str = str(getattr(p, 'product_id', getattr(p, 'id', '')))
                if pid_str in parsed and isinstance(parsed[pid_str], str):
                    cleaned[pid_str] = parsed[pid_str].strip('"\' ')
            if cleaned:
                return cleaned
    except Exception as e:
        print(f"Ollama ranking explanation generation warning: {e}", flush=True)

    return None


def _generate_heuristic_explanations(top_4):
    explanations = {}

    prices = [float(getattr(p, 'final_price', 0) or 0) for p in top_4]
    min_price = min([pr for pr in prices if pr > 0]) if any(pr > 0 for pr in prices) else 0

    for idx, p in enumerate(top_4):
        pid_str = str(getattr(p, 'product_id', getattr(p, 'id', idx)))
        orig_price = float(getattr(p, 'original_price', 0) or 0)
        final_price = float(getattr(p, 'final_price', 0) or 0)
        disc_pct = int((1 - final_price / orig_price) * 100) if orig_price > final_price > 0 else 0
        raw_rating = float(getattr(p, 'product_rating', 0) or 0)
        rating = raw_rating * 5.0 if raw_rating <= 1.0 else raw_rating
        reviews = int(getattr(p, 'review_count', 0) or 0)
        co2e = getattr(p, 'co2e_kg', None)

        if co2e is not None and float(co2e) < 50 and rating >= 4.0:
            explanations[pid_str] = "Eco-friendly choice with great ratings"
        elif disc_pct >= 20:
            explanations[pid_str] = f"Huge {disc_pct}% sale discount"
        elif rating >= 4.5 and reviews >= 10:
            explanations[pid_str] = f"Great customer ratings ({rating:.1f}★)"
        elif final_price > 0 and final_price == min_price:
            explanations[pid_str] = "Best budget value choice"
        else:
            explanations[pid_str] = "Best price/quality ratio"

    return explanations
