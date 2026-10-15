# Changelog

## 2.0.0 — Belum dirilis

### Added

- Dashboard responsif, tema terang/gelap, tampilan ringkas, status koneksi, dan kontrol jeda.
- Riwayat dengan pencarian, filter besar/kecil, pilihan jumlah hasil, serta ekspor CSV sesuai filter.
- Grafik frekuensi lokal yang dapat diakses tanpa CDN dan ringkasan statistik.
- Endpoint `/api/history`, timeout, validasi respons, serta pesan error aman.
- Sesi per tab yang bertahan saat reload, migrasi riwayat lama, dan pemberitahuan penyimpanan gagal.
- Server pengembangan, build statis terpilah, pengujian unit/browser/aksesibilitas, dan CI.
- Tab Pola dan Edukasi, backtest deterministik di worker, serta perbandingan empat metode.
- Arsip upstream digabung dengan hasil live; pencarian, statistik, dan CSV mendukung seluruh arsip.

### Fixed

- Pola-6 tidak lagi menyambung periode arsip yang hilang, memakai hasil lama untuk target yang terputus, atau menghitung contoh bertumpuk sebagai dukungan terpisah.
- Mayoritas seri/kosong abstain; tidak otomatis memilih Besar. Prediksi yang sudah dicatat dan hasil sesi lama tidak ditulis ulang.
- Backtest memakai fungsi empat metode yang sama dengan simulator dan menampilkan jumlah abstain; hasil pola tidak lagi diganti diam-diam oleh mayoritas.

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
- Metode pola-6 dan fallback dari main dipertahankan, dengan penghitung per metode dan pencegahan penggunaan hasil masa depan.
- Simulator sesi kini menilai keempat metode (pola-6, mayoritas-30, mayoritas-all, acak) di setiap periode secara paralel; metode tanpa sinyal abstain dan tidak dihitung. "Ronde selesai" menghitung periode yang dinilai, sedangkan WIN/LOSE menghitung seluruh taruhan metode. Format sesi lama (v2) tidak dapat dipulihkan dan sesi dimulai baru.
- Pengumpul arsip terjadwal memakai validasi yang sama dengan API, deduplikasi, dan penulisan atomik.

### Migration

- Jalankan `npm ci`, lalu gunakan Node.js 24 dan konfigurasi Vercel dari repositori.
- Riwayat valid `five55_history_v1` dibaca otomatis; sumber lama tidak dihapus.
- Scorecard lama tidak dapat dipulihkan karena implementasi sebelumnya hanya menyimpannya di DOM.
- UI memberi label eksplisit bahwa prediksi adalah simulasi metode dan saldo berupa poin virtual.
