"""Extract energy-relevant specs from Vietnamese product names / descriptions.

Retailers (Điện Máy Xanh, TGDĐ, FPT...) publish these fields in free text, e.g.
"Máy lạnh Daikin Inverter 1 HP", "Nhãn năng lượng 5 sao",
"Điện năng tiêu thụ: 1.02 kW/h" or "Tiêu thụ điện 280 kWh/năm".  Every field is
optional: the CO2 formula falls back to category defaults when one is missing.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

_NUM = r"(\d+(?:[.,]\d+)?)"


def _to_float(raw: str) -> float:
    return float(raw.replace(",", "."))


def _fold(text: str) -> str:
    """Lowercase + strip Vietnamese accents so regexes match both spellings."""
    text = unicodedata.normalize("NFKD", text.lower())
    text = "".join(c for c in text if not unicodedata.combining(c))
    return text.replace("đ", "d")


@dataclass
class ProductSpecs:
    energy_label_stars: int | None = None     # Vietnamese energy label, 1..5
    annual_kwh: float | None = None           # kWh/year (label value when present)
    daily_kwh: float | None = None            # kWh/day
    power_w: float | None = None              # rated power, W
    inverter: bool = False                    # inverter / DC motor technology
    cspf: float | None = None                 # AC seasonal performance factor
    cooling_hp: float | None = None           # AC capacity in HP
    cooling_btu: float | None = None          # AC capacity in BTU/h
    volume_l: float | None = None             # fridge / rice-cooker volume, litres
    load_kg: float | None = None              # washing-machine load, kg
    screen_inch: float | None = None          # TV / monitor size
    weight_kg: float | None = None            # product mass
    certifications: list[str] = field(default_factory=list)
    refurbished: bool = False                 # used / refurbished item

    def effective_annual_kwh(self) -> float | None:
        """Annual consumption directly stated on the product, if any."""
        if self.annual_kwh:
            return self.annual_kwh
        if self.daily_kwh:
            return self.daily_kwh * 365
        return None


_CERT_PATTERNS = {
    "energy_star": r"energy\s*star",
    "epeat": r"\bepeat\b",
    "tco": r"\btco\s*certified\b",
    "nhan_xanh_vn": r"nhan\s*xanh\s*viet\s*nam|vietnam\s*green\s*label",
    "eu_ecolabel": r"eu\s*ecolabel",
    "rohs": r"\brohs\b",
}


def parse_specs(*texts: str | None) -> ProductSpecs:
    """Parse all given texts (name, short description, description...)."""
    raw = " \n ".join(t for t in texts if t)
    s = _fold(raw)
    specs = ProductSpecs()

    # Energy label: "nhãn năng lượng 5 sao", "5 sao năng lượng", "tiết kiệm điện 5 sao"
    m = re.search(r"nhan\s*nang\s*luong[^0-9]{0,20}([1-5])\s*sao", s) or re.search(
        r"([1-5])\s*sao\s*(?:nang\s*luong|tiet\s*kiem)", s
    )
    if m:
        specs.energy_label_stars = int(m.group(1))

    m = re.search(_NUM + r"\s*kwh\s*/\s*(?:nam|year)", s)
    if m:
        specs.annual_kwh = _to_float(m.group(1))
    m = re.search(_NUM + r"\s*kwh\s*/\s*(?:ngay|day|24\s*h)", s)
    if m:
        specs.daily_kwh = _to_float(m.group(1))

    # Rated power: prefer a value introduced by "công suất"; otherwise the first "<n> W".
    m = re.search(r"cong\s*suat[^0-9]{0,40}" + _NUM + r"\s*(kw|w)\b", s) or re.search(
        r"(?<![a-z0-9])" + _NUM + r"\s*(kw|w)\b(?!\s*/)", s
    )  # the look-behind keeps model codes such as "FV1409S4W" from reading as 4 W
    if m:
        value = _to_float(m.group(1))
        specs.power_w = value * 1000 if m.group(2) == "kw" else value

    specs.inverter = bool(re.search(r"inverter|\bdc\s*(?:motor|inverter)|dong\s*co\s*dc", s))

    m = re.search(r"cspf[^0-9]{0,10}" + _NUM, s)
    if m:
        specs.cspf = _to_float(m.group(1))

    m = re.search(_NUM + r"\s*hp\b", s)
    if m:
        specs.cooling_hp = _to_float(m.group(1))
    m = re.search(_NUM + r"\s*btu", s)
    if m:
        specs.cooling_btu = _to_float(m.group(1).replace(".", "").replace(",", ""))
    if specs.cooling_hp is None and specs.cooling_btu:
        specs.cooling_hp = round(specs.cooling_btu / 9000, 1)

    m = re.search(_NUM + r"\s*(?:lit|l)\b", s)
    if m:
        specs.volume_l = _to_float(m.group(1))
    m = re.search(r"(?:giat|long\s*giat|khoi\s*luong\s*giat)[^0-9]{0,20}" + _NUM + r"\s*kg", s)
    if m:
        specs.load_kg = _to_float(m.group(1))
    m = re.search(_NUM + r"\s*-?\s*(?:inch|\"|”|″)", s)  # 27 inch, 27-inch, 27", 27”
    if m:
        specs.screen_inch = _to_float(m.group(1))
    m = re.search(r"(?:khoi\s*luong|trong\s*luong|nang)[^0-9]{0,20}" + _NUM + r"\s*kg", s)
    if m:
        specs.weight_kg = _to_float(m.group(1))

    specs.certifications = [k for k, p in _CERT_PATTERNS.items() if re.search(p, s)]
    specs.refurbished = bool(re.search(r"\b(cu|like\s*new|refurbished|tan\s*trang|da\s*qua\s*su\s*dung)\b", s))
    return specs
