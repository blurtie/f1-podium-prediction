import type { PredictionResponse } from "@/lib/types";

const MARKERS = [
  { x: 232, y: 65 },
  { x: 310, y: 286 },
  { x: 266, y: 112 },
];

const SPA_TRACK_PATH =
  "M104 232 C86 244 66 260 54 276 C48 282 42 284 42 279 C42 272 49 252 57 235 C69 210 90 185 103 167 C118 147 146 120 172 101 C208 75 257 50 282 43 L298 35 C307 32 308 46 315 47 C323 47 330 36 337 39 C347 45 355 66 365 79 C374 91 378 102 368 109 C357 115 349 91 340 84 C333 79 324 85 315 90 C303 97 287 103 273 109 C258 114 253 126 256 144 C258 162 276 172 292 179 C310 187 331 192 332 202 C333 214 326 227 332 239 C339 249 360 257 363 261 C370 271 367 281 360 290 L346 305 C339 310 328 304 318 298 C294 285 280 259 260 214 C249 198 234 190 219 192 C206 193 196 204 175 214 C158 222 141 226 128 229 C126 227 127 223 125 219 C123 214 120 216 119 220 C117 225 110 228 104 232 Z";

export function SpaTrack({ predictions }: { predictions: PredictionResponse }) {
  return (
    <div className="track-visual" aria-label="Outline Circuit de Spa-Francorchamps dengan marker prediksi podium">
      <svg viewBox="0 0 420 340" role="img" aria-labelledby="track-title track-desc">
        <title id="track-title">Lap trace Spa-Francorchamps</title>
        <desc id="track-desc">Siluet 19 tikungan Spa-Francorchamps dengan tiga marker pembalap podium hasil simulasi.</desc>
        <path className="track-shadow" d={SPA_TRACK_PATH} />
        <path className="track-line" pathLength="1" d={SPA_TRACK_PATH} />
        <path className="sector-line" d="M152 116 L140 98 M323 187 L342 177 M246 209 L258 190" />
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
      <div className="track-label la-source">LA SOURCE <span>T1</span></div>
      <div className="track-label pouhon">POUHON <span>T12</span></div>
      <div className="track-telemetry" aria-hidden="true">
        <span>V MAX</span><strong>340</strong><small>KM/H</small>
      </div>
    </div>
  );
}
