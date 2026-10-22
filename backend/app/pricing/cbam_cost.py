"""CBAM certificate cost per shipment: EU default values vs verified actual emissions.

  obligation_t = tonnes * max(0, SEE - benchmark * free_allocation_factor(year))
  cost_eur     = obligation_t * certificate_price - eligible carbon price paid at origin

The benchmark follows the CBAM benchmark table: the default path uses the benchmark for
goods declared with default values; the verified path applies the precursor benchmark
through the plant's actual precursor ratio (clinker per tonne of cement). All rates come
from config/pricing.yaml and the sector config.
"""

from pydantic import BaseModel

from app import config


class CostLine(BaseModel):
    basis: str  # "default" or "verified"
    see_tco2_per_t: float
    benchmark_deduction_tco2_per_t: float
    obligation_tco2: float
    gross_cost_eur: float
    carbon_price_deduction_eur: float
    net_cost_eur: float


class CostComparison(BaseModel):
    sector: str
    year: int
    tonnes: float
    certificate_price_eur: float
    default: CostLine
    verified: CostLine
    saving_eur: float
    assumptions: list[str]


def _benchmarks(sector_cfg: dict, precursor_ratio: float | None) -> tuple[float, float]:
    """(default-values benchmark, actual-data benchmark) in t CO2 per tonne of product."""
    b = sector_cfg["benchmark"]
    default = b["cement_default_values_tco2_per_t"]
    actual = b["clinker_tco2_per_t"] * precursor_ratio if precursor_ratio is not None else default
    return default, actual


def _default_see(sector_cfg: dict, year: int) -> float:
    """EU default value for the year, including the mark-up that applies to it."""
    d = sector_cfg["defaults"]
    markups = d["markup_by_year"]
    markup = markups.get(year, markups[max(markups)] if year > max(markups) else 0.0)
    return round(d["see_total_tco2_per_t"] * (1 + markup), 4)


def _line(basis, see, tonnes, deduction, price, carbon_paid) -> CostLine:
    obligation = tonnes * max(0.0, see - deduction)
    gross = obligation * price
    paid = min(carbon_paid, gross)
    return CostLine(
        basis=basis, see_tco2_per_t=round(see, 4), benchmark_deduction_tco2_per_t=round(deduction, 4),
        obligation_tco2=round(obligation, 1), gross_cost_eur=round(gross, 2),
        carbon_price_deduction_eur=round(paid, 2), net_cost_eur=round(gross - paid, 2),
    )


def compare(
    sector: str, tonnes: float, verified_see: float, year: int = 2026,
    carbon_price_paid_eur: float = 0.0, certificate_price_eur: float | None = None,
    precursor_ratio: float | None = None,
) -> CostComparison:
    p = config.load("pricing")
    s = config.load(sector)
    price = certificate_price_eur if certificate_price_eur is not None else p["certificate_price_eur"]
    fa = p["free_allocation_factor_by_year"].get(year, 0.0) if p["apply_free_allocation_adjustment"] else 0.0
    bm_default, bm_actual = _benchmarks(s, precursor_ratio)

    default_see = _default_see(s, year)
    default = _line("default", default_see, tonnes, bm_default * fa, price, 0.0)
    verified = _line("verified", verified_see, tonnes, bm_actual * fa, price, carbon_price_paid_eur)
    return CostComparison(
        sector=sector, year=year, tonnes=tonnes, certificate_price_eur=price,
        default=default, verified=verified,
        saving_eur=round(default.net_cost_eur - verified.net_cost_eur, 2),
        assumptions=[
            f"Certificate price {price} EUR/t ({p['certificate_price_source']})",
            f"Free-allocation factor {fa} for {year}; benchmark {bm_default:.3f} t CO2/t on default values, "
            f"{bm_actual:.3f} t CO2/t on verified data ({s['benchmark']['source']})",
            f"Default value {default_see} t CO2/t incl. {year} mark-up ({s['defaults']['source']})",
            "Carbon price paid at origin deducted only from the verified path, capped at gross cost (simplified)",
        ],
    )


def schedule(
    sector: str, tonnes: float, verified_see: float, carbon_price_paid_eur: float = 0.0,
    precursor_ratio: float | None = None,
) -> list[CostComparison]:
    """Cost comparison for every year in the free-allocation phase-out (for year selectors and charts)."""
    years = sorted(config.load("pricing")["free_allocation_factor_by_year"])
    return [compare(sector, tonnes, verified_see, year=y, carbon_price_paid_eur=carbon_price_paid_eur,
                    precursor_ratio=precursor_ratio) for y in years]
