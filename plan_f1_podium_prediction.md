# Rencana Proyek Prediksi Podium Formula 1

## 1. Ringkasan Proyek

Proyek ini bertujuan membangun program prediksi podium Formula 1 untuk menentukan pembalap yang berpotensi finis di posisi:

1. P1
2. P2
3. Non-podium

Dataset utama menggunakan **Formula 1 Race Data** dari Kaggle:

`https://www.kaggle.com/datasets/jtrotman/formula-1-race-data`

Prediksi utama dilakukan pada level **pembalap dalam satu balapan**. Setiap baris data merepresentasikan satu kombinasi:

```text
raceId + driverId
```

Model akan memberikan skor atau probabilitas kepada seluruh pembalap dalam satu balapan. Tiga pembalap dengan skor tertinggi kemudian dipilih sebagai kandidat podium.

---

## 2. Tujuan

### 2.1 Tujuan Utama

Membangun model yang dapat:

1. Memprediksi tiga pembalap yang akan naik podium.
2. Mengurutkan kandidat podium menjadi P1, P2, dan P3.
3. Menggunakan hanya data yang tersedia sebelum balapan dimulai.
4. Menghindari data leakage dari hasil balapan yang sedang diprediksi.
5. Menyediakan penjelasan faktor yang memengaruhi hasil prediksi.

### 2.2 Output Sistem

Program menghasilkan output seperti berikut:

| Prediksi | Pembalap | Tim | Skor |
|---|---|---|---:|
| P1 | Driver A | Team A | 0.87 |
| P2 | Driver B | Team B | 0.81 |
| P3 | Driver C | Team C | 0.74 |

Output tambahan yang dapat ditampilkan:

1. Probabilitas podium setiap pembalap.
2. Faktor utama yang mendukung prediksi.
3. Perbandingan prediksi dengan hasil aktual.
4. Riwayat akurasi model per musim dan per sirkuit.

---

## 3. Definisi Masalah

### 3.1 Unit Observasi

Satu observasi adalah satu pembalap pada satu balapan.

Contoh:

```text
Australian GP 2025 + Driver A
Australian GP 2025 + Driver B
Australian GP 2025 + Driver C
```

### 3.2 Target

Target utama:

```python
podium = 1 if positionOrder <= 3 else 0
```

Target tambahan untuk model ranking:

```python
relevance = {
    1: 3,
    2: 2,
    3: 1,
    "non_podium": 0
}
```

Alternatif target:

```text
P1
P2
P3
Non-podium
```

Namun, klasifikasi multiclass biasa tidak menjadi pendekatan utama karena dapat menghasilkan lebih dari satu pembalap sebagai P1 atau jumlah pembalap podium yang tidak tepat.

### 3.3 Waktu Prediksi

Versi utama sistem melakukan prediksi:

```text
Setelah sesi qualifying selesai, sebelum race dimulai.
```

Dengan demikian, fitur seperti posisi qualifying dan starting grid dapat digunakan.

Versi tambahan dapat dikembangkan untuk:

1. Prediksi sebelum qualifying.
2. Prediksi setelah sprint.
3. Prediksi live selama race.

---

## 4. Tabel Dataset yang Digunakan

### 4.1 Tabel Utama

| Tabel | Fungsi |
|---|---|
| `races.csv` | Informasi musim, ronde, tanggal, dan sirkuit |
| `results.csv` | Hasil balapan dan target podium |
| `qualifying.csv` | Posisi dan waktu qualifying |
| `drivers.csv` | Informasi pembalap |
| `constructors.csv` | Informasi tim |
| `circuits.csv` | Informasi sirkuit |
| `driver_standings.csv` | Klasemen pembalap |
| `constructor_standings.csv` | Klasemen konstruktor |
| `sprint_results.csv` | Hasil sprint |
| `status.csv` | Status finis, DNF, accident, dan lainnya |

### 4.2 Tabel Tambahan

| Tabel | Penggunaan |
|---|---|
| `lap_times.csv` | Analisis pace historis |
| `pit_stops.csv` | Analisis strategi historis |
| `constructor_results.csv` | Kinerja konstruktor per race |
| `seasons.csv` | Metadata musim |

Tabel `lap_times` dan `pit_stops` tidak digunakan dari race yang sedang diprediksi karena baru tersedia setelah race berjalan.

---

## 5. Data Preparation

### 5.1 Memuat Seluruh Dataset

Langkah:

1. Membaca seluruh file CSV.
2. Memeriksa tipe data.
3. Memeriksa jumlah baris dan kolom.
4. Memeriksa missing value.
5. Memeriksa duplikasi.
6. Memeriksa konsistensi foreign key.

