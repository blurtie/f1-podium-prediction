export type Factor = {
  feature: string;
  label: string;
  direction: "supporting" | "inhibiting";
  impact: number;
};

export type DriverPrediction = {
  driverId: number;
  driverCode: string;
  driverName: string;
  team: string;
  qualifyingPosition: number | null;
  gridPosition: number | null;
  positionProbabilities: { p1: number; p2: number; p3: number };
  winnerProbability: number;
  podiumProbability: number;
  factors: Factor[];
};

export type PredictionResponse = {
  stage: "pre-qualifying" | "post-qualifying";
  generatedAt: string;
  dataCutoff: string;
  modelVersion: string;
  simulationCount: number;
  simulationSeed: number;
  predictedPodium: Array<{
    position: number;
    driverId: number;
    driverCode: string;
    driverName: string;
    team: string;
    probability: number;
  }>;
  field: DriverPrediction[];
  warnings: string[];
  disclaimer: string;
};

export type Overview = {
  event: string;
  venue: string;
  weekend: { start: string; end: string };
  schedule: Array<{ session: string; startsAt: string; label: string }>;
  track: {
    lengthKm: number;
    laps: number;
    raceDistanceKm: number;
    character: string[];
  };
  dataCutoff: string;
  model: { status: string; version: string; stage: string; calibrationWindow: string };
  weather: {
    status: string;
    source: string;
    modelUsage: string;
    warning: string;
    days: Array<{
      date: string;
      temperatureMaxC: number;
      temperatureMinC: number;
      precipitationMm: number;
      precipitationProbability: number;
      windSpeedMaxKmh: number;
    }>;
  };
  updatedAt: string;
};

export type Rate = {
  successes: number;
  sampleSize: number;
  rate: number;
  confidenceInterval: { low: number; high: number };
  smallSample: boolean;
};

export type EntityPerformance = {
  name: string;
  starts: number;
  podiums: number;
  wins: number;
  averageFinish: number;
  dnfRate: number;
  smallSample: boolean;
};

export type History = {
  window: string;
  basis: string;
  include2021: boolean;
  yearRange: { from: number; to: number };
  raceSampleSize: number;
  driverObservationCount: number;
  poleToWinner: Rate;
  poleToPodium: Rate;
  topThreeQualifyingToRaceTopThree: Rate;
  spearmanCorrelation: number | null;
  averagePositionsGained: number;
  dnfRate: Rate;
  positionRates: Array<{ position: number; winner: Rate; podium: Rate }>;
  activeDrivers: EntityPerformance[];
  teams: EntityPerformance[];
  warnings: string[];
};

export type QualifyingRow = {
  driverId: number;
  driverCode: string;
  driverName: string;
  team: string;
  qualifyingPosition: number;
  gridPosition: number;
  gapToPoleSeconds: number | null;
};
