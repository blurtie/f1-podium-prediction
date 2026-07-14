import pytest

from spa_pipeline.history import build_spa_history, wilson_interval


def test_wilson_interval_handles_empty_sample() -> None:
    assert wilson_interval(0, 0) == {"low": 0.0, "high": 0.0}


def test_wilson_interval_contains_observed_rate() -> None:
    interval = wilson_interval(7, 10)
    assert interval["low"] < 0.7 < interval["high"]
    assert interval["low"] == pytest.approx(0.3968, abs=0.001)


def test_modern_history_contract_includes_active_driver_formbook() -> None:
    history = build_spa_history(window="modern", basis="qualifying", include_2021=False)

    assert history["yearRange"] == {"from": 2014, "to": 2025}
    assert history["include2021"] is False
    assert history["basis"] == "qualifying"
    assert history["poleToWinner"]["sampleSize"] == 11
    assert history["poleToPodium"]["successes"] == 10
    assert history["activeDrivers"]
    assert history["teams"]
    assert all("averageFinish" in driver for driver in history["activeDrivers"])
