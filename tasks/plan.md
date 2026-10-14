# Rencana implementasi

Persetujuan: pengguna meminta langsung mengerjakan cakupan pembaruan pada 14 Oktober 2026.

1. data-api: pertahankan kontrak GET /api, tambahkan GET /api/history; validasi digit dan ID, timeout, metadata waktu, error aman. Payload signature lama tetap utuh karena permintaan aktual berhasil dan dokumentasi penandatanganan belum tersedia.
2. session-engine: fungsi murni untuk normalisasi, pencocokan ID lengkap, scorecard kumulatif; sesi per tab di sessionStorage dan riwayat perangkat di localStorage. Poll berurutan dengan backoff dan visibility handling.
3. analytics-history: statistik deskriptif, filter dan ekspor CSV memakai riwayat yang sama, migrasi kunci five55_history_v1 tanpa menghapus data sumber.
4. dashboard-ui: dashboard gelap dengan aksen mint dari desain lama, kolom utama dan sidebar konteks pada desktop; tumpukan pada ponsel; tema terang/gelap, keyboard, status koneksi, kontrol sesi dan tampilan situs eksternal opsional.
5. delivery-quality: Node test runner, Playwright + axe untuk alur utama dan aksesibilitas, server dev lokal, output statis terpilah, CI dan panduan Vercel.

Tidak ada dependensi runtime. Alat pengembangan: Playwright, axe, dan Prettier. API penyedia tidak disimulasikan dalam mode produksi; mock hanya dipakai pada pengujian. Urutan dan temuan modul dirujuk di CAPABILITY-MAP.md.

Integrasi main terbaru mempertahankan pola-6 dan fallback mayoritas, arsip historis, pengumpul terjadwal, serta backtest CLI. UI menambahkan Pola dan Edukasi dengan backtest worker, sehingga pekerjaan berat tidak menghambat interaksi dashboard.

## Kontrak desain

Layar membantu membaca periode aktif, hasil terbaru, dan ringkasan simulasi dengan cepat. Aksi utama: perbarui data; aksi pendukung: saring/ekspor riwayat. Warna meneruskan panel awal: navy, mint, merah lembut. Tidak ada klaim akurasi prediktif. Grafik memakai HTML/CSS lokal dengan nilai teks, tanpa ketergantungan CDN. Kontrol minimal 44px; satu h1; loading/kosong/error/offline dan reduced motion tersedia. Konten tetap terbaca pada 320, 768, 1024, dan 1440px.

## Verifikasi

`npm test` untuk kontrak data dan regresi; `npm run check` untuk sintaks; `npm run build` untuk aset statis; `npm run test:e2e` untuk browser desktop/mobile, alur kegagalan-pemulihan, penyimpanan dan ekspor. API aktual diperiksa terpisah dari tes deterministik. Tidak mengubah signature secara spekulatif.
