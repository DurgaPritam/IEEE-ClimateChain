import pytest

from app.trust import merkle
from app.trust.canonical import canonical_bytes, report_hash
from app.trust.signatures import hybrid

REPORT = {"plant": "TR-ANA-01", "period": "2026-06", "see_total": 0.8322, "cement_t": 117347.0}


def test_canonical_json_is_order_independent():
    assert canonical_bytes({"b": 1, "a": 2}) == canonical_bytes({"a": 2, "b": 1})
    assert report_hash(REPORT) == report_hash(dict(reversed(REPORT.items())))


@pytest.fixture(scope="module")
def key():
    return hybrid.generate_hybrid_key("plant:TR-ANA-01")


def test_hybrid_sign_and_verify(key):
    msg = canonical_bytes(REPORT)
    sig = hybrid.sign(msg, key)
    assert {c.alg for c in sig.components} == {"ML-DSA-65", "ECDSA-P256-SHA256"}
    assert hybrid.verify(msg, sig)
    assert sig.key_fingerprint == key.key_fingerprint


def test_tampered_report_fails(key):
    sig = hybrid.sign(canonical_bytes(REPORT), key)
    assert not hybrid.verify(canonical_bytes(REPORT | {"see_total": 0.5}), sig)


def test_hybrid_requires_both_components(key):
    msg = canonical_bytes(REPORT)
    sig = hybrid.sign(msg, key)
    stripped = sig.model_copy(update={"components": sig.components[1:]})
    assert not hybrid.verify(msg, stripped)


def test_one_broken_component_invalidates(key):
    msg = canonical_bytes(REPORT)
    sig = hybrid.sign(msg, key)
    other = hybrid.sign(canonical_bytes({"x": 1}), key)
    mixed = sig.model_copy(update={"components": [sig.components[0], other.components[1]]})
    assert not hybrid.verify(msg, mixed)


@pytest.mark.parametrize("n", [1, 2, 3, 5, 8])
def test_merkle_disclosure_roundtrip(n):
    fields = {f"f{i}": i * 1.5 for i in range(n)}
    c = merkle.MerkleCommitment(fields)
    for k in fields:
        d = c.disclose(k)
        assert merkle.verify_disclosure(d, c.root)


def test_merkle_rejects_changed_value():
    c = merkle.MerkleCommitment(REPORT)
    d = c.disclose("see_total")
    assert not merkle.verify_disclosure(d.model_copy(update={"value": 0.5}), c.root)


def test_merkle_root_hides_values_via_salt():
    a = merkle.MerkleCommitment(REPORT)
    b = merkle.MerkleCommitment(REPORT)
    assert a.root != b.root
