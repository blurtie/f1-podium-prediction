import { expect, test } from "@playwright/test";
import {
  buildContenderForm,
  buildTeamOutlook,
  deltaDirection,
  podiumDelta,
  podiumProbabilityIsCoherent,
  strongestFactor,
  weatherForecastIsAvailable,
} from "@/lib/analytics";
import type { DriverPrediction, EntityPerformance, Overview } from "@/lib/types";

function prediction(overrides: Partial<DriverPrediction> = {}): DriverPrediction {
  return {
    driverId: 1,
    driverCode: "AAA",
    driverName: "A Driver",
    team: "Team One",
    qualifyingPosition: null,
    gridPosition: null,
    positionProbabilities: { p1: 0.1, p2: 0.15, p3: 0.2 },
    winnerProbability: 0.1,
    podiumProbability: 0.45,
    factors: [],
    ...overrides,
  };
}

test("position probabilities, factors, and delta helpers cover edge states", () => {
  const coherent = prediction();
  expect(podiumProbabilityIsCoherent(coherent)).toBe(true);
  expect(podiumProbabilityIsCoherent({ ...coherent, podiumProbability: 0.5 })).toBe(false);
  expect(strongestFactor([], "inhibiting")).toBeNull();

  expect(podiumDelta(0.322, 0.487)).toBeCloseTo(16.5);
  expect(deltaDirection(16.5)).toBe("positive");
  expect(deltaDirection(-2)).toBe("negative");
  expect(deltaDirection(0)).toBe("neutral");
});

test("team outlook sums win probability and labels podium as expected slots", () => {
  const field = [
    prediction({ driverId: 1, podiumProbability: 0.45, winnerProbability: 0.2 }),
    prediction({ driverId: 2, driverCode: "BBB", podiumProbability: 0.35, winnerProbability: 0.1 }),
    prediction({ driverId: 3, driverCode: "CCC", team: "Team Two", podiumProbability: 0.2, winnerProbability: 0.05 }),
  ];
  const outlook = buildTeamOutlook(field);
  expect(outlook[0].team).toBe("Team One");
  expect(outlook[0].winProbability).toBeCloseTo(0.3);
  expect(outlook[0].expectedPodiumSlots).toBeCloseTo(0.8);
  expect(outlook[0].strongestContender.driverId).toBe(1);
});

test("formbook matches accents and preserves a debut state", () => {
  const history: EntityPerformance[] = [{
    name: "Sergio Pérez",
    starts: 10,
    wins: 0,
    podiums: 2,
    averageFinish: 6.7,
    dnfRate: 0.1,
    smallSample: false,
  }];
  const form = buildContenderForm([
    prediction({ driverName: "Sergio Perez" }),
    prediction({ driverId: 2, driverName: "Rookie Driver" }),
  ], history);
  expect(form[0].history?.starts).toBe(10);
  expect(form[1].history).toBeNull();
});

test("weekend conditions distinguishes available and unavailable forecast states", () => {
  const available: Overview["weather"] = {
    status: "available",
    source: "Open-Meteo",
    modelUsage: "context-only",
    warning: "",
    days: [{
      date: "2026-07-17",
      temperatureMaxC: 21,
      temperatureMinC: 12,
      precipitationMm: 4.2,
      precipitationProbability: 60,
      windSpeedMaxKmh: 24,
    }],
  };
  const unavailable = { ...available, status: "unavailable", days: [], warning: "Feed belum tersedia." };
  expect(weatherForecastIsAvailable(available)).toBe(true);
  expect(weatherForecastIsAvailable(unavailable)).toBe(false);
});
