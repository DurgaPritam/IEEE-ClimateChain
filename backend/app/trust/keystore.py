"""File keystore for demo signing keys, so fingerprints stay stable across restarts.

Demo only: keys are stored unencrypted in backend/keys/ (gitignored). In production,
each installation and verifier keeps its keys in an HSM/KMS.
"""

import base64
import json
import os
import re
from pathlib import Path

from app.trust.signatures import hybrid

KEY_DIR = Path(os.environ.get("KEY_DIR", Path(__file__).resolve().parents[2] / "keys"))


def load_or_create(signer: str, algs: tuple[str, ...]) -> hybrid.HybridKey:
    path = KEY_DIR / (re.sub(r"[^A-Za-z0-9_.-]", "_", signer) + ".json")
    if path.exists():
        data = json.loads(path.read_text())
        if tuple(data["algs"]) == algs:
            return hybrid.HybridKey(signer=signer, keys=[
                (k["alg"], base64.b64decode(k["pk"]), base64.b64decode(k["sk"])) for k in data["keys"]
            ])
    key = hybrid.generate_hybrid_key(signer, algs)
    KEY_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"signer": signer, "algs": list(algs), "keys": [
        {"alg": a, "pk": base64.b64encode(pk).decode(), "sk": base64.b64encode(sk).decode()}
        for a, pk, sk in key.keys
    ]}))
    path.chmod(0o600)
    return key
