"""The full demo story through the HTTP API, on the in-memory chain."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

PLANT = "TR-ANA-01"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def submit(client, plant, kind):
    sc = client.get(f"/api/demo/scenarios/{plant}", params={"kind": kind}).json()
    return client.post(f"/api/plants/{plant}/reports", json=sc).json()


def test_honest_plant_end_to_end(client):
    r = submit(client, PLANT, "honest")
    assert r["status"] in ("ready", "flagged")

    signed = client.post(f"/api/reports/{r['id']}/sign").json()
    assert signed["status"] == "plant_signed"
    assert signed["receipts"]["anchor"]["tx_hash"]

    verified = client.post(f"/api/reports/{r['id']}/cosign", json={"note": "Site visit OK"}).json()
    assert verified["status"] == "verified"

    alloc = client.post(f"/api/reports/{r['id']}/allocations",
                        json={"shipment_id": "SHIP-001", "importer_id": "DE-HAMBURG-01", "tonnes": 10_000}).json()
    total = verified["result"]["product_tonnes"]
    assert alloc["remaining_tonnes"] == pytest.approx(total - 10_000, abs=0.01)

    pkg = client.get("/api/shipments/SHIP-001/disclosure").json()
    assert pkg["cost"]["saving_eur"] > 0
    assert {d["field"] for d in pkg["disclosures"]} >= {"see_total"}
    assert not any(d["field"].startswith("input.") for d in pkg["disclosures"])  # recipes stay private

    check = client.post("/api/disclosure/verify", json=pkg).json()
    assert check["valid"]

    pkg["disclosures"][0]["value"] = 0.1  # importer-side tamper check
    assert not client.post("/api/disclosure/verify", json=pkg).json()["valid"]

    # Fraud 2: the same green tonne sold twice.
    over = client.post(f"/api/reports/{r['id']}/allocations",
                       json={"shipment_id": "SHIP-002", "importer_id": "NL-ROTTERDAM-02", "tonnes": total})
    assert over.status_code == 409
    assert over.json()["code"] == "chain:OverAllocation"


def test_under_reporting_plant_is_blocked(client):
    r = submit(client, "TR-MAR-03", "calcination_floor")
    assert r["status"] == "blocked"
    assert any(f["rule_id"] == "calcination_floor" for f in r["guard"]["flags"])
    res = client.post(f"/api/reports/{r['id']}/sign")
    assert res.status_code == 400 and res.json()["code"] == "blocked"


def test_audit_trail_lists_chain_events(client):
    events = client.get("/api/audit").json()["events"]
    names = {e["event"] for e in events}
    assert {"ReportAnchored", "ReportCoSigned", "TonnesAllocated"} <= names
