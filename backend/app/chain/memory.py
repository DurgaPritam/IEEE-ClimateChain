"""In-memory chain that enforces the same rules as contracts/VerdantRegistry.sol.

Used for tests and as an offline fallback when a testnet RPC is down.
"""

import hashlib
import itertools
from dataclasses import dataclass

from app.chain.base import ChainError, TxReceipt


@dataclass
class _Report:
    installation_id: str
    merkle_root: str
    period: str
    verified_kg: int
    allocated_kg: int = 0
    verified: bool = False
    verifier_key_fp: str | None = None


class MemoryChain:
    name = "memory"

    def __init__(self):
        self.installations: dict[str, str] = {}
        self.verifier_active = False
        self.verifier_key_fp: str | None = None
        self.reports: dict[str, _Report] = {}
        self.period_index: dict[tuple[str, str], str] = {}
        self.shipments: set[str] = set()
        self._events: list[dict] = []
        self._block = itertools.count(1)

    def _tx(self, event: str, **args) -> TxReceipt:
        block = next(self._block)
        tx = "0x" + hashlib.sha256(f"{block}{event}{args}".encode()).hexdigest()
        self._events.append({"event": event, "block": block, "tx_hash": tx, **args})
        return TxReceipt(tx_hash=tx, block=block, backend=self.name)

    def register_installation(self, installation_id, operator_key_fp):
        self.installations[installation_id] = operator_key_fp
        return self._tx("InstallationRegistered", installation_id=installation_id, operator_key_fp=operator_key_fp)

    def set_verifier(self, verifier_key_fp, active=True):
        self.verifier_key_fp, self.verifier_active = verifier_key_fp, active
        return self._tx("VerifierSet", verifier_key_fp=verifier_key_fp, active=active)

    def anchor_report(self, installation_id, report_hash, merkle_root, period, verified_kg):
        if installation_id not in self.installations:
            raise ChainError("UnknownInstallation")
        if report_hash in self.reports:
            raise ChainError("ReportExists")
        if verified_kg <= 0:
            raise ChainError("ZeroAmount")
        if (installation_id, period) in self.period_index:
            raise ChainError("PeriodAlreadyReported", self.period_index[(installation_id, period)])
        self.period_index[(installation_id, period)] = report_hash
        self.reports[report_hash] = _Report(installation_id, merkle_root, period, verified_kg)
        return self._tx("ReportAnchored", report_hash=report_hash, installation_id=installation_id,
                        period=period, merkle_root=merkle_root, verified_kg=verified_kg)

    def co_sign(self, report_hash):
        if not self.verifier_active:
            raise ChainError("NotVerifier")
        r = self.reports.get(report_hash)
        if r is None:
            raise ChainError("UnknownReport")
        if r.verified:
            raise ChainError("NotPending")
        r.verified, r.verifier_key_fp = True, self.verifier_key_fp
        return self._tx("ReportCoSigned", report_hash=report_hash, verifier_key_fp=self.verifier_key_fp)

    def allocate(self, report_hash, shipment_id, importer_id, kg):
        r = self.reports.get(report_hash)
        if r is None:
            raise ChainError("UnknownReport")
        if not r.verified:
            raise ChainError("NotVerified")
        if kg <= 0:
            raise ChainError("ZeroAmount")
        if shipment_id in self.shipments:
            raise ChainError("ShipmentAlreadyAllocated")
        available = r.verified_kg - r.allocated_kg
        if kg > available:
            raise ChainError("OverAllocation", f"available {available} kg, requested {kg} kg",
                             {"available_kg": available, "requested_kg": kg})
        r.allocated_kg += kg
        self.shipments.add(shipment_id)
        return self._tx("TonnesAllocated", report_hash=report_hash, shipment_id=shipment_id,
                        importer_id=importer_id, kg=kg, remaining_kg=r.verified_kg - r.allocated_kg)

    def remaining_kg(self, report_hash):
        r = self.reports[report_hash]
        return r.verified_kg - r.allocated_kg

    def events(self):
        return list(self._events)
