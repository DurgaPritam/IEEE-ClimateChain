"""Sector-independent domain models shared by every layer."""

from enum import Enum

from pydantic import BaseModel, Field, computed_field


class EmissionsResult(BaseModel):
    """Output of a sector calculation. All values in t CO2 or t CO2 per t product."""

    sector: str
    product_tonnes: float
    direct_tco2: float
    indirect_tco2: float
    see_direct: float = Field(description="Specific embedded direct emissions, t CO2/t product")
    see_indirect: float = Field(description="Specific embedded indirect emissions, t CO2/t product")
    see_total: float
    breakdown: dict[str, float] = Field(default_factory=dict, description="Named components, t CO2")


class Severity(str, Enum):
    PASS = "pass"
    WARN = "warn"
    BLOCK = "block"


class Flag(BaseModel):
    """One plausibility check result (pass, warn or block), always with a human-readable reason."""

    rule_id: str
    title: str
    severity: Severity
    reason: str
    expected: str | None = None
    reported: str | None = None
    contributions: dict[str, float] | None = Field(
        default=None, description="Feature contributions (e.g. SHAP) for model-based flags"
    )


class GuardResult(BaseModel):
    checks: list[Flag]

    @computed_field
    @property
    def flags(self) -> list[Flag]:
        """Checks that did not pass."""
        return [c for c in self.checks if c.severity != Severity.PASS]

    @computed_field
    @property
    def blocked(self) -> bool:
        return any(f.severity == Severity.BLOCK for f in self.checks)

    @computed_field
    @property
    def status(self) -> Severity:
        if self.blocked:
            return Severity.BLOCK
        if any(f.severity == Severity.WARN for f in self.checks):
            return Severity.WARN
        return Severity.PASS
