from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss, ndcg_score

from .features import POST_FEATURES, PRE_FEATURES, build_feature_frame
from .history import build_spa_history
from .modeling import predict_fixture


MODEL_VERSION = "spa-lgbm-2026.07.13-v1"
OOF_YEARS = tuple(range(2019, 2026))


def _estimator(target: str, positive_ratio: float) -> LGBMClassifier:
    return LGBMClassifier(
        objective="binary",
        n_estimators=240,
        learning_rate=0.035,
        num_leaves=15,
        max_depth=5,
        min_child_samples=35,
        subsample=0.9,
        colsample_bytree=0.85,
        reg_alpha=0.2,
        reg_lambda=0.8,
        scale_pos_weight=max(1.0, (1 - positive_ratio) / max(positive_ratio, 1e-4)),
        random_state=20260719,
        n_jobs=-1,
        verbosity=-1,
    )


def _fit_model(
    frame: pd.DataFrame, features: list[str], target: str
) -> tuple[dict[str, Any], pd.Series]:
    medians = frame[features].median(numeric_only=True).fillna(0.0).to_dict()
    oof = pd.Series(np.nan, index=frame.index, dtype=float)
    for year in OOF_YEARS:
        train = frame[frame["year"].lt(year)]
        validation = frame[frame["year"].eq(year)]
        if train.empty or validation.empty:
            continue
        x_train = train[features].fillna(pd.Series(medians))
        model = _estimator(target, float(train[target].mean()))
        model.fit(x_train, train[target].astype(int))
        oof.loc[validation.index] = model.predict_proba(
            validation[features].fillna(pd.Series(medians))
        )[:, 1]

    valid_oof = oof.notna()
    raw = np.clip(oof.loc[valid_oof].to_numpy(), 1e-6, 1 - 1e-6)
    logits = np.log(raw / (1 - raw)).reshape(-1, 1)
    calibrator = LogisticRegression(random_state=20260719)
    calibrator.fit(logits, frame.loc[valid_oof, target].astype(int))
    calibrated = pd.Series(np.nan, index=frame.index, dtype=float)
    calibrated.loc[valid_oof] = calibrator.predict_proba(logits)[:, 1]

    final = _estimator(target, float(frame[target].mean()))
    final.fit(frame[features].fillna(pd.Series(medians)), frame[target].astype(int))
    return (
        {
            "estimator": final,
            "calibrator": calibrator,
            "features": features,
            "medians": medians,
            "target": target,
            "calibration_years": list(OOF_YEARS),
        },
        calibrated,
    )


def _ranking_metrics(
    frame: pd.DataFrame, podium_score: pd.Series, winner_score: pd.Series
) -> dict[str, float]:
    valid = podium_score.notna() & winner_score.notna()
    evaluated = frame.loc[valid].copy()
    evaluated["podium_score"] = podium_score.loc[valid]
    evaluated["winner_score"] = winner_score.loc[valid]
    hits: list[float] = []
    exact: list[float] = []
    winners: list[float] = []
    ndcgs: list[float] = []
    for _, race in evaluated.groupby("raceId"):
        predicted_top = set(race.nlargest(3, "podium_score")["driverId"])
        actual_top = set(race.nsmallest(3, "positionOrder")["driverId"])
        hits.append(len(predicted_top & actual_top) / 3)
        exact.append(float(predicted_top == actual_top))
        predicted_winner = int(race.loc[race["winner_score"].idxmax(), "driverId"])
        actual_winner = int(race.loc[race["positionOrder"].idxmin(), "driverId"])
        winners.append(float(predicted_winner == actual_winner))
        relevance = np.where(
            race["positionOrder"].eq(1),
            3,
            np.where(race["positionOrder"].eq(2), 2, np.where(race["positionOrder"].eq(3), 1, 0)),
        )
        ndcgs.append(float(ndcg_score([relevance], [race["podium_score"].to_numpy()], k=3)))
    return {
        "raceCount": int(evaluated["raceId"].nunique()),
        "podiumHitRate": round(float(np.mean(hits)), 4),
        "winnerAccuracy": round(float(np.mean(winners)), 4),
        "exactTopThree": round(float(np.mean(exact)), 4),
        "ndcgAt3": round(float(np.mean(ndcgs)), 4),
        "podiumBrier": round(
            float(brier_score_loss(evaluated["is_podium"], evaluated["podium_score"])), 5
        ),
        "podiumLogLoss": round(
            float(log_loss(evaluated["is_podium"], evaluated["podium_score"])), 5
        ),
        "winnerBrier": round(
            float(brier_score_loss(evaluated["is_winner"], evaluated["winner_score"])), 5
        ),
        "winnerLogLoss": round(
            float(log_loss(evaluated["is_winner"], evaluated["winner_score"])), 5
        ),
    }


