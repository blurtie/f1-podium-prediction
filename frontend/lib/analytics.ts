import type {
  DriverPrediction,
  EntityPerformance,
  Factor,
  Overview,
} from "./types";

export type TeamOutlook = {
  team: string;
  winProbability: number;
  expectedPodiumSlots: number;
  strongestContender: DriverPrediction;
  drivers: DriverPrediction[];
};

export type ContenderForm = {
  prediction: DriverPrediction;
  history: EntityPerformance | null;
};

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en");
}

export function strongestFactor(
  factors: Factor[],
  direction: Factor["direction"],
): Factor | null {
  let strongest: Factor | null = null;
  for (const factor of factors) {
    if (factor.direction !== direction) continue;
    if (!strongest || Math.abs(factor.impact) > Math.abs(strongest.impact)) {
      strongest = factor;
    }
  }
  return strongest;
}

export function buildTeamOutlook(field: DriverPrediction[]): TeamOutlook[] {
  const teams = new Map<string, DriverPrediction[]>();
  for (const driver of field) {
    const drivers = teams.get(driver.team);
    if (drivers) drivers.push(driver);
    else teams.set(driver.team, [driver]);
  }

  return Array.from(teams, ([team, drivers]) => {
    let winProbability = 0;
    let expectedPodiumSlots = 0;
    let strongestContender = drivers[0];
    for (const driver of drivers) {
      winProbability += driver.winnerProbability;
      expectedPodiumSlots += driver.podiumProbability;
      if (driver.podiumProbability > strongestContender.podiumProbability) {
        strongestContender = driver;
      }
    }
    return {
      team,
      winProbability,
      expectedPodiumSlots,
      strongestContender,
      drivers,
    };
  }).sort(
    (left, right) =>
      right.expectedPodiumSlots - left.expectedPodiumSlots ||
      right.winProbability - left.winProbability,
  );
}

export function buildContenderForm(
  field: DriverPrediction[],
  activeDrivers: EntityPerformance[],
): ContenderForm[] {
  const historyByName = new Map(
    activeDrivers.map((driver) => [normalizeName(driver.name), driver]),
  );
  return field.map((prediction) => ({
    prediction,
    history: historyByName.get(normalizeName(prediction.driverName)) ?? null,
  }));
}

export function podiumProbabilityIsCoherent(
  driver: DriverPrediction,
  tolerance = 0.000_003,
) {
  const { p1, p2, p3 } = driver.positionProbabilities;
  return Math.abs(p1 + p2 + p3 - driver.podiumProbability) <= tolerance;
}

export function podiumDelta(before: number, after: number) {
  return (after - before) * 100;
}

export function deltaDirection(value: number, neutralTolerance = 0.05) {
  if (Math.abs(value) < neutralTolerance) return "neutral" as const;
  return value > 0 ? "positive" as const : "negative" as const;
}

export function weatherForecastIsAvailable(weather: Overview["weather"]) {
  return weather.status === "available" && weather.days.length > 0;
}
