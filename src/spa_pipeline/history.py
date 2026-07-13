from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


CLASSIFIED_PREFIXES = ("Finished", "+")


def wilson_interval(successes: int, total: int, z: float = 1.96) -> dict[str, float]:
    """Return a 95% Wilson score interval as proportions."""
    if total <= 0:
        return {"low": 0.0, "high": 0.0}
    proportion = successes / total
    denominator = 1 + z**2 / total
    centre = (proportion + z**2 / (2 * total)) / denominator
    margin = z * math.sqrt(
        (proportion * (1 - proportion) + z**2 / (4 * total)) / total
    ) / denominator
    return {"low": max(0.0, centre - margin), "high": min(1.0, centre + margin)}


def _rate(successes: int, total: int) -> dict[str, Any]:
    interval = wilson_interval(successes, total)
    return {
        "successes": int(successes),
        "sampleSize": int(total),
        "rate": float(successes / total) if total else 0.0,
        "confidenceInterval": interval,
        "smallSample": total < 5,
    }


def _load_spa_rows(data_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    races = pd.read_csv(data_dir / "races.csv")
    results = pd.read_csv(data_dir / "results.csv")
    qualifying = pd.read_csv(data_dir / "qualifying.csv")
    drivers = pd.read_csv(data_dir / "drivers.csv")
    constructors = pd.read_csv(data_dir / "constructors.csv")
    statuses = pd.read_csv(data_dir / "status.csv")

    qualifying["qualifyingPosition"] = pd.to_numeric(qualifying["position"], errors="coerce")
    results["gridPosition"] = pd.to_numeric(results["grid"], errors="coerce")
    spa = races[races["name"].str.contains("Belgian Grand Prix", case=False, na=False)]
    rows = (
        spa[["raceId", "year", "round", "date", "circuitId"]]
        .merge(results, on="raceId", how="inner")
        .merge(
            qualifying[["raceId", "driverId", "qualifyingPosition"]],
            on=["raceId", "driverId"],
            how="left",
        )
        .merge(
            drivers[["driverId", "driverRef", "forename", "surname", "code"]],
            on="driverId",
            how="left",
        )
        .merge(
            constructors[["constructorId", "name"]].rename(columns={"name": "team"}),
            on="constructorId",
            how="left",
        )
        .merge(statuses, on="statusId", how="left")
    )
    rows["isPodium"] = rows["positionOrder"].le(3)
    rows["isWinner"] = rows["positionOrder"].eq(1)
    rows["isDnf"] = ~rows["status"].fillna("").str.startswith(CLASSIFIED_PREFIXES)

    complete_races = races[races["raceId"].isin(results["raceId"])]
    latest_race_id = int(complete_races.sort_values(["year", "round"]).iloc[-1]["raceId"])
    active_ids = results.loc[results["raceId"].eq(latest_race_id), "driverId"].unique()
    return rows, pd.DataFrame({"driverId": active_ids})


def _position_rates(rows: pd.DataFrame, basis_column: str) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    for position in range(1, 21):
        group = rows[rows[basis_column].eq(position)]
        total = len(group)
        output.append(
            {
                "position": position,
                "winner": _rate(int(group["isWinner"].sum()), total),
                "podium": _rate(int(group["isPodium"].sum()), total),
            }
        )
    return output


def _entity_performance(rows: pd.DataFrame, entity: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for name, group in rows.groupby(entity, dropna=True):
        records.append(
            {
                "name": str(name),
                "starts": int(len(group)),
                "podiums": int(group["isPodium"].sum()),
                "wins": int(group["isWinner"].sum()),
                "averageFinish": round(float(group["positionOrder"].mean()), 2),
                "dnfRate": round(float(group["isDnf"].mean()), 4),
                "smallSample": len(group) < 5,
            }
        )
    return sorted(records, key=lambda item: (-item["podiums"], item["averageFinish"]))


def build_spa_history(
    data_dir: str | Path = "data",
    window: str = "modern",
    basis: str = "qualifying",
    include_2021: bool = False,
) -> dict[str, Any]:
    if window not in {"modern", "extended"}:
        raise ValueError("window harus 'modern' atau 'extended'")
    if basis not in {"qualifying", "grid"}:
        raise ValueError("basis harus 'qualifying' atau 'grid'")

    rows, active = _load_spa_rows(Path(data_dir))
    start_year = 2014 if window == "modern" else 2000
    rows = rows[rows["year"].between(start_year, 2025)].copy()
    if not include_2021:
        rows = rows[rows["year"].ne(2021)]

    basis_column = "qualifyingPosition" if basis == "qualifying" else "gridPosition"
    valid = rows.dropna(subset=[basis_column, "positionOrder"]).copy()
    valid[basis_column] = valid[basis_column].astype(int)
    pole = valid[valid[basis_column].eq(1)]
    top_three = valid[valid[basis_column].le(3)]
    top_three_overlap = int(top_three["positionOrder"].le(3).sum())
    correlation = valid[basis_column].rank().corr(valid["positionOrder"].rank())
    positions_gained = valid[basis_column] - valid["positionOrder"]

    active_rows = rows.merge(active, on="driverId", how="inner").copy()
    active_rows["driver"] = (
        active_rows["forename"].fillna("") + " " + active_rows["surname"].fillna("")
    ).str.strip()

    return {
        "window": window,
        "basis": basis,
        "include2021": include_2021,
        "yearRange": {"from": start_year, "to": 2025},
        "raceSampleSize": int(valid["raceId"].nunique()),
        "driverObservationCount": int(len(valid)),
        "poleToWinner": _rate(int(pole["isWinner"].sum()), len(pole)),
        "poleToPodium": _rate(int(pole["isPodium"].sum()), len(pole)),
        "topThreeQualifyingToRaceTopThree": _rate(top_three_overlap, len(top_three)),
        "spearmanCorrelation": None if np.isnan(correlation) else round(float(correlation), 4),
        "averagePositionsGained": round(float(positions_gained.mean()), 3),
        "dnfRate": _rate(int(valid["isDnf"].sum()), len(valid)),
        "positionRates": _position_rates(valid, basis_column),
        "teams": _entity_performance(rows, "team")[:12],
        "activeDrivers": _entity_performance(active_rows, "driver"),
        "warnings": [
            "Statistik dengan kurang dari lima observasi ditandai sebagai sampel kecil.",
            "Korelasi bersifat deskriptif dan tidak membuktikan hubungan sebab-akibat.",
        ],
    }
