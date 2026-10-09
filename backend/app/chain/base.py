"""Chain client interface. Implementations: in-memory (offline demo/tests) and web3 (testnet)."""

from typing import Protocol

from pydantic import BaseModel


class ChainError(Exception):
    """A contract revert, carrying the custom error name (e.g. "OverAllocation")."""

    def __init__(self, error: str, detail: str = ""):
        super().__init__(f"{error}: {detail}" if detail else error)
        self.error = error
        self.detail = detail


class TxReceipt(BaseModel):
    tx_hash: str
    block: int | None = None
    explorer_url: str | None = None
    backend: str


class ChainClient(Protocol):
    """All ids are strings; implementations map them to bytes32.
    `report_hash` and `merkle_root` are 32-byte hex (sha256)."""

    name: str

    def register_installation(self, installation_id: str, operator_key_fp: str) -> TxReceipt: ...
    def set_verifier(self, verifier_key_fp: str, active: bool = True) -> TxReceipt: ...
    def anchor_report(self, installation_id: str, report_hash: str, merkle_root: str,
                      period: str, verified_kg: int) -> TxReceipt: ...
    def co_sign(self, report_hash: str) -> TxReceipt: ...
    def allocate(self, report_hash: str, shipment_id: str, importer_id: str, kg: int) -> TxReceipt: ...
    def remaining_kg(self, report_hash: str) -> int: ...
    def events(self) -> list[dict]: ...
