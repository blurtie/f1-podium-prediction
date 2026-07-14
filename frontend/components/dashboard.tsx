import { Countdown } from "@/components/countdown";
import {
  FullFieldProbability,
  HistoryMetrics,
  SpaContenderFormbook,
  TeamOutlook,
  WeekendConditions,
} from "@/components/dashboard-statistics";
import { QualifyingWorkbench } from "@/components/qualifying-workbench";
import { SpaTrack } from "@/components/spa-track";
import type { History, Overview, PredictionResponse } from "@/lib/types";

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${value}T12:00:00+07:00`));
}

export function Dashboard({
  overview,
  history,
  predictions,
}: {
  overview: Overview;
  history: History;
  predictions: PredictionResponse;
}) {
  const race = overview.schedule.find((session) => session.session === "Race");
  const strongestPositionRates = history.positionRates.slice(0, 10);

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Spa Predictor, kembali ke atas">
          <span className="brand-mark">SP</span>
          <span>SPA PREDICTOR</span>
        </a>
        <nav aria-label="Navigasi utama">
          <a href="#prediction">Prediksi</a>
          <a href="#history">Riwayat</a>
          <a href="#qualifying">Qualifying</a>
        </nav>
        <div className="feed-status"><span /> MODEL LIVE</div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">ROUND 10 / SPA-FRANCORCHAMPS / 19 JUL 2026</p>
          <h1>Podium under<br /><em>pressure.</em></h1>
          <p className="hero-lede">
            Satu prediksi khusus Belgian GP. Form terkini, riwayat Spa, dan 50.000
            simulasi merangkum siapa yang paling mungkin bertahan di podium.
          </p>
          <dl className="race-facts">
            <div><dt>LAP</dt><dd>{overview.track.laps}</dd></div>
            <div><dt>DISTANCE</dt><dd>{overview.track.raceDistanceKm}<small> KM</small></dd></div>
            <div><dt>MODEL CUT-OFF</dt><dd>{formatDate(overview.dataCutoff)}</dd></div>
          </dl>
        </div>
        <div className="session-board">
          <p className="eyebrow">NEXT SESSION</p>
          <strong>{race?.session ?? "Race"}</strong>
          <span>{race?.label}</span>
          <div className="countdown"><Countdown target={race?.startsAt ?? overview.weekend.end} /></div>
          <div className="weather-strip">
            <span>FORECAST</span>
            <strong>
              {overview.weather.status === "available" && overview.weather.days.length > 0
                ? `${Math.max(...overview.weather.days.map((day) => day.precipitationProbability))}% RAIN`
                : "FEED PENDING"}
            </strong>
          </div>
        </div>
      </section>

      <WeekendConditions weather={overview.weather} />

      <section className="prediction-section" id="prediction">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PRE-QUALIFYING FORECAST</p>
            <h2>The predicted three</h2>
          </div>
          <p>Probabilitas posisi berasal dari simulasi tanpa pengembalian: satu pembalap hanya dapat menempati satu posisi podium.</p>
        </div>

        <div className="prediction-stage">
          <SpaTrack predictions={predictions} />
          <ol className="podium-list">
            {predictions.predictedPodium.map((driver) => {
              const detail = predictions.field.find((item) => item.driverId === driver.driverId);
              return (
                <li key={driver.driverId}>
                  <span className="podium-position">P{driver.position}</span>
                  <div>
                    <strong>{driver.driverName}</strong>
                    <span>{driver.team}</span>
                  </div>
                  <div className="podium-probability">
                    <strong>{percent(driver.probability)}</strong>
                    <span>{driver.position === 1 ? "WIN" : `FINISH P${driver.position}`}</span>
                  </div>
                  <div className="probability-line" style={{ "--probability": driver.probability } as React.CSSProperties} />
                  {detail?.factors[0] ? <small>{detail.factors[0].label}</small> : null}
                </li>
              );
            })}
          </ol>
        </div>

        <FullFieldProbability field={predictions.field} />
      </section>

      <TeamOutlook field={predictions.field} />

      <section className="history-section" id="history">
        <div className="section-heading light">
          <div>
            <p className="eyebrow">SPA / {history.yearRange.from}–{history.yearRange.to}</p>
            <h2>What the circuit remembers</h2>
          </div>
          <p>{history.raceSampleSize} race editions, 2021 dikeluarkan secara default karena hanya dua lap di belakang safety car.</p>
        </div>
        <HistoryMetrics history={history} />
        <div className="position-chart">
          <div className="chart-heading"><h3>Starting position conversion</h3><span>WIN / PODIUM RATE</span></div>
          <div className="bars">
            {strongestPositionRates.map((entry) => (
              <div className="bar-column" key={entry.position}>
                <div className="bar-stack">
                  <i className="podium-bar" style={{ height: percent(entry.podium.rate) }} />
                  <i className="winner-bar" style={{ height: percent(entry.winner.rate) }} />
                </div>
                <b>P{entry.position}</b>
              </div>
            ))}
          </div>
          <div className="chart-legend"><span><i className="winner-key" /> WIN</span><span><i className="podium-key" /> PODIUM</span></div>
        </div>
      </section>

      <SpaContenderFormbook field={predictions.field} history={history} />

      <QualifyingWorkbench initialPrediction={predictions} />

      <section className="method-section">
        <p className="eyebrow">MODEL NOTES</p>
        <div>
          <h2>Fast enough to use.<br />Honest enough to question.</h2>
          <ul>
            {predictions.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            <li>{predictions.disclaimer}</li>
          </ul>
        </div>
        <dl>
          <div><dt>VERSION</dt><dd>{predictions.modelVersion}</dd></div>
          <div><dt>SIMULATIONS</dt><dd>{predictions.simulationCount.toLocaleString("id-ID")}</dd></div>
          <div><dt>SEED</dt><dd>{predictions.simulationSeed}</dd></div>
        </dl>
      </section>

      <footer><span>SPA PODIUM PREDICTOR / 2026</span><span>DATA CUT-OFF {overview.dataCutoff}</span></footer>
    </main>
  );
}
