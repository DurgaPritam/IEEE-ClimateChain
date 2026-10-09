"""Canonical JSON (RFC 8785, JCS) so the same data always produces the same bytes and hash."""

import hashlib
from typing import Any

import rfc8785


def canonical_bytes(obj: Any) -> bytes:
    return rfc8785.dumps(obj)


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def report_hash(obj: Any) -> str:
    return sha256_hex(canonical_bytes(obj))
