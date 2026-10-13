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

`buatPrediksi()` memakai **baseline berbasis riwayat**: kategori mayoritas dari
30 ronde terakhir (seri → mayoritas seluruh riwayat). Ini baseline naive —
tiap ronde WinGo tetap acak dan independen. Akurasi riilnya tampil apa adanya
di scorecard sesi; statistik bersifat deskriptif, bukan ramalan.

## Deploy

Auto-deploy ke Vercel dari branch `main`. File statis (`data/riwayat.json`)
ikut ter-deploy apa adanya.
