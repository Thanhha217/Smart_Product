"""Build one AI result page (B1): plan -> search -> real CO2 data -> AI layout -> filled page.

Every number on the page comes from db-search (product.co2e_kg and the stored
detail), never from the model.  When the model is unavailable or slow the page
is still built, with rule-based texts and a warning.
"""
from __future__ import annotations

import re
import time
import uuid
from typing import Any, Callable

import data_client
import llm_provider
import page_spec as ps
from green import parse_specs
from green.co2_formula import CATEGORY_PARAMS, estimate_savings
from green.explain import explain
from green.fallback import FORMULA_CATEGORY
from store import Store, now_iso

MAX_CANDIDATES = 6
_URL = re.compile(r"https?://[^\s,;)]+|\b(?:[a-z0-9-]+\.)+(?:com|org|net|io)(?:/[^\s,;)]*)?", re.I)


def with_urls(refs: list[dict] | None) -> list[dict]:
    """Add `url` (first link in the reference's source text) so the web can link to the report."""
    out = []
    for ref in refs or []:
        ref = dict(ref)
        m = _URL.search(ref.get("source") or "")
        if m and not ref.get("url"):
            ref["url"] = m.group(0) if m.group(0).lower().startswith("http") else f"https://{m.group(0)}"
        out.append(ref)
    return out


def product_co2(item: dict) -> dict[str, Any]:
    """Body of GET /api/products/{id}/co2."""
    c = data_client.card(item)
    row = data_client.row(item)
    out = explain(row)
    bounds = row.get("green_score_bounds")
    score = None
    if c.get("green_score") is not None and isinstance(bounds, (list, tuple)) and len(bounds) == 2:
        score = {"formula": "5 × ln(U ÷ CO₂) ÷ ln(U ÷ L)", "co2e_kg": c.get("co2e_kg"), "low": bounds[0],
                 "high": bounds[1], "score": c.get("green_score"), "clamp": [0, 5]}
    return {"product": c, "explanation_vi": row.get("co2e_explanation_vi"), "explanation_en": row.get("co2e_explanation"),
            "references": with_urls(row.get("co2e_references")), **out, "green_score_formula": score}


def _appliance_savings(card: dict, row: dict, horizons: tuple[int, ...]) -> list[dict] | None:
    key = FORMULA_CATEGORY.get(card.get("category") or "")
    if key not in CATEGORY_PARAMS:
        return None
    specs = parse_specs(row.get("name"), row.get("description"))
    return [{"months": s.months, "kwh_saved": s.kwh_saved, "money_saved_vnd": s.money_saved_vnd,
             "co2_use_saved_kg": s.co2_use_saved_kg}
            for s in estimate_savings(key, specs, horizons)]


def _sources_item(card: dict, row: dict) -> dict:
    lim = ps.SOURCE_LIMITS.get(card.get("co2e_source") or "", ("Chưa có số CO₂.", "No CO2 figure."))
    return {"product_id": card["product_id"], "name": card["name"], "source": card.get("co2e_source"),
            "confidence": card.get("co2e_confidence"), "references": with_urls(row.get("co2e_references")),
            "limitations_vi": lim[0], "limitations_en": lim[1]}


