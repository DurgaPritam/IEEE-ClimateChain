"""Plausibility guard: runs a sector's rules (and optionally the anomaly model) over one month."""

from pydantic import BaseModel

from app import config
from app.guard.anomaly import FEATURES, AnomalyModel
from app.guard.base import GuardContext, Rule
from app.guard.rules import cement as cement_rules
from app.models import EmissionsResult, GuardResult
from app.sectors import get_sector

RULE_SETS: dict[str, list[type]] = {
    "cement": cement_rules.RULES,
}


class Guard:
    def __init__(self, sector_name: str, anomaly: AnomalyModel | None = None):
        self.sector = get_sector(sector_name)
        self.cfg = config.load(sector_name)
        self.rules: list[Rule] = [R() for R in RULE_SETS[sector_name]]
        self.anomaly = anomaly

    def fit_anomaly(self, history: list[tuple[BaseModel, EmissionsResult]]) -> None:
        self.anomaly = AnomalyModel(
            FEATURES[self.sector.name], self.cfg["guard"]["anomaly_contamination"]
        ).fit(history)

    def check(
        self, x: BaseModel, result: EmissionsResult,
        history: list[tuple[BaseModel, EmissionsResult]] | None = None,
    ) -> GuardResult:
        ctx = GuardContext(cfg=self.cfg, history=history or [], sector=self.sector)
        checks = [*self.rules, *([self.anomaly] if self.anomaly else [])]
        flags = [f for c in checks if (f := c.check(x, result, ctx))]
        return GuardResult(flags=flags)
