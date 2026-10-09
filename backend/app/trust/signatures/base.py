"""Signature scheme interface. Only standard library implementations are used — no custom crypto."""

import hashlib
from dataclasses import dataclass
from typing import ClassVar, Protocol


@dataclass(frozen=True)
class KeyPair:
    alg: str
    public_key: bytes
    secret_key: bytes

    @property
    def fingerprint(self) -> str:
        return fingerprint(self.public_key)


def fingerprint(public_key: bytes) -> str:
    return hashlib.sha256(public_key).hexdigest()


class SignatureScheme(Protocol):
    alg: ClassVar[str]

    def generate_keypair(self) -> KeyPair: ...
    def sign(self, message: bytes, secret_key: bytes) -> bytes: ...
    def verify(self, message: bytes, signature: bytes, public_key: bytes) -> bool: ...
