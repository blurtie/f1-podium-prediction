# Belgian GP 2026 Podium Predictor

Dashboard prediksi podium khusus Formula 1 Belgian Grand Prix 2026 di Spa-Francorchamps. Pipeline membangun fitur pre-race yang di-shift, melatih model winner dan podium dengan walk-forward out-of-fold calibration, lalu menghasilkan probabilitas P1/P2/P3 melalui 50.000 simulasi tanpa pengembalian.

## Menjalankan lokal

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt
PYTHONPATH=src .venv/bin/python -m spa_pipeline.train
.venv/bin/python backend/run.py
```

Di terminal lain:

```bash
cd frontend
npm install
npm run dev
```

Buka `http://localhost:3000`. Backend menyediakan dokumentasi OpenAPI pada `http://localhost:8000/docs`.

Konfigurasi URL API tersedia di `frontend/.env.example`. Prediksi pre-qualifying memakai data sampai British GP 2026; setelah qualifying Spa selesai, masukkan posisi qualifying, grid final, dan gap ke pole melalui workbench dashboard.

## Verifikasi

```bash
.venv/bin/python -m pytest
cd frontend && npm run typecheck && npm run build
```

Cuaca ditampilkan sebagai konteks dan tidak menjadi fitur model v1. Hasil merupakan estimasi analitis, bukan kepastian atau saran taruhan.
