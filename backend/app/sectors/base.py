"""Interface every CBAM sector module implements (cement now; steel, aluminium later)."""

from typing import ClassVar, Protocol

from pydantic import BaseModel

from app.models import EmissionsResult


class Sector(Protocol):
    name: ClassVar[str]
    inputs_model: ClassVar[type[BaseModel]]

    def calculate(self, inputs: BaseModel) -> EmissionsResult: ...
