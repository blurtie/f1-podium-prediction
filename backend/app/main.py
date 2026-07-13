from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from spa_pipeline.history import build_spa_history
from spa_pipeline.modeling import predict_fixture, validate_qualifying_input

from .schemas import QualifyingRequest
from .services import fetch_weather, load_artifacts


app = FastAPI(
    title="Belgian GP 2026 Podium Prediction API",
    version="1.0.0",
    description="Leakage-safe analytics API khusus Spa-Francorchamps.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def _artifact_error(error: FileNotFoundError) -> HTTPException:
    return HTTPException(status_code=503, detail=str(error))


@app.get("/api/health")
def health() -> dict:
    try:
        _, fixture, manifest = load_artifacts()
        return {
            "status": "ok",
            "api": "ready",
            "artifacts": "ready",
            "modelVersion": manifest["modelVersion"],
            "dataCutoff": manifest["dataCutoff"],
            "activeDriverCount": len(fixture),
        }
    except FileNotFoundError as error:
        return {
            "status": "degraded",
            "api": "ready",
            "artifacts": "missing",
            "detail": str(error),
        }


@app.get("/api/spa/overview")
async def overview() -> dict:
    try:
        _, _, manifest = load_artifacts()
    except FileNotFoundError as error:
        raise _artifact_error(error) from error
    weather = await fetch_weather()
    return {
        "event": "Formula 1 Belgian Grand Prix 2026",
        "venue": "Circuit de Spa-Francorchamps",
        "weekend": {"start": "2026-07-17", "end": "2026-07-19"},
        "schedule": [
            {
                "session": "Qualifying",
                "startsAt": "2026-07-18T21:00:00+07:00",
                "label": "Sabtu, 18 Juli · 21.00 WIB",
            },
            {
                "session": "Race",
                "startsAt": "2026-07-19T20:00:00+07:00",
                "label": "Minggu, 19 Juli · 20.00 WIB",
            },
        ],
        "track": {
            "lengthKm": 7.004,
            "laps": 44,
            "raceDistanceKm": 308.052,
            "coordinates": {"latitude": 50.4372, "longitude": 5.9714},
            "character": ["low-downforce straights", "high-speed elevation", "volatile weather"],
        },
        "dataCutoff": manifest["dataCutoff"],
        "model": {
            "status": "ready",
            "version": manifest["modelVersion"],
            "stage": "pre-qualifying",
            "calibrationWindow": manifest["calibrationWindow"],
        },
        "weather": weather,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/spa/history")
def history(
    window: Literal["modern", "extended"] = "modern",
    basis: Literal["qualifying", "grid"] = "qualifying",
    include2021: bool = Query(default=False),
) -> dict:
    return build_spa_history(window=window, basis=basis, include_2021=include2021)


@app.get("/api/spa/predictions/pre-qualifying")
def pre_qualifying() -> dict:
    try:
        bundle, fixture, _ = load_artifacts()
    except FileNotFoundError as error:
        raise _artifact_error(error) from error
    return predict_fixture(bundle, fixture, "pre-qualifying")


@app.post("/api/spa/predictions/post-qualifying")
def post_qualifying(payload: QualifyingRequest) -> dict:
    try:
        bundle, fixture, _ = load_artifacts()
    except FileNotFoundError as error:
        raise _artifact_error(error) from error
    drivers = [driver.model_dump(by_alias=True) for driver in payload.drivers]
    active_ids = set(int(value) for value in fixture["driverId"])
    errors = validate_qualifying_input(drivers, active_ids)
    if errors:
        raise HTTPException(status_code=422, detail={"message": "Input qualifying tidak valid", "errors": errors})
    return predict_fixture(bundle, fixture, "post-qualifying", drivers)