Foreign key utama:

```text
raceId
driverId
constructorId
circuitId
statusId
```

### 5.2 Membuat Master Dataset

Tabel dasar dibuat dari `results.csv`, kemudian digabungkan dengan:

1. `races.csv`
2. `drivers.csv`
3. `constructors.csv`
4. `circuits.csv`
5. `qualifying.csv`
6. klasemen sebelum race
7. sprint result
8. fitur historis

Struktur akhir:

```text
season
round
raceId
driverId
constructorId
circuitId
qualifying features
driver form features
constructor form features
circuit history features
target
```

### 5.3 Filter Periode

Rekomendasi awal:

```text
Musim 2014 sampai musim terakhir yang sudah selesai.
```

Alasan:

1. Regulasi dan karakter kompetisi F1 berubah dari waktu ke waktu.
2. Data yang terlalu lama dapat menambah noise.
3. Era modern memiliki struktur qualifying dan sistem poin yang lebih konsisten.

Eksperimen tambahan:

1. Data 2009 hingga terbaru.
2. Data 2014 hingga terbaru.
3. Data 2022 hingga terbaru.

Hasil ketiga rentang dibandingkan untuk melihat pengaruh concept drift.

---

## 6. Pencegahan Data Leakage

Semua fitur harus mencerminkan informasi yang sudah tersedia sebelum race.

### 6.1 Kolom yang Tidak Boleh Digunakan

Kolom hasil race yang sedang diprediksi:

```text
position
positionOrder
points
laps
time
milliseconds
fastestLap
rank
fastestLapTime
fastestLapSpeed
statusId
```

### 6.2 Aturan Shift

Semua rolling feature wajib menggunakan data hingga race sebelumnya.

Contoh:

```python
df["driver_points_avg_5"] = (
    df.groupby("driverId")["points"]
      .transform(lambda x: x.shift(1).rolling(5).mean())
)
```

Kesalahan yang harus dihindari:

```python
rolling(5).mean()
```

tanpa:

```python
shift(1)
```

### 6.3 Klasemen

Posisi klasemen yang digunakan harus merupakan posisi sebelum race.

Jika tabel klasemen menyimpan posisi setelah race, gunakan:

```python
groupby(...).shift(1)
```

---

## 7. Feature Engineering

## 7.1 Fitur Qualifying

Fitur utama:

```text
qual_position
grid_effective
reached_q2
reached_q3
q1_gap
q2_gap
q3_gap
qual_gap_to_pole
qual_vs_teammate
team_qual_mean
team_best_qual_position
```

### Koreksi Starting Grid

Nilai:

```text
grid = 0
```

tidak dianggap sebagai pole position.

Transformasi:

```python
grid_effective = grid

if grid == 0:
    grid_effective = field_size + 1
```

### Normalisasi Waktu Qualifying

Waktu qualifying diubah menjadi milidetik.

Contoh fitur:

```python
qual_gap_to_pole = driver_best_qual_time - pole_best_qual_time
```

Fitur dapat dinormalisasi terhadap panjang lap:

```python
qual_gap_ratio = qual_gap_to_pole / pole_best_qual_time
```

---

## 7.2 Fitur Form Pembalap

Rolling window:

```text
3 race
5 race
10 race
```

Fitur:

```text
driver_finish_avg_3
driver_finish_avg_5
driver_finish_avg_10

driver_points_avg_3
driver_points_avg_5
driver_points_avg_10

driver_podium_rate_5
driver_podium_rate_10

driver_win_rate_10
driver_top5_rate_10

driver_dnf_rate_5
driver_dnf_rate_10

driver_grid_gain_avg_5
driver_prev_finish
driver_prev_qualifying
```

Contoh grid gain:

```python
grid_gain = grid_effective - positionOrder
```

Nilai positif menunjukkan pembalap finis lebih baik daripada posisi start.

---

## 7.3 Fitur Kekuatan Konstruktor

Fitur:

```text
team_points_avg_5
team_points_avg_10

team_best_finish_avg_5
team_best_finish_avg_10

team_podium_rate_10
team_win_rate_10

team_dnf_rate_5
team_dnf_rate_10

team_qual_mean
team_grid_mean

constructor_prev_position
constructor_prev_points
```

Kekuatan tim perlu dipisahkan dari form pembalap agar model dapat membedakan:

1. Kemampuan pembalap.
2. Kekuatan mobil.
3. Kondisi tim pada musim berjalan.

---

## 7.4 Fitur Klasemen

Fitur sebelum race:

```text
driver_prev_standing_position
driver_prev_standing_points
driver_points_gap_to_leader

constructor_prev_standing_position
constructor_prev_standing_points
constructor_points_gap_to_leader
```

