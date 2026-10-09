"""Synthetic cement plant data (clearly labelled as synthetic), built from published ranges.

3 plants x 24 months with seasonal variation, plus labelled injected frauds so the
guard's detection rate can be reported honestly.
"""

import math
import random
from dataclasses import dataclass, field

from app.sectors.cement import CementInputs


@dataclass
class PlantProfile:
    id: str
    name: str
    city: str
    clinker_t: float  # monthly clinker production
    cement_type: str
    clinker_ratio: float
    fuel_mix: dict[str, float]  # share of thermal energy by fuel
    kiln_gj_per_t: float
    kwh_kiln_per_t_clk: float
    kwh_grind_per_t_cem: float
    cao: float = 0.655
    mgo: float = 0.018
    frauds: dict[int, str] = field(default_factory=dict)  # month index -> fraud type


PLANTS = [
    PlantProfile("TR-ANA-01", "Anatolia Cement (synthetic)", "Ankara", 95_000, "CEM_I", 0.93,
                 {"petcoke": 0.7, "coal": 0.25, "waste_tyres": 0.05}, 3.45, 32, 42),
    PlantProfile("TR-AEG-02", "Aegean Cement (synthetic)", "Izmir", 80_000, "CEM_II_A", 0.82,
                 {"petcoke": 0.45, "natural_gas": 0.15, "waste_tyres": 0.15, "biomass": 0.25}, 3.30, 30, 38),
    PlantProfile("TR-MAR-03", "Marmara Cement (synthetic)", "Kocaeli", 110_000, "CEM_I", 0.94,
                 {"petcoke": 0.6, "lignite": 0.4}, 3.70, 34, 45,
                 frauds={18: "calcination_floor", 20: "low_cao", 21: "hidden_fuel",
                         22: "inflated_output", 23: "sudden_drop"}),
]

NCV = {"petcoke": 32.5, "coal": 25.8, "lignite": 11.9, "natural_gas": 48.0,
       "fuel_oil": 40.4, "waste_tyres": 31.4, "biomass": 15.6}

FRAUD_TYPES = ["calcination_floor", "low_cao", "hidden_fuel", "inflated_output", "missing_electricity", "sudden_drop"]


def _month(p: PlantProfile, m: int, rng: random.Random, fraud: str | None) -> CementInputs:
    season = 1 + 0.12 * math.sin(2 * math.pi * (m - 3) / 12)  # construction season peaks mid-year
    clk = p.clinker_t * season * rng.gauss(1, 0.03)
    ratio = p.clinker_ratio * rng.gauss(1, 0.008)
    cement = clk / ratio * rng.gauss(1, 0.01)
    consumed = cement * ratio
    additives = cement - consumed
    gj = clk * p.kiln_gj_per_t * rng.gauss(1, 0.02)
    fuels = {f: round(gj * share / NCV[f], 1) for f, share in p.fuel_mix.items()}
    cao, mgo = p.cao + rng.gauss(0, 0.004), p.mgo + rng.gauss(0, 0.002)
    kiln_mwh = clk * p.kwh_kiln_per_t_clk * rng.gauss(1, 0.03) / 1000
    grind_mwh = cement * p.kwh_grind_per_t_cem * rng.gauss(1, 0.03) / 1000
    process_co2 = None
    note = None

    if fraud == "calcination_floor":
        process_co2 = clk * (0.785 * cao + 1.092 * mgo) * 0.80  # 20% below chemistry
    elif fraud == "low_cao":
        cao = 0.48
    elif fraud == "hidden_fuel":
        fuels = {f: round(q * 0.7, 1) for f, q in fuels.items()}
    elif fraud == "inflated_output":
        cement *= 1.12
    elif fraud == "missing_electricity":
        kiln_mwh *= 0.5
        grind_mwh *= 0.5
    elif fraud == "sudden_drop":
        fuels = {f: round(q * 0.78, 1) for f, q in fuels.items()}
        cao = 0.61

    return CementInputs(
        clinker_produced_t=round(clk, 1), clinker_consumed_t=round(consumed, 1),
        additives_t=round(additives, 1), cement_produced_t=round(cement, 1), cement_type=p.cement_type,
        clinker_cao=round(cao, 4), clinker_mgo=round(mgo, 4), fuels_t=fuels,
        electricity_kiln_mwh=round(kiln_mwh, 1), electricity_grinding_mwh=round(grind_mwh, 1),
        reported_process_co2_t=round(process_co2, 1) if process_co2 else None,
        declared_process_change=note,
        carbon_price_paid_eur=round(clk * 0.8 * 4.0, 2),  # placeholder Turkish ETS price paid
    )


def generate(months: int = 24, seed: int = 42) -> dict[str, list[tuple[str, CementInputs, str | None]]]:
    """Return {plant_id: [(period 'YYYY-MM', inputs, fraud_label_or_None), ...]}."""
    rng = random.Random(seed)
    out = {}
    for p in PLANTS:
        rows = []
        for m in range(months):
            period = f"{2025 + m // 12}-{m % 12 + 1:02d}"
            fraud = p.frauds.get(m)
            rows.append((period, _month(p, m, rng, fraud), fraud))
        out[p.id] = rows
    return out
