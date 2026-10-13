# 55FIVE — Panel Prediksi WinGo 30s

Panel web untuk memantau hasil Win Go 30s: prediksi per periode, scorecard sesi
transparan (WIN/LOSE/akurasi + saldo demo virtual), dan tab Statistik deskriptif
(frekuensi angka 0–9, rasio Besar/Kecil, streak, distribusi warna).

## Struktur

- `index.html` — seluruh frontend (satu file).
- `api/index.js` — serverless function (Vercel): mengambil periode & hasil terbaru
  dari backend 55five. **Jangan diubah strukturnya** — dipakai juga oleh pengumpul
  data studi pola (`GET /api/`).
- `data/riwayat.json` — snapshot riwayat hasil (lihat `data/README.md`).
  **Data sementara**, diganti versi final pada 15 Okt 2026.

## Cara kerja prediksi

`buatPrediksi()` memakai strategi **pola mirip riwayat**: 6 ronde terakhir
diambil sebagai pola (urutan Besar/Kecil), lalu aplikasi mencari segmen-segmen
riwayat lama yang polanya persis sama dan mengikuti hasil mayoritas dari
"ronde sesudah segmen-segmen itu". Jika kecocokan kurang dari 3 atau hasilnya
seri, dipakai fallback baseline mayoritas 30 ronde terakhir.

Hasil backtest walk-forward strategi ini pada 922 ronde (8–13 Okt 2026):
**akurasi 51,95%** — secara statistik tidak berbeda dari lempar koin, sesuai
sifat tiap ronde WinGo yang acak dan independen. Jadi strategi ini adalah
eksperimen berbasis data riil, bukan cara meminimalisir kekalahan. Akurasi
riilnya tampil apa adanya di scorecard sesi; statistik bersifat deskriptif,
bukan ramalan. Skrip backtest: `backtest-pola.js`
(`node backtest-pola.js data/riwayat.json`).

## Deploy

Auto-deploy ke Vercel dari branch `main`. File statis (`data/riwayat.json`)
ikut ter-deploy apa adanya.
