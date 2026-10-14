# data/riwayat.json

Riwayat hasil **Win Go 30s** (55five). Awalnya snapshot studi pola 8–15 Okt 2026,
kini **diperbarui otomatis** oleh GitHub Actions
(`.github/workflows/update-riwayat.yml`, tiap 30 menit) — tanpa perlu membuka web.

- **Jumlah:** bertambah otomatis (1.123 ronde unik per 14 Okt 2026, 8–14 Okt 2026)
- **Sumber:** backend 55five langsung (tiap run menangkap 10 ronde terbaru —
  backend hanya mengembalikan itu; jadi file ini sampel segar, bukan semua ronde)
- **Format:** array JSON compact `[{ "p": "<periode penuh>", "h": <angka 0–9> }]` — sama dengan format riwayat `localStorage` di aplikasi
- **Status:** data live yang terus diperbarui; tidak perlu lagi ditimpa manual
  pada 15 Okt 2026 (dataset studi terpisah tetap dipakai untuk laporan final)

Dipakai aplikasi untuk:
1. Mengisi tab **Statistik** saat pertama dibuka (tanpa menunggu riwayat menumpuk).
2. Baseline prediksi **berbasis riwayat** (strategi pola mirip riwayat +
   fallback mayoritas 30 ronde terakhir) pengganti `Math.random()`.
   Akurasi riilnya tetap tampil transparan di scorecard sesi — tiap ronde tetap acak & independen.
