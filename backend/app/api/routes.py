"""HTTP API. Thin layer over VerdantService; grouped by role."""

from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app import demo
from app.chain import get_chain
from app.data.synthetic import FRAUD_TYPES
from app.pricing.cbam_cost import compare
from app.service import DisclosurePackage, VerdantService, signature_size_summary
from app.store import Store

router = APIRouter()


def svc(request: Request) -> VerdantService:
    return request.app.state.service


class SubmitBody(BaseModel):
    period: str
    inputs: dict[str, Any]


class CosignBody(BaseModel):
    note: str | None = None


class AllocateBody(BaseModel):
    shipment_id: str
    importer_id: str
    tonnes: float


# ---- shared ----

@router.get("/health")
def health(s: VerdantService = Depends(svc)):
    return {"ok": True, "chain": s.chain.name}


@router.get("/plants")
def plants(s: VerdantService = Depends(svc)):
    return list(s.store.plants.values())


@router.get("/plants/{plant_id}/reports")
def plant_reports(plant_id: str, s: VerdantService = Depends(svc)):
    return s.store.plant_reports(plant_id)


@router.get("/reports/{report_id}")
def report(report_id: str, s: VerdantService = Depends(svc)):
    r = s._report(report_id)
    out = r.model_dump(exclude={"salts"})
    if r.plant_signature:
        out["signature_bytes"] = signature_size_summary(r.plant_signature)
    if r.report_hash and r.status.value == "verified":
        out["remaining_tonnes"] = s.remaining_tonnes(report_id)
    return out


# ---- plant operator ----

@router.post("/plants/{plant_id}/reports", tags=["plant"])
def submit(plant_id: str, body: SubmitBody, s: VerdantService = Depends(svc)):
    return s.submit(plant_id, body.period, body.inputs)


@router.post("/reports/{report_id}/sign", tags=["plant"])
def sign(report_id: str, s: VerdantService = Depends(svc)):
    return s.plant_sign(report_id).model_dump(exclude={"salts"})


@router.post("/reports/{report_id}/allocations", tags=["plant"])
def allocate(report_id: str, body: AllocateBody, s: VerdantService = Depends(svc)):
    a = s.allocate(report_id, body.shipment_id, body.importer_id, body.tonnes)
    return {"allocation": a, "remaining_tonnes": s.remaining_tonnes(report_id)}


# ---- verifier ----

@router.get("/verifier/queue", tags=["verifier"])
def verifier_queue(s: VerdantService = Depends(svc)):
    return [r.model_dump(exclude={"salts"}) for r in s.store.reports.values() if r.status.value == "plant_signed"]


@router.post("/reports/{report_id}/cosign", tags=["verifier"])
def cosign(report_id: str, body: CosignBody, s: VerdantService = Depends(svc)):
    return s.verifier_cosign(report_id, body.note).model_dump(exclude={"salts"})


# ---- importer ----

@router.get("/shipments/{shipment_id}/disclosure", tags=["importer"])
def disclosure(shipment_id: str, year: int = 2026, s: VerdantService = Depends(svc)):
    return s.disclosure(shipment_id, year)


@router.post("/disclosure/verify", tags=["importer"])
def verify(package: DisclosurePackage):
    return VerdantService.verify_package(package)


@router.get("/cost", tags=["importer"])
def cost(tonnes: float, see: float, sector: str = "cement", year: int = 2026, carbon_paid_eur: float = 0):
    return compare(sector, tonnes, see, year=year, carbon_price_paid_eur=carbon_paid_eur)


# ---- regulator ----

@router.get("/audit", tags=["regulator"])
def audit(s: VerdantService = Depends(svc)):
    return {
        "chain": s.chain.name,
        "events": s.chain.events(),
        "reports": [{"id": r.id, "status": r.status, "report_hash": r.report_hash,
                     "guard": r.guard.status, "see_total": r.result.see_total}
                    for r in s.store.reports.values() if r.report_hash or r.status.value == "blocked"],
        "allocations": list(s.store.allocations.values()),
    }


# ---- demo ----

@router.get("/demo/scenarios", tags=["demo"])
def scenario_kinds():
    return ["honest", *FRAUD_TYPES]


@router.get("/demo/scenarios/{plant_id}", tags=["demo"])
def scenario(plant_id: str, kind: str = "honest"):
    return demo.scenario(plant_id, kind)


@router.post("/demo/reset", tags=["demo"])
def reset(request: Request):
    request.app.state.service = demo.seed(VerdantService(Store(), get_chain()))
    return {"ok": True}