def build_page(message: str, lang: str, store: Store, parent_id: str | None = None,
               plan_fn: Callable | None = None, compose_fn: Callable | None = None) -> dict[str, Any]:
    import assistant_llm  # imported lazily so tests can run without the SDK configured

    plan_fn = plan_fn or assistant_llm.plan_request
    compose_fn = compose_fn or assistant_llm.compose_page
    started = time.monotonic()
    warnings: list[str] = []

    question = message
    if parent_id:
        parent = store.get_page(parent_id)
        if parent:
            question = f"{parent['query']} — {message}"
    plan, plan_model = plan_fn(question)
    if plan_model == "rule-based":
        warnings.append("llm_unavailable")

    items = data_client.search(plan.search_query)
    if plan.budget_max_vnd:
        items = [i for i in items if ((i.get("product") or {}).get("final_price") or 0) <= plan.budget_max_vnd]
    by_id = {data_client.card(i)["product_id"]: i for i in items}
    cards_all = [data_client.card(i) for i in items]
    short = ps.shortlist(cards_all, MAX_CANDIDATES)
    cards = {c["product_id"]: c for c in short}
    rows = {pid: data_client.row(by_id[pid]) for pid in cards}
    explained = {pid: explain(rows[pid]) for pid in cards}
    alias_map = ps.aliases(cards)

    page_id = str(uuid.uuid4())
    base = {"version": 1, "id": page_id, "url": f"/assistant/{page_id}", "lang": lang, "query": message,
            "parent_id": parent_id, "created_at": now_iso(),
            "plan": {"search_query": plan.search_query, "category_slug": plan.category_slug,
                     "budget_max_vnd": plan.budget_max_vnd}}
    if not cards:
        page = {**base, "summary": {"vi": "Không tìm thấy sản phẩm phù hợp.", "fr": "Aucun produit correspondant."}.get(lang, "No matching product found."),
                "products": {}, "sections": [], "warnings": warnings,
                "meta": {"model": plan_model, "latency_ms": int((time.monotonic() - started) * 1000),
                         "number_check_failures": 0}}
        store.save_page(page)
        return page

    first = short[0]
    stats = data_client.stats(first.get("category"), first["product_id"])
    horizons = tuple(sorted(set(plan.horizons_months or [6, 12])))
    savings = ps.compute_savings(first, stats, horizons, _appliance_savings(first, rows[first["product_id"]], horizons))
    values = ps.placeholder_values(cards, alias_map, savings, stats, lang)

    # ---- the model chooses the layout and writes texts with placeholders only
    layout, model_used = None, plan_model
    try:
        candidates = [{"ref": a, "name": cards[pid]["name"], "price_vnd": cards[pid]["price_vnd"],
                       "co2e_kg": cards[pid]["co2e_kg"], "green_score": cards[pid]["green_score"],
                       "source": cards[pid]["co2e_source"], "confidence": cards[pid]["co2e_confidence"],
                       "category": cards[pid]["category"], "platform": cards[pid]["platform"]}
                      for a, pid in alias_map.items()]
        # name -> printed text, so the model sees which placeholder stands for which figure
        layout = compose_fn(message if not parent_id else question, lang, candidates, stats, savings,
                            {k: values[k] for k in sorted(values)})
        model_used = llm_provider.model_label()
    except Exception as error:
        print(f"assistant: layout via rules ({error.__class__.__name__}: {error})", flush=True)
        warnings.append("explanation_timeout" if "timeout" in error.__class__.__name__.lower() else "llm_unavailable")

    literals = [c["name"] for c in cards.values() if c.get("name")] + [message]
    failures = 0
    if layout:
        focus = (ps.valid_refs([layout.get("focus_ref")], alias_map) or [first["product_id"]])[0]
        recommended = ps.valid_refs(layout.get("recommended_refs"), alias_map)[:3] or list(cards)[:3]
        order, charts = ps.validate_layout(layout.get("section_order"), layout.get("charts"))
        summary, f1 = ps.fill_text(layout.get("summary", ""), values, literals)
        bullets = []
        for b in layout.get("why_bullets", []):
            text, f = ps.fill_text(b, values, literals)
            failures += f
            if text:
                bullets.append(text)
        reasons = {}
        for r in layout.get("reasons", []):
            pid = (ps.valid_refs([r.get("ref")], alias_map) or [None])[0]
            text, f = ps.fill_text(r.get("reason", ""), values, literals)
            failures += f
            if pid and text:
                reasons[pid] = text
        failures += f1
        if not summary:
            summary = ps.fill_text(ps.default_texts(alias_map, cards, savings, stats, lang)[0], values, literals)[0]
    else:
        focus, recommended = first["product_id"], list(cards)[:3]
        order, charts = ps.validate_layout(None, None)
        raw_summary, raw_bullets = ps.default_texts(alias_map, cards, savings, stats, lang)
        summary = ps.fill_text(raw_summary, values, literals)[0]
        bullets = [t for t in (ps.fill_text(b, values, literals)[0] for b in raw_bullets) if t]
        reasons = {}
    if failures:
        warnings.append("number_check_failed")

    related = None
    try:
        related = data_client.related(focus, 6)
    except Exception as error:
        print(f"assistant: related unavailable ({error.__class__.__name__})", flush=True)
    related_cards = [data_client.card(i) for i in (related or {}).get("items", [])]
    alt = (related or {}).get("greener_alternative")
    alt_card = data_client.card(alt) if alt else None

    lifecycles = {pid: e["lifecycle"] for pid, e in explained.items()}
    sections: list[dict] = []
    for t in order:
        if t == "recommendations":
            sections.append({"type": t, "product_ids": recommended, "reasons": reasons})
        elif t == "formula":
            sections.append({"type": t, "product_id": focus, "formula": explained[focus]["formula"]})
        elif t == "lifecycle":
            sections.append({"type": t, "product_id": focus, "lifecycle": explained[focus]["lifecycle"]})
        elif t == "chart":
            for kind in charts:
                chart = ps.build_chart(kind, list(cards.values()), lifecycles, lang)
                if chart:
                    sections.append({"type": "chart", "chart": kind, **chart, "product_ids": list(cards)})
        elif t == "category_stats" and stats:
            sections.append({"type": t, "category": stats["category"], "product_id": first["product_id"], "stats": stats})
        elif t == "savings" and savings:
            sections.append({"type": t, **savings})
        elif t == "why_low_co2" and bullets:
            sections.append({"type": t, "bullets": bullets})
        elif t == "related" and (related_cards or alt_card):
            sections.append({"type": t, "product_id": focus, "items": related_cards, "greener_alternative": alt_card})
        elif t == "sources":
            sections.append({"type": t, "items": [_sources_item(cards[pid], rows[pid]) for pid in cards]})

    products = dict(cards)
    for c in related_cards + ([alt_card] if alt_card else []):
        products.setdefault(c["product_id"], c)
    page = {**base, "summary": summary, "products": products, "sections": sections,
            "warnings": sorted(set(warnings)),
            "meta": {"model": model_used if layout else "rule-based", "latency_ms": int((time.monotonic() - started) * 1000),
                     "number_check_failures": failures}}
    store.save_page(page)
    print(f"assistant page {page_id}: q={message!r} latency={page['meta']['latency_ms']}ms "
          f"failures={failures} model={page['meta']['model']}", flush=True)
    return page


