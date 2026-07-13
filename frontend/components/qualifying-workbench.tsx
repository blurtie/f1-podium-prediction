"use client";

import { useMemo, useState, useTransition } from "react";
import { postQualifying } from "@/lib/api";
import type { PredictionResponse, QualifyingRow } from "@/lib/types";

function seedRows(prediction: PredictionResponse): QualifyingRow[] {
  return prediction.field.map((driver, index) => ({
    driverId: driver.driverId,
    driverCode: driver.driverCode,
    driverName: driver.driverName,
    team: driver.team,
    qualifyingPosition: index + 1,
    gridPosition: index + 1,
    gapToPoleSeconds: index === 0 ? 0 : null,
  }));
}

export function QualifyingWorkbench({ initialPrediction }: { initialPrediction: PredictionResponse }) {
  const [rows, setRows] = useState<QualifyingRow[]>(() => seedRows(initialPrediction));
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const positionsValid = useMemo(() => {
    const expected = new Set(Array.from({ length: rows.length }, (_, index) => index + 1));
    const qualifying = new Set(rows.map((row) => row.qualifyingPosition));
    const grid = new Set(rows.map((row) => row.gridPosition));
    return qualifying.size === rows.length && grid.size === rows.length &&
      [...qualifying].every((position) => expected.has(position)) &&
      [...grid].every((position) => expected.has(position));
  }, [rows]);

  function updateRow(driverId: number, field: "qualifyingPosition" | "gridPosition" | "gapToPoleSeconds", value: number | null) {
    setRows((current) => current.map((row) => row.driverId === driverId ? { ...row, [field]: value } : row));
  }

  function calculate() {
    setError(null);
    startTransition(async () => {
      try {
        setResult(await postQualifying(rows));
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Prediksi tidak dapat dihitung.");
      }
    });
  }

  return (
    <section className="qualifying-section" id="qualifying">
      <div className="section-heading">
        <div><p className="eyebrow">AFTER THE CLOCK STOPS</p><h2>Enter qualifying</h2></div>
        <p>Masukkan hasil resmi qualifying dan grid final. Gap boleh dikosongkan; median historis untuk posisi tersebut akan dipakai.</p>
      </div>

      <div className="workbench">
        <div className="qualifying-editor">
          <div className="editor-header"><span>DRIVER</span><span>QUALI</span><span>GRID</span><span>GAP TO POLE</span></div>
          {rows.map((row) => (
            <div className="editor-row" key={row.driverId}>
              <div><b>{row.driverCode}</b><span>{row.driverName}<small>{row.team}</small></span></div>
              <label><span className="sr-only">Posisi qualifying {row.driverName}</span><input type="number" min="1" max={rows.length} value={row.qualifyingPosition} onChange={(event) => updateRow(row.driverId, "qualifyingPosition", event.target.valueAsNumber)} /></label>
              <label><span className="sr-only">Posisi grid {row.driverName}</span><input type="number" min="1" max={rows.length} value={row.gridPosition} onChange={(event) => updateRow(row.driverId, "gridPosition", event.target.valueAsNumber)} /></label>
              <label className="gap-input"><span className="sr-only">Gap ke pole {row.driverName}</span><input type="number" min="0" step="0.001" placeholder="AUTO" value={row.gapToPoleSeconds ?? ""} onChange={(event) => updateRow(row.driverId, "gapToPoleSeconds", event.target.value === "" ? null : event.target.valueAsNumber)} /><span>S</span></label>
            </div>
          ))}
          {!positionsValid ? <p className="validation-note">Posisi qualifying dan grid harus unik, lengkap dari 1 sampai {rows.length}.</p> : null}
          {error ? <p className="validation-note error-note" role="alert">{error}</p> : null}
          <button className="calculate-button" type="button" disabled={!positionsValid || isPending} onClick={calculate}>
            {isPending ? "RUNNING 50,000 SIMULATIONS..." : "CALCULATE POST-QUALIFYING PODIUM"}
          </button>
        </div>

        <aside className="result-panel" aria-live="polite">
          <p className="eyebrow">POST-QUALIFYING OUTPUT</p>
          {result ? (
            <ol>
              {result.predictedPodium.map((driver) => (
                <li key={driver.driverId}><span>P{driver.position}</span><div><b>{driver.driverCode}</b><small>{driver.driverName}</small></div><strong>{(driver.probability * 100).toFixed(1)}%</strong></li>
              ))}
            </ol>
          ) : (
            <div className="empty-result"><span>44</span><p>Complete the timing sheet to recalculate the podium.</p></div>
          )}
          {result?.warnings.map((warning) => <small className="result-warning" key={warning}>{warning}</small>)}
        </aside>
      </div>
    </section>
  );
}
