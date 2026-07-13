from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd


FEATURE_LABELS = {
    "driver_finish_avg_5": "Rata-rata finis 5 race",
    "driver_points_avg_5": "Poin rata-rata 5 race",
    "driver_podium_rate_10": "Konsistensi podium",
    "driver_win_rate_10": "Momentum kemenangan",
    "driver_dnf_rate_10": "Risiko DNF pembalap",
    "driver_grid_gain_avg_5": "Kemampuan naik posisi",
    "team_points_avg_5": "Performa tim terkini",
    "team_podium_rate_10": "Konsistensi podium tim",
    "team_win_rate_10": "Momentum kemenangan tim",
    "team_dnf_rate_10": "Risiko reliabilitas tim",
    "prev_standing_pos": "Posisi klasemen pembalap",
    "prev_standing_points": "Poin klasemen pembalap",
    "prev_constructor_pos": "Posisi klasemen konstruktor",
    "prev_constructor_points": "Poin konstruktor",
    "driver_circuit_races": "Pengalaman di Spa",
    "driver_circuit_avg_finish": "Riwayat finis di Spa",
    "driver_circuit_podium_rate": "Riwayat podium di Spa",
    "team_circuit_races": "Pengalaman tim di Spa",
    "team_circuit_avg_finish": "Riwayat finis tim di Spa",
    "team_circuit_podium_rate": "Riwayat podium tim di Spa",
    "qualifying_position": "Posisi qualifying",
    "grid_position": "Posisi start aktual",
    "gap_to_pole_seconds": "Gap terhadap pole",
    "reached_q2": "Lolos Q2",
    "reached_q3": "Lolos Q3",
}


def validate_qualifying_input(
    drivers: list[dict[str, Any]], active_driver_ids: set[int]
) -> list[str]:
    errors: list[str] = []
    received_ids = [int(item.get("driverId", -1)) for item in drivers]
    missing = active_driver_ids - set(received_ids)
    unexpected = set(received_ids) - active_driver_ids
    if missing:
        errors.append(f"Pembalap aktif belum lengkap: {sorted(missing)}")
    if unexpected:
        errors.append(f"driverId tidak dikenal: {sorted(unexpected)}")
    if len(received_ids) != len(set(received_ids)):
        errors.append("Setiap pembalap hanya boleh muncul satu kali.")

    qualifying = [int(item.get("qualifyingPosition", 0)) for item in drivers]
    grids = [int(item.get("gridPosition", 0)) for item in drivers]
    expected_positions = set(range(1, len(active_driver_ids) + 1))
    if set(qualifying) != expected_positions or len(qualifying) != len(set(qualifying)):
        errors.append(f"Posisi qualifying harus unik dari 1 sampai {len(active_driver_ids)}.")
    if set(grids) != expected_positions or len(grids) != len(set(grids)):
        errors.append(f"Posisi grid harus unik dari 1 sampai {len(active_driver_ids)}.")

    pole_entries = [item for item in drivers if int(item.get("qualifyingPosition", 0)) == 1]
    if len(pole_entries) == 1:
        pole_gap = pole_entries[0].get("gapToPoleSeconds")
        if pole_gap is None or abs(float(pole_gap)) > 1e-9:
            errors.append("Pole wajib memiliki gapToPoleSeconds sama dengan 0.")
    for item in drivers:
        gap = item.get("gapToPoleSeconds")
        if gap is not None and float(gap) < 0:
            errors.append("gapToPoleSeconds tidak boleh negatif.")
            break
    return errors


def run_simulation(
    winner_weights: np.ndarray,
    podium_weights: np.ndarray,
    simulations: int = 50_000,
    seed: int = 20_260_719,
) -> dict[str, np.ndarray]:
    winner = np.asarray(winner_weights, dtype=float)
    podium = np.asarray(podium_weights, dtype=float)
    if winner.ndim != 1 or podium.ndim != 1 or len(winner) != len(podium):
        raise ValueError("Bobot winner dan podium harus vektor dengan panjang sama.")
    if len(winner) < 3:
        raise ValueError("Simulasi podium membutuhkan minimal tiga pembalap.")
    winner = np.clip(winner, 1e-12, None)
    podium = np.clip(podium, 1e-12, None)
    winner /= winner.sum()

    rng = np.random.default_rng(seed)
    p1 = rng.choice(len(winner), size=simulations, p=winner)
    race_keys = -np.log(np.clip(rng.random((simulations, len(podium))), 1e-12, 1.0)) / podium
    race_keys[np.arange(simulations), p1] = np.inf
    following = np.argpartition(race_keys, kth=1, axis=1)[:, :2]
    following_keys = np.take_along_axis(race_keys, following, axis=1)
    following = np.take_along_axis(following, np.argsort(following_keys, axis=1), axis=1)
    p2, p3 = following[:, 0], following[:, 1]

    counts = []
    for selected in (p1, p2, p3):
        counts.append(np.bincount(selected, minlength=len(winner)) / simulations)
    return {
        "p1": counts[0],
        "p2": counts[1],
        "p3": counts[2],
        "winner": counts[0],
        "podium": counts[0] + counts[1] + counts[2],
    }


