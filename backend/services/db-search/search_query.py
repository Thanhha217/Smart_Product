"""Understand a shopper's search text (vi / en / fr) without guessing.

parse_query("Laptop Dell dưới 20 triệu ít CO2") ->
    category="laptops", brand="Dell", max_price=20_000_000, eco=True, terms=[]

Only explicit conditions are extracted (category words, known brands, budgets, a
low-CO2 intent). Whatever is left becomes free-text terms that must all appear in the
product name. A category the catalogue does not carry (air conditioners, fridges...)
is reported in `unsupported` instead of being silently mapped to something else.
Pure Python: unit-tested in tests/test_search_query.py.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import asdict, dataclass, field

# taxonomy slug -> words (accent-folded, lower case) that name it
CATEGORY_WORDS: dict[str, tuple[str, ...]] = {
    "laptops": ("laptop", "laptops", "may tinh xach tay", "notebook", "macbook", "ordinateur portable", "portable"),
    "monitors": ("man hinh", "monitor", "monitors", "ecran", "ecrans"),
    "smartphones": ("dien thoai", "smartphone", "smartphones", "phone", "iphone", "telephone", "mobile"),
    "headphones": ("tai nghe", "headphone", "headphones", "earbuds", "earphone", "airpods", "casque", "ecouteurs"),
    "smartwatches": ("dong ho thong minh", "dong ho", "smartwatch", "smartwatches", "watch", "montre connectee", "montre"),
    "tablets": ("may tinh bang", "tablet", "tablets", "ipad", "tablette"),
}
# categories people ask for that the catalogue does not contain (yet)
UNSUPPORTED_WORDS: dict[str, tuple[str, ...]] = {
    "air_conditioners": ("dieu hoa", "may lanh", "air conditioner", "aircon", "climatiseur", "climatisation"),
    "refrigerators": ("tu lanh", "fridge", "refrigerator", "refrigerateur", "frigo"),
    "washing_machines": ("may giat", "washing machine", "washer", "lave linge", "lave-linge"),
    "televisions": ("tivi", "television", "televisions", "smart tv", "televiseur"),
    "rice_cookers": ("noi com", "rice cooker", "cuiseur a riz"),
    "fans": ("quat", "fan", "ventilateur"),
}
BRANDS = ("Apple", "Dell", "HP", "Lenovo", "Asus", "Acer", "MSI", "Samsung", "Xiaomi", "OPPO", "Vivo", "Realme",
          "LG", "Sony", "Logitech", "Huawei", "Microsoft", "Surface", "Gigabyte", "AOC", "ViewSonic", "Philips",
          "JBL", "Sennheiser", "Garmin", "Amazfit", "Nokia", "Masstel", "Tecno", "Infinix", "Honor", "Google",
          "Nothing", "Razer", "Corsair", "HyperX", "Marshall", "Bose", "Edifier", "Soundpeats", "Baseus", "Anker",
          "Lenovo LOQ", "Gigabyte Aorus", "Dareu", "E-Dra", "Havit", "Itel", "Poco", "OnePlus", "Redmi", "Coolpad")
# product lines whose names never say the brand
BRAND_ALIASES = {"Apple": ("apple", "iphone", "ipad", "macbook", "airpods", "imac", "mac mini"),
                 "Samsung": ("samsung", "galaxy"), "Xiaomi": ("xiaomi", "redmi", "poco"),
                 "Microsoft": ("microsoft", "surface"), "Huawei": ("huawei", "matebook", "matepad")}
ECO_WORDS = ("it co2", "it co 2", "it phat thai", "xanh nhat", "than thien moi truong", "tiet kiem dien", "low co2",
             "low carbon", "eco", "greenest", "green", "faible co2", "bas carbone", "ecologique", "peu d emissions")
STOP_WORDS = {"tim", "mua", "cho", "toi", "minh", "can", "muon", "goi y", "de", "hoc", "lam", "viec", "choi", "game",
              "nao", "gi", "co", "va", "la", "voi", "find", "buy", "for", "me", "a", "an", "the", "with", "best",
              "good", "cheap", "re", "tot", "nhat", "chon", "giup", "trouver", "pour", "un", "une", "le", "la", "les",
              "des", "avec", "meilleur", "pas", "cher", "sinh", "vien", "van", "phong", "nhe", "manh", "dep", "gia"}


def fold(text: str | None) -> str:
    """Lower case, accents removed, đ -> d, punctuation to spaces, single spaces."""
    t = unicodedata.normalize("NFKD", (text or "").lower())
    t = "".join(c for c in t if not unicodedata.combining(c)).replace("đ", "d")
    t = re.sub(r"[^a-z0-9.,/+\- ]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


@dataclass
class ParsedQuery:
    raw: str = ""
    category: str | None = None
    unsupported: str | None = None
    brand: str | None = None
    min_price: float | None = None
    max_price: float | None = None
    eco: bool = False
    terms: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


_NUM = r"(\d+(?:[.,]\d+)?)"
_UNIT = r"\s*(trieu|tr|million|millions|m|k|nghin|ngan|d|vnd|dong)?\b"


def _money(value: str, unit: str | None) -> float:
    v = value.replace(",", ".")
    if unit in (None, "", "d", "vnd", "dong") and re.fullmatch(r"\d{1,3}(\.\d{3})+", value):
        return float(value.replace(".", ""))          # 20.000.000 written with dots
    n = float(v)
    if unit in ("trieu", "tr", "million", "millions", "m"):
        return n * 1_000_000
    if unit in ("k", "nghin", "ngan"):
        return n * 1_000
    return n * 1_000_000 if n < 1000 else n            # a bare "20" in a budget phrase means millions


def _cut(text: str, phrase: str) -> str:
    return re.sub(rf"(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])", " ", text)


def parse_query(raw: str | None) -> ParsedQuery:
    q = ParsedQuery(raw=(raw or "").strip())
    text = f" {fold(raw)} "

    # budget: range first, then upper / lower bounds
    m = re.search(rf"(?:tu|from|de|entre)?\s*{_NUM}{_UNIT}\s*(?:-|den|to|a|et)\s*{_NUM}{_UNIT}", text)
    if m and (m.group(2) or m.group(4)):
        unit = m.group(4) or m.group(2)
        q.min_price, q.max_price = _money(m.group(1), m.group(2) or unit), _money(m.group(3), unit)
        text = text.replace(m.group(0), " ")
    for pattern, attr in ((rf"(?:duoi|toi da|khong qua|under|below|less than|max|moins de|sous|<)\s*{_NUM}{_UNIT}", "max_price"),
                          (rf"(?:tren|it nhat|over|above|more than|min|plus de|>)\s*{_NUM}{_UNIT}", "min_price")):
        m = re.search(pattern, text)
        if m:
            setattr(q, attr, _money(m.group(1), m.group(2)))
            text = text.replace(m.group(0), " ")

    for phrase in sorted(ECO_WORDS, key=len, reverse=True):
        if re.search(rf"(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])", text):
            q.eco = True
            text = _cut(text, phrase)

    for slug, words in UNSUPPORTED_WORDS.items():
        for w in sorted(words, key=len, reverse=True):
            if re.search(rf"(?<![a-z0-9]){re.escape(w)}(?![a-z0-9])", text):
                q.unsupported = slug
                text = _cut(text, w)
                break
        if q.unsupported:
            break
    if not q.unsupported:
        best = None
        for slug, words in CATEGORY_WORDS.items():
            for w in words:
                if re.search(rf"(?<![a-z0-9]){re.escape(w)}(?![a-z0-9])", text) and (best is None or len(w) > len(best[1])):
                    best = (slug, w)
        if best:
            q.category = best[0]
            # brand-like category words (iphone, ipad, macbook, airpods) also stay as search terms
            if best[1] not in ("iphone", "ipad", "macbook", "airpods"):
                text = _cut(text, best[1])

    for brand in sorted(BRANDS, key=len, reverse=True):
        b = fold(brand)
        if re.search(rf"(?<![a-z0-9]){re.escape(b)}(?![a-z0-9])", text):
            q.brand = brand.split()[0] if brand.split()[0] not in ("Gigabyte",) else brand.split()[0]
            text = _cut(text, b)
            break

    terms = []
    for tok in re.findall(r"[a-z0-9][a-z0-9.+\-/]*", text):
        if tok not in STOP_WORDS and len(tok) > 1 or (tok.isdigit() and len(tok) >= 1 and tok not in STOP_WORDS):
            if tok not in STOP_WORDS:
                terms.append(tok)
    q.terms = terms[:6]
    return q
