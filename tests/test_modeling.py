import numpy as np
import pytest

from spa_pipeline.modeling import run_simulation, validate_qualifying_input


def _drivers(count: int = 4) -> list[dict]:
    return [
        {
            "driverId": index,
            "qualifyingPosition": index,
            "gridPosition": index,
            "gapToPoleSeconds": 0.0 if index == 1 else float(index - 1),
        }
        for index in range(1, count + 1)
    ]


def test_validate_qualifying_accepts_complete_unique_field() -> None:
    assert validate_qualifying_input(_drivers(), {1, 2, 3, 4}) == []


def test_validate_qualifying_reports_duplicates_and_missing_driver() -> None:
    drivers = _drivers()
    drivers[-1]["driverId"] = 3
    drivers[-1]["qualifyingPosition"] = 3
    errors = validate_qualifying_input(drivers, {1, 2, 3, 4})
    assert any("belum lengkap" in error for error in errors)
    assert any("satu kali" in error for error in errors)
    assert any("Posisi qualifying" in error for error in errors)


def test_simulation_is_reproducible_and_assigns_three_places() -> None:
    winner = np.array([0.5, 0.3, 0.15, 0.05])
    podium = np.array([0.4, 0.3, 0.2, 0.1])
    first = run_simulation(winner, podium, simulations=2_000, seed=7)
    second = run_simulation(winner, podium, simulations=2_000, seed=7)
    for key in ("p1", "p2", "p3", "podium"):
        np.testing.assert_array_equal(first[key], second[key])
    assert first["p1"].sum() == pytest.approx(1.0)
    assert first["p2"].sum() == pytest.approx(1.0)
    assert first["p3"].sum() == pytest.approx(1.0)
    assert first["podium"].sum() == pytest.approx(3.0)


def test_simulation_rejects_fields_smaller_than_a_podium() -> None:
    with pytest.raises(ValueError, match="minimal tiga"):
        run_simulation(np.ones(2), np.ones(2))
