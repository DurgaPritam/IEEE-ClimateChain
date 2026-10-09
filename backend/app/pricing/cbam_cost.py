"""CBAM certificate cost per shipment: EU default values vs verified actual emissions.

  obligation_t = tonnes * max(0, SEE - benchmark * free_allocation_factor(year))
  cost_eur     = obligation_t * certificate_price - eligible carbon price paid at origin

Simplified: the free-allocation adjustment is applied to total SEE for both paths,
so the comparison stays like-for-like. All rates come from config/pricing.yaml and the
sector config.
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


def _benchmark(sector_cfg: dict) -> float:
    b = sector_cfg["benchmark"]
    return b["clinker_tco2_per_t"] * b["default_clinker_ratio"]


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
) -> CostComparison:
    p = config.load("pricing")
    s = config.load(sector)
    price = certificate_price_eur if certificate_price_eur is not None else p["certificate_price_eur"]
    fa = p["free_allocation_factor_by_year"].get(year, 0.0) if p["apply_free_allocation_adjustment"] else 0.0
    deduction = _benchmark(s) * fa

    default = _line("default", s["defaults"]["see_total_tco2_per_t"], tonnes, deduction, price, 0.0)
    verified = _line("verified", verified_see, tonnes, deduction, price, carbon_price_paid_eur)
    return CostComparison(
        sector=sector, year=year, tonnes=tonnes, certificate_price_eur=price,
        default=default, verified=verified,
        saving_eur=round(default.net_cost_eur - verified.net_cost_eur, 2),
        assumptions=[
            f"Certificate price {price} EUR/t ({p['certificate_price_source']})",
            f"Free-allocation factor {fa} for {year}, benchmark {_benchmark(s):.3f} t CO2/t",
            f"Default value {s['defaults']['see_total_tco2_per_t']} t CO2/t ({s['defaults']['source']})",
            "Carbon price paid at origin deducted only from the verified path, capped at gross cost (simplified)",
        ],
    )


def schedule(sector: str, tonnes: float, verified_see: float, carbon_price_paid_eur: float = 0.0) -> list[CostComparison]:
    """Cost comparison for every year in the free-allocation phase-out (for year selectors and charts)."""
    years = sorted(config.load("pricing")["free_allocation_factor_by_year"])
    return [compare(sector, tonnes, verified_see, year=y, carbon_price_paid_eur=carbon_price_paid_eur) for y in years]