def compare(ids: list[str], lang: str = "vi") -> dict[str, Any]:
    """Body of GET /api/compare."""
    from green.co2_formula import ELECTRICITY_PRICE_VND

    products = []
    for pid in ids[:4]:
        item = data_client.product(pid)
        if not item:
            continue
        c = data_client.card(item)
        e = explain(data_client.row(item))
        kwh = (e["lifecycle"].get("use_phase") or {}).get("kwh_year")
        products.append({**c, "formula": e["formula"], "lifecycle": e["lifecycle"], "annual_kwh": kwh,
                         "electricity_vnd_year": round(kwh * ELECTRICITY_PRICE_VND) if kwh else None})
    rows = ["price_vnd", "co2e_kg", "green_score", "co2e_source", "co2e_confidence", "annual_kwh", "electricity_vnd_year"]
    lower_better = {"price_vnd", "co2e_kg", "annual_kwh", "electricity_vnd_year"}
    best = {}
    for r in rows:
        if r == "co2e_source":
            continue
        vals = [(p[r], p["product_id"]) for p in products if isinstance(p.get(r), (int, float))]
        if len(vals) >= 2:
            best[r] = (min(vals) if r in lower_better else max(vals))[1]
    conclusion = ""
    known = [p for p in products if p.get("co2e_kg") is not None]
    if len(known) >= 2:
        lo, hi = min(known, key=lambda p: p["co2e_kg"]), max(known, key=lambda p: p["co2e_kg"])
        k = lambda x: ps.fmt_kg(x, lang)  # noqa: E731
        diff = hi["co2e_kg"] - lo["co2e_kg"]
        conclusion = {
            "vi": f"{lo['name']} có CO₂ thấp nhất ({k(lo['co2e_kg'])} kg), ít hơn {k(diff)} kg so với {hi['name']}.",
            "fr": f"{lo['name']} a le CO₂ le plus bas ({k(lo['co2e_kg'])} kg), soit {k(diff)} kg de moins que {hi['name']}.",
        }.get(lang, f"{lo['name']} has the lowest CO₂ ({k(lo['co2e_kg'])} kg), {k(diff)} kg less than {hi['name']}.")
        if best.get("price_vnd") == lo["product_id"]:
            conclusion += {"vi": " Đây cũng là sản phẩm rẻ nhất trong bảng.",
                           "fr": " C’est aussi le moins cher du tableau."}.get(lang, " It is also the cheapest in the table.")
    return {"products": products, "rows": rows, "best": best, "conclusion": conclusion}


METHOD = {
    "title_vi": "Phương pháp tính CO₂ của CarbonSense AI",
    "chain": [
        {"step": 1, "method": "manufacturer", "rule": "Tên sản phẩm chứa nguyên tên một mẫu (≥ 3 từ) → số của hãng", "confidence": 0.9},
        {"step": 2, "method": "neighbor_average", "rule": "OpenCLIP: 5 mẫu giống nhất, bỏ ngoài [trung vị ÷ 8; × 8], giữ cosine ≥ 0,66 → trung bình", "confidence": 0.5},
        {"step": "3a", "method": "lifecycle_formula", "rule": "Điện gia dụng: E_sx + L × (kWh/năm × 0,681 + rò rỉ ga) + E_thải bỏ", "confidence": "0,25–0,35"},
        {"step": "3b", "method": "category_model", "rule": "Trung vị loại (hoặc hãng nếu ≥ 3 mẫu) × (inch ÷ inch chuẩn)^b; màn hình b = 0,81 (23,8\"), laptop b = 0,53 (14\")", "confidence": 0.35},
        {"step": "3c", "method": "eeio_price", "rule": "Giá ÷ 25.900 × (292,655 ÷ 336,940) × hệ số ngành US EPA", "confidence": 0.15},
        {"step": 4, "method": "none", "rule": "Không đủ căn cứ → để trống, không đoán"},
    ],
    "green_score": "5 × ln(U ÷ CO₂) ÷ ln(U ÷ L), kẹp trong 0–5, so trong cùng loại (Kalisvaart 2025)",
    "ranking": "1 ÷ (60 + hạng nhu cầu) + 0,2 × 1 ÷ (60 + hạng CO₂); sản phẩm chưa có số nhận hạng giữa (Vestrum 2026)",
    "results": {"covered_categories_error_pct": "≈ 20", "spearman": 0.95, "category_model_mdape_pct": 20.9,
                "coverage_10000": "7.406 / 10.000 (74%)", "llm_vs_neighbour_mae_kg": [77.2, 68.0]},
    "principle": "Số CO₂ luôn truy về báo cáo của hãng; AI chỉ tìm sản phẩm giống và viết lời giải thích, không tự sinh số.",
    "url": "/method",
}
