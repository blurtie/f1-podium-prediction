from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator


class QualifyingDriver(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    driver_id: int = Field(alias="driverId", gt=0)
    qualifying_position: int = Field(alias="qualifyingPosition", ge=1, le=30)
    grid_position: int = Field(alias="gridPosition", ge=1, le=30)
    gap_to_pole_seconds: float | None = Field(
        default=None, alias="gapToPoleSeconds", ge=0
    )


class QualifyingRequest(BaseModel):
    drivers: list[QualifyingDriver]

    @field_validator("drivers")
    @classmethod
    def require_drivers(cls, value: list[QualifyingDriver]) -> list[QualifyingDriver]:
        if not value:
            raise ValueError("drivers tidak boleh kosong")
        return value
