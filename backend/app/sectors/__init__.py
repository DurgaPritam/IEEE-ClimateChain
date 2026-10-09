"""Sector registry. To add a sector: implement `Sector` and register it here."""

from app.sectors.base import Sector
from app.sectors.cement import CementSector

SECTORS: dict[str, type] = {
    CementSector.name: CementSector,
}


def get_sector(name: str) -> Sector:
    return SECTORS[name]()
