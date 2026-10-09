"""Plausibility rule interface. Each rule is one small class; register it in the sector's rule list."""

from dataclasses import dataclass, field
from typing import Any, ClassVar, Protocol

from pydantic import BaseModel

from app.models import EmissionsResult, Flag


@dataclass
class GuardContext:
    """Everything a rule may look at besides the current month."""

    cfg: dict  # sector config (thresholds under cfg["guard"])
    history: list[tuple[BaseModel, EmissionsResult]] = field(default_factory=list)  # earlier months, oldest first
    sector: Any = None  # the Sector instance, for helper calculations


class Rule(Protocol):
    id: ClassVar[str]
    title: ClassVar[str]

    def check(self, x: BaseModel, result: EmissionsResult, ctx: GuardContext) -> Flag | None:
        """Return a Flag when the rule fires, else None."""
        ...
