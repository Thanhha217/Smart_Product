"""Deterministic lifecycle CO2 formula (advisor requirement #2).

Replaces "ask a 0.8B LLM for a number" with an explicit, auditable model:

    CO2_life = E_emb + L * (AEC * EF_grid + R_leak) + E_eol

    E_emb   embodied emissions (materials + manufacturing + transport), kg CO2e
    AEC     annual electricity consumption of THIS product, kWh/year
    EF_grid Vietnam grid emission factor, kg CO2e/kWh
    R_leak  refrigerant leakage per year = charge * GWP * leak_rate (AC / fridge)
    E_eol   end-of-life emissions (incl. refrigerant lost at disposal)
    L       service lifetime, years

Emissions attributed to T months of use (embodied amortised over lifetime):

    CO2(T) = (T/12) * (AEC * EF_grid + R_leak) + (T/12) / L * (E_emb + E_eol)

Savings vs a baseline product of the SAME capacity (non-inverter, 1-2 star):

    dCO2(T) = (T/12) * (AEC_b - AEC_p) * EF_grid                 # use phase
            + (T/12) / L * (E_emb_b - E_emb_p)                    # embodied
            + (T/12) * (R_leak_b - R_leak_p)                      # refrigerant

Full derivation and parameter sources: docs/research/co2-formula.md.  All
category defaults below are ASSUMPTIONS for Vietnamese households and must be
calibrated (energy label data, EPDs) before being reported as results.
"""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass, field

from green.spec_parser import ProductSpecs

# Vietnam grid emission factor (kg CO2e / kWh). Default = 2023 factor published
# by the Ministry of Natural Resources and Environment (0.6592 tCO2/MWh) --
# verify against the latest official announcement before publishing.
EF_GRID = float(os.environ.get("CO2_GRID_EF", "0.6592"))
# Average household electricity price (VND/kWh), EVN tiered tariff -- assumption.
ELECTRICITY_PRICE_VND = float(os.environ.get("ELECTRICITY_PRICE_VND", "2700"))
# CO2 absorbed by one mature tree per year (kg) -- used only for a friendly equivalent.
TREE_KG_PER_YEAR = 21.8

# Efficiency multipliers applied to the category baseline consumption.
INVERTER_FACTOR = {"air_conditioners": 0.65, "refrigerators": 0.70, "washing_machines": 0.75,
                   "electric_fans": 0.50, "air_purifiers": 0.60, "rice_cookers": 0.85}
STAR_STEP = 0.08            # each energy-label star above 1 cuts consumption by ~8 %
REFURBISHED_EMBODIED = 0.2  # reuse avoids ~80 % of manufacturing emissions


@dataclass(frozen=True)
class CategoryParams:
    lifetime_years: float
    baseline_kwh_year: float      # standard (non-inverter, low-star) unit of reference size
    embodied_kg: float            # E_emb of the reference-size unit
    eol_kg: float = 0.0
    size_attr: str | None = None  # ProductSpecs attribute used to scale the unit
    ref_size: float | None = None
    size_exponent: float = 1.0    # consumption/embodied ~ (size/ref_size) ** exponent
    hours_per_day: float = 0.0    # used when only rated power is known
    days_per_year: float = 365
    load_factor: float = 1.0      # average draw / rated power
    refrigerant_charge_kg: float = 0.0
    refrigerant_gwp: float = 0.0
    refrigerant_leak_rate: float = 0.0   # fraction of charge lost per year
    refrigerant_eol_loss: float = 0.0    # fraction lost at disposal


