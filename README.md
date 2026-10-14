# 55FIVE — Panel Prediksi WinGo 30s

Panel web untuk memantau hasil Win Go 30s: prediksi per periode (dengan label
metode transparan + kinerja per metode), scorecard sesi (WIN/LOSE/akurasi +
saldo demo virtual), tab Statistik deskriptif (rentang Semua/500/100 ronde,
frekuensi angka 0–9, rasio Besar/Kecil, streak, distribusi warna, 30 ronde
terakhir), tab Pola (indikator bentuk pola deskriptif: streak, dragon, ABAB —
bukan sinyal), dan tab Edukasi (payout, house edge, kenapa tak ada prediksi 80%).

## Struktur

- `index.html` — seluruh frontend (satu file).
- `api/index.js` — serverless function (Vercel): mengambil periode & hasil terbaru
  dari backend 55five. **Jangan diubah strukturnya** — dipakai juga oleh pengumpul
  data studi pola (`GET /api/`).
- `data/riwayat.json` — riwayat hasil (lihat `data/README.md`),
  diperbarui otomatis tiap 30 menit oleh GitHub Actions
  (`.github/workflows/update-riwayat.yml`).

## Cara kerja prediksi

`buatPrediksi()` memakai strategi **pola mirip riwayat**: 6 ronde terakhir
diambil sebagai pola (urutan Besar/Kecil), lalu aplikasi mencari segmen-segmen
riwayat lama yang polanya persis sama dan mengikuti hasil mayoritas dari
"ronde sesudah segmen-segmen itu". Jika kecocokan kurang dari 3 atau hasilnya
seri, dipakai fallback baseline mayoritas 30 ronde terakhir.

Hasil backtest walk-forward **multi-strategi** pada 1.123 ronde (8–14 Okt 2026):
pola-6 **51,22%**, ikut-streak 49,95%, acak 49,46%, mayoritas-30 47,21% —
semuanya sekitar lempar koin, sesuai sifat tiap ronde WinGo yang acak dan
independen. Jadi strategi-strategi ini adalah eksperimen berbasis data riil,
bukan cara meminimalisir kekalahan. Akurasi riilnya tampil apa adanya di
scorecard sesi dan tabel kinerja per metode; statistik bersifat deskriptif,
bukan ramalan. Skrip backtest: `backtest-pola.js`
(`node backtest-pola.js data/riwayat.json`).

Setiap baris prediksi menampilkan label kecil metodenya (`pola-6`,
`mayoritas-30`, `mayoritas-all`, `acak`) — lihat legenda di bawah tabel.
Penilaian WIN/LOSE memakai nilai prediksi murni (label tidak ikut dihitung).

## Deploy

Auto-deploy ke Vercel dari branch `main`. File statis (`data/riwayat.json`)
ikut ter-deploy apa adanya.
