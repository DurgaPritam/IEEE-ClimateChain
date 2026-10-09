"""Records kept off-chain. In-memory for now; swap for SQLite/Postgres behind the same class."""

from datetime import UTC, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from app.chain.base import TxReceipt
from app.models import EmissionsResult, GuardResult
from app.trust.signatures.hybrid import HybridSignature


class ReportStatus(str, Enum):
    BLOCKED = "blocked"              # guard blocked; returned to the plant
    FLAGGED = "flagged"              # warnings; plant may sign, verifier must review
    READY = "ready"                  # all checks passed; awaiting plant signature
    PLANT_SIGNED = "plant_signed"    # signed + anchored on-chain (pending)
    VERIFIED = "verified"            # verifier co-signed on-chain; tonnes allocatable


class Plant(BaseModel):
    id: str
    name: str
    city: str
    sector: str = "cement"
    key_fingerprint: str | None = None


class Report(BaseModel):
    id: str
    plant_id: str
    period: str
    sector: str
    inputs: dict[str, Any]
    result: EmissionsResult
    guard: GuardResult
    status: ReportStatus
    header: dict[str, Any] | None = None  # signed, contains the Merkle root (no private data)
    report_hash: str | None = None
    salts: dict[str, str] | None = None  # hex salts of the Merkle leaves (private)
    plant_signature: HybridSignature | None = None
    verifier_signature: HybridSignature | None = None
    verifier_note: str | None = None
    receipts: dict[str, TxReceipt] = Field(default_factory=dict)
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class Allocation(BaseModel):
    shipment_id: str
    report_id: str
    importer_id: str
    tonnes: float
    receipt: TxReceipt


class Store:
    def __init__(self):
        self.plants: dict[str, Plant] = {}
        self.reports: dict[str, Report] = {}
        self.allocations: dict[str, Allocation] = {}

    def plant_reports(self, plant_id: str) -> list[Report]:
        return sorted((r for r in self.reports.values() if r.plant_id == plant_id), key=lambda r: r.period)

    def accepted_history(self, plant_id: str, before: str) -> list[Report]:
        """Earlier months that passed the guard; the baseline for history-based checks."""
        return [r for r in self.plant_reports(plant_id)
                if r.period < before and r.status != ReportStatus.BLOCKED]
