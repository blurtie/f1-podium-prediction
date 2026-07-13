from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd


PRE_FEATURES = [
    "driver_finish_avg_5",
    "driver_points_avg_5",
    "driver_podium_rate_10",
    "driver_win_rate_10",
    "driver_dnf_rate_10",
    "driver_grid_gain_avg_5",
    "team_points_avg_5",
    "team_podium_rate_10",
    "team_win_rate_10",
    "team_dnf_rate_10",
    "prev_standing_pos",
    "prev_standing_points",
    "prev_constructor_pos",
    "prev_constructor_points",
    "driver_circuit_races",
    "driver_circuit_avg_finish",
    "driver_circuit_podium_rate",
    "team_circuit_races",
    "team_circuit_avg_finish",
    "team_circuit_podium_rate",
    "season_progress",
    "field_size",
]

POST_FEATURES = PRE_FEATURES + [
    "qualifying_position",
    "grid_position",
    "gap_to_pole_seconds",
    "reached_q2",
    "reached_q3",
]


def _time_to_seconds(value: object) -> float:
    if not isinstance(value, str) or value in {"", "\\N"}:
        return np.nan
    try:
        minutes, seconds = value.split(":")
        return float(minutes) * 60 + float(seconds)
    except (ValueError, TypeError):
        return np.nan


def _rolling_previous(frame: pd.DataFrame, group: str, column: str, window: int) -> pd.Series:
    return frame.groupby(group, sort=False)[column].transform(
        lambda values: values.shift(1).rolling(window, min_periods=1).mean()
    )


def _expanding_previous(
    frame: pd.DataFrame, groups: list[str], column: str, operation: str
) -> pd.Series:
    def calculate(values: pd.Series) -> pd.Series:
        shifted = values.shift(1)
        expanding = shifted.expanding(min_periods=1)
        if operation == "count":
            return expanding.count()
        if operation == "min":
            return expanding.min()
        return expanding.mean()

    return frame.groupby(groups, sort=False)[column].transform(calculate)


def _standings_features(
    frame: pd.DataFrame,
    standings: pd.DataFrame,
    races: pd.DataFrame,
    entity: str,
    prefix: str,
) -> pd.DataFrame:
    values = standings.merge(races[["raceId", "date"]], on="raceId", how="left")
    values["date"] = pd.to_datetime(values["date"])
    values["position"] = pd.to_numeric(values["position"], errors="coerce")
    values = values.sort_values([entity, "date", "raceId"])
    values[f"{prefix}_pos"] = values.groupby(entity)["position"].shift(1)
    values[f"{prefix}_points"] = values.groupby(entity)["points"].shift(1)
    previous = values[["raceId", entity, f"{prefix}_pos", f"{prefix}_points"]]
    merged = frame.merge(previous, on=["raceId", entity], how="left")

    fixture_mask = merged["is_fixture"]
    if fixture_mask.any():
        latest = values.sort_values("date").groupby(entity, as_index=False).tail(1)
        latest_pos = latest.set_index(entity)["position"]
        latest_points = latest.set_index(entity)["points"]
        merged.loc[fixture_mask, f"{prefix}_pos"] = merged.loc[fixture_mask, entity].map(
            latest_pos
        )
        merged.loc[fixture_mask, f"{prefix}_points"] = merged.loc[
            fixture_mask, entity
        ].map(latest_points)
    return merged


