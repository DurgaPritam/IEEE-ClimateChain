"""Hybrid signatures: a report is valid only if every component signature verifies.

The default pairing is ML-DSA-65 + ECDSA P-256, so a report stays secure if either
scheme is broken. The component list is configurable (e.g. ECDSA-only emergency mode).
"""

import base64
import hashlib

from pydantic import BaseModel

from app.trust.signatures.base import KeyPair, SignatureScheme, fingerprint
from app.trust.signatures.ecdsa import ECDSAP256
from app.trust.signatures.mldsa import MLDSA

DOMAIN = b"VERDANT-X/report-signature/v1\x00"

SCHEMES: dict[str, type] = {MLDSA.alg: MLDSA, ECDSAP256.alg: ECDSAP256}
DEFAULT_SCHEMES = (MLDSA.alg, ECDSAP256.alg)


class ComponentSignature(BaseModel):
    alg: str
    public_key: str  # base64
    signature: str  # base64
    key_fingerprint: str  # sha256 hex of the public key


class HybridSignature(BaseModel):
    signer: str
    message_sha256: str
    components: list[ComponentSignature]

    @property
    def key_fingerprint(self) -> str:
        """Single identity for the hybrid key, as anchored on-chain."""
        return hashlib.sha256(
            b"".join(bytes.fromhex(c.key_fingerprint) for c in self.components)
        ).hexdigest()


class HybridKey(BaseModel):
    """A signer's set of keys, one per component scheme."""

    signer: str
    keys: list[tuple[str, bytes, bytes]]  # (alg, public_key, secret_key)

    @property
    def key_fingerprint(self) -> str:
        return hashlib.sha256(b"".join(bytes.fromhex(fingerprint(pk)) for _, pk, _ in self.keys)).hexdigest()


def _scheme(alg: str) -> SignatureScheme:
    return SCHEMES[alg]()


def generate_hybrid_key(signer: str, algs: tuple[str, ...] = DEFAULT_SCHEMES) -> HybridKey:
    pairs: list[KeyPair] = [_scheme(a).generate_keypair() for a in algs]
    return HybridKey(signer=signer, keys=[(p.alg, p.public_key, p.secret_key) for p in pairs])


def sign(message: bytes, key: HybridKey) -> HybridSignature:
    msg = DOMAIN + message
    return HybridSignature(
        signer=key.signer,
        message_sha256=hashlib.sha256(message).hexdigest(),
        components=[
            ComponentSignature(
                alg=alg,
                public_key=base64.b64encode(pk).decode(),
                signature=base64.b64encode(_scheme(alg).sign(msg, sk)).decode(),
                key_fingerprint=fingerprint(pk),
            )
            for alg, pk, sk in key.keys
        ],
    )


def verify(message: bytes, sig: HybridSignature, required: tuple[str, ...] = DEFAULT_SCHEMES) -> bool:
    """True only if all required schemes are present and every component verifies."""
    if {c.alg for c in sig.components} != set(required):
        return False
    msg = DOMAIN + message
    return all(
        _scheme(c.alg).verify(msg, base64.b64decode(c.signature), base64.b64decode(c.public_key))
        for c in sig.components
    )