Tambahkan indikator fase musim:

```text
season_progress
```

Rumus:

```python
season_progress = round / total_rounds_in_season
```

---

## 7.5 Fitur Riwayat Sirkuit

Fitur pembalap:

```text
driver_circuit_races
driver_circuit_avg_finish
driver_circuit_best_finish
driver_circuit_podium_rate
driver_circuit_win_rate
driver_circuit_dnf_rate
```

Fitur konstruktor:

```text
team_circuit_races
team_circuit_avg_finish
team_circuit_best_finish
team_circuit_podium_rate
team_circuit_win_rate
```

Fitur harus dihitung hanya dari balapan sebelumnya pada sirkuit yang sama.

---

## 7.6 Fitur Sprint

Untuk sprint weekend:

```text
has_sprint
sprint_grid
sprint_finish
sprint_points
sprint_position_gain
```

Untuk weekend tanpa sprint:

```text
has_sprint = 0
```

Nilai fitur sprint lainnya dapat diisi dengan:

```text
NaN
```

CatBoost dan LightGBM dapat menangani missing value secara langsung.

---

## 7.7 Fitur Reliability

Status hasil race sebelumnya dikelompokkan menjadi:

```text
Finished
Mechanical DNF
Crash or Accident
Disqualified
Other
```

Fitur:

```text
driver_mechanical_dnf_rate_5
driver_crash_rate_5
team_mechanical_dnf_rate_5
team_finish_rate_10
```

Reliability dapat membantu membedakan pembalap cepat yang sering gagal finis.

---

## 7.8 Fitur Teammate Comparison

Fitur pembanding terhadap rekan satu tim:

```text
qual_gap_to_teammate
finish_gap_to_teammate_avg_5
points_gap_to_teammate
qualifying_win_rate_vs_teammate
race_win_rate_vs_teammate
```

Fitur ini membantu mengukur performa individu dengan mengontrol kekuatan mobil.

---

## 8. Exploratory Data Analysis

## 8.1 Analisis Target

Analisis:

1. Proporsi podium dan non-podium.
2. Jumlah pembalap per race.
3. Jumlah race per musim.
4. Distribusi podium per konstruktor.
5. Distribusi podium per posisi qualifying.

Target bersifat tidak seimbang karena hanya tiga pembalap dari sekitar 20 pembalap yang masuk podium.

Perkiraan distribusi:

```text
Podium sekitar 15%
Non-podium sekitar 85%
```

## 8.2 Analisis Korelasi

Metode:

1. Pearson correlation.
2. Spearman correlation.
3. Point-biserial correlation.
4. Mutual information.
5. AUC satu fitur.
6. Feature importance model awal.

Korelasi tidak digunakan sebagai satu-satunya dasar pemilihan fitur karena:

1. Hubungan dapat bersifat non-linear.
2. Fitur dapat memiliki interaksi.
3. Banyak fitur saling berkorelasi.
4. Korelasi tinggi belum tentu bebas leakage.

## 8.3 Analisis Multikolinearitas

Kelompok yang berpotensi sangat berkorelasi:

```text
grid vs qualifying position
driver rolling points vs driver rolling finish
team rolling points vs team rolling finish
driver standing vs driver rolling points
constructor standing vs team rolling points
```

Penanganan:

1. Menghapus fitur yang hampir identik.
2. Menggunakan regularisasi.
3. Menggunakan permutation importance.
4. Menggunakan SHAP.
5. Membandingkan performa model dengan dan tanpa fitur redundan.

---

## 9. Strategi Validasi

## 9.1 Larangan Random Split

Random split tidak digunakan karena dapat mencampurkan masa depan ke data masa lalu.

Contoh masalah:

```text
Train: race 2025
Test: race 2023
```

Hal ini tidak mencerminkan penggunaan nyata.

## 9.2 Time-Based Split

Contoh pembagian:

```text
Train      : 2014-2022
Validation : 2023
Test       : 2024-2025
```

Alternatif:

```text
Train      : 2014-2023
Validation : 2024
Test       : 2025
```

## 9.3 Walk-Forward Validation

Skema:

```text
Fold 1:
Train 2014-2018
Validate 2019

Fold 2:
Train 2014-2019
Validate 2020

Fold 3:
Train 2014-2020
Validate 2021

Fold 4:
Train 2014-2021
Validate 2022
```

Walk-forward validation menjadi evaluasi utama karena paling sesuai dengan prediksi musim berikutnya.

## 9.4 Grouping Per Race

Semua pembalap pada race yang sama harus berada pada split yang sama.