def _calibrated_probability(model: dict[str, Any], features: pd.DataFrame) -> np.ndarray:
    x = features[model["features"]].fillna(pd.Series(model["medians"]))
    raw = np.clip(model["estimator"].predict_proba(x)[:, 1], 1e-6, 1 - 1e-6)
    logits = np.log(raw / (1 - raw)).reshape(-1, 1)
    return model["calibrator"].predict_proba(logits)[:, 1]


def _factors(model: dict[str, Any], features: pd.DataFrame) -> list[list[dict[str, Any]]]:
    x = features[model["features"]].fillna(pd.Series(model["medians"]))
    contributions = model["estimator"].booster_.predict(x, pred_contrib=True)[:, :-1]
    output: list[list[dict[str, Any]]] = []
    for row in contributions:
        positive = np.argsort(row)[::-1]
        negative = np.argsort(row)
        chosen = [index for index in positive if row[index] > 0][:3]
        chosen += [index for index in negative if row[index] < 0][:2]
        output.append(
            [
                {
                    "feature": model["features"][index],
                    "label": FEATURE_LABELS.get(
                        model["features"][index], model["features"][index]
                    ),
                    "direction": "supporting" if row[index] > 0 else "inhibiting",
                    "impact": round(float(row[index]), 4),
                }
                for index in chosen
            ]
        )
    return output


def predict_fixture(
    bundle: dict[str, Any],
    fixture: pd.DataFrame,
    stage: str,
    qualifying_input: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    if stage not in {"pre-qualifying", "post-qualifying"}:
        raise ValueError("stage tidak dikenal")
    frame = fixture.copy().sort_values("driverId").reset_index(drop=True)
    warnings = list(bundle.get("warnings", []))
    key = "pre" if stage == "pre-qualifying" else "post"

    if qualifying_input is not None:
        by_driver = {int(item["driverId"]): item for item in qualifying_input}
        missing_gap_positions: list[int] = []
        for index, row in frame.iterrows():
            item = by_driver[int(row["driverId"])]
            qualifying_position = int(item["qualifyingPosition"])
            frame.loc[index, "qualifying_position"] = qualifying_position
            frame.loc[index, "grid_position"] = int(item["gridPosition"])
            gap = item.get("gapToPoleSeconds")
            if gap is None:
                missing_gap_positions.append(qualifying_position)
                gap = bundle["gap_medians"].get(
                    str(qualifying_position), bundle["gap_default"]
                )
            frame.loc[index, "gap_to_pole_seconds"] = float(gap)
            frame.loc[index, "reached_q2"] = float(qualifying_position <= 15)
            frame.loc[index, "reached_q3"] = float(qualifying_position <= 10)
        if missing_gap_positions:
            warnings.append(
                "Gap kosong pada posisi "
                + ", ".join(f"P{position}" for position in sorted(missing_gap_positions))
                + "; median historis per posisi qualifying digunakan."
            )

    winner_model = bundle["models"][f"{key}_winner"]
    podium_model = bundle["models"][f"{key}_podium"]
    winner_probability = _calibrated_probability(winner_model, frame)
    podium_probability = _calibrated_probability(podium_model, frame)
    simulated = run_simulation(winner_probability, podium_probability)
    factors = _factors(podium_model, frame)

    field: list[dict[str, Any]] = []
    for index, row in frame.iterrows():
        field.append(
            {
                "driverId": int(row["driverId"]),
                "driverCode": row["code"],
                "driverName": row["driver_name"],
                "team": row["team"],
                "qualifyingPosition": None
                if pd.isna(row.get("qualifying_position"))
                else int(row["qualifying_position"]),
                "gridPosition": None
                if pd.isna(row.get("grid_position"))
                else int(row["grid_position"]),
                "positionProbabilities": {
                    "p1": round(float(simulated["p1"][index]), 6),
                    "p2": round(float(simulated["p2"][index]), 6),
                    "p3": round(float(simulated["p3"][index]), 6),
                },
                "winnerProbability": round(float(simulated["winner"][index]), 6),
                "podiumProbability": round(float(simulated["podium"][index]), 6),
                "factors": factors[index],
            }
        )

    remaining = set(range(len(field)))
    predicted: list[dict[str, Any]] = []
    for place, probability_key in enumerate(("p1", "p2", "p3"), start=1):
        selected = max(
            remaining,
            key=lambda index: field[index]["positionProbabilities"][probability_key],
        )
        remaining.remove(selected)
        predicted.append(
            {
                "position": place,
                "driverId": field[selected]["driverId"],
                "driverCode": field[selected]["driverCode"],
                "driverName": field[selected]["driverName"],
                "team": field[selected]["team"],
                "probability": field[selected]["positionProbabilities"][probability_key],
            }
        )

    return {
        "stage": stage,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "dataCutoff": bundle["data_cutoff"],
        "modelVersion": bundle["version"],
        "simulationCount": 50_000,
        "simulationSeed": 20_260_719,
        "predictedPodium": predicted,
        "field": sorted(field, key=lambda item: item["podiumProbability"], reverse=True),
        "warnings": warnings,
        "disclaimer": "Probabilitas adalah estimasi analitis, bukan kepastian atau saran taruhan.",
    }
