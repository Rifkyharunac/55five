# Arsip hasil 55FIVE

`riwayat.json` berisi hasil observasi dalam format JSON compact `[{"p":"<ID lengkap>","h":0}]`, diurutkan kronologis. Angka hasil harus bilangan bulat 0–9 dan ID disimpan sebagai teks.

Dataset awal berasal dari studi pada Oktober 2026 dan terus diperbarui oleh `.github/workflows/update-riwayat.yml` setiap 30 menit. Setiap pengambilan mendapat sekitar 10 hasil terbaru: arsip adalah **sampel dengan celah**, bukan rekaman lengkap setiap ronde. Jumlah dan rentang aktual dapat diperiksa langsung dari file; tidak ada jumlah tetap yang dijanjikan.

Frontend memuat arsip ini ke memori untuk statistik, pola, metode simulasi, dan backtest. Riwayat browser dibatasi 500 hasil dan digabung tanpa duplikasi dengan arsip; kunci browser lama tetap dipertahankan. Data yang tidak valid tidak masuk perhitungan.

Jalankan `node backtest-pola.js data/riwayat.json` untuk perbandingan walk-forward yang dapat diulang. Hasil backtest adalah evaluasi sampel historis, bukan jaminan ronde mendatang.