def _baseline_scores(frame: pd.DataFrame, basis: str) -> tuple[pd.Series, pd.Series]:
    column = "prev_standing_pos" if basis == "standings" else "qualifying_position"
    podium = pd.Series(np.nan, index=frame.index, dtype=float)
    winner = pd.Series(np.nan, index=frame.index, dtype=float)
    for _, race in frame.groupby("raceId"):
        ordered = race.sort_values(column, na_position="last")
        podium.loc[race.index] = 0.02
        winner.loc[race.index] = 0.005
        podium.loc[ordered.head(3).index] = 0.82
        winner.loc[ordered.head(1).index] = 0.72
    return podium, winner


def train(output_dir: str | Path = "artifacts/spa/v1") -> dict[str, Any]:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    frame = build_feature_frame(include_fixture=True)
    training = frame[
        (~frame["is_fixture"]) & frame["year"].between(2014, 2026)
    ].copy()
    fixture = frame[frame["is_fixture"]].copy()

    models: dict[str, Any] = {}
    oof: dict[str, pd.Series] = {}
    for stage, features in (("pre", PRE_FEATURES), ("post", POST_FEATURES)):
        for target_name, target in (("podium", "is_podium"), ("winner", "is_winner")):
            model, predictions = _fit_model(training, features, target)
            models[f"{stage}_{target_name}"] = model
            oof[f"{stage}_{target_name}"] = predictions

    historical_gaps = training.dropna(subset=["qualifying_position", "gap_to_pole_seconds"])
    gap_medians = (
        historical_gaps.groupby("qualifying_position")["gap_to_pole_seconds"]
        .median()
        .to_dict()
    )
    gap_medians = {str(int(key)): float(value) for key, value in gap_medians.items()}
    bundle = {
        "version": MODEL_VERSION,
        "data_cutoff": str(fixture["data_cutoff"].iloc[0]),
        "models": models,
        "gap_medians": gap_medians,
        "gap_default": float(historical_gaps["gap_to_pole_seconds"].median()),
        "warnings": [
            "Cuaca ditampilkan sebagai konteks dan belum menjadi fitur model v1.",
            "Model dilatih dengan walk-forward OOF dan Platt scaling untuk kalibrasi.",
        ],
    }
    joblib.dump(bundle, output / "model_bundle.joblib")
    fixture.to_parquet(output / "fixture.parquet", index=False)
    predictions = predict_fixture(bundle, fixture, "pre-qualifying")
    (output / "pre_predictions.json").write_text(
        json.dumps(predictions, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    report = {
        "modelVersion": MODEL_VERSION,
        "window": "walk-forward 2019-2025",
        "preQualifying": {
            "model": _ranking_metrics(training, oof["pre_podium"], oof["pre_winner"]),
        },
        "postQualifying": {
            "model": _ranking_metrics(training, oof["post_podium"], oof["post_winner"]),
        },
    }
    evaluation = training[training["year"].isin(OOF_YEARS)].copy()
    for name, basis in (("standingsTopThree", "standings"), ("qualifyingTopThree", "qualifying")):
        baseline_podium, baseline_winner = _baseline_scores(evaluation, basis)
        target = report["preQualifying"] if basis == "standings" else report["postQualifying"]
        target[name] = _ranking_metrics(evaluation, baseline_podium, baseline_winner)

    reports = Path("reports/spa")
    reports.mkdir(parents=True, exist_ok=True)
    (reports / "walk_forward_report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    history = build_spa_history()
    (reports / "history_default.json").write_text(
        json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    manifest = {
        "modelVersion": MODEL_VERSION,
        "dataCutoff": bundle["data_cutoff"],
        "fixtureRaceId": int(fixture["raceId"].iloc[0]),
        "fieldSize": int(len(fixture)),
        "models": sorted(models),
        "calibrationWindow": "2019-2025 walk-forward OOF",
        "simulationCount": 50_000,
        "simulationSeed": 20_260_719,
        "leakageGuards": [
            "race result columns are shifted before rolling features",
            "constructor features are aggregated once per team and race before shift",
            "finish_gap_to_teammate_avg is excluded",
        ],
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Train Belgian GP 2026 dashboard models")
    parser.add_argument("--output", default="artifacts/spa/v1")
    args = parser.parse_args()
    print(json.dumps(train(args.output), indent=2))


if __name__ == "__main__":
    main()