Tidak boleh ada sebagian pembalap dari satu race di train dan sebagian lainnya di validation.

---

## 10. Baseline Model

## 10.1 Baseline 1: Posisi Qualifying

Prediksi:

```text
P1 = posisi qualifying 1
P2 = posisi qualifying 2
P3 = posisi qualifying 3
```

Baseline ini penting karena qualifying merupakan prediktor sangat kuat.

## 10.2 Baseline 2: Starting Grid

Prediksi:

```text
P1 = grid 1
P2 = grid 2
P3 = grid 3
```

## 10.3 Baseline 3: Klasemen Pembalap

Prediksi berdasarkan tiga posisi klasemen tertinggi sebelum race.

## 10.4 Baseline 4: Weighted Formula

Contoh:

```python
score = (
    -0.45 * normalized_qual_position
    -0.20 * normalized_grid
    +0.15 * driver_form
    +0.15 * constructor_form
    +0.05 * circuit_history
)
```

Baseline formula berfungsi sebagai pembanding sebelum machine learning.

---

## 11. Kandidat Model

## 11.1 Logistic Regression

Target:

```text
podium vs non-podium
```

Kelebihan:

1. Mudah diinterpretasikan.
2. Menjadi baseline machine learning.
3. Cepat dilatih.
4. Memberikan probabilitas.

Kekurangan:

1. Hubungan harus relatif linear.
2. Sensitif terhadap multikolinearitas.
3. Kurang kuat untuk interaksi kompleks.

## 11.2 Random Forest

Kelebihan:

1. Menangkap hubungan non-linear.
2. Tidak membutuhkan scaling.
3. Mudah digunakan.

Kekurangan:

1. Probabilitas sering kurang terkalibrasi.
2. Dapat kalah dari boosting pada data tabular.

## 11.3 XGBoost

Kelebihan:

1. Kuat untuk data tabular.
2. Menangani hubungan non-linear.
3. Mendukung ranking objective.
4. Mendukung class weighting.

## 11.4 LightGBM

Kelebihan:

1. Cepat.
2. Efisien.
3. Mendukung LambdaRank.
4. Cocok untuk dataset relasional hasil feature engineering.

Model kandidat utama:

```text
LGBMClassifier
LGBMRanker
```

## 11.5 CatBoost

Kelebihan:

1. Baik untuk fitur kategorikal.
2. Menangani missing value.
3. Membutuhkan preprocessing lebih sedikit.
4. Menyediakan ranking loss.

Model kandidat:

```text
CatBoostClassifier
CatBoostRanker
```

---

## 12. Strategi Pemodelan

## 12.1 Tahap 1: Binary Podium Classifier

Target:

```text
podium = 1
non-podium = 0
```

Proses:

1. Model menghasilkan probabilitas podium setiap pembalap.
2. Data dikelompokkan berdasarkan `raceId`.
3. Pembalap diurutkan berdasarkan probabilitas.
4. Tiga skor tertinggi dipilih sebagai kandidat podium.

Kelebihan:

1. Implementasi sederhana.
2. Cocok untuk baseline.
3. Mudah dievaluasi.
4. Probabilitas mudah dijelaskan.

## 12.2 Tahap 2: Learning to Rank

Relevance score:

```text
P1 = 3
P2 = 2
P3 = 1
Non-podium = 0
```

Grouping:

```text
group = jumlah pembalap pada setiap raceId
```

Model:

```text
LGBMRanker
XGBRanker
CatBoostRanker
```

Tujuan:

1. Mengurutkan pembalap dalam race.
2. Memastikan prediksi dinilai relatif terhadap peserta dalam race yang sama.
3. Mengoptimalkan kualitas urutan podium.

## 12.3 Tahap 3: Two-Stage Model

Model pertama:

```text
Memprediksi peluang podium.
```

Model kedua:

```text
Mengurutkan kandidat podium menjadi P1, P2, dan P3.
```

Input model kedua hanya kandidat dengan probabilitas podium tertinggi.

## 12.4 Tahap 4: Ensemble

Kombinasi:

```text
LightGBM Classifier
LightGBM Ranker
CatBoost Ranker
Formula Baseline
```

Contoh blending:

```python
final_score = (
    0.35 * classifier_probability
    + 0.45 * ranker_score
    + 0.20 * baseline_score
)
```

Bobot ditentukan berdasarkan validation set, bukan test set.

---

## 13. Penanganan Class Imbalance

Karena hanya tiga pembalap per race yang masuk podium, target tidak seimbang.

Metode:

1. `class_weight="balanced"`
2. `scale_pos_weight`
3. Weighted binary cross entropy.
4. Fokus pada ranking metric.
5. Tidak menggunakan SMOTE secara langsung.

