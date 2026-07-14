"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { PredictionResponse } from "@/lib/types";

const MARKERS = [
  { x: 232, y: 65 },
  { x: 310, y: 286 },
  { x: 266, y: 112 },
];

const SPA_TRACK_PATH =
  "M104 232 C86 244 66 260 54 276 C48 282 42 284 42 279 C42 272 49 252 57 235 C69 210 90 185 103 167 C118 147 146 120 172 101 C208 75 257 50 282 43 L298 35 C307 32 308 46 315 47 C323 47 330 36 337 39 C347 45 355 66 365 79 C374 91 378 102 368 109 C357 115 349 91 340 84 C333 79 324 85 315 90 C303 97 287 103 273 109 C258 114 253 126 256 144 C258 162 276 172 292 179 C310 187 331 192 332 202 C333 214 326 227 332 239 C339 249 360 257 363 261 C370 271 367 281 360 290 L346 305 C339 310 328 304 318 298 C294 285 280 259 260 214 C249 198 234 190 219 192 C206 193 196 204 175 214 C158 222 141 226 128 229 C126 227 127 223 125 219 C123 214 120 216 119 220 C117 225 110 228 104 232 Z";

const TRACK_LANDMARKS = [
  {
    id: "la-source",
    name: "La Source",
    turns: "T1",
    x: 54,
    y: 276,
    mobileLabel: true,
    labelPosition: "right",
    popoverPosition: "above",
    description:
      "Hairpin paling lambat di Spa dan titik pengereman pertama. Exit yang rapi menentukan laju turun menuju Eau Rouge.",
  },
  {
    id: "eau-rouge-raidillon",
    name: "Eau Rouge / Raidillon",
    turns: "T2–T4",
    x: 105,
    y: 168,
    mobileLabel: true,
    labelPosition: "right",
    popoverPosition: "above",
    description:
      "Kompresi besar di dasar Eau Rouge berlanjut ke tanjakan cepat Raidillon. Keberanian dan kestabilan mobil menentukan kecepatan ke Kemmel.",
  },
  {
    id: "kemmel-straight",
    name: "Kemmel Straight",
    x: 204,
    y: 78,
    mobileLabel: true,
    labelPosition: "left",
    popoverPosition: "below",
    description:
      "Lintasan lurus utama menuju Les Combes. Mulai 2026, DRS digantikan oleh Active Aero dan Overtake Mode; zona event tidak digambar sebelum peta resmi FIA tersedia.",
  },
  {
    id: "les-combes",
    name: "Les Combes",
    turns: "T5–T7",
    x: 322,
    y: 96,
    mobileLabel: false,
    labelPosition: "right",
    popoverPosition: "below",
    description:
      "Zona pengereman keras setelah Kemmel yang membuka rangkaian kanan–kiri–kanan. Titik salip bergantung pada kecepatan lurus dan kontrol saat deselerasi.",
  },
  {
    id: "pouhon",
    name: "Pouhon",
    turns: "T12",
    x: 292,
    y: 179,
    mobileLabel: false,
    labelPosition: "left",
    popoverPosition: "above",
    description:
      "Tikungan kiri cepat dengan beban lateral panjang. Downforce dan keyakinan pada bagian depan mobil sangat menentukan waktu lap.",
  },
  {
    id: "blanchimont",
    name: "Blanchimont",
    turns: "T17",
    x: 282,
    y: 259,
    mobileLabel: false,
    labelPosition: "left",
    popoverPosition: "above",
    description:
      "Tikungan cepat menuju Bus Stop. Momentum keluar menjadi persiapan terakhir sebelum pengereman berat di chicane penutup lap.",
  },
] as const;

type LandmarkId = (typeof TRACK_LANDMARKS)[number]["id"];

