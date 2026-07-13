"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="api-error">
      <p className="eyebrow">SPA / ERROR</p>
      <h1>Data tidak dapat ditampilkan.</h1>
      <p>Periksa koneksi backend dan artefak model, lalu coba kembali.</p>
      <button className="action-button" onClick={reset}>Coba lagi</button>
    </main>
  );
}
