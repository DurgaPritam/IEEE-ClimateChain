"""Physics and chemistry rules for cement. Thresholds come from config/cement.yaml (guard section).

Every rule returns a result — PASS included — with expected and reported values,
so the UI and the verifier see the whole checklist, not only the failures.
"""

import statistics

from app.guard.base import GuardContext
from app.models import EmissionsResult, Flag, Severity
from app.sectors.cement import CementInputs


def _rng(lo: float, hi: float, unit: str = "") -> str:
    return f"{lo:g}–{hi:g}{unit}"


class _Rule:
    id: str
    title: str

    def result(self, severity: Severity, reason: str, expected: str | None = None,
               reported: str | None = None) -> Flag:
        return Flag(rule_id=self.id, title=self.title, severity=severity, reason=reason,
                    expected=expected, reported=reported)


class ClinkerChemistry(_Rule):
    id = "clinker_chemistry"
    title = "Clinker oxide content"

    def check(self, x: CementInputs, r: EmissionsResult, ctx: GuardContext) -> Flag:
        g = ctx.cfg["guard"]
        lo, hi = g["clinker_cao_range"]
        if not lo <= x.clinker_cao <= hi:
            return self.result(
                Severity.BLOCK,
                f"Portland clinker needs a CaO content of {_rng(lo, hi)}. A lower value "
                "understates calcination CO2, which is fixed by chemistry.",
                _rng(lo, hi), f"{x.clinker_cao:g}")
        mlo, mhi = g["clinker_mgo_range"]
        if not mlo <= x.clinker_mgo <= mhi:
            return self.result(Severity.WARN, "MgO content outside the usual range for Portland clinker.",
                               _rng(mlo, mhi), f"{x.clinker_mgo:g}")
        return self.result(Severity.PASS, "CaO and MgO within the range for Portland clinker.",
                           _rng(lo, hi), f"{x.clinker_cao:g}")


class CalcinationFloor(_Rule):
    id = "calcination_floor"
    title = "Calcination floor"

    def check(self, x: CementInputs, r: EmissionsResult, ctx: GuardContext) -> Flag:
        floor = ctx.sector.calcination_co2(x)
        tol = ctx.cfg["guard"]["calcination_tolerance"]
        expected = f">= {floor * (1 - tol):,.0f} t CO2"
        if x.reported_process_co2_t is None:
            return self.result(Severity.PASS, "Process CO2 computed from clinker chemistry (no separate figure reported).",
                               expected, f"{floor:,.0f} t CO2")
        if x.reported_process_co2_t < floor * (1 - tol):
            return self.result(
                Severity.BLOCK,
                f"Reported process CO2 is below the chemical minimum for "
                f"{x.clinker_produced_t:,.0f} t of clinker at the declared CaO/MgO content.",
                expected, f"{x.reported_process_co2_t:,.0f} t CO2")
        return self.result(
            Severity.PASS,
            f"Reported process CO2 is at or above the chemical minimum for {x.clinker_produced_t:,.0f} t of clinker.",
            expected, f"{x.reported_process_co2_t:,.0f} t CO2")


class KilnEnergyBand(_Rule):
    id = "kiln_energy_band"
    title = "Kiln energy per tonne of clinker"

    def check(self, x: CementInputs, r: EmissionsResult, ctx: GuardContext) -> Flag:
        lo, hi = ctx.cfg["guard"]["kiln_energy_gj_per_t_clk"]
        v = ctx.sector.kiln_energy_gj(x) / x.clinker_produced_t
        expected, reported = _rng(lo, hi, " GJ/t"), f"{v:.2f} GJ/t"
        if v < lo:
            return self.result(Severity.BLOCK, "Thermal energy below the realistic band for dry-process kilns "
                               "— fuel may be missing from the report.", expected, reported)
        if v > hi:
            return self.result(Severity.WARN, "Thermal energy above the realistic band for dry-process kilns.",
                               expected, reported)
        return self.result(Severity.PASS, "Thermal energy within the realistic band for dry-process kilns.",
                           expected, reported)


