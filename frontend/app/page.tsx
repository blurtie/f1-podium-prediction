import { Dashboard } from "@/components/dashboard";
import { getDashboardData } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Page() {
  try {
    const data = await getDashboardData();
    return <Dashboard {...data} />;
  } catch (error) {
    return (
      <main className="api-error">
        <p className="eyebrow">SPA / SYSTEM CHECK</p>
        <h1>Timing feed belum tersambung.</h1>
        <p>
          Jalankan FastAPI pada port 8000, lalu muat ulang halaman. Detail: {error instanceof Error ? error.message : "API tidak tersedia"}
        </p>
        <a className="action-button" href="/">Coba lagi</a>
      </main>
    );
  }
}
