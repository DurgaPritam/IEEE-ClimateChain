"""End-to-end reporting flow, independent of the web layer.

submit -> guard -> plant hybrid-signs + anchors -> verifier co-signs -> allocate -> disclose
"""

import base64
import os
from typing import Any

from pydantic import BaseModel

from app.chain import ChainClient, ChainError, get_chain
from app.guard import Guard
from app.pricing.cbam_cost import CostComparison, compare
from app.sectors import get_sector
from app.store import Allocation, Plant, Report, ReportStatus, Store
from app.trust import merkle
from app.trust.canonical import canonical_bytes, sha256_hex
from app.trust.signatures import hybrid

SCHEMA = "verdant-x/report/v1"
# Fields an importer receives by default; everything else stays private.
DISCLOSED_FIELDS = ("see_total", "see_direct", "see_indirect", "cn_code", "period", "plant_id")


class ServiceError(Exception):
    def __init__(self, message: str, code: str = "invalid", detail: Any = None):
        super().__init__(message)
        self.code, self.detail = code, detail


class DisclosurePackage(BaseModel):
    shipment_id: str
    importer_id: str
    tonnes: float
    header: dict[str, Any]
    report_hash: str
    disclosures: list[merkle.Disclosure]
    plant_signature: hybrid.HybridSignature
    verifier_signature: hybrid.HybridSignature
    receipts: dict[str, Any]
    cost: CostComparison
    carbon_price_paid_eur: float


class VerificationResult(BaseModel):
    report_hash_matches: bool
    plant_signature_valid: bool
    verifier_signature_valid: bool
    disclosures_valid: dict[str, bool]
    valid: bool


def _schemes() -> tuple[str, ...]:
    return tuple(os.environ.get("SIGNATURE_SCHEMES", ",".join(hybrid.DEFAULT_SCHEMES)).split(","))


