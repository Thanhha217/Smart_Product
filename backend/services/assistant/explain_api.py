"""POST /api/explain — "chọn đâu hỏi đó": explain one part of a product's CO2 in plain words.

1. Facts: only numbers the system already has for the product (stored co2e_kg, lifecycle
   split, formula steps, category stats, greener alternative) plus the what-if scenario
   the page sent.
2. A rule-based answer for every topic, used when no LLM key is set or the call fails.
3. With a key (OpenAI or Anthropic, see llm_provider) the model rewrites it for the
   question asked. A sentence quoting a number that is not in the facts is dropped and
   counted (number_check_failures), as on the AI page.
Answers are cached in memory: the same click costs one call.
"""
from __future__ import annotations

import json
import re
from collections import OrderedDict
from typing import Any

import llm_provider
from page_spec import fmt_kg, fmt_number, fmt_price

TOPICS = ("co2e_total", "green_score", "confidence", "materials", "factory", "transport", "use", "grid",
          "end_of_life", "formula", "category", "greener_alternative", "wefe", "what_if", "free")
GRID_EF = 0.681
TREE_KG = 21.8
CAR_KM_PER_KG = 4.1
_CACHE: OrderedDict[str, dict] = OrderedDict()
_CACHE_MAX = 500

SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "answer": {"type": "string"},
        "bullets": {"type": "array", "items": {"type": "string"}},
        "follow_ups": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["title", "answer", "bullets", "follow_ups"],
    "additionalProperties": False,
}

SYSTEM = """You explain the carbon footprint of ONE product to an ordinary shopper in Vietnam, on an interactive
"CO2 world" web page where the user clicked something they did not understand. Be warm, concrete and short.
Write in the requested language (vi = natural Vietnamese, en = English).

Return JSON: title (max 8 words), answer (2-4 short sentences answering the click or the question),
bullets (0-4 short facts or tips), follow_ups (2-3 short questions the user may want to ask next, same language).

Rules:
- Use ONLY numbers that appear in `facts` or `scenario`. Never invent a figure, a percentage or a source.
  If the facts do not contain what is asked, say the system does not have that number.
- CO2 figures are estimates; say which method produced the number when relevant (facts.method).
- A scenario is a what-if simulation, not the product's official figure (facts.co2e_kg).
- Encourage lower-CO2 choices with reasons tied to the facts, without exaggerating.
- No markdown, no emojis."""


# ------------------------------------------------------------------ facts

def build_facts(co2: dict, stats: dict | None, related: dict | None, lang: str) -> dict[str, Any]:
    p = co2.get("product") or {}
    formula = co2.get("formula") or {}
    lifecycle = co2.get("lifecycle") or {}
    stages = {s["key"]: {"kg": s["kg"], "pct": s["pct"]} for s in lifecycle.get("stages") or []}
    route = lifecycle.get("route") or {}
    use_phase = lifecycle.get("use_phase") or {}
    kg = p.get("co2e_kg")
    use_kg = (stages.get("use") or {}).get("kg")
    kwh_life = (use_phase.get("kwh_year") or 0) * (use_phase.get("years") or 0) or (use_kg / GRID_EF if use_kg else None)
    alt = (related or {}).get("greener_alternative")
    vi = lang == "vi"
    facts: dict[str, Any] = {
        "product": p.get("name"), "price_vnd": p.get("price_vnd"), "platform": p.get("platform"),
        "category": p.get("category"), "co2e_kg": kg, "green_score_0_5": p.get("green_score"),
        "method": formula.get("title_vi" if vi else "title_en"), "method_key": formula.get("method"),
        "confidence": p.get("co2e_confidence"),
        "formula": formula.get("expression"),
        "formula_steps": [f"{s.get('label_vi' if vi else 'label_en')}: {s.get('expr')}" for s in formula.get("steps") or []][-5:],
        "stages_kg_and_percent": stages,
        "stage_split_basis": lifecycle.get("basis"),
        "assumed_origin": route.get("origin_vi" if vi else "origin_en"),
        "shipping": {"sea_km": route.get("sea_km"), "road_km": route.get("road_km"), "mode": route.get("mode"),
                     "assumed": route.get("assumed")} if route else None,
        "use_phase": use_phase or None,
        "vietnam_grid_kg_per_kwh": GRID_EF,
        "electricity_kwh_over_life": round(kwh_life, 1) if kwh_life else None,
        "trees_for_one_year": round(kg / TREE_KG, 1) if kg else None,
        "car_km_equivalent": round(kg * CAR_KM_PER_KG) if kg else None,
        "references": [{"name": r.get("name"), "co2e_kg": r.get("co2e_kg")} for r in (co2.get("references") or [])[:4]],
    }
    if stats and stats.get("n"):
        facts["category_stats"] = {k: stats.get(k) for k in ("n", "median_kg", "p25", "p75", "min", "max", "greener_than_pct")}
    if alt and (alt.get("product") or alt.get("name")):
        a = alt.get("product") or alt
        facts["greener_alternative"] = {"name": a.get("name"), "co2e_kg": a.get("co2e_kg"),
                                        "price_vnd": a.get("final_price", a.get("price_vnd"))}
    return {k: v for k, v in facts.items() if v not in (None, [], {})}


