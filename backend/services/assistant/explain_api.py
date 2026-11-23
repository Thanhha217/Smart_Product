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
          "end_of_life", "formula", "category", "greener_alternative", "wefe", "what_if", "insight", "free")
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
Write in the requested language (en = English, fr = natural French, vi = natural Vietnamese).

Return JSON: title (max 8 words), answer (2-4 short sentences answering the click or the question),
bullets (0-4 short facts or tips), follow_ups (2-3 short questions the user may want to ask next, same language).

Rules:
- Use ONLY numbers that appear in `facts` or `scenario`. Never invent a figure, a percentage or a source.
  If the facts do not contain what is asked, say the system does not have that number.
- CO2 figures are estimates; say which method produced the number when relevant (facts.method).
- A scenario is a what-if simulation, not the product's official figure (facts.co2e_kg).
- Encourage lower-CO2 choices with reasons tied to the facts, without exaggerating.
- No markdown, no emojis.
- When clicked is "insight": a short buying insight for this product. Say why it is (or is not) a good lower-CO2
  choice compared with its category (category_stats), which stage of its life weighs most, and one action that
  lowers its footprint (use it longer, recycle it). Be encouraging but honest: if it emits more than the category
  median, say so and point to the greener alternative when facts have one."""


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
        "assumed_origin": ({"CN": "Chine", "VN": "Vietnam", "TH": "Thaïlande", "MY": "Malaisie"}.get(route.get("origin_code"), route.get("origin_en"))
                           if lang == "fr" else route.get("origin_vi" if vi else "origin_en")),
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

def _stage_line(f: dict, key: str, lang: str) -> str | None:
    s = (f.get("stages_kg_and_percent") or {}).get(key)
    if not s:
        return None
    kg, pct = fmt_kg(s["kg"], lang), fmt_number(s["pct"], lang)
    return {"vi": f"Chặng này chiếm {kg} kg CO₂e, tức {pct}% cả vòng đời.",
            "fr": f"Cette étape représente {kg} kg CO₂e, soit {pct} % du cycle de vie."}.get(
        lang, f"This stage is {kg} kg CO₂e, {pct}% of the lifecycle.")


def rule_based(topic: str, f: dict, lang: str, scenario: dict | None = None) -> dict:
    """A plain-language answer for every topic in English, French and Vietnamese, from the facts only."""
    L = lang if lang in ("vi", "fr") else "en"

    def T(vi: str, en: str, fr: str) -> str:
        return {"vi": vi, "fr": fr}.get(L, en)

    kg = f.get("co2e_kg")
    k = lambda x: fmt_kg(x, L)  # noqa: E731
    n = lambda x, d=1: fmt_number(x, L, d)  # noqa: E731
    method = f.get("method", "")
    title, answer, bullets = "", "", []
    if kg is None:
        return {"title": T("Chưa có số CO₂", "No CO₂ figure", "Pas encore de chiffre CO₂"),
                "answer": T("Hệ thống chưa đủ căn cứ để tính CO₂ cho sản phẩm này nên để trống, không đoán.",
                            "The system lacks reliable data for this product, so it leaves the number empty instead of guessing.",
                            "Le système n’a pas assez de données fiables pour ce produit : il laisse le chiffre vide plutôt que de deviner."),
                "bullets": [], "follow_ups": []}
    if topic in ("co2e_total", "free"):
        title = T("Tổng CO₂ của sản phẩm", "The product's total CO₂", "Le CO₂ total du produit")
        answer = T(f"Trong cả vòng đời, từ khai thác nguyên liệu đến thải bỏ, sản phẩm này gây ra khoảng {k(kg)} kg CO₂e. Cách tính: {method}.",
                   f"Over its whole life, from mining to disposal, this product causes about {k(kg)} kg CO₂e. Method: {method}.",
                   f"Sur tout son cycle de vie, de l’extraction au recyclage, ce produit émet environ {k(kg)} kg CO₂e. Méthode : {method}.")
        if f.get("trees_for_one_year"):
            t = n(f["trees_for_one_year"])
            bullets.append(T(f"Bằng lượng CO₂ {t} cây xanh hấp thụ trong 1 năm.", f"What {t} trees absorb in a year.",
                             f"Ce qu’absorbent {t} arbres en un an."))
        if f.get("car_km_equivalent"):
            c = n(f["car_km_equivalent"], 0)
            bullets.append(T(f"Tương đương chạy ô tô xăng {c} km.", f"Like driving a petrol car {c} km.",
                             f"Comme rouler {c} km en voiture à essence."))
    elif topic == "green_score":
        g = n(f.get("green_score_0_5"))
        title = T("Điểm xanh 0–5", "Green score 0–5", "Score vert 0–5")
        answer = T(f"Điểm xanh so sản phẩm với các sản phẩm cùng loại: 5 là xanh nhất, 0 là phát thải nhiều nhất. Sản phẩm này được {g}/5.",
                   f"The green score compares the product with its category: 5 is greenest, 0 emits most. This one scores {g}/5.",
                   f"Le score vert compare le produit à sa catégorie : 5 est le plus sobre, 0 le plus émetteur. Celui-ci obtient {g}/5.")
    elif topic == "confidence":
        c = n((f.get("confidence") or 0) * 100, 0)
        title = T("Độ tin cậy của con số", "How reliable the number is", "Fiabilité du chiffre")
        answer = T(f"Độ tin cậy {c}% phản ánh cách tính: số của hãng cho đúng mẫu tin cậy nhất, rồi đến trung bình sản phẩm giống, mức điển hình của loại, và cuối cùng là ước tính theo giá.",
                   f"A confidence of {c}% reflects the method: the manufacturer's own figure is most reliable, then similar products, the category level, and finally the price estimate.",
                   f"Une confiance de {c} % reflète la méthode : le chiffre du fabricant est le plus fiable, puis la moyenne de produits similaires, le niveau typique de la catégorie, et enfin l’estimation par le prix.")
    elif topic in ("materials", "factory"):
        title = T("Khai thác và sản xuất", "Mining and manufacturing", "Extraction et fabrication")
        answer = T("Khai thác kim loại, làm chip, màn hình, pin và lắp ráp tiêu tốn rất nhiều năng lượng. Với đồ điện tử đây thường là phần phát thải lớn nhất.",
                   "Mining metals and making chips, screens and batteries take a lot of energy. For electronics this is usually the largest part.",
                   "Extraire les métaux et fabriquer puces, écrans et batteries demande beaucoup d’énergie. Pour l’électronique, c’est généralement la plus grosse part.")
        bullets = [x for x in (_stage_line(f, "materials_production", L),
                               T("Dùng lâu hơn hoặc mua máy tân trang giúp giảm phần này nhiều nhất.",
                                 "Keeping it longer or buying refurbished cuts this part most.",
                                 "Le garder plus longtemps ou acheter reconditionné réduit le plus cette part.")) if x]
    elif topic == "transport":
        sh = f.get("shipping") or {}
        origin, sea, road = f.get("assumed_origin") or T("nước ngoài", "abroad", "l’étranger"), n(sh.get("sea_km"), 0), n(sh.get("road_km"), 0)
        title = T("Vận chuyển về Việt Nam", "Shipping to Vietnam", "Transport jusqu’au Vietnam")
        answer = T(f"Sản phẩm được giả định sản xuất tại {origin}, đi {sea} km đường biển và {road} km đường bộ. Tàu biển phát thải rất ít trên mỗi kg hàng, máy bay thì gấp hàng chục lần.",
                   f"Assumed made in {origin}, it travels {sea} km by sea and {road} km by road. Ships emit very little per kg; planes dozens of times more.",
                   f"Fabrication supposée : {origin}. Il parcourt ensuite {sea} km par mer et {road} km par route. Le bateau émet très peu par kg ; l’avion des dizaines de fois plus.")
        bullets = [x for x in (_stage_line(f, "transport", L),) if x]
    elif topic in ("use", "grid"):
        ef = n(GRID_EF, 3)
        title = T("Dùng điện tại Việt Nam", "Using power in Vietnam", "L’électricité au Vietnam")
        answer = T(f"Mỗi kWh điện ở Việt Nam phát thải khoảng {ef} kg CO₂e vì lưới điện còn nhiều nhiệt điện than. Điện dùng càng nhiều, phát thải càng lớn.",
                   f"Each kWh in Vietnam emits about {ef} kg CO₂e because the grid still uses a lot of coal. The more power, the more emissions.",
                   f"Chaque kWh au Vietnam émet environ {ef} kg CO₂e, car le réseau dépend encore beaucoup du charbon. Plus on consomme, plus on émet.")
        if f.get("electricity_kwh_over_life"):
            e = n(f["electricity_kwh_over_life"], 0)
            bullets.append(T(f"Cả vòng đời dùng khoảng {e} kWh.", f"About {e} kWh over its life.", f"Environ {e} kWh sur sa durée de vie."))
        line = _stage_line(f, "use", L)
        if line:
            bullets.append(line)
    elif topic == "end_of_life":
        title = T("Thải bỏ và tái chế", "End of life", "Fin de vie")
        answer = T("Thu gom và tái chế phát thải ít, nhưng rác điện tử vứt sai chỗ làm kim loại nặng ngấm vào đất và nước. Hãy mang tới điểm thu gom rác điện tử.",
                   "Recycling emits little, but dumped e-waste leaks heavy metals into soil and water. Bring it to an e-waste point.",
                   "Le recyclage émet peu, mais les déchets électroniques abandonnés libèrent des métaux lourds dans le sol et l’eau. Déposez-les en point de collecte.")
        bullets = [x for x in (_stage_line(f, "end_of_life", L),) if x]
    elif topic == "formula":
        title = T("Công thức đã dùng", "The formula used", "La formule utilisée")
        answer = T(f"Hệ thống thử 4 cách theo thứ tự và dừng ở cách đầu tiên ra số. Sản phẩm này dùng: {method}. AI chỉ tìm sản phẩm giống, không tự bịa ra số.",
                   f"The system tries four methods in order and stops at the first that works. This one: {method}. AI only finds similar products; it never invents the number.",
                   f"Le système essaie quatre méthodes dans l’ordre et s’arrête à la première qui donne un chiffre. Ici : {method}. L’IA ne fait que trouver des produits similaires, elle n’invente jamais le chiffre.")
        bullets = list(f.get("formula_steps") or [])[-3:]
    elif topic in ("category", "greener_alternative"):
        st = f.get("category_stats") or {}
        title = T("So với sản phẩm cùng loại", "Compared with its category", "Comparé à sa catégorie")
        if st:
            cnt, med, pct = n(st.get("n"), 0), k(st.get("median_kg")), n(st.get("greener_than_pct"), 0)
            answer = T(f"Trong {cnt} sản phẩm cùng loại, mức giữa là {med} kg; sản phẩm này xanh hơn {pct}% số còn lại.",
                       f"Among {cnt} similar products the median is {med} kg; this one is greener than {pct}%.",
                       f"Parmi {cnt} produits similaires, la médiane est de {med} kg ; celui-ci est plus sobre que {pct} % d’entre eux.")
        else:
            answer = T("Chưa đủ dữ liệu thống kê cho loại này.", "Not enough category data.", "Pas assez de données pour cette catégorie.")
        alt = f.get("greener_alternative")
        if alt:
            bullets.append(T(f"Món xanh hơn giá tương đương: {alt['name']}, {k(alt['co2e_kg'])} kg CO₂e.",
                             f"Greener choice at a similar price: {alt['name']}, {k(alt['co2e_kg'])} kg CO₂e.",
                             f"Option plus sobre à prix similaire : {alt['name']}, {k(alt['co2e_kg'])} kg CO₂e."))
    elif topic == "wefe":
        title = T("Nước – Năng lượng – Lương thực – Hệ sinh thái", "Water – Energy – Food – Ecosystems",
                  "Eau – Énergie – Alimentation – Écosystèmes")
        answer = T("Một lựa chọn mua sắm chạm tới cả bốn: điện than cần nhiều nước làm mát, rác điện tử ảnh hưởng đất canh tác, và CO₂ làm nóng khí hậu. Chọn món ít CO₂ hơn là giảm áp lực lên cả hệ thống đô thị.",
                   "One purchase touches all four: coal power needs cooling water, e-waste harms farmland, CO₂ warms the climate. A lower-CO₂ choice eases the whole city system.",
                   "Un achat touche les quatre : l’électricité au charbon consomme de l’eau de refroidissement, les déchets électroniques abîment les terres agricoles, le CO₂ réchauffe le climat. Choisir plus sobre allège tout le système urbain.")
    elif topic == "insight":
        st = f.get("category_stats") or {}
        stages = f.get("stages_kg_and_percent") or {}
        alt = f.get("greener_alternative")
        pct = st.get("greener_than_pct")
        big = max(stages.items(), key=lambda kv: kv[1].get("pct") or 0) if stages else None
        stage_name = {"materials_production": T("sản xuất", "manufacturing", "la fabrication"),
                      "transport": T("vận chuyển", "transport", "le transport"),
                      "use": T("lúc sử dụng", "use", "l’usage"),
                      "end_of_life": T("thải bỏ", "end of life", "la fin de vie")}
        if pct is not None and st.get("median_kg") is not None and pct >= 99.5:
            # nothing in the category is lower: say that, instead of "lower than 100 % of them"
            title = T("Ít CO₂ nhất trong loại này", "The lowest CO₂ in its category", "Le CO₂ le plus bas de sa catégorie")
            answer = T(f"Trong {n(st.get('n') or 0, 0)} sản phẩm cùng loại đã có số CO₂, đây là mức thấp nhất: {k(kg)} kg so với mức giữa {k(st['median_kg'])} kg.",
                       f"Among the {n(st.get('n') or 0, 0)} products of its category that have a CO₂ figure, this is the lowest: {k(kg)} kg against a median of {k(st['median_kg'])} kg.",
                       f"Parmi les {n(st.get('n') or 0, 0)} produits de sa catégorie ayant un chiffre CO₂, c’est le plus bas : {k(kg)} kg contre une médiane de {k(st['median_kg'])} kg.")
        elif pct is not None and st.get("median_kg") is not None and pct >= 50:
            title = T("Vì sao nên chọn sản phẩm này", "Why this is a good pick", "Pourquoi c’est un bon choix")
            answer = T(f"Sản phẩm này ít CO₂ hơn {n(pct, 0)}% sản phẩm cùng loại: {k(kg)} kg so với mức giữa {k(st['median_kg'])} kg. Chọn nó là bạn đã giảm phát thải ngay từ lúc mua.",
                       f"It emits less CO₂ than {n(pct, 0)}% of its category: {k(kg)} kg against a median of {k(st['median_kg'])} kg. Choosing it cuts emissions from the moment you buy.",
                       f"Il émet moins de CO₂ que {n(pct, 0)} % de sa catégorie : {k(kg)} kg contre une médiane de {k(st['median_kg'])} kg. Le choisir réduit les émissions dès l’achat.")
        elif pct is not None and st.get("median_kg") is not None:
            title = T("Cân nhắc trước khi mua", "Worth a second look", "À réfléchir avant d’acheter")
            answer = T(f"Sản phẩm này thải {k(kg)} kg CO₂, cao hơn mức giữa {k(st['median_kg'])} kg của loại. Nếu thật sự cần, hãy dùng thật lâu; nếu không, có lựa chọn xanh hơn.",
                       f"It emits {k(kg)} kg CO₂, above its category median of {k(st['median_kg'])} kg. If you need it, keep it for a long time; otherwise a greener option exists.",
                       f"Il émet {k(kg)} kg de CO₂, au-dessus de la médiane de sa catégorie ({k(st['median_kg'])} kg). Si vous en avez besoin, gardez-le longtemps ; sinon, il existe plus sobre.")
        else:
            title = T("Nhận định nhanh", "Quick insight", "En bref")
            answer = T(f"Sản phẩm này thải khoảng {k(kg)} kg CO₂ trong cả vòng đời. Chưa đủ dữ liệu cùng loại để so sánh.",
                       f"It causes about {k(kg)} kg CO₂ over its life. There is not enough category data to compare it.",
                       f"Il émet environ {k(kg)} kg de CO₂ sur sa vie. Pas assez de données de catégorie pour comparer.")
        if big:
            key, val = big
            bullets.append(T(f"{n(val['pct'], 0)}% CO₂ nằm ở khâu {stage_name.get(key, key)}.",
                             f"{n(val['pct'], 0)}% of its CO₂ comes from {stage_name.get(key, key)}.",
                             f"{n(val['pct'], 0)} % de son CO₂ vient de {stage_name.get(key, key)}."))
            if key == "materials_production":
                bullets.append(T("Phần này đã thải ra trước khi bạn mua: dùng càng lâu, mỗi năm càng nhẹ.",
                                 "That part is spent before you buy: the longer you use it, the lighter each year.",
                                 "Cette part est émise avant l’achat : plus vous l’utilisez longtemps, plus chaque année est légère."))
            elif key == "use":
                bullets.append(T("Tắt hẳn khi không dùng và chọn chế độ tiết kiệm điện giúp giảm phần này.",
                                 "Switching it off fully and using power-saving mode cuts this part.",
                                 "L’éteindre complètement et utiliser le mode économie réduit cette part."))
        if alt and pct is not None and pct < 50:
            bullets.append(T(f"Món xanh hơn giá tương đương: {alt['name']}, {k(alt['co2e_kg'])} kg CO₂e.",
                             f"Greener choice at a similar price: {alt['name']}, {k(alt['co2e_kg'])} kg CO₂e.",
                             f"Option plus sobre à prix similaire : {alt['name']}, {k(alt['co2e_kg'])} kg CO₂e."))
        bullets.append(T("Hết dùng, mang tới điểm thu gom để vật liệu quay lại sản xuất.",
                         "At the end, bring it to a collection point so its materials go back into new products.",
                         "En fin de vie, déposez-le en point de collecte pour que ses matériaux servent à nouveau."))
    elif topic == "what_if":
        title = T("Kịch bản mô phỏng", "What-if scenario", "Scénario de simulation")
        total = (scenario or {}).get("total_kg")
        if total is not None:
            answer = T(f"Đây là mô phỏng: với các lựa chọn bạn đặt, tổng phát thải khoảng {k(total)} kg CO₂e, so với số chính thức {k(kg)} kg. Số chính thức không đổi.",
                       f"This is a simulation: with your choices the total is about {k(total)} kg CO₂e versus the official {k(kg)} kg.",
                       f"Ceci est une simulation : avec vos choix, le total est d’environ {k(total)} kg CO₂e contre {k(kg)} kg officiellement.")
        else:
            answer = T("Thay đổi các nút gạt để xem phát thải thay đổi ra sao.", "Change the toggles to see how emissions move.",
                       "Modifiez les réglages pour voir comment les émissions évoluent.")
    follow = {"vi": ["Vì sao sản xuất chiếm nhiều CO₂?", "Làm sao giảm CO₂ khi dùng?", "Có món nào xanh hơn không?"],
              "fr": ["Pourquoi la fabrication pèse-t-elle autant ?", "Comment réduire le CO₂ à l’usage ?", "Existe-t-il une option plus sobre ?"]
              }.get(L, ["Why is manufacturing so large?", "How can I cut CO₂ while using it?", "Is there a greener option?"])
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
    lang = lang if lang in ("en", "fr", "vi") else "en"
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
