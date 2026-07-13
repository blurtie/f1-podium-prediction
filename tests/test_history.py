import pytest

from spa_pipeline.history import wilson_interval


def test_wilson_interval_handles_empty_sample() -> None:
    assert wilson_interval(0, 0) == {"low": 0.0, "high": 0.0}


def test_wilson_interval_contains_observed_rate() -> None:
    interval = wilson_interval(7, 10)
    assert interval["low"] < 0.7 < interval["high"]
    assert interval["low"] == pytest.approx(0.3968, abs=0.001)
