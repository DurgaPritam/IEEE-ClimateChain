"""ML-DSA (NIST FIPS 204) via liboqs-python (Open Quantum Safe)."""

import os
from typing import ClassVar

# liboqs-python looks for the shared library here; Homebrew's location is used when present.
if "OQS_INSTALL_PATH" not in os.environ and os.path.isdir("/opt/homebrew/opt/liboqs"):
    os.environ["OQS_INSTALL_PATH"] = "/opt/homebrew/opt/liboqs"

import oqs  # noqa: E402

from app.trust.signatures.base import KeyPair  # noqa: E402


class MLDSA:
    alg: ClassVar[str] = "ML-DSA-65"

    def generate_keypair(self) -> KeyPair:
        with oqs.Signature(self.alg) as s:
            pk = s.generate_keypair()
            return KeyPair(self.alg, pk, s.export_secret_key())

    def sign(self, message: bytes, secret_key: bytes) -> bytes:
        with oqs.Signature(self.alg, secret_key) as s:
            return s.sign(message)

    def verify(self, message: bytes, signature: bytes, public_key: bytes) -> bool:
        with oqs.Signature(self.alg) as s:
            return s.verify(message, signature, public_key)