# ---- Default parameters (assumptions, see docs/research/co2-formula.md) ----
CATEGORY_PARAMS: dict[str, CategoryParams] = {
    # Home appliances (focus group "appliances")
    "air_conditioners": CategoryParams(10, 1300, 300, 20, "cooling_hp", 1.0, 1.0, 8, 300, 0.8,
                                       refrigerant_charge_kg=0.6, refrigerant_gwp=675,
                                       refrigerant_leak_rate=0.03, refrigerant_eol_loss=0.3),
    "refrigerators": CategoryParams(12, 420, 300, 15, "volume_l", 300, 0.7, 24, 365, 0.4,
                                    refrigerant_charge_kg=0.06, refrigerant_gwp=3,
                                    refrigerant_leak_rate=0.01, refrigerant_eol_loss=0.3),
    "washing_machines": CategoryParams(10, 90, 250, 10, "load_kg", 9, 0.6, 1, 250, 1.0),
    "televisions": CategoryParams(8, 180, 330, 10, "screen_inch", 55, 1.3, 5, 365, 0.6),
    "electric_fans": CategoryParams(7, 160, 25, 2, None, None, 1.0, 8, 365, 1.0),
    "rice_cookers": CategoryParams(6, 130, 20, 2, "volume_l", 1.8, 0.5, 1, 365, 0.5),
    "air_purifiers": CategoryParams(7, 130, 40, 3, None, None, 1.0, 8, 365, 0.5),
    "water_purifiers": CategoryParams(8, 60, 50, 5, None, None, 1.0, 24, 365, 0.05),
    "vacuum_cleaners": CategoryParams(6, 40, 50, 4, None, None, 1.0, 0.5, 365, 1.0),
    "microwaves_ovens": CategoryParams(8, 60, 80, 5, None, None, 1.0, 0.2, 365, 1.0),
    "stoves": CategoryParams(8, 400, 60, 5, None, None, 1.0, 1, 365, 0.5),
    "lighting": CategoryParams(8, 20, 2, 0.2, None, None, 1.0, 6, 365, 1.0),
    # Consumer electronics (focus group "electronics")
    "smartphones": CategoryParams(3, 4, 55, 1),
    "laptops": CategoryParams(4, 30, 250, 3),
    "gaming_laptops": CategoryParams(4, 90, 350, 4),
    "tablets": CategoryParams(4, 8, 90, 1),
    "monitors": CategoryParams(6, 45, 350, 5, "screen_inch", 27, 1.2, 6, 250, 0.8),
    "desktops": CategoryParams(5, 200, 400, 5, None, None, 1.0, 6, 250, 0.5),
    "smartwatches": CategoryParams(3, 1, 35, 0.5),
    "headphones": CategoryParams(3, 1, 10, 0.5),
    "speakers": CategoryParams(5, 5, 20, 1),
}

# Relative uncertainty of the use-phase term by data source.
_USE_UNCERTAINTY = {"label": 0.10, "rated_power": 0.25, "category_default": 0.40}
_EMBODIED_UNCERTAINTY = 0.30


@dataclass
class HorizonCO2:
    months: int
    kwh: float
    use_kg: float
    refrigerant_kg: float
    embodied_share_kg: float
    total_kg: float
    cost_vnd: float


@dataclass
class CO2Result:
    category: str
    annual_kwh: float
    kwh_source: str                 # label | rated_power | category_default
    embodied_kg: float
    eol_kg: float
    use_kg_per_year: float
    refrigerant_kg_per_year: float
    lifetime_years: float
    lifecycle_kg: float
    lifecycle_low_kg: float
    lifecycle_high_kg: float
    horizons: list[HorizonCO2] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def _size_scale(params: CategoryParams, specs: ProductSpecs) -> float:
    if not params.size_attr or not params.ref_size:
        return 1.0
    size = getattr(specs, params.size_attr, None)
    if not size or size <= 0:
        return 1.0
    return (size / params.ref_size) ** params.size_exponent


def baseline_annual_kwh(category: str, specs: ProductSpecs) -> float:
    """Consumption of a standard unit with the same capacity (the comparison baseline)."""
    params = CATEGORY_PARAMS[category]
    return params.baseline_kwh_year * _size_scale(params, specs)


def product_annual_kwh(category: str, specs: ProductSpecs) -> tuple[float, str]:
    """AEC of the product and where the number came from."""
    params = CATEGORY_PARAMS[category]
    stated = specs.effective_annual_kwh()
    if stated:
        return stated, "label"
    if specs.power_w and params.hours_per_day:
        kwh = specs.power_w * params.hours_per_day * params.days_per_year * params.load_factor / 1000
        if specs.inverter:
            kwh *= INVERTER_FACTOR.get(category, 1.0)
        return kwh, "rated_power"
    kwh = baseline_annual_kwh(category, specs)
    if specs.inverter:
        kwh *= INVERTER_FACTOR.get(category, 1.0)
    if specs.energy_label_stars:
        kwh *= max(0.5, 1 - STAR_STEP * (specs.energy_label_stars - 1))
    return kwh, "category_default"


def _refrigerant_per_year(params: CategoryParams) -> float:
    return params.refrigerant_charge_kg * params.refrigerant_gwp * params.refrigerant_leak_rate


def _embodied(category: str, specs: ProductSpecs, embodied_override: float | None) -> float:
    params = CATEGORY_PARAMS[category]
    embodied = embodied_override if embodied_override is not None else params.embodied_kg * _size_scale(params, specs)
    if specs.refurbished:
        embodied *= REFURBISHED_EMBODIED
    return embodied