# ------------------------------------------------------------------ rule-based answers

def _stage_line(f: dict, key: str, vi: bool) -> str | None:
    s = (f.get("stages_kg_and_percent") or {}).get(key)
    if not s:
        return None
    return (f"Chặng này chiếm {fmt_kg(s['kg'])} kg CO₂e, tức {fmt_number(s['pct'])}% cả vòng đời." if vi
            else f"This stage is {fmt_kg(s['kg'], 'en')} kg CO₂e, {fmt_number(s['pct'], 'en')}% of the lifecycle.")


def rule_based(topic: str, f: dict, lang: str, scenario: dict | None = None) -> dict:
    vi = lang == "vi"
    L = "vi" if vi else "en"
    kg = f.get("co2e_kg")
    k = lambda x: fmt_kg(x, L)  # noqa: E731
    title, answer, bullets = "", "", []
    if kg is None:
        return {"title": "Chưa có số CO₂" if vi else "No CO₂ figure",
                "answer": ("Hệ thống chưa đủ căn cứ để tính CO₂ cho sản phẩm này nên để trống, không đoán."
                           if vi else "The system lacks reliable data for this product, so it leaves the number empty instead of guessing."),
                "bullets": [], "follow_ups": []}
    if topic in ("co2e_total", "free"):
        title = "Tổng CO₂ của sản phẩm" if vi else "The product's total CO₂"
        answer = (f"Trong cả vòng đời, từ khai thác nguyên liệu đến thải bỏ, sản phẩm này gây ra khoảng {k(kg)} kg CO₂e. "
                  f"Con số có được bằng cách: {f.get('method', '')}." if vi else
                  f"Over its whole life, from mining to disposal, this product causes about {k(kg)} kg CO₂e. Method: {f.get('method', '')}.")
        if f.get("trees_for_one_year"):
            bullets.append(f"Bằng lượng CO₂ {fmt_number(f['trees_for_one_year'], L)} cây xanh hấp thụ trong 1 năm." if vi
                           else f"What {fmt_number(f['trees_for_one_year'], L)} trees absorb in a year.")
        if f.get("car_km_equivalent"):
            bullets.append(f"Tương đương chạy ô tô xăng {fmt_number(f['car_km_equivalent'], L, 0)} km." if vi
                           else f"Like driving a petrol car {fmt_number(f['car_km_equivalent'], L, 0)} km.")
    elif topic == "green_score":
        g = f.get("green_score_0_5")
        title = "Điểm xanh 0–5" if vi else "Green score 0–5"
        answer = (f"Điểm xanh so sản phẩm với các sản phẩm cùng loại: 5 là xanh nhất, 0 là phát thải nhiều nhất. Sản phẩm này được {fmt_number(g, L)}/5."
                  if vi else f"The green score compares the product with its category: 5 is greenest, 0 emits most. This one scores {fmt_number(g, L)}/5.")
    elif topic == "confidence":
        c = f.get("confidence")
        title = "Độ tin cậy của con số" if vi else "How reliable the number is"
        answer = (f"Độ tin cậy {fmt_number((c or 0) * 100, L, 0)}% phản ánh cách tính: số của hãng cho đúng mẫu tin cậy nhất, rồi đến trung bình sản phẩm giống, mức điển hình của loại, và cuối cùng là ước tính theo giá."
                  if vi else f"A confidence of {fmt_number((c or 0) * 100, L, 0)}% reflects the method: the manufacturer's own figure is most reliable, then similar products, the category level, and finally the price estimate.")
    elif topic in ("materials", "factory"):
        title = "Khai thác và sản xuất" if vi else "Mining and manufacturing"
        answer = ("Khai thác kim loại, làm chip, màn hình, pin và lắp ráp tiêu tốn rất nhiều năng lượng. Với đồ điện tử đây thường là phần phát thải lớn nhất."
                  if vi else "Mining metals and making chips, screens and batteries take a lot of energy. For electronics this is usually the largest part.")
        line = _stage_line(f, "materials_production", vi)
        bullets = [x for x in (line, "Dùng lâu hơn hoặc mua máy tân trang giúp giảm phần này nhiều nhất." if vi else
                               "Keeping it longer or buying refurbished cuts this part most.") if x]
    elif topic == "transport":
        sh = f.get("shipping") or {}
        title = "Vận chuyển về Việt Nam" if vi else "Shipping to Vietnam"
        answer = (f"Sản phẩm được giả định sản xuất tại {f.get('assumed_origin', 'nước ngoài')}, đi {fmt_number(sh.get('sea_km'), L, 0)} km đường biển và {fmt_number(sh.get('road_km'), L, 0)} km đường bộ. Tàu biển phát thải rất ít trên mỗi kg hàng, máy bay thì gấp hàng chục lần."
                  if vi else f"Assumed made in {f.get('assumed_origin', 'abroad')}, it travels {fmt_number(sh.get('sea_km'), L, 0)} km by sea and {fmt_number(sh.get('road_km'), L, 0)} km by road. Ships emit very little per kg; planes dozens of times more.")
        bullets = [x for x in (_stage_line(f, "transport", vi),) if x]
    elif topic in ("use", "grid"):
        title = "Dùng điện tại Việt Nam" if vi else "Using power in Vietnam"
        answer = (f"Mỗi kWh điện ở Việt Nam phát thải khoảng {fmt_number(GRID_EF, L, 3)} kg CO₂e vì lưới điện còn nhiều nhiệt điện than. Điện dùng càng nhiều, phát thải càng lớn."
                  if vi else f"Each kWh in Vietnam emits about {fmt_number(GRID_EF, L, 3)} kg CO₂e because the grid still uses a lot of coal.")
        if f.get("electricity_kwh_over_life"):
            bullets.append(f"Cả vòng đời dùng khoảng {fmt_number(f['electricity_kwh_over_life'], L, 0)} kWh." if vi
                           else f"About {fmt_number(f['electricity_kwh_over_life'], L, 0)} kWh over its life.")
        line = _stage_line(f, "use", vi)
        if line:
            bullets.append(line)
    elif topic == "end_of_life":
        title = "Thải bỏ và tái chế" if vi else "End of life"
        answer = ("Thu gom và tái chế phát thải ít, nhưng rác điện tử vứt sai chỗ làm kim loại nặng ngấm vào đất và nước. Hãy mang tới điểm thu gom rác điện tử."
                  if vi else "Recycling emits little, but dumped e-waste leaks heavy metals into soil and water. Bring it to an e-waste point.")
        bullets = [x for x in (_stage_line(f, "end_of_life", vi),) if x]
    elif topic == "formula":
        title = "Công thức đã dùng" if vi else "The formula used"
        answer = (f"Hệ thống thử 4 cách theo thứ tự và dừng ở cách đầu tiên ra số. Sản phẩm này dùng: {f.get('method', '')}. AI chỉ tìm sản phẩm giống, không tự bịa ra số."
                  if vi else f"The system tries four methods in order and stops at the first that works. This one: {f.get('method', '')}. AI only finds similar products; it never invents the number.")
        bullets = list(f.get("formula_steps") or [])[-3:]
    elif topic in ("category", "greener_alternative"):
        st = f.get("category_stats") or {}
        title = "So với sản phẩm cùng loại" if vi else "Compared with its category"
        answer = (f"Trong {fmt_number(st.get('n'), L, 0)} sản phẩm cùng loại, mức giữa là {k(st.get('median_kg'))} kg; sản phẩm này xanh hơn {fmt_number(st.get('greener_than_pct'), L, 0)}% số còn lại."
                  if vi and st else f"Among {fmt_number(st.get('n'), L, 0)} similar products the median is {k(st.get('median_kg'))} kg; this one is greener than {fmt_number(st.get('greener_than_pct'), L, 0)}%."
                  if st else ("Chưa đủ dữ liệu thống kê cho loại này." if vi else "Not enough category data."))
        alt = f.get("greener_alternative")
        if alt:
            bullets.append(f"Món xanh hơn giá tương đương: {alt['name']}, {k(alt['co2e_kg'])} kg CO₂e." if vi
                           else f"Greener choice at a similar price: {alt['name']}, {k(alt['co2e_kg'])} kg CO₂e.")
    elif topic == "wefe":
        title = "Nước – Năng lượng – Lương thực – Hệ sinh thái" if vi else "Water – Energy – Food – Ecosystems"
        answer = ("Một lựa chọn mua sắm chạm tới cả bốn: điện than cần nhiều nước làm mát, rác điện tử ảnh hưởng đất canh tác, và CO₂ làm nóng khí hậu. Chọn món ít CO₂ hơn là giảm áp lực lên cả hệ thống đô thị."
                  if vi else "One purchase touches all four: coal power needs cooling water, e-waste harms farmland, CO₂ warms the climate. A lower-CO₂ choice eases the whole city system.")
    elif topic == "what_if":
        title = "Kịch bản mô phỏng" if vi else "What-if scenario"
        total = (scenario or {}).get("total_kg")
        answer = (f"Đây là mô phỏng: với các lựa chọn bạn đặt, tổng phát thải khoảng {k(total)} kg CO₂e, so với số chính thức {k(kg)} kg. Số chính thức không đổi."
                  if vi and total is not None else
                  f"This is a simulation: with your choices the total is about {k(total)} kg CO₂e versus the official {k(kg)} kg."
                  if total is not None else ("Thay đổi các nút gạt để xem phát thải thay đổi ra sao." if vi else "Change the toggles to see how emissions move."))
    follow = (["Vì sao sản xuất chiếm nhiều CO₂?", "Làm sao giảm CO₂ khi dùng?", "Có món nào xanh hơn không?"] if vi
              else ["Why is manufacturing so large?", "How can I cut CO₂ while using it?", "Is there a greener option?"])
    return {"title": title, "answer": answer, "bullets": bullets, "follow_ups": follow}


