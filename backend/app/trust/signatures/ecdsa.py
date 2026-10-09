"""ECDSA P-256 with SHA-256 via the `cryptography` library."""

from typing import ClassVar

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec

from app.trust.signatures.base import KeyPair


class ECDSAP256:
    alg: ClassVar[str] = "ECDSA-P256-SHA256"

    def generate_keypair(self) -> KeyPair:
        sk = ec.generate_private_key(ec.SECP256R1())
        pk = sk.public_key().public_bytes(
            serialization.Encoding.X962, serialization.PublicFormat.CompressedPoint
        )
        der = sk.private_bytes(
            serialization.Encoding.DER, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
        )
        return KeyPair(self.alg, pk, der)

    def sign(self, message: bytes, secret_key: bytes) -> bytes:
        sk = serialization.load_der_private_key(secret_key, password=None)
        return sk.sign(message, ec.ECDSA(hashes.SHA256()))

    def verify(self, message: bytes, signature: bytes, public_key: bytes) -> bool:
        pk = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), public_key)
        try:
            pk.verify(signature, message, ec.ECDSA(hashes.SHA256()))
            return True
        except InvalidSignature:
            return False
