import asyncio

import pytest

from backend.app import main as api_main


@pytest.mark.parametrize(
    ("weather", "expected_status", "expected_days"),
    [
        (
            {
                "status": "available",
                "source": "Open-Meteo",
                "modelUsage": "context-only",
                "warning": "Cuaca belum menjadi fitur model v1.",
                "days": [{"date": "2026-07-17"}],
            },
            "available",
            1,
        ),
        (
            {
                "status": "unavailable",
                "source": "Open-Meteo",
                "modelUsage": "context-only",
                "warning": "Forecast tidak tersedia.",
                "days": [],
            },
            "unavailable",
            0,
        ),
    ],
)
def test_overview_preserves_available_and_unavailable_weather(
    monkeypatch: pytest.MonkeyPatch,
    weather: dict,
    expected_status: str,
    expected_days: int,
) -> None:
    async def fake_weather() -> dict:
        return weather

    monkeypatch.setattr(
        api_main,
        "load_artifacts",
        lambda: ({}, [], {"dataCutoff": "2026-07-05", "modelVersion": "test", "calibrationWindow": "2022-2025"}),
    )
    monkeypatch.setattr(api_main, "fetch_weather", fake_weather)
    result = asyncio.run(api_main.overview())

    assert result["weather"]["status"] == expected_status
    assert len(result["weather"]["days"]) == expected_days
    assert result["weather"]["modelUsage"] == "context-only"