def estimate_co2(
    category: str,
    specs: ProductSpecs,
    horizons_months: tuple[int, ...] = (6, 12),
    embodied_override: float | None = None,
    ef_grid: float = EF_GRID,
) -> CO2Result:
    """Lifecycle CO2 of one product.

    ``embodied_override`` lets a better embodied value (EPD, reference seed or
    LLM estimate) replace the category default.
    """
    if category not in CATEGORY_PARAMS:
        raise KeyError(f"No CO2 parameters for category {category!r}")
    params = CATEGORY_PARAMS[category]

    annual_kwh, source = product_annual_kwh(category, specs)
    embodied = _embodied(category, specs, embodied_override)
    eol = params.eol_kg + params.refrigerant_charge_kg * params.refrigerant_gwp * params.refrigerant_eol_loss
    use_year = annual_kwh * ef_grid
    refrigerant_year = _refrigerant_per_year(params)
    life = params.lifetime_years

    lifecycle = embodied + life * (use_year + refrigerant_year) + eol
    u_use, u_emb = _USE_UNCERTAINTY[source], _EMBODIED_UNCERTAINTY
    low = embodied * (1 - u_emb) + life * (use_year * (1 - u_use) + refrigerant_year) + eol
    high = embodied * (1 + u_emb) + life * (use_year * (1 + u_use) + refrigerant_year) + eol

    horizons = []
    for months in horizons_months:
        years = months / 12
        use_kg = years * use_year
        refr_kg = years * refrigerant_year
        share = years / life * (embodied + eol)
        horizons.append(HorizonCO2(
            months=months,
            kwh=round(years * annual_kwh, 1),
            use_kg=round(use_kg, 2),
            refrigerant_kg=round(refr_kg, 2),
            embodied_share_kg=round(share, 2),
            total_kg=round(use_kg + refr_kg + share, 2),
            cost_vnd=round(years * annual_kwh * ELECTRICITY_PRICE_VND),
        ))

    return CO2Result(
        category=category,
        annual_kwh=round(annual_kwh, 1),
        kwh_source=source,
        embodied_kg=round(embodied, 1),
        eol_kg=round(eol, 1),
        use_kg_per_year=round(use_year, 2),
        refrigerant_kg_per_year=round(refrigerant_year, 2),
        lifetime_years=life,
        lifecycle_kg=round(lifecycle, 1),
        lifecycle_low_kg=round(low, 1),
        lifecycle_high_kg=round(high, 1),
        horizons=horizons,
    )


@dataclass
class Savings:
    months: int
    kwh_saved: float
    co2_use_saved_kg: float
    co2_embodied_saved_kg: float
    co2_net_saved_kg: float
    money_saved_vnd: float
    trees_equivalent: float     # trees needed for a year to absorb the same CO2


def estimate_savings(
    category: str,
    specs: ProductSpecs,
    horizons_months: tuple[int, ...] = (6, 12),
    baseline_specs: ProductSpecs | None = None,
    ef_grid: float = EF_GRID,
) -> list[Savings]:
    """CO2 avoided by choosing this product instead of a standard unit of the same capacity.

    The baseline shares the product's capacity (HP, litres, inches...) but has
    no inverter, no energy label bonus and is new (not refurbished).
    """
    params = CATEGORY_PARAMS[category]
    if baseline_specs is None:
        baseline_specs = ProductSpecs(
            cooling_hp=specs.cooling_hp, volume_l=specs.volume_l, load_kg=specs.load_kg,
            screen_inch=specs.screen_inch,
        )
    aec_p, _ = product_annual_kwh(category, specs)
    aec_b = baseline_annual_kwh(category, baseline_specs)
    emb_p = _embodied(category, specs, None)
    emb_b = _embodied(category, baseline_specs, None)

    out = []
    for months in horizons_months:
        years = months / 12
        kwh = years * (aec_b - aec_p)
        use = kwh * ef_grid
        emb = years / params.lifetime_years * (emb_b - emb_p)
        net = use + emb
        out.append(Savings(
            months=months,
            kwh_saved=round(kwh, 1),
            co2_use_saved_kg=round(use, 2),
            co2_embodied_saved_kg=round(emb, 2),
            co2_net_saved_kg=round(net, 2),
            money_saved_vnd=round(kwh * ELECTRICITY_PRICE_VND),
            trees_equivalent=round(net / TREE_KG_PER_YEAR, 2),
        ))
    return out
