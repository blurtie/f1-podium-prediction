import {
  buildContenderForm,
  buildTeamOutlook,
  podiumProbabilityIsCoherent,
  strongestFactor,
  weatherForecastIsAvailable,
} from "@/lib/analytics";
import type {
  ContenderForm as ContenderFormData,
  TeamOutlook as TeamOutlookData,
} from "@/lib/analytics";
import type {
  DriverPrediction,
  History,
  Overview,
  Rate,
} from "@/lib/types";

const percentFormatter = new Intl.NumberFormat("id-ID", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const decimalFormatter = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

const percent = (value: number) => percentFormatter.format(value);

function weekendDay(date: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${date}T12:00:00+07:00`));
}

export function WeekendConditions({ weather }: { weather: Overview["weather"] }) {
  const available = weatherForecastIsAvailable(weather);

  return (
    <section className="conditions-section" aria-labelledby="conditions-title">
      <div className="telemetry-heading">
        <div>
          <p className="eyebrow">FRIDAY — SUNDAY / ARDENNES</p>
          <h2 id="conditions-title">Weekend Conditions</h2>
        </div>
        <div className="context-badge" title="Forecast ini hanya konteks dan tidak memengaruhi probabilitas model.">
          CONTEXT ONLY — NOT A MODEL INPUT
        </div>
      </div>

      {available ? (
        <div className="conditions-grid" data-testid="weather-available">
          {weather.days.map((day) => (
            <article className="condition-day" key={day.date}>
              <header>
                <span>{weekendDay(day.date)}</span>
                <b>{day.precipitationProbability}% RAIN</b>
              </header>
              <dl>
                <div>
                  <dt title="Rentang suhu minimum hingga maksimum harian">TEMP MIN–MAX</dt>
                  <dd>{decimalFormatter.format(day.temperatureMinC)}° — {decimalFormatter.format(day.temperatureMaxC)}°C</dd>
                </div>
                <div>
                  <dt title="Total presipitasi harian dalam milimeter">PRECIPITATION</dt>
                  <dd>{decimalFormatter.format(day.precipitationMm)} <small>MM</small></dd>
                </div>
                <div>
                  <dt title="Kecepatan angin maksimum pada ketinggian 10 meter">MAX WIND</dt>
                  <dd>{decimalFormatter.format(day.windSpeedMaxKmh)} <small>KM/H</small></dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <div className="conditions-empty" data-testid="weather-unavailable" role="status">
          <span>FORECAST FEED PENDING</span>
          <p>{weather.warning || "Forecast Jumat–Minggu belum tersedia. Coba muat ulang saat feed cuaca aktif."}</p>
        </div>
      )}
      <p className="section-note">Sumber: {weather.source}. Forecast membantu membaca konteks weekend, tetapi belum digunakan sebagai fitur model v1.</p>
    </section>
  );
}

function FieldRows({ drivers }: { drivers: DriverPrediction[] }) {
  return drivers.map((driver) => {
    const supporting = strongestFactor(driver.factors, "supporting");
    const inhibiting = strongestFactor(driver.factors, "inhibiting");
    const coherent = podiumProbabilityIsCoherent(driver);
    return (
      <div className="probability-row" role="row" key={driver.driverId} data-driver-code={driver.driverCode}>
        <span className="driver-cell" role="cell"><b>{driver.driverCode}</b><span>{driver.driverName}<small>{driver.team}</small></span></span>
        <span role="cell">{percent(driver.positionProbabilities.p1)}</span>
        <span role="cell">{percent(driver.positionProbabilities.p2)}</span>
        <span role="cell">{percent(driver.positionProbabilities.p3)}</span>
        <span className="probability-cell" role="cell" title={coherent ? "P1 + P2 + P3 konsisten dengan peluang podium" : "Jumlah posisi tidak konsisten"}>
          <i style={{ width: percent(driver.podiumProbability) }} />
          <b>{percent(driver.podiumProbability)}</b>
        </span>
        <span className="factor-cell supporting" role="cell">{supporting?.label ?? "Tidak terdeteksi"}</span>
        <span className={inhibiting ? "factor-cell inhibiting" : "factor-cell empty-factor"} role="cell">
          {inhibiting?.label ?? "Tidak terdeteksi"}
        </span>
      </div>
    );
  });
}

export function FullFieldProbability({ field }: { field: DriverPrediction[] }) {
  const visible = field.slice(0, 6);
  const remaining = field.slice(6);
  return (
    <div className="field-table-wrap">
      <div className="table-intro">
        <div>
          <h3>Full Field Probability</h3>
          <p>Setiap PODIUM adalah jumlah P1, P2, dan P3 dari simulasi yang sama.</p>
        </div>
        <span>{field.length} DRIVERS / SORTED BY PODIUM CHANCE</span>
      </div>
      <div className="responsive-table" tabIndex={0} aria-label="Tabel probabilitas seluruh pembalap, dapat digulir horizontal">
        <div className="probability-table" role="table" aria-label="Probabilitas seluruh pembalap">
          <div className="probability-row field-header" role="row">
            <span role="columnheader">DRIVER / TEAM</span><span role="columnheader">P1</span><span role="columnheader">P2</span><span role="columnheader">P3</span><span role="columnheader">PODIUM</span><span role="columnheader" title="Kontribusi model positif terbesar">STRONGEST SUPPORT</span><span role="columnheader" title="Kontribusi model negatif terbesar">BIGGEST RISK</span>
          </div>
          <FieldRows drivers={visible} />
          {remaining.length > 0 ? (
            <details className="table-disclosure">
              <summary>Lihat semua <span>+{remaining.length} pembalap</span></summary>
              <FieldRows drivers={remaining} />
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TeamRows({ teams }: { teams: TeamOutlookData[] }) {
  return teams.map((team) => (
    <article className="team-row" key={team.team} data-team={team.team}>
      <div><span>TEAM</span><strong>{team.team}</strong><small>{team.drivers.map((driver) => driver.driverCode).join(" / ")}</small></div>
      <div><span>WIN PROBABILITY</span><strong>{percent(team.winProbability)}</strong><small>jumlah peluang menang pembalap</small></div>
      <div><span>EXPECTED PODIUM SLOTS</span><strong>{decimalFormatter.format(team.expectedPodiumSlots)}</strong><small>ekspektasi slot, bukan probabilitas</small></div>
      <div><span>LEAD CONTENDER</span><strong>{team.strongestContender.driverCode}</strong><small>{percent(team.strongestContender.podiumProbability)} podium</small></div>
    </article>
  ));
}

export function TeamOutlook({ field }: { field: DriverPrediction[] }) {
  const teams = buildTeamOutlook(field);
  const visible = teams.slice(0, 6);
  const remaining = teams.slice(6);
  return (
    <section className="outlook-section" aria-labelledby="team-outlook-title">
      <div className="telemetry-heading">
        <div><p className="eyebrow">2026 CONSTRUCTOR FIELD</p><h2 id="team-outlook-title">Team Outlook</h2></div>
        <p>Agregasi dibuat langsung dari dua pembalap tim 2026. Tidak ada penggabungan sejarah tim yang pernah berganti nama.</p>
      </div>
      <div className="team-outlook-list">
        <TeamRows teams={visible} />
        {remaining.length > 0 ? (
          <details className="row-disclosure">
            <summary>Lihat semua <span>+{remaining.length} tim</span></summary>
            <TeamRows teams={remaining} />
          </details>
        ) : null}
      </div>
      <p className="section-note">Expected podium slots dapat bernilai di atas 100% karena merupakan jumlah ekspektasi slot podium, bukan peluang “tim podium”.</p>
    </section>
  );
}

function confidenceInterval(rate: Rate) {
  return `${percent(rate.confidenceInterval.low)}–${percent(rate.confidenceInterval.high)}`;
}

function RateStat({ label, rate, description, primary = false }: { label: string; rate: Rate; description: string; primary?: boolean }) {
  return (
    <article className={`history-stat${primary ? " primary-stat" : ""}`}>
      <span title={description}>{label}</span>
      <strong>{percent(rate.rate)}</strong>
      <p>{rate.successes}/{rate.sampleSize} observasi berhasil</p>
      <small title="Rentang keyakinan Wilson 95%">95% CI {confidenceInterval(rate)}{rate.smallSample ? " · sampel kecil" : ""}</small>
    </article>
  );
}

export function HistoryMetrics({ history }: { history: History }) {
  return (
    <div className="history-grid">
      <RateStat label="POLE → WIN" rate={history.poleToWinner} description="Proporsi pole sitter yang memenangkan balapan." primary />
      <RateStat label="POLE → PODIUM" rate={history.poleToPodium} description="Proporsi pole sitter yang finis di tiga besar." />
      <RateStat label="TOP 3 QUALI → PODIUM" rate={history.topThreeQualifyingToRaceTopThree} description="Proporsi pembalap Top 3 qualifying yang finis di podium, tanpa menuntut urutan sama." />
      <article className="history-stat">
        <span title="Korelasi peringkat Spearman antara posisi qualifying dan posisi finis.">QUALI / FINISH CORRELATION</span>
        <strong>{history.spearmanCorrelation?.toFixed(2) ?? "N/A"}</strong>
        <p>{history.driverObservationCount} observasi pembalap</p>
        <small>Deskriptif, bukan hubungan sebab-akibat</small>
      </article>
      <RateStat label="DNF RATE" rate={history.dnfRate} description="Proporsi start yang tidak diklasifikasikan finis." />
    </div>
  );
}

function FormbookRows({ contenders }: { contenders: ContenderFormData[] }) {
  return contenders.map(({ prediction, history }) => (
    <div className="formbook-row" role="row" key={prediction.driverId}>
      <span className="driver-cell" role="cell"><b>{prediction.driverCode}</b><span>{prediction.driverName}<small>{prediction.team}</small></span></span>
      <span className="formbook-chance" role="cell">{percent(prediction.podiumProbability)}</span>
      {history ? (
        <>
          <span role="cell">{history.starts}</span>
          <span role="cell">{history.wins}</span>
          <span role="cell">{history.podiums}</span>
          <span role="cell">P{decimalFormatter.format(history.averageFinish)}</span>
          <span role="cell">{percent(history.dnfRate)}{history.smallSample ? <small className="sample-flag" title="Kurang dari lima start">SMALL N</small> : null}</span>
        </>
      ) : (
        <span className="debut-cell" role="cell">Debut / belum ada sampel</span>
      )}
    </div>
  ));
}

export function SpaContenderFormbook({ field, history }: { field: DriverPrediction[]; history: History }) {
  const contenders = buildContenderForm(field, history.activeDrivers);
  const visible = contenders.slice(0, 6);
  const remaining = contenders.slice(6);
  return (
    <section className="formbook-section" aria-labelledby="formbook-title">
      <div className="telemetry-heading">
        <div><p className="eyebrow">MODEL ORDER / SPA RECORD</p><h2 id="formbook-title">Spa Contender Formbook</h2></div>
        <p>Urutan mengikuti peluang podium model 2026; hasil historis hanya konteks dan tidak mengubah urutan ini.</p>
      </div>
      <div className="responsive-table" tabIndex={0} aria-label="Tabel formbook Spa, dapat digulir horizontal">
        <div className="formbook-table" role="table" aria-label="Riwayat Spa pembalap 2026">
          <div className="formbook-row field-header" role="row">
            <span role="columnheader">DRIVER / TEAM</span><span role="columnheader">MODEL PODIUM</span><span role="columnheader">STARTS</span><span role="columnheader">WINS</span><span role="columnheader">PODIUMS</span><span role="columnheader">AVG FINISH</span><span role="columnheader">DNF</span>
          </div>
          <FormbookRows contenders={visible} />
          {remaining.length > 0 ? (
            <details className="table-disclosure">
              <summary>Lihat semua <span>+{remaining.length} pembalap</span></summary>
              <FormbookRows contenders={remaining} />
            </details>
          ) : null}
        </div>
      </div>
      <p className="section-note">Window {history.yearRange.from}–{history.yearRange.to}, basis qualifying, Belgian GP 2021 dikeluarkan. Riwayat pembalap dengan kurang dari lima start ditandai sebagai sampel kecil.</p>
    </section>
  );
}
