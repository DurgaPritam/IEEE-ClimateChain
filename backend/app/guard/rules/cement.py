"""Physics and chemistry rules for cement. Thresholds come from config/cement.yaml (guard section)."""

import statistics

from app.guard.base import GuardContext
from app.models import EmissionsResult, Flag, Severity
from app.sectors.cement import CementInputs


def _rng(lo: float, hi: float, unit: str = "") -> str:
    return f"{lo:g}–{hi:g}{unit}"


class ClinkerChemistry:
    id = "clinker_chemistry"
    title = "Clinker oxide content"

    def check(self, x: CementInputs, r: EmissionsResult, ctx: GuardContext) -> Flag | None:
        g = ctx.cfg["guard"]
        lo, hi = g["clinker_cao_range"]
        if not lo <= x.clinker_cao <= hi:
            return Flag(
                rule_id=self.id, title=self.title, severity=Severity.BLOCK,
                reason=f"Portland clinker needs a CaO content of {_rng(lo, hi)}. A lower value "
                       "understates calcination CO2, which is fixed by chemistry.",
                expected=_rng(lo, hi), reported=f"{x.clinker_cao:g}",
            )
        lo, hi = g["clinker_mgo_range"]
        if not lo <= x.clinker_mgo <= hi:
            return Flag(
                rule_id=self.id, title=self.title, severity=Severity.WARN,
                reason="MgO content outside the usual range for Portland clinker.",
                expected=_rng(lo, hi), reported=f"{x.clinker_mgo:g}",
            )
        return None


class CalcinationFloor:
    id = "calcination_floor"
    title = "Calcination floor"

    def check(self, x: CementInputs, r: EmissionsResult, ctx: GuardContext) -> Flag | None:
        if x.reported_process_co2_t is None:
            return None
        floor = ctx.sector.calcination_co2(x)
        tol = ctx.cfg["guard"]["calcination_tolerance"]
        if x.reported_process_co2_t < floor * (1 - tol):
            return Flag(
                rule_id=self.id, title=self.title, severity=Severity.BLOCK,
                reason=f"Reported process CO2 is below the chemical minimum for "
                       f"{x.clinker_produced_t:,.0f} t of clinker at the declared CaO/MgO content.",
                expected=f">= {floor:,.0f} t CO2", reported=f"{x.reported_process_co2_t:,.0f} t CO2",
            )
        return None


class KilnEnergyBand:
    id = "kiln_energy_band"
    title = "Kiln energy per tonne of clinker"

    def check(self, x: CementInputs, r: EmissionsResult, ctx: GuardContext) -> Flag | None:
        lo, hi = ctx.cfg["guard"]["kiln_energy_gj_per_t_clk"]
        v = ctx.sector.kiln_energy_gj(x) / x.clinker_produced_t
        if not lo <= v <= hi:
            return Flag(
                rule_id=self.id, title=self.title,
                severity=Severity.BLOCK if v < lo else Severity.WARN,
                reason="Thermal energy outside the realistic band for dry-process kilns"
                       + (" — fuel may be missing from the report." if v < lo else "."),
                expected=_rng(lo, hi, " GJ/t"), reported=f"{v:.2f} GJ/t",
            )
        return None


class ClinkerRatio:
    id = "clinker_ratio"
    title = "Clinker-to-cement ratio"

    def check(self, x: CementInputs, r: EmissionsResult, ctx: GuardContext) -> Flag | None:
        bands = ctx.cfg["guard"]["clinker_ratio_by_type"]
        if x.cement_type not in bands:
            return Flag(rule_id=self.id, title=self.title, severity=Severity.WARN,
                        reason=f"Unknown cement type {x.cement_type}; ratio not checked.")
        lo, hi = bands[x.cement_type]
        ratio = x.clinker_consumed_t / x.cement_produced_t
        if not lo <= ratio <= hi:
            return Flag(
                rule_id=self.id, title=self.title, severity=Severity.BLOCK,
                reason=f"Clinker ratio does not match declared type {x.cement_type}.",
                expected=_rng(lo, hi), reported=f"{ratio:.3f}",
            )
        return None


class MassBalance:
    id = "mass_balance"
    title = "Mass balance"

    def check(self, x: CementInputs, r: EmissionsResult, ctx: GuardContext) -> Flag | None:
        tol = ctx.cfg["guard"]["mass_balance_tolerance"]
        inputs = x.clinker_consumed_t + x.additives_t
        if x.cement_produced_t > inputs * (1 + tol):
            return Flag(
                rule_id=self.id, title=self.title, severity=Severity.BLOCK,
                reason="Cement output exceeds clinker plus additives — production may be invented.",
                expected=f"<= {inputs * (1 + tol):,.0f} t", reported=f"{x.cement_produced_t:,.0f} t",
            )
        if x.clinker_consumed_t > x.clinker_produced_t * 1.5:
            return Flag(
                rule_id=self.id, title=self.title, severity=Severity.WARN,
                reason="Clinker consumed far exceeds clinker produced; purchased clinker must be declared.",
                expected=f"<= {x.clinker_produced_t * 1.5:,.0f} t", reported=f"{x.clinker_consumed_t:,.0f} t",
            )
        return None


class ElectricityBand:
    id = "electricity_band"
    title = "Electricity per tonne of cement"

    def check(self, x: CementInputs, r: EmissionsResult, ctx: GuardContext) -> Flag | None:
        g = ctx.cfg["guard"]
        kwh = lambda i: (i.electricity_kiln_mwh + i.electricity_grinding_mwh) * 1000 / i.cement_produced_t
        v = kwh(x)
        past = [kwh(h) for h, _ in ctx.history]
        if len(past) >= g["electricity_min_history"]:
            mu, sd = statistics.mean(past), statistics.stdev(past)
            lo, hi = mu - g["electricity_sigma"] * sd, mu + g["electricity_sigma"] * sd
            basis = "the plant's own history"
        else:
            lo, hi = g["electricity_kwh_per_t_cem_fallback"]
            basis = "the industry range"
        if not lo <= v <= hi:
            return Flag(
                rule_id=self.id, title=self.title, severity=Severity.WARN,
                reason=f"Electricity use outside {basis} — indirect emissions may be missing.",
                expected=_rng(round(lo), round(hi), " kWh/t"), reported=f"{v:.0f} kWh/t",
            )
        return None


class SuddenImprovement:
    id = "sudden_improvement"
    title = "Sudden improvement"

    def check(self, x: CementInputs, r: EmissionsResult, ctx: GuardContext) -> Flag | None:
        if not ctx.history or x.declared_process_change:
            return None
        prev = ctx.history[-1][1].see_total
        drop = (prev - r.see_total) / prev
        th = ctx.cfg["guard"]["sudden_drop_threshold"]
        if drop > th:
            return Flag(
                rule_id=self.id, title=self.title, severity=Severity.WARN,
                reason=f"Intensity fell {drop:.0%} in one month with no declared process change.",
                expected=f"drop <= {th:.0%}", reported=f"{prev:.3f} -> {r.see_total:.3f} t CO2/t",
            )
        return None


RULES = [ClinkerChemistry, CalcinationFloor, KilnEnergyBand, ClinkerRatio,
         MassBalance, ElectricityBand, SuddenImprovement]
