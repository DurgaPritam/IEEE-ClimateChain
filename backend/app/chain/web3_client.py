"""web3.py client for the deployed VerdantRegistry (Polygon Amoy, Sepolia or a local Hardhat node).

Reads address and ABI from contracts/deployments/<network>.json. The deployer wallet acts as
registry owner and demo plant operator; a second wallet acts as the accredited verifier.
"""

import json
import os
from pathlib import Path

from web3 import Web3
from web3.exceptions import ContractCustomError, ContractLogicError

from app.chain.base import ChainError, TxReceipt

DEPLOYMENTS = Path(__file__).resolve().parents[3] / "contracts" / "deployments"


def b32(value: str) -> bytes:
    """32-byte hex passes through; any other id is keccak-hashed (matches ethers.id in tests)."""
    v = value.removeprefix("0x")
    if len(v) == 64:
        try:
            return bytes.fromhex(v)
        except ValueError:
            pass
    return Web3.keccak(text=value)


class Web3Chain:
    name = "web3"

    def __init__(self, network: str | None = None):
        network = network or os.environ.get("CHAIN_NETWORK", "amoy")
        dep = json.loads((DEPLOYMENTS / f"{network}.json").read_text())
        rpc = os.environ.get(f"{network.upper()}_RPC_URL") or "http://127.0.0.1:8545"
        self.w3 = Web3(Web3.HTTPProvider(rpc))
        self.contract = self.w3.eth.contract(address=dep["address"], abi=dep["abi"])
        self.address = dep["address"]
        self.owner = self.w3.eth.account.from_key(os.environ["DEPLOYER_PRIVATE_KEY"])
        self.verifier = self.w3.eth.account.from_key(os.environ["VERIFIER_PRIVATE_KEY"])
        self.explorer = os.environ.get("EXPLORER_TX_URL", "")
        self._errors = {
            Web3.keccak(text=sig)[:4].hex(): sig.split("(")[0]
            for sig in (
                "NotOwner()", "NotOperator()", "NotVerifier()", "UnknownInstallation()",
                "PeriodAlreadyReported(bytes32)", "ReportExists()", "UnknownReport()", "NotPending()",
                "NotVerified()", "VerifierIsOperator()", "ShipmentAlreadyAllocated()", "ZeroAmount()",
                "OverAllocation(uint256,uint256)",
            )
        }

    def _send(self, fn, account) -> TxReceipt:
        try:
            fn.call({"from": account.address})  # surface custom-error reverts before spending gas
        except (ContractCustomError, ContractLogicError) as e:
            data = e.data.get("data", "") if isinstance(e.data, dict) else str(e.data or "")
            data = data.removeprefix("0x")
            raise ChainError(self._errors.get(data[:8], "Revert"), str(e.message or data)) from e
        tx = fn.build_transaction({
            "from": account.address,
            "nonce": self.w3.eth.get_transaction_count(account.address),
        })
        signed = account.sign_transaction(tx)
        h = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        rcpt = self.w3.eth.wait_for_transaction_receipt(h, timeout=120)
        hx = "0x" + h.hex().removeprefix("0x")
        return TxReceipt(tx_hash=hx, block=rcpt.blockNumber,
                         explorer_url=self.explorer + hx if self.explorer else None, backend=self.name)

    def register_installation(self, installation_id, operator_key_fp):
        fn = self.contract.functions.registerInstallation(b32(installation_id), self.owner.address, b32(operator_key_fp))
        return self._send(fn, self.owner)

    def set_verifier(self, verifier_key_fp, active=True):
        fn = self.contract.functions.setVerifier(self.verifier.address, b32(verifier_key_fp), active)
        return self._send(fn, self.owner)

    def anchor_report(self, installation_id, report_hash, merkle_root, period, verified_kg):
        fn = self.contract.functions.anchorReport(
            b32(installation_id), b32(report_hash), b32(merkle_root), period, verified_kg)
        return self._send(fn, self.owner)

    def co_sign(self, report_hash):
        return self._send(self.contract.functions.coSign(b32(report_hash)), self.verifier)

    def allocate(self, report_hash, shipment_id, importer_id, kg):
        fn = self.contract.functions.allocate(b32(report_hash), b32(shipment_id), b32(importer_id), kg)
        return self._send(fn, self.owner)

    def remaining_kg(self, report_hash):
        return self.contract.functions.remainingKg(b32(report_hash)).call()

    def events(self):
        out = []
        for name in ("InstallationRegistered", "VerifierSet", "ReportAnchored", "ReportCoSigned", "TonnesAllocated"):
            for log in getattr(self.contract.events, name).get_logs(from_block=0):
                out.append({"event": name, "block": log.blockNumber, "tx_hash": "0x" + log.transactionHash.hex().removeprefix("0x"),
                            **{k: (v.hex() if isinstance(v, bytes) else v) for k, v in log.args.items()}})
        return sorted(out, key=lambda e: e["block"])