class ClinkerRatio(_Rule):
    id = "clinker_ratio"
    title = "Clinker-to-cement ratio"

    def check(self, x: CementInputs, r: EmissionsResult, ctx: GuardContext) -> Flag:
        bands = ctx.cfg["guard"]["clinker_ratio_by_type"]
        ratio = x.clinker_consumed_t / x.cement_produced_t
        if x.cement_type not in bands:
            return self.result(Severity.WARN, f"Unknown cement type {x.cement_type}; ratio not checked.",
                               None, f"{ratio:.3f}")
        lo, hi = bands[x.cement_type]
        if not lo <= ratio <= hi:
            return self.result(Severity.BLOCK, f"Clinker ratio does not match declared type {x.cement_type}.",
                               _rng(lo, hi), f"{ratio:.3f}")
        return self.result(Severity.PASS, f"Ratio matches declared type {x.cement_type}.",
                           _rng(lo, hi), f"{ratio:.3f}")


class MassBalance(_Rule):
    id = "mass_balance"
    title = "Mass balance"

    def check(self, x: CementInputs, r: EmissionsResult, ctx: GuardContext) -> Flag:
        tol = ctx.cfg["guard"]["mass_balance_tolerance"]
        cap = (x.clinker_consumed_t + x.additives_t) * (1 + tol)
        expected, reported = f"<= {cap:,.0f} t", f"{x.cement_produced_t:,.0f} t"
        if x.cement_produced_t > cap:
            return self.result(Severity.BLOCK, "Cement output exceeds clinker plus additives "
                               "— production may be invented.", expected, reported)
        if x.clinker_consumed_t > x.clinker_produced_t * 1.5:
            return self.result(Severity.WARN, "Clinker consumed far exceeds clinker produced; "
                               "purchased clinker must be declared.",
                               f"<= {x.clinker_produced_t * 1.5:,.0f} t", f"{x.clinker_consumed_t:,.0f} t")
        return self.result(Severity.PASS, "Cement output is covered by clinker plus additives.", expected, reported)


class ElectricityBand(_Rule):
    id = "electricity_band"
    title = "Electricity per tonne of cement"

    def check(self, x: CementInputs, r: EmissionsResult, ctx: GuardContext) -> Flag:
        g = ctx.cfg["guard"]
        kwh = lambda i: (i.electricity_kiln_mwh + i.electricity_grinding_mwh) * 1000 / i.cement_produced_t
        v = kwh(x)
        past = [kwh(h) for h, _ in ctx.history]
        if len(past) >= g["electricity_min_history"]:
            mu, sd = statistics.mean(past), statistics.stdev(past)
            lo, hi = mu - g["electricity_sigma"] * sd, mu + g["electricity_sigma"] * sd
            basis = f"the plant's own history (±{g['electricity_sigma']:g}σ, {len(past)} months)"
        else:
            lo, hi = g["electricity_kwh_per_t_cem_fallback"]
            basis = "the industry range"
        expected, reported = _rng(round(lo), round(hi), " kWh/t"), f"{v:.0f} kWh/t"
        if not lo <= v <= hi:
            return self.result(Severity.WARN, f"Electricity use outside {basis} — indirect emissions may be missing.",
                               expected, reported)
        return self.result(Severity.PASS, f"Within {basis}.", expected, reported)


class SuddenImprovement(_Rule):
    id = "sudden_improvement"
    title = "Sudden improvement"

    def check(self, x: CementInputs, r: EmissionsResult, ctx: GuardContext) -> Flag:
        th = ctx.cfg["guard"]["sudden_drop_threshold"]
        expected = f"drop <= {th:.0%}"
        if not ctx.history:
            return self.result(Severity.PASS, "No earlier month to compare with.", expected, f"{r.see_total:.3f}")
        prev = ctx.history[-1][1].see_total
        drop = (prev - r.see_total) / prev
        reported = f"{prev:.3f} -> {r.see_total:.3f}"
        if drop > th and not x.declared_process_change:
            return self.result(Severity.WARN, f"Intensity fell {drop:.0%} in one month with no declared process change.",
                               expected, reported)
        if drop > th:
            return self.result(Severity.PASS, f"Intensity fell {drop:.0%}; declared process change: "
                               f"{x.declared_process_change}", expected, reported)
        return self.result(Severity.PASS, f"Month-on-month change within the {th:.0%} threshold.", expected, reported)


RULES = [ClinkerChemistry, CalcinationFloor, KilnEnergyBand, ClinkerRatio,
         MassBalance, ElectricityBand, SuddenImprovement]