class VerdantService:
    def __init__(self, store: Store | None = None, chain: ChainClient | None = None):
        self.store = store or Store()
        self.chain = chain or get_chain()
        self.keys: dict[str, hybrid.HybridKey] = {}
        self.guards: dict[str, Guard] = {}
        self.verifier_key = hybrid.generate_hybrid_key("verifier:accredited-demo", _schemes())
        self.chain.set_verifier(self.verifier_key.key_fingerprint)

    # ---- plants ----

    def register_plant(self, plant: Plant) -> Plant:
        key = hybrid.generate_hybrid_key(f"plant:{plant.id}", _schemes())
        self.keys[plant.id] = key
        plant.key_fingerprint = key.key_fingerprint
        self.store.plants[plant.id] = plant
        self.chain.register_installation(plant.id, key.key_fingerprint)
        self.guards[plant.id] = Guard(plant.sector)
        return plant

    def fit_anomaly_model(self, plant_id: str) -> None:
        hist = [(self._inputs(r), r.result) for r in self.store.plant_reports(plant_id)
                if r.status != ReportStatus.BLOCKED]
        if len(hist) >= 6:
            self.guards[plant_id].fit_anomaly(hist)

    # ---- reporting flow ----

    def _inputs(self, r: Report) -> BaseModel:
        return get_sector(r.sector).inputs_model(**r.inputs)

    def submit(self, plant_id: str, period: str, inputs: dict[str, Any]) -> Report:
        plant = self._plant(plant_id)
        sector = get_sector(plant.sector)
        x = sector.inputs_model(**inputs)
        result = sector.calculate(x)
        history = [(self._inputs(r), r.result) for r in self.store.accepted_history(plant_id, period)]
        guard = self.guards[plant_id].check(x, result, history)
        status = (ReportStatus.BLOCKED if guard.blocked
                  else ReportStatus.FLAGGED if guard.flags else ReportStatus.READY)
        report = Report(id=f"{plant_id}:{period}", plant_id=plant_id, period=period, sector=plant.sector,
                        inputs=x.model_dump(), result=result, guard=guard, status=status)
        existing = self.store.reports.get(report.id)
        if existing and existing.status in (ReportStatus.PLANT_SIGNED, ReportStatus.VERIFIED):
            raise ServiceError("This period is already signed and anchored.", "already_anchored")
        self.store.reports[report.id] = report
        return report

    def _leaves(self, r: Report) -> dict[str, Any]:
        cfg = get_sector(r.sector).cfg
        public = {
            "plant_id": r.plant_id, "period": r.period, "sector": r.sector,
            "cn_code": cfg["product"]["cn_code"], "product_t": r.result.product_tonnes,
            "see_total": r.result.see_total, "see_direct": r.result.see_direct,
            "see_indirect": r.result.see_indirect,
        }
        private = {f"input.{k}": v for k, v in r.inputs.items()}
        private |= {f"calc.{k}": v for k, v in r.result.breakdown.items()}
        private["guard.status"] = r.guard.status.value
        return public | private

    def plant_sign(self, report_id: str) -> Report:
        r = self._report(report_id)
        if r.status == ReportStatus.BLOCKED:
            raise ServiceError("Blocked reports cannot be signed; correct the data first.", "blocked",
                               [f.model_dump() for f in r.guard.flags])
        if r.status not in (ReportStatus.READY, ReportStatus.FLAGGED):
            raise ServiceError(f"Report is {r.status.value}.", "bad_state")

        commitment = merkle.MerkleCommitment(self._leaves(r))
        r.salts = {k: v.hex() for k, v in commitment.salts.items()}
        r.header = {
            "schema": SCHEMA, "plant_id": r.plant_id, "period": r.period, "sector": r.sector,
            "merkle_root": commitment.root, "product_t": r.result.product_tonnes,
            "plant_key_fingerprint": self.keys[r.plant_id].key_fingerprint,
        }
        msg = canonical_bytes(r.header)
        r.report_hash = sha256_hex(msg)
        r.plant_signature = hybrid.sign(msg, self.keys[r.plant_id])
        r.receipts["anchor"] = self._chain(
            self.chain.anchor_report, r.plant_id, r.report_hash, commitment.root, r.period,
            int(round(r.result.product_tonnes * 1000)),
        )
        r.status = ReportStatus.PLANT_SIGNED
        return r

    def verifier_cosign(self, report_id: str, note: str | None = None) -> Report:
        r = self._report(report_id)
        if r.status != ReportStatus.PLANT_SIGNED:
            raise ServiceError(f"Report is {r.status.value}; only plant-signed reports can be co-signed.", "bad_state")
        msg = canonical_bytes(r.header)
        if not hybrid.verify(msg, r.plant_signature, _schemes()):
            raise ServiceError("Plant signature does not verify.", "bad_signature")
        r.verifier_signature = hybrid.sign(msg, self.verifier_key)
        r.verifier_note = note
        r.receipts["cosign"] = self._chain(self.chain.co_sign, r.report_hash)
        r.status = ReportStatus.VERIFIED
        return r

    def allocate(self, report_id: str, shipment_id: str, importer_id: str, tonnes: float) -> Allocation:
        r = self._report(report_id)
        if r.status != ReportStatus.VERIFIED:
            raise ServiceError("Only verified reports can be allocated.", "bad_state")
        receipt = self._chain(self.chain.allocate, r.report_hash, shipment_id, importer_id, int(round(tonnes * 1000)))
        a = Allocation(shipment_id=shipment_id, report_id=report_id, importer_id=importer_id,
                       tonnes=tonnes, receipt=receipt)
        self.store.allocations[shipment_id] = a
        return a

    def remaining_tonnes(self, report_id: str) -> float:
        r = self._report(report_id)
        return self.chain.remaining_kg(r.report_hash) / 1000 if r.report_hash else 0.0

    # ---- importer side ----

    def disclosure(self, shipment_id: str, year: int = 2026) -> DisclosurePackage:
        a = self.store.allocations.get(shipment_id)
        if a is None:
            raise ServiceError("Unknown shipment.", "not_found")
        r = self._report(a.report_id)
        leaves = self._leaves(r)
        commitment = merkle.MerkleCommitment(leaves, {k: bytes.fromhex(v) for k, v in r.salts.items()})
        assert commitment.root == r.header["merkle_root"]
        carbon_paid = r.inputs.get("carbon_price_paid_eur", 0.0) * a.tonnes / r.result.product_tonnes
        return DisclosurePackage(
            shipment_id=shipment_id, importer_id=a.importer_id, tonnes=a.tonnes,
            header=r.header, report_hash=r.report_hash,
            disclosures=[commitment.disclose(f) for f in DISCLOSED_FIELDS],
            plant_signature=r.plant_signature, verifier_signature=r.verifier_signature,
            receipts={**{k: v.model_dump() for k, v in r.receipts.items()}, "allocation": a.receipt.model_dump()},
            cost=compare(r.sector, a.tonnes, r.result.see_total, year=year, carbon_price_paid_eur=carbon_paid),
            carbon_price_paid_eur=round(carbon_paid, 2),
        )

    @staticmethod
    def verify_package(p: DisclosurePackage) -> VerificationResult:
        """Everything an importer can check without trusting VERDANT-X's server."""
        msg = canonical_bytes(p.header)
        root = p.header["merkle_root"]
        hash_ok = sha256_hex(msg) == p.report_hash
        plant_ok = hybrid.verify(msg, p.plant_signature, _schemes()) and \
            p.plant_signature.key_fingerprint == p.header["plant_key_fingerprint"]
        verifier_ok = hybrid.verify(msg, p.verifier_signature, _schemes())
        disc = {d.field: merkle.verify_disclosure(d, root) for d in p.disclosures}
        return VerificationResult(
            report_hash_matches=hash_ok, plant_signature_valid=plant_ok, verifier_signature_valid=verifier_ok,
            disclosures_valid=disc, valid=hash_ok and plant_ok and verifier_ok and all(disc.values()),
        )

    # ---- helpers ----

    def _plant(self, plant_id: str) -> Plant:
        if plant_id not in self.store.plants:
            raise ServiceError(f"Unknown plant {plant_id}.", "not_found")
        return self.store.plants[plant_id]

    def _report(self, report_id: str) -> Report:
        if report_id not in self.store.reports:
            raise ServiceError(f"Unknown report {report_id}.", "not_found")
        return self.store.reports[report_id]

    @staticmethod
    def _chain(fn, *args):
        try:
            return fn(*args)
        except ChainError as e:
            raise ServiceError(str(e), f"chain:{e.error}", e.detail) from e


def signature_size_summary(sig: hybrid.HybridSignature) -> dict[str, int]:
    return {c.alg: len(base64.b64decode(c.signature)) for c in sig.components}
