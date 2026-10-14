# Changelog

## 2.0.0 — 2026-10-14

### Added

- Dashboard responsif, tema terang/gelap, tampilan ringkas, status koneksi, dan kontrol jeda.
- Riwayat dengan pencarian, filter besar/kecil, pilihan jumlah hasil, serta ekspor CSV sesuai filter.
- Grafik frekuensi lokal yang dapat diakses tanpa CDN dan ringkasan statistik.
- Endpoint `/api/history`, timeout, validasi respons, serta pesan error aman.
- Sesi per tab yang bertahan saat reload, migrasi riwayat lama, dan pemberitahuan penyimpanan gagal.
- Server pengembangan, build statis terpilah, pengujian unit/browser/aksesibilitas, dan CI.

### Fixed

- Koneksi awal gagal kini dicoba ulang; polling tidak bertumpuk dan berhenti saat tab tidak aktif.
- Hasil dicocokkan menggunakan ID periode lengkap, bukan lima digit terakhir.
- Nomor periode tidak lagi dinaikkan berdasarkan jam perangkat.
- Total WIN/LOSE dan saldo tidak berubah akibat pemangkasan baris tampilan.
- Data invalid tidak ditampilkan sebagai hasil; periode tanpa hasil ditandai terlewat.

### Changed

- JavaScript dan CSS dipisah menjadi modul; Node.js 24 menjadi runtime proyek.
- Situs eksternal dimuat hanya saat pengguna membuka panelnya.
- CORS wildcard dihapus; frontend memakai API satu origin.
- Header keamanan diterapkan dan hanya aset publik yang masuk output build.

### Migration

- Jalankan `npm ci`, lalu gunakan Node.js 24 dan konfigurasi Vercel dari repositori.
- Riwayat valid `five55_history_v1` dibaca otomatis; sumber lama tidak dihapus.
- Scorecard lama tidak dapat dipulihkan karena implementasi sebelumnya hanya menyimpannya di DOM.
- UI memberi label eksplisit bahwa prediksi adalah simulasi acak dan saldo berupa poin virtual.