SMOTE kurang disarankan karena dapat menghasilkan pembalap sintetis yang tidak merepresentasikan struktur race sebenarnya.

---

## 14. Evaluasi Model

## 14.1 Metric Klasifikasi

Metric umum:

```text
ROC-AUC
PR-AUC
Log Loss
Brier Score
Precision
Recall
F1 Score
```

PR-AUC lebih relevan daripada accuracy karena target tidak seimbang.

## 14.2 Metric Podium Per Race

### Podium Hit Rate

Jumlah pembalap podium aktual yang masuk tiga prediksi teratas.

```python
podium_hit_rate = correct_podium_drivers / 3
```

Contoh:

```text
Prediksi: A, B, C
Aktual  : A, C, D

Podium hit = 2 dari 3
```

### Exact Podium Drivers

Bernilai benar jika ketiga pembalap podium berhasil diprediksi tanpa memperhatikan urutan.

### Exact Ordered Podium

Bernilai benar jika:

```text
P1 benar
P2 benar
P3 benar
```

### Winner Accuracy

Persentase pemenang yang berhasil diprediksi.

### Top-3 Recall

Mengukur proporsi podium aktual yang masuk tiga prediksi tertinggi.

## 14.3 Metric Ranking

Metric:

```text
NDCG@3
MAP@3
MRR
Precision@3
Recall@3
```

Metric utama yang direkomendasikan:

```text
NDCG@3
Podium Hit Rate
Exact Podium Drivers
Exact Ordered Podium
Winner Accuracy
```

## 14.4 Evaluasi Kalibrasi

Model probabilitas dievaluasi dengan:

1. Reliability curve.
2. Brier score.
3. Calibration error.

Metode kalibrasi:

```text
Platt scaling
Isotonic regression
```

Kalibrasi dilakukan menggunakan validation set.

---

## 15. Explainability

## 15.1 Global Feature Importance

Analisis:

1. Gain importance.
2. Permutation importance.
3. SHAP summary plot.
4. Ablation study.

## 15.2 Local Explanation

Untuk setiap pembalap, tampilkan alasan utama.

Contoh:

```text
Driver A diprediksi P1 karena:
1. Start dari posisi pertama.
2. Rata-rata poin lima race terakhir tertinggi.
3. Tim memiliki podium rate tinggi.
4. Memiliki riwayat kuat di sirkuit ini.
```

## 15.3 Feature Ablation

Eksperimen:

```text
Model A: qualifying saja
Model B: qualifying + driver form
Model C: qualifying + driver form + constructor form
Model D: semua fitur
```

Tujuan:

1. Menilai kontribusi setiap kelompok fitur.
2. Menghindari fitur yang hanya menambah kompleksitas.
3. Memastikan peningkatan performa konsisten.

---

## 16. Eksperimen yang Direncanakan

### Eksperimen 1: Baseline

```text
Qualifying top 3
Grid top 3
Standing top 3
```

### Eksperimen 2: Window Rolling

Bandingkan:

```text
3 race
5 race
10 race
Weighted rolling
```

Weighted rolling memberi bobot lebih besar pada race terbaru.

### Eksperimen 3: Rentang Data

Bandingkan:

```text
2009-sekarang
2014-sekarang
2022-sekarang
```

### Eksperimen 4: Fitur Qualifying

Bandingkan:

```text
Tanpa qualifying
Qualifying position
Qualifying position + time gap
Qualifying + teammate comparison
```

### Eksperimen 5: Model

Bandingkan:

```text
Logistic Regression
Random Forest
XGBoost
LightGBM
CatBoost
```

### Eksperimen 6: Objective

Bandingkan:

```text
Binary classification
Multiclass classification
Pairwise ranking
LambdaRank
```

### Eksperimen 7: Circuit History

Bandingkan performa model:

```text
Tanpa circuit history
Dengan driver circuit history
Dengan constructor circuit history
Dengan seluruh circuit history
```

### Eksperimen 8: Ensemble

Bandingkan:

```text
Single best model
Average ensemble
Weighted ensemble
Stacking
```

---

## 17. Struktur Folder Proyek