def build_feature_frame(data_dir: str | Path = "data", include_fixture: bool = True) -> pd.DataFrame:
    """Build all pre-race features from raw CSVs with an explicit one-race shift."""
    data_path = Path(data_dir)
    races = pd.read_csv(data_path / "races.csv")
    results = pd.read_csv(data_path / "results.csv")
    qualifying = pd.read_csv(data_path / "qualifying.csv")
    drivers = pd.read_csv(data_path / "drivers.csv")
    constructors = pd.read_csv(data_path / "constructors.csv")
    statuses = pd.read_csv(data_path / "status.csv")
    driver_standings = pd.read_csv(data_path / "driver_standings.csv")
    constructor_standings = pd.read_csv(data_path / "constructor_standings.csv")

    races["date"] = pd.to_datetime(races["date"])
    results["grid_position"] = pd.to_numeric(results["grid"], errors="coerce")
    results.loc[results["grid_position"].eq(0), "grid_position"] = np.nan
    results["is_podium"] = results["positionOrder"].le(3).astype(float)
    results["is_winner"] = results["positionOrder"].eq(1).astype(float)
    status_map = statuses.set_index("statusId")["status"]
    result_status = results["statusId"].map(status_map).fillna("")
    results["is_dnf"] = (~result_status.str.startswith(("Finished", "+"))).astype(float)
    results["grid_gain"] = results["grid_position"] - results["positionOrder"]

    qualifying["qualifying_position"] = pd.to_numeric(qualifying["position"], errors="coerce")
    session_times = qualifying[["q1", "q2", "q3"]].map(_time_to_seconds)
    qualifying["qualifying_seconds"] = session_times["q3"].fillna(
        session_times["q2"].fillna(session_times["q1"])
    )
    qualifying["gap_to_pole_seconds"] = qualifying["qualifying_seconds"] - qualifying.groupby(
        "raceId"
    )["qualifying_seconds"].transform("min")
    qualifying["reached_q2"] = session_times["q2"].notna().astype(float)
    qualifying["reached_q3"] = session_times["q3"].notna().astype(float)

    base = (
        results.merge(
            races[["raceId", "year", "round", "circuitId", "name", "date"]],
            on="raceId",
            how="inner",
        )
        .merge(
            qualifying[
                [
                    "raceId",
                    "driverId",
                    "qualifying_position",
                    "gap_to_pole_seconds",
                    "reached_q2",
                    "reached_q3",
                ]
            ],
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
    )
    base["is_fixture"] = False

    complete_races = races[races["raceId"].isin(results["raceId"])]
    cutoff_race = complete_races.sort_values(["year", "round"]).iloc[-1]
    if include_fixture:
        fixture_race = races[
            (races["year"].eq(2026))
            & races["name"].str.contains("Belgian Grand Prix", case=False, na=False)
        ].iloc[0]
        active = base[base["raceId"].eq(int(cutoff_race["raceId"]))].copy()
        fixture = active[
            ["driverId", "constructorId", "driverRef", "forename", "surname", "code", "team"]
        ].copy()
        fixture["raceId"] = int(fixture_race["raceId"])
        fixture["year"] = int(fixture_race["year"])
        fixture["round"] = int(fixture_race["round"])
        fixture["circuitId"] = int(fixture_race["circuitId"])
        fixture["name"] = fixture_race["name"]
        fixture["date"] = fixture_race["date"]
        fixture["is_fixture"] = True
        for column in [
            "positionOrder",
            "points",
            "is_podium",
            "is_winner",
            "is_dnf",
            "grid_gain",
            "grid_position",
            "qualifying_position",
            "gap_to_pole_seconds",
            "reached_q2",
            "reached_q3",
        ]:
            fixture[column] = np.nan
        base = pd.concat([base, fixture], ignore_index=True, sort=False)

    base = base.sort_values(["date", "raceId", "driverId"]).reset_index(drop=True)
    base["driver_finish_avg_5"] = _rolling_previous(base, "driverId", "positionOrder", 5)
    base["driver_points_avg_5"] = _rolling_previous(base, "driverId", "points", 5)
    base["driver_podium_rate_10"] = _rolling_previous(base, "driverId", "is_podium", 10)
    base["driver_win_rate_10"] = _rolling_previous(base, "driverId", "is_winner", 10)
    base["driver_dnf_rate_10"] = _rolling_previous(base, "driverId", "is_dnf", 10)
    base["driver_grid_gain_avg_5"] = _rolling_previous(base, "driverId", "grid_gain", 5)

    team_race = (
        base.groupby(
            ["raceId", "constructorId", "date", "year", "round", "is_fixture"],
            as_index=False,
            dropna=False,
        )
        .agg(
            team_points=("points", lambda values: values.sum(min_count=1)),
            team_podium=("is_podium", "mean"),
            team_win=("is_winner", "max"),
            team_dnf=("is_dnf", "mean"),
            team_finish=("positionOrder", "mean"),
        )
        .sort_values(["date", "raceId", "constructorId"])
    )
    team_race["team_points_avg_5"] = _rolling_previous(
        team_race, "constructorId", "team_points", 5
    )
    team_race["team_podium_rate_10"] = _rolling_previous(
        team_race, "constructorId", "team_podium", 10
    )
    team_race["team_win_rate_10"] = _rolling_previous(
        team_race, "constructorId", "team_win", 10
    )
    team_race["team_dnf_rate_10"] = _rolling_previous(
        team_race, "constructorId", "team_dnf", 10
    )
    base = base.merge(
        team_race[
            [
                "raceId",
                "constructorId",
                "team_points_avg_5",
                "team_podium_rate_10",
                "team_win_rate_10",
                "team_dnf_rate_10",
            ]
        ],
        on=["raceId", "constructorId"],
        how="left",
    )

    base["driver_circuit_races"] = _expanding_previous(
        base, ["driverId", "circuitId"], "positionOrder", "count"
    )
    base["driver_circuit_avg_finish"] = _expanding_previous(
        base, ["driverId", "circuitId"], "positionOrder", "mean"
    )
    base["driver_circuit_podium_rate"] = _expanding_previous(
        base, ["driverId", "circuitId"], "is_podium", "mean"
    )

    team_circuit = (
        base.groupby(
            ["raceId", "constructorId", "circuitId", "date"], as_index=False, dropna=False
        )
        .agg(team_finish=("positionOrder", "mean"), team_podium=("is_podium", "mean"))
        .sort_values(["date", "raceId", "constructorId"])
    )
    team_circuit["team_circuit_races"] = _expanding_previous(
        team_circuit, ["constructorId", "circuitId"], "team_finish", "count"
    )
    team_circuit["team_circuit_avg_finish"] = _expanding_previous(
        team_circuit, ["constructorId", "circuitId"], "team_finish", "mean"
    )
    team_circuit["team_circuit_podium_rate"] = _expanding_previous(
        team_circuit, ["constructorId", "circuitId"], "team_podium", "mean"
    )
    base = base.merge(
        team_circuit[
            [
                "raceId",
                "constructorId",
                "team_circuit_races",
                "team_circuit_avg_finish",
                "team_circuit_podium_rate",
            ]
        ],
        on=["raceId", "constructorId"],
        how="left",
    )

    base = _standings_features(
        base, driver_standings, races, "driverId", "prev_standing"
    )
    base = _standings_features(
        base, constructor_standings, races, "constructorId", "prev_constructor"
    )
    season_rounds = races.groupby("year")["round"].max()
    base["season_progress"] = base["round"] / base["year"].map(season_rounds)
    base["field_size"] = base.groupby("raceId")["driverId"].transform("count")
    base["driver_name"] = (base["forename"] + " " + base["surname"]).str.strip()
    base["data_cutoff"] = pd.Timestamp(cutoff_race["date"]).date().isoformat()
    return base
