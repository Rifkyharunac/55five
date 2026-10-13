# data/riwayat.json

Snapshot hasil **Win Go 30s** (55five) yang dikumpulkan untuk studi pola 8–15 Okt 2026.

- **Jumlah:** 922 ronde unik (rentang periode `20261008100050772` → `20261013100051429`)
- **Sumber:** observasi hasil via API aplikasi ini sendiri (sampel ±10 ronde/jam; situs resmi 55five diblokir Cloudflare)
- **Format:** array JSON `[{ "p": "<periode penuh>", "h": <angka 0–9> }]` — sama dengan format riwayat `localStorage` di aplikasi
- **Status: DATA SEMENTARA** — diganti versi final pada **15 Okt 2026** (cukup timpa satu file ini, tanpa ubah kode lain)

Dipakai aplikasi untuk:
1. Mengisi tab **Statistik** saat pertama dibuka (tanpa menunggu riwayat menumpuk).
2. Baseline prediksi **berbasis riwayat** (mayoritas 30 ronde terakhir) pengganti `Math.random()`.
   Akurasi riilnya tetap tampil transparan di scorecard sesi — tiap ronde tetap acak & independen.