```text
f1-podium-prediction/
│
├── data/
│   ├── raw/
│   ├── interim/
│   ├── processed/
│   └── external/
│
├── notebooks/
│   ├── 01_data_understanding.ipynb
│   ├── 02_data_cleaning.ipynb
│   ├── 03_eda_correlation.ipynb
│   ├── 04_feature_engineering.ipynb
│   ├── 05_baseline.ipynb
│   ├── 06_classification_model.ipynb
│   ├── 07_ranking_model.ipynb
│   ├── 08_evaluation.ipynb
│   └── 09_explainability.ipynb
│
├── src/
│   ├── config.py
│   ├── data_loader.py
│   ├── preprocessing.py
│   ├── feature_engineering.py
│   ├── validation.py
│   ├── train_classifier.py
│   ├── train_ranker.py
│   ├── predict.py
│   ├── evaluate.py
│   └── explain.py
│
├── models/
│   ├── classifier/
│   ├── ranker/
│   └── ensemble/
│
├── reports/
│   ├── figures/
│   ├── metrics/
│   └── predictions/
│
├── app/
│   ├── app.py
│   └── components/
│
├── tests/
│   ├── test_preprocessing.py
│   ├── test_features.py
│   └── test_leakage.py
│
├── requirements.txt
├── README.md
└── plan_f1_podium_prediction.md
```

---

## 18. Tahapan Implementasi

## Tahap 1: Data Understanding

Tujuan:

1. Memahami setiap tabel.
2. Memetakan relasi antarfile.
3. Menentukan periode analisis.
4. Menentukan target.
5. Mengidentifikasi potensi leakage.

Output:

```text
reports/data_dictionary.md
reports/table_relationship.md
```

Checklist:

- [ ] Semua file berhasil dibaca
- [ ] Primary key dan foreign key teridentifikasi
- [ ] Jumlah race per musim diperiksa
- [ ] Missing value diperiksa
- [ ] Target podium dibuat
- [ ] Kolom leakage didokumentasikan

---

## Tahap 2: Master Dataset

Tujuan:

1. Membuat satu baris per pembalap-race.
2. Menggabungkan hasil, race, driver, constructor, circuit, dan qualifying.
3. Menjaga urutan temporal.

Output:

```text
data/interim/master_race_driver.parquet
```

Checklist:

- [ ] Tidak ada duplikasi `raceId + driverId`
- [ ] Jumlah pembalap per race masuk akal
- [ ] Target memiliki tepat tiga podium per race
- [ ] Data diurutkan berdasarkan tanggal
- [ ] Grid nol telah dikoreksi

---

## Tahap 3: EDA dan Korelasi

Tujuan:

1. Menganalisis distribusi target.
2. Menghitung korelasi fitur.
3. Mengukur AUC satu fitur.
4. Mengidentifikasi multikolinearitas.
5. Mengidentifikasi pergeseran performa antarera.

Output:

```text
notebooks/03_eda_correlation.ipynb
reports/figures/correlation_matrix.png
reports/metrics/univariate_feature_analysis.csv
```

Checklist:

- [ ] Korelasi Pearson dihitung
- [ ] Korelasi Spearman dihitung
- [ ] Mutual information dihitung
- [ ] AUC per fitur dihitung
- [ ] Leakage feature dihapus
- [ ] Korelasi antarf fitur dianalisis

---

## Tahap 4: Feature Engineering

Tujuan:

1. Membuat driver form.
2. Membuat constructor form.
3. Membuat qualifying features.
4. Membuat circuit history.
5. Membuat reliability features.
6. Membuat teammate comparison.

Output:

```text
data/processed/model_dataset.parquet
```

Checklist:

- [ ] Semua rolling feature menggunakan `shift(1)`
- [ ] Fitur klasemen menggunakan data sebelum race
- [ ] Circuit history hanya menggunakan race sebelumnya
- [ ] Missing value ditangani
- [ ] Feature dictionary dibuat
- [ ] Tes leakage dibuat

---

## Tahap 5: Baseline

Tujuan:

1. Mengukur baseline qualifying.
2. Mengukur baseline grid.
3. Mengukur baseline klasemen.
4. Membuat formula score sederhana.

Output:

```text
reports/metrics/baseline_results.csv
```

Checklist:

- [ ] Winner accuracy dihitung
- [ ] Podium hit rate dihitung
- [ ] Exact podium dihitung
- [ ] NDCG@3 dihitung
- [ ] Baseline terbaik dipilih

---

## Tahap 6: Binary Classification

Model:

```text
Logistic Regression
Random Forest
XGBoost
LightGBM
CatBoost
```

Tujuan:

1. Memprediksi probabilitas podium.
2. Memilih tiga probabilitas tertinggi per race.
3. Membandingkan model dengan baseline.

Output:

```text
models/classifier/
reports/metrics/classifier_results.csv
```

Checklist:

- [ ] Time-based split digunakan
- [ ] Class imbalance ditangani
- [ ] Hyperparameter tuning dilakukan
- [ ] Probabilitas dikalibrasi
- [ ] Prediksi top-3 dibuat per race
- [ ] Feature importance dianalisis

