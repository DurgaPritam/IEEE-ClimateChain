"""CBAM embedded-emissions calculation for grey Portland cement.

Two steps, because CBAM treats clinker as a precursor of cement:

  E_clinker   = m_clk * (0.785 w_CaO + 1.092 w_MgO)       calcination
              + sum_f Q_f * NCV_f * EF_f * (1 - biomass_f)  kiln fuels
              + P_kiln * EF_grid                            indirect
  SEE_cement  = r_clk * E_clinker / m_clk + P_grind * EF_grid / m_cem

Simplified starting point; see README "Emissions method" for the full list of
simplifications. Factors are read from config/cement.yaml.
"""

from typing import ClassVar

from pydantic import BaseModel, Field

from app import config
from app.models import EmissionsResult


class CementInputs(BaseModel):
    """One month of plant data, as submitted by the operator."""

    clinker_produced_t: float = Field(gt=0)
    clinker_consumed_t: float = Field(gt=0, description="Clinker used in cement grinding")
    additives_t: float = Field(ge=0, description="Gypsum, limestone, slag, fly ash, etc.")
    cement_produced_t: float = Field(gt=0)
    cement_type: str = "CEM_I"
    clinker_cao: float = Field(gt=0, lt=1, description="CaO mass fraction in clinker")
    clinker_mgo: float = Field(ge=0, lt=1, description="MgO mass fraction in clinker")
    fuels_t: dict[str, float] = Field(description="Kiln fuel use by type, tonnes")
    electricity_kiln_mwh: float = Field(ge=0)
    electricity_grinding_mwh: float = Field(ge=0)
    reported_process_co2_t: float | None = Field(
        default=None, description="Process CO2 if the plant uses the raw-meal input method"
    )
    declared_process_change: str | None = Field(
        default=None, description="Declared reason for a step change in intensity"
    )
    carbon_price_paid_eur: float = Field(default=0, ge=0, description="Turkish ETS price paid")
    carbon_price_evidence_sha256: str | None = None


class CementSector:
    name: ClassVar[str] = "cement"
    inputs_model: ClassVar[type[BaseModel]] = CementInputs

    def __init__(self, cfg: dict | None = None):
        self.cfg = cfg or config.load("cement")

    def calcination_co2(self, x: CementInputs) -> float:
        c = self.cfg["calcination"]
        return x.clinker_produced_t * (c["factor_cao"] * x.clinker_cao + c["factor_mgo"] * x.clinker_mgo)

    def fuel_co2(self, x: CementInputs) -> float:
        total = 0.0
        for fuel, tonnes in x.fuels_t.items():
            f = self.cfg["fuels"][fuel]
            total += tonnes * f["ncv"] * f["ef"] / 1000 * (1 - f["biomass_fraction"])
        return total

    def kiln_energy_gj(self, x: CementInputs) -> float:
        return sum(t * self.cfg["fuels"][f]["ncv"] for f, t in x.fuels_t.items())

    def calculate(self, x: CementInputs) -> EmissionsResult:
        grid_ef = self.cfg["electricity"]["grid_ef_tco2_per_mwh"]

        # Process CO2: the larger of the stoichiometric value and any reported raw-meal figure.
        process = max(self.calcination_co2(x), x.reported_process_co2_t or 0.0)
        fuel = self.fuel_co2(x)
        kiln_indirect = x.electricity_kiln_mwh * grid_ef
        grinding_indirect = x.electricity_grinding_mwh * grid_ef

        clk_direct_per_t = (process + fuel) / x.clinker_produced_t
        clk_indirect_per_t = kiln_indirect / x.clinker_produced_t
        ratio = x.clinker_consumed_t / x.cement_produced_t

        see_direct = ratio * clk_direct_per_t
        see_indirect = ratio * clk_indirect_per_t + grinding_indirect / x.cement_produced_t

        return EmissionsResult(
            sector=self.name,
            product_tonnes=x.cement_produced_t,
            direct_tco2=see_direct * x.cement_produced_t,
            indirect_tco2=see_indirect * x.cement_produced_t,
            see_direct=round(see_direct, 4),
            see_indirect=round(see_indirect, 4),
            see_total=round(see_direct + see_indirect, 4),
            breakdown={
                "calcination_tco2": round(process, 2),
                "kiln_fuel_tco2": round(fuel, 2),
                "kiln_electricity_tco2": round(kiln_indirect, 2),
                "grinding_electricity_tco2": round(grinding_indirect, 2),
                "clinker_ratio": round(ratio, 4),
                "clinker_see_direct": round(clk_direct_per_t, 4),
            },
        )
