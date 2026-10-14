# Verifikasi pembaruan 2.0.0

Pemeriksaan lokal selesai pada 15 Oktober 2026. Ini bukan pernyataan deployment produksi.

- `npm test`: 33 tes lulus; kontrak provider, timeout, data rusak, rollover, pencocokan ID lengkap, penyimpanan, polling, metode, backtest, arsip lebih dari 500 hasil, dan CSV.
- `npm run test:e2e` dengan `E2E_PORT=3100`: 12 tes Chromium lulus. Meliputi pemulihan koneksi, countdown, reload, filter/CSV, tema, keyboard, reset, offline, storage gagal, panel eksternal, arsip dan worker.
- Axe: kelima tab pada tema gelap dan terang; tidak ditemukan pelanggaran pada pemeriksaan otomatis tersebut.
- Responsif: kelima tab diuji pada 320, 768, 1024, dan 1440px tanpa overflow halaman; screenshot desktop dan ponsel ditinjau.
- `npm run check`, `npm run build`, `npm run format:check`, dan `git diff --check`: lulus.
- Mutation check: membalik kondisi pencocokan hasil menyebabkan tes regresi gagal; perubahan sengaja tersebut telah dikembalikan.
- Smoke test provider asli: `/api/`, `/api/history`, dan arsip mengembalikan HTTP 200; browser menampilkan status Terhubung, 1.173 sampel gabungan, backtest selesai, dan tanpa page error.
- Pembatasan aset lokal: `/.env` dan `/server/provider.js` mengembalikan 404; header CSP tersedia.

## Batas verifikasi

### Integrasi konflik PR #4

Perubahan `main` hingga `d08db24` diintegrasikan, termasuk arsip terbaru dan penyegaran arsip setiap 30 menit dari PR #5. Tes browser tambahan memverifikasi penyegaran berkala, retensi data saat gagal, dan pemulihan pemberitahuan. Pemulihan startup tetap menggunakan polling dengan backoff yang sudah diuji.

Provider eksternal dan tanda tangannya dapat berubah. Override JSON tervalidasi tersedia; signature baru tidak direkayasa. Arsip historis memiliki jeda, sehingga indikator menjelaskan sampel tersimpan dan tidak menjanjikan akurasi. CI dan workflow pengumpul disiapkan; keberhasilan eksekusi GitHub serta deployment Vercel harus dinilai dari run masing-masing. Pengujian browser lokal memakai Chromium, bukan seluruh browser/perangkat.
