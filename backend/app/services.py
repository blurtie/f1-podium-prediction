from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx
import joblib
import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_DIR = ROOT / "artifacts" / "spa" / "v1"


@lru_cache(maxsize=1)
def load_artifacts() -> tuple[dict[str, Any], pd.DataFrame, dict[str, Any]]:
    bundle_path = ARTIFACT_DIR / "model_bundle.joblib"
    fixture_path = ARTIFACT_DIR / "fixture.parquet"
    manifest_path = ARTIFACT_DIR / "manifest.json"
    missing = [path.name for path in (bundle_path, fixture_path, manifest_path) if not path.exists()]
    if missing:
        raise FileNotFoundError("Artefak model belum tersedia: " + ", ".join(missing))
    bundle = joblib.load(bundle_path)
    fixture = pd.read_parquet(fixture_path)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    return bundle, fixture, manifest


async def fetch_weather() -> dict[str, Any]:
    params = {
        "latitude": 50.4372,
        "longitude": 5.9714,
        "start_date": "2026-07-17",
        "end_date": "2026-07-19",
        "timezone": "Asia/Jakarta",
        "daily": ",".join(
            [
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_sum",
                "precipitation_probability_max",
                "wind_speed_10m_max",
            ]
        ),
    }
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            response = await client.get("https://api.open-meteo.com/v1/forecast", params=params)
            response.raise_for_status()
        daily = response.json().get("daily", {})
        days = []
        for index, date in enumerate(daily.get("time", [])):
            days.append(
                {
                    "date": date,
                    "temperatureMaxC": daily["temperature_2m_max"][index],
                    "temperatureMinC": daily["temperature_2m_min"][index],
                    "precipitationMm": daily["precipitation_sum"][index],
                    "precipitationProbability": daily["precipitation_probability_max"][index],
                    "windSpeedMaxKmh": daily["wind_speed_10m_max"][index],
                }
            )
        return {
            "status": "available",
            "source": "Open-Meteo",
            "days": days,
            "modelUsage": "context-only",
            "warning": "Cuaca belum menjadi fitur model v1.",
        }
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as error:
        return {
            "status": "unavailable",
            "source": "Open-Meteo",
            "days": [],
            "modelUsage": "context-only",
            "warning": f"Forecast cuaca sementara tidak tersedia ({type(error).__name__}).",
        }