# ------------------------------------------------------------------ number check

_NUM = re.compile(r"\d[\d.,]*\d|\d")


def _candidates(token: str) -> set[float]:
    out = set()
    for thousands, decimal in ((".", ","), (",", ".")):
        t = token.replace(thousands, "").replace(decimal, ".")
        try:
            out.add(float(t))
        except ValueError:
            pass
    return out


def _allowed(*blobs: Any) -> list[float]:
    vals: list[float] = []

    def walk(x):
        if isinstance(x, bool):
            return
        if isinstance(x, (int, float)):
            vals.append(float(x))
        elif isinstance(x, str):
            for tok in _NUM.findall(x):
                vals.extend(_candidates(tok))
        elif isinstance(x, dict):
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)
    for b in blobs:
        walk(b)
    derived = []
    for v in vals:           # percentages written as 0.35 -> 35 %, and rounded forms
        derived.extend([v * 100, v / 1000])
    return vals + derived


def _number_ok(tok: str, allowed: list[float]) -> bool:
    for c in _candidates(tok):
        if c <= 12 and float(c).is_integer():
            return True     # counts like "4 cách", "3 năm", "2-4"
        for a in allowed:
            if abs(c - a) <= max(0.06, 0.012 * abs(a)):
                return True
    return False


def check_numbers(text: str, allowed: list[float]) -> tuple[str, int]:
    kept, failures = [], 0
    for sentence in re.split(r"(?<=[.!?…])\s+", (text or "").strip()):
        if not sentence:
            continue
        if all(_number_ok(tok, allowed) for tok in _NUM.findall(sentence)):
            kept.append(sentence)
        else:
            failures += 1
    return " ".join(kept), failures