---

## Tahap 7: Ranking Model

Model:

```text
LightGBM Ranker
XGBoost Ranker
CatBoost Ranker
```

Tujuan:

1. Mengoptimalkan urutan pembalap dalam setiap race.
2. Mengukur NDCG@3.
3. Membandingkan ranking dengan binary classifier.

Output:

```text
models/ranker/
reports/metrics/ranker_results.csv
```

Checklist:

- [ ] Group size per race dibuat
- [ ] Relevance score dibuat
- [ ] LambdaRank diuji
- [ ] Pairwise ranking diuji
- [ ] NDCG@3 dihitung
- [ ] Prediksi P1-P3 dibuat

---

## Tahap 8: Ensemble

Tujuan:

1. Menggabungkan model terbaik.
2. Meningkatkan stabilitas prediksi.
3. Mengurangi ketergantungan pada satu model.

Output:

```text
models/ensemble/
reports/metrics/ensemble_results.csv
```

Checklist:

- [ ] Skor model dinormalisasi
- [ ] Bobot ditentukan dari validation set
- [ ] Test set tidak digunakan untuk menentukan bobot
- [ ] Ensemble dibandingkan dengan single model
- [ ] Kalibrasi diperiksa

---

## Tahap 9: Explainability

Tujuan:

1. Menjelaskan faktor global.
2. Menjelaskan prediksi per pembalap.
3. Mengidentifikasi bias model.

Output:

```text
reports/figures/shap_summary.png
reports/prediction_explanations/
```

Checklist:

- [ ] SHAP global dibuat
- [ ] SHAP per race dibuat
- [ ] Permutation importance dibuat
- [ ] Ablation study dilakukan
- [ ] Fitur leakage tidak muncul

---

## Tahap 10: Deployment

Pilihan aplikasi:

```text
Streamlit
FastAPI
Gradio
```

Fitur aplikasi:

1. Pilih musim dan race.
2. Tampilkan daftar pembalap.
3. Masukkan hasil qualifying terbaru.
4. Jalankan prediksi.
5. Tampilkan P1, P2, dan P3.
6. Tampilkan probabilitas podium.
7. Tampilkan alasan prediksi.
8. Simpan hasil prediksi.

Output:

```text
app/app.py
```

---

## 19. Desain Pipeline Prediksi

```text
Raw CSV
   ↓
Data Validation
   ↓
Relational Join
   ↓
Temporal Sorting
   ↓
Leakage-Safe Feature Engineering
   ↓
Model Dataset
   ↓
Time-Based Validation
   ↓
Classifier and Ranker
   ↓
Ensemble
   ↓
Race-Level Top-3 Selection
   ↓
P1, P2, P3 Prediction
   ↓
Explanation and Dashboard
```

---

## 20. Pseudocode Pipeline

```python
def build_dataset():
    races = load_races()
    results = load_results()
    qualifying = load_qualifying()
    standings = load_standings()
    sprint = load_sprint_results()

    df = create_driver_race_table(
        races=races,
        results=results
    )

    df = add_qualifying_features(df, qualifying)
    df = add_shifted_standings(df, standings)
    df = add_driver_rolling_features(df)
    df = add_constructor_rolling_features(df)
    df = add_circuit_history(df)
    df = add_sprint_features(df, sprint)
    df = validate_no_leakage(df)

    return df


def train_model(df):
    train, valid, test = time_based_split(df)

    classifier = train_podium_classifier(train, valid)
    ranker = train_race_ranker(train, valid)

    valid_scores = blend_predictions(
        classifier,
        ranker,
        valid
    )

    weights = optimize_blend_weights(valid_scores)

    test_predictions = predict_top_three(
        classifier=classifier,
        ranker=ranker,
        weights=weights,
        data=test
    )

    return evaluate_predictions(test_predictions)
```

---

## 21. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Data leakage | Skor terlihat tinggi tetapi tidak valid | Shift semua fitur historis dan audit kolom |
| Concept drift | Model lama tidak cocok dengan regulasi baru | Gunakan rolling training dan season weighting |
| Class imbalance | Model terlalu sering memilih non-podium | Class weighting dan ranking objective |
| Grid penalty | Grid awal berbeda dari hasil qualifying | Gunakan grid final yang tersedia sebelum race |
| Missing qualifying | Pembalap tanpa catatan waktu | Tambahkan indikator missing dan posisi efektif |
| Sprint tidak selalu tersedia | Banyak nilai kosong | Gunakan `has_sprint` dan native missing handling |
| Dominasi konstruktor | Model terlalu bergantung pada tim | Tambahkan teammate comparison dan driver features |
| Cuaca tidak tersedia | Prediksi gagal menangkap wet race | Tambahkan data cuaca eksternal pada versi lanjutan |
| Insiden acak | Hasil race sulit diprediksi | Gunakan probabilitas, bukan klaim deterministik |

