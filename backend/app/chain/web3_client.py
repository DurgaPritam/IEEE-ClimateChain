"""web3.py client for the deployed VerdantRegistry (Polygon Amoy, Sepolia or a local Hardhat node).

Reads address and ABI from contracts/deployments/<network>.json. The deployer wallet acts as
registry owner and demo plant operator; a second wallet acts as the accredited verifier.
"""

import json
import os
import time
from pathlib import Path

from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware
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
        self.w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)  # Polygon uses PoA-style extraData
        self.contract = self.w3.eth.contract(address=dep["address"], abi=dep["abi"])
        self.address = dep["address"]
        self.network = network
        self.owner = self.w3.eth.account.from_key(os.environ["DEPLOYER_PRIVATE_KEY"])
        self.verifier = self.w3.eth.account.from_key(os.environ["VERIFIER_PRIVATE_KEY"])
        self.explorer = os.environ.get("EXPLORER_TX_URL", "")
        self.deploy_block = dep.get("deployBlock", 0)
        # Namespace for installation/shipment ids, so rehearsals get fresh on-chain identities
        # without redeploying (the contract allows one report per installation and period).
        self.ns = os.environ.get("CHAIN_NAMESPACE", "")
        tip = os.environ.get("GAS_TIP_GWEI")
        self.tip_wei = Web3.to_wei(float(tip), "gwei") if tip else None
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
            name = self._errors.get(data[:8], "Revert")
            args = {}
            if name == "OverAllocation" and len(data) >= 8 + 128:
                args = {"available_kg": int(data[8:72], 16), "requested_kg": int(data[72:136], 16)}
            raise ChainError(name, str(e.message or data), args) from e
        params = {"from": account.address, "nonce": self.w3.eth.get_transaction_count(account.address)}
        if self.tip_wei is not None:
            base = self.w3.eth.get_block("latest").get("baseFeePerGas", 0)
            params |= {"maxPriorityFeePerGas": self.tip_wei, "maxFeePerGas": 2 * base + self.tip_wei}
        tx = fn.build_transaction(params)
        signed = account.sign_transaction(tx)
        h = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        rcpt = self.w3.eth.wait_for_transaction_receipt(h, timeout=120)
        hx = "0x" + h.hex().removeprefix("0x")
        return TxReceipt(tx_hash=hx, block=rcpt.blockNumber,
                         explorer_url=self.explorer + hx if self.explorer else None, backend=self.name)

    def _id(self, value: str) -> bytes:
        return b32(f"{self.ns}/{value}" if self.ns else value)

    def _unchanged(self) -> TxReceipt:
        return TxReceipt(tx_hash="unchanged", backend=self.name)

    def register_installation(self, installation_id, operator_key_fp):
        operator, fp, active = self.contract.functions.installations(self._id(installation_id)).call()
        if active and operator == self.owner.address and fp == b32(operator_key_fp):
            return self._unchanged()  # already registered with this key: no gas spent
        fn = self.contract.functions.registerInstallation(self._id(installation_id), self.owner.address, b32(operator_key_fp))
        return self._send(fn, self.owner)

    def set_verifier(self, verifier_key_fp, active=True):
        fp, is_active = self.contract.functions.verifiers(self.verifier.address).call()
        if is_active == active and fp == b32(verifier_key_fp):
            return self._unchanged()
        fn = self.contract.functions.setVerifier(self.verifier.address, b32(verifier_key_fp), active)
        return self._send(fn, self.owner)

    def anchor_report(self, installation_id, report_hash, merkle_root, period, verified_kg):
        fn = self.contract.functions.anchorReport(
            self._id(installation_id), b32(report_hash), b32(merkle_root), period, verified_kg)
        return self._send(fn, self.owner)

    def co_sign(self, report_hash):
        return self._send(self.contract.functions.coSign(b32(report_hash)), self.verifier)

    def allocate(self, report_hash, shipment_id, importer_id, kg):
        fn = self.contract.functions.allocate(b32(report_hash), self._id(shipment_id), b32(importer_id), kg)
        return self._send(fn, self.owner)

    def remaining_kg(self, report_hash):
        return self.contract.functions.remainingKg(b32(report_hash)).call()

    def _retry(self, fn, *args, attempts: int = 4, **kwargs):
        for i in range(attempts):  # free public RPCs fail intermittently
            try:
                return fn(*args, **kwargs)
            except Exception:
                if i == attempts - 1:
                    raise
                time.sleep(1.5 * (i + 1))

    def events(self):
        names = ("InstallationRegistered", "VerifierSet", "ReportAnchored", "ReportCoSigned", "TonnesAllocated")
        by_topic = {}
        for n in names:
            abi = next(e for e in self.contract.abi if e.get("type") == "event" and e["name"] == n)
            sig = f"{n}({','.join(i['type'] for i in abi['inputs'])})"
            by_topic[Web3.keccak(text=sig)] = getattr(self.contract.events, n)()
        latest, step = self._retry(lambda: self.w3.eth.block_number), 5_000  # public RPCs cap log ranges
        out = []
        for a in range(self.deploy_block, latest + 1, step):
            logs = self._retry(self.w3.eth.get_logs, {
                "address": self.contract.address, "fromBlock": a, "toBlock": min(a + step - 1, latest)})
            for log in logs:
                ev = by_topic.get(bytes(log["topics"][0]))
                if ev is None:
                    continue
                d = ev.process_log(log)
                out.append({"event": d.event, "block": d.blockNumber,
                            "tx_hash": "0x" + d.transactionHash.hex().removeprefix("0x"),
                            **{k: (v.hex() if isinstance(v, bytes) else v) for k, v in d.args.items()}})
        return sorted(out, key=lambda e: e["block"])
