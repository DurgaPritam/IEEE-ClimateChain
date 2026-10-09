"""Salted Merkle commitments for selective disclosure.

Each report field becomes a leaf: H(0x00 || salt || canonical({"k": field, "v": value})).
Internal nodes are H(0x01 || left || right); an odd node is carried up unchanged.
Only the root goes on-chain. An importer receives one field, its salt and its path,
which proves the value belongs to the committed report without revealing other fields.
"""

import hashlib
import secrets
from typing import Any

from pydantic import BaseModel

from app.trust.canonical import canonical_bytes


def _h(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def leaf_hash(field: str, value: Any, salt: bytes) -> bytes:
    return _h(b"\x00" + salt + canonical_bytes({"k": field, "v": value}))


def _node(left: bytes, right: bytes) -> bytes:
    return _h(b"\x01" + left + right)


class ProofStep(BaseModel):
    sibling: str  # hex
    side: str  # "left" or "right": where the sibling sits


class Disclosure(BaseModel):
    field: str
    value: Any
    salt: str  # hex
    proof: list[ProofStep]
    root: str  # hex


class MerkleCommitment:
    def __init__(self, fields: dict[str, Any], salts: dict[str, bytes] | None = None):
        self.fields = dict(sorted(fields.items()))
        self.salts = salts or {k: secrets.token_bytes(32) for k in self.fields}
        self.keys = list(self.fields)
        self.levels: list[list[bytes]] = [
            [leaf_hash(k, self.fields[k], self.salts[k]) for k in self.keys]
        ]
        while len(self.levels[-1]) > 1:
            cur = self.levels[-1]
            nxt = [_node(cur[i], cur[i + 1]) for i in range(0, len(cur) - 1, 2)]
            if len(cur) % 2:
                nxt.append(cur[-1])
            self.levels.append(nxt)

    @property
    def root(self) -> str:
        return self.levels[-1][0].hex()

    def disclose(self, field: str) -> Disclosure:
        idx = self.keys.index(field)
        proof = []
        for level in self.levels[:-1]:
            sib = idx ^ 1
            if sib < len(level):
                proof.append(ProofStep(sibling=level[sib].hex(), side="left" if sib < idx else "right"))
            idx //= 2
        return Disclosure(
            field=field, value=self.fields[field], salt=self.salts[field].hex(), proof=proof, root=self.root
        )


def verify_disclosure(d: Disclosure, expected_root: str | None = None) -> bool:
    h = leaf_hash(d.field, d.value, bytes.fromhex(d.salt))
    for step in d.proof:
        s = bytes.fromhex(step.sibling)
        h = _node(s, h) if step.side == "left" else _node(h, s)
    return h.hex() == (expected_root or d.root)