export function SpaTrack({ predictions }: { predictions: PredictionResponse }) {
  const [selectedLandmark, setSelectedLandmark] = useState<LandmarkId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const selected = TRACK_LANDMARKS.find((landmark) => landmark.id === selectedLandmark) ?? null;

  const focusTrigger = (landmarkId: LandmarkId) => {
    requestAnimationFrame(() => {
      rootRef.current
        ?.querySelector<HTMLButtonElement>(`[data-landmark-id="${landmarkId}"]`)
        ?.focus();
    });
  };

  const closeAndReturnFocus = () => {
    if (!selectedLandmark) return;
    const landmarkId = selectedLandmark;
    setSelectedLandmark(null);
    focusTrigger(landmarkId);
  };

  useEffect(() => {
    if (!selectedLandmark) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(".landmark-popover, .track-hotspot")) {
        setSelectedLandmark(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        const landmarkId = selectedLandmark;
        setSelectedLandmark(null);
        focusTrigger(landmarkId);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedLandmark]);

  return (
    <div
      ref={rootRef}
      className={`track-visual${selected ? " has-active-landmark" : ""}`}
      aria-label="Outline Circuit de Spa-Francorchamps dengan sektor, landmark, dan marker prediksi podium"
    >
      <div className="track-canvas">
        <svg viewBox="0 0 420 340" role="img" aria-labelledby="track-title track-desc">
          <title id="track-title">Lap trace Spa-Francorchamps</title>
          <desc id="track-desc">
            Siluet 19 tikungan Spa-Francorchamps, arah balapan, tiga sektor, dan tiga marker pembalap podium hasil simulasi.
          </desc>
          <defs>
            <marker id="race-direction-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 L8 4 L0 8 Z" />
            </marker>
          </defs>
          <path className="track-shadow" d={SPA_TRACK_PATH} />
          <path className="track-line" pathLength="1" d={SPA_TRACK_PATH} />

          <g className="track-information-layer" aria-hidden="true">
            <path className="sector-split sector-one-split" d="M304 82 L318 98" />
            <path className="sector-split sector-two-split" d="M320 235 L339 232" />
            <path className="control-line" d="M98 223 L110 241" />
            <text className="sector-label sector-one-label" x="294" y="112">S1</text>
            <text className="sector-label sector-two-label" x="346" y="224">S2</text>
            <text className="sector-label sector-three-label" x="119" y="249">S3</text>
            <text className="control-label" x="78" y="218">START / FINISH</text>
            <path className="direction-arrow" d="M68 220 L82 198" />
            <path className="direction-arrow" d="M225 66 L250 55" />
            <path className="direction-arrow" d="M276 171 L299 183" />
            <path className="direction-arrow" d="M346 249 L359 260" />
          </g>

          {predictions.predictedPodium.map((driver, index) => (
            <g
              key={driver.driverId}
              className={`track-marker marker-${index + 1}`}
              transform={`translate(${MARKERS[index].x} ${MARKERS[index].y})`}
            >
              <circle r="18" />
              <text y="5" textAnchor="middle">{driver.position}</text>
              <text className="marker-code" y="35" textAnchor="middle">{driver.driverCode}</text>
            </g>
          ))}
        </svg>

        <div className="track-landmarks">
          {TRACK_LANDMARKS.map((landmark) => {
            const isSelected = landmark.id === selectedLandmark;
            return (
              <button
                key={landmark.id}
                type="button"
                className={`track-hotspot label-${landmark.labelPosition}${landmark.mobileLabel ? " mobile-featured" : ""}`}
                style={{
                  "--landmark-x": `${(landmark.x / 420) * 100}%`,
                  "--landmark-y": `${(landmark.y / 340) * 100}%`,
                } as React.CSSProperties}
                data-landmark-id={landmark.id}
                aria-label={`Buka detail ${landmark.name}${"turns" in landmark ? `, ${landmark.turns}` : ""}`}
                aria-expanded={isSelected}
                aria-controls={`${popoverId}-${landmark.id}`}
                aria-haspopup="dialog"
                onClick={() => setSelectedLandmark((current) => current === landmark.id ? null : landmark.id)}
              >
                <span className="hotspot-pin" aria-hidden="true" />
                <span className="hotspot-label">
                  {landmark.name}{"turns" in landmark ? <small>{landmark.turns}</small> : null}
                </span>
              </button>
            );
          })}
        </div>
        {selected ? (
          <aside
            id={`${popoverId}-${selected.id}`}
            className={`landmark-popover popover-${selected.popoverPosition}`}
            style={{
              "--landmark-x": `${(selected.x / 420) * 100}%`,
              "--landmark-y": `${(selected.y / 340) * 100}%`,
            } as React.CSSProperties}
            role="dialog"
            aria-labelledby={`${popoverId}-${selected.id}-title`}
          >
            <div>
              <span>TRACK NOTE</span>
              <button type="button" onClick={closeAndReturnFocus} aria-label={`Tutup detail ${selected.name}`}>×</button>
            </div>
            <strong id={`${popoverId}-${selected.id}-title`}>
              {selected.name}{"turns" in selected ? <small>{selected.turns}</small> : null}
            </strong>
            <p>{selected.description}</p>
          </aside>
        ) : null}
      </div>

      <div className="track-telemetry" aria-label="Estimasi kecepatan maksimum 340 kilometer per jam">
        <span>EST. V MAX</span><strong>340</strong><small>KM/H</small>
      </div>
    </div>
  );
}