# ------------------------------------------------------------------ entry point

def explain(co2: dict, stats: dict | None, related: dict | None, topic: str, question: str | None,
            lang: str, scenario: dict | None, call=llm_provider.structured_call) -> dict:
    topic = topic if topic in TOPICS else "free"
    lang = "en" if lang == "en" else "vi"
    facts = build_facts(co2, stats, related, lang)
    pid = str((co2.get("product") or {}).get("product_id"))
    key = json.dumps([pid, topic, (question or "").strip().lower(), scenario, lang], sort_keys=True, ensure_ascii=False)
    if key in _CACHE:
        _CACHE.move_to_end(key)
        return {**_CACHE[key], "cached": True}

    base = rule_based(topic, facts, lang, scenario)
    result = {"topic": topic, **base, "facts": facts, "model": "rule-based", "number_check_failures": 0}
    if llm_provider.provider() is not None and facts.get("co2e_kg") is not None:
        user = json.dumps({"lang": lang, "clicked": topic, "question": question, "facts": facts,
                           "scenario": scenario, "draft_answer": base}, ensure_ascii=False)
        try:
            out = call(SYSTEM, user, SCHEMA, name="explanation", effort="low", max_tokens=1200)
            allowed = _allowed(facts, scenario, question or "", base)
            answer, fails = check_numbers(out.get("answer", ""), allowed)
            bullets = []
            for b in out.get("bullets", [])[:4]:
                text, f = check_numbers(b, allowed)
                fails += f
                if text:
                    bullets.append(text)
            if answer:
                result.update(title=out.get("title") or base["title"], answer=answer, bullets=bullets,
                              follow_ups=[q for q in out.get("follow_ups", [])[:3] if q],
                              model=llm_provider.model_label(), number_check_failures=fails)
            else:
                result["number_check_failures"] = fails
        except Exception as error:  # no key, quota, timeout, invalid JSON: keep the rule-based answer
            print(f"explain: LLM failed ({error.__class__.__name__}: {str(error)[:120]})", flush=True)
    _CACHE[key] = result
    if len(_CACHE) > _CACHE_MAX:
        _CACHE.popitem(last=False)
    return {**result, "cached": False}
