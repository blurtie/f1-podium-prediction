import type { History, Overview, PredictionResponse, QualifyingRow } from "./types";

const serverBase = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${serverBase}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`API ${path} mengembalikan status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function getDashboardData() {
  const [overview, history, predictions] = await Promise.all([
    getJson<Overview>("/api/spa/overview"),
    getJson<History>("/api/spa/history?window=modern&basis=qualifying&include2021=false"),
    getJson<PredictionResponse>("/api/spa/predictions/pre-qualifying"),
  ]);
  return { overview, history, predictions };
}

export async function postQualifying(rows: QualifyingRow[]): Promise<PredictionResponse> {
  const clientBase =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${clientBase}/api/spa/predictions/post-qualifying`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      drivers: rows.map(({ driverId, qualifyingPosition, gridPosition, gapToPoleSeconds }) => ({
        driverId,
        qualifyingPosition,
        gridPosition,
        gapToPoleSeconds,
      })),
    }),
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as
      | { detail?: { errors?: string[] } | string }
      | null;
    const errors =
      typeof detail?.detail === "object" ? detail.detail.errors?.join(" ") : detail?.detail;
    throw new Error(errors || "Prediksi pasca-qualifying gagal dihitung.");
  }
  return response.json() as Promise<PredictionResponse>;
}