---

## 22. Kriteria Keberhasilan

Model dianggap berhasil jika:

1. Mengungguli baseline qualifying top-3.
2. Meningkatkan rata-rata podium hit rate.
3. Memiliki NDCG@3 yang stabil pada beberapa musim.
4. Tidak menggunakan data setelah race dimulai.
5. Memiliki probabilitas yang cukup terkalibrasi.
6. Hasil tidak hanya bagus pada satu tim atau satu musim.
7. Penjelasan model masuk akal secara domain.

Target awal eksperimen:

```text
Podium Hit Rate > baseline qualifying
Winner Accuracy > baseline klasemen
NDCG@3 stabil pada seluruh test season
Exact Podium Drivers meningkat secara konsisten
```

Target angka final ditentukan setelah baseline dihitung secara resmi.

---

## 23. Deliverables

### Data

```text
data/interim/master_race_driver.parquet
data/processed/model_dataset.parquet
data/processed/feature_dictionary.csv
```

### Model

```text
models/classifier/best_classifier.pkl
models/ranker/best_ranker.pkl
models/ensemble/final_model.pkl
```

### Report

```text
reports/metrics/baseline_results.csv
reports/metrics/classifier_results.csv
reports/metrics/ranker_results.csv
reports/metrics/final_test_results.csv
reports/figures/
```

### Application

```text
app/app.py
```

### Documentation

```text
README.md
reports/data_dictionary.md
reports/model_card.md
reports/leakage_audit.md
```

---

## 24. Urutan Pengerjaan yang Direkomendasikan

```text
1. Audit seluruh tabel dataset
2. Buat master driver-race dataset
3. Buat target podium
4. Buat data leakage blacklist
5. Buat qualifying features
6. Buat shifted rolling features
7. Lakukan EDA dan analisis korelasi
8. Hitung baseline qualifying dan grid
9. Latih logistic regression
10. Latih LightGBM classifier
11. Latih LightGBM ranker
12. Evaluasi dengan walk-forward validation
13. Lakukan feature ablation
14. Buat ensemble
15. Kalibrasi probabilitas
16. Buat SHAP explanation
17. Buat aplikasi prediksi
18. Dokumentasikan model dan keterbatasannya
```

---

## 25. Prioritas MVP

Versi MVP cukup menggunakan:

### Data

```text
results
races
qualifying
drivers
constructors
driver standings
constructor standings
```

### Fitur

```text
qual_position
grid_effective
driver_points_avg_5
driver_finish_avg_5
driver_podium_rate_10
driver_dnf_rate_5
team_points_avg_5
team_podium_rate_10
driver_prev_standing_position
constructor_prev_standing_position
```

### Model

```text
Logistic Regression
LightGBM Classifier
LightGBM Ranker
```

### Evaluasi

```text
Podium Hit Rate
Exact Podium Drivers
Exact Ordered Podium
Winner Accuracy
NDCG@3
```

Setelah MVP stabil, fitur circuit history, sprint, teammate comparison, cuaca, dan strategi dapat ditambahkan secara bertahap.

---

## 26. Pengembangan Lanjutan

Setelah model utama selesai, proyek dapat dikembangkan menjadi:

1. Prediksi sebelum qualifying.
2. Prediksi fastest lap.
3. Prediksi DNF.
4. Prediksi head-to-head antarpembalap.
5. Prediksi constructor points.
6. Prediksi championship standings.
7. Simulasi Monte Carlo hasil race.
8. Prediksi dengan data cuaca.
9. Prediksi strategi pit stop.
10. Live race probability update.

---

## 27. Kesimpulan

Pendekatan utama proyek adalah membangun **race-level ranking system** yang mengurutkan seluruh pembalap dalam satu balapan.

Tahapan paling penting adalah:

1. Menjamin seluruh fitur bebas data leakage.
2. Menggunakan validasi berdasarkan waktu.
3. Membandingkan model dengan baseline qualifying.
4. Menggabungkan qualifying, driver form, constructor strength, standings, reliability, dan circuit history.
5. Mengevaluasi hasil pada level race, bukan hanya pada level baris.
6. Menggunakan ranking model untuk menghasilkan urutan P1, P2, dan P3 yang konsisten.

Model MVP dimulai dari binary podium classifier. Setelah baseline stabil, sistem ditingkatkan menggunakan learning to rank dan ensemble.
