"""Seeded demo state: 3 synthetic plants with 23 months of history; the 24th month is played live."""

import random

from app.data.synthetic import FRAUD_TYPES, PLANTS, _month, generate
from app.service import VerdantService
from app.store import Plant

LIVE_MONTH = 23  # 2026-12
LIVE_PERIOD = "2026-12"


def seed(service: VerdantService) -> VerdantService:
    data = generate()
    for p in PLANTS:
        service.register_plant(Plant(id=p.id, name=p.name, city=p.city))
        for period, x, _fraud in data[p.id][:LIVE_MONTH]:
            service.submit(p.id, period, x.model_dump())
        service.fit_anomaly_model(p.id)
    return service


def scenario(plant_id: str, kind: str = "honest", seed: int = 2026) -> dict:
    """Prefilled inputs for the live month; `kind` is "honest" or one of FRAUD_TYPES."""
    profile = next(p for p in PLANTS if p.id == plant_id)
    fraud = None if kind == "honest" else kind
    if fraud and fraud not in FRAUD_TYPES:
        raise ValueError(f"Unknown scenario {kind}; choose honest or one of {FRAUD_TYPES}")
    return {"period": LIVE_PERIOD,
            "inputs": _month(profile, LIVE_MONTH, random.Random(seed), fraud).model_dump()}
