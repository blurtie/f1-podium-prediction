import type { PredictionResponse } from "@/lib/types";

const MARKERS = [
  { x: 177, y: 70 },
  { x: 295, y: 183 },
  { x: 105, y: 265 },
];

export function SpaTrack({ predictions }: { predictions: PredictionResponse }) {
  return (
    <div className="track-visual" aria-label="Outline Circuit de Spa-Francorchamps dengan marker prediksi podium">
      <svg viewBox="0 0 420 340" role="img" aria-labelledby="track-title track-desc">
        <title id="track-title">Lap trace Spa-Francorchamps</title>
        <desc id="track-desc">Lintasan dengan tiga marker pembalap podium hasil simulasi.</desc>
        <path className="track-shadow" d="M96 291 C65 267 54 221 77 184 C94 156 126 158 140 126 C151 101 129 73 151 47 C174 19 222 30 238 59 C250 82 234 105 257 122 C283 141 327 129 351 154 C376 181 359 219 330 231 C304 241 279 231 254 251 C225 274 223 312 185 317 C150 321 126 305 96 291 Z" />
        <path className="track-line" pathLength="1" d="M96 291 C65 267 54 221 77 184 C94 156 126 158 140 126 C151 101 129 73 151 47 C174 19 222 30 238 59 C250 82 234 105 257 122 C283 141 327 129 351 154 C376 181 359 219 330 231 C304 241 279 231 254 251 C225 274 223 312 185 317 C150 321 126 305 96 291 Z" />
        <path className="sector-line" d="M140 126 L113 106 M351 154 L379 142 M254 251 L270 280" />
        {predictions.predictedPodium.map((driver, index) => (
          <g key={driver.driverId} className={`track-marker marker-${index + 1}`} transform={`translate(${MARKERS[index].x} ${MARKERS[index].y})`}>
            <circle r="18" />
            <text y="5" textAnchor="middle">{driver.position}</text>
            <text className="marker-code" y="35" textAnchor="middle">{driver.driverCode}</text>
          </g>
        ))}
      </svg>
      <div className="track-label eau-rouge">EAU ROUGE <span>↗ 35 m</span></div>
      <div className="track-label kemmel">KEMMEL <span>DRS</span></div>
      <div className="track-telemetry" aria-hidden="true">
        <span>V MAX</span><strong>340</strong><small>KM/H</small>
      </div>
    </div>
  );
}
