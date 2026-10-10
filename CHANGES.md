# Perbaikan panel prediksi 55five

Panel memakai ID periode lengkap dari server. Nomor periode tidak pernah ditambah berdasarkan jam perangkat. Hasil hanya menyelesaikan baris dengan ID identik dan angka 0–9 yang valid.

Prediksi merupakan eksperimen frekuensi: maksimal 100 hasil unik sebelum periode target, minimal 10 hasil, perataan Laplace (jumlah Besar + 1)/(jumlah sampel + 2). Frekuensi seimbang atau data kurang menghasilkan Lewati. Prediksi dikunci saat periode pertama diterima. Metode ini belum terbukti mengungguli tebakan acak dan tidak menjamin kemenangan.

Akurasi adalah WIN/jumlah prediksi yang sudah selesai dan tidak dilewati, dari maksimal 200 baris lokal. Ini bukan backtest atau akurasi populasi. Hasil setelah penutupan browser bisa tidak tersedia bila sudah keluar dari 10 hasil terakhir sumber API. Baris seperti itu tetap menunggu, tidak dianggap LOSE. Penyimpanan hanya berlaku di browser ini, bukan sinkronisasi antarperangkat/tab.

Countdown memakai selisih endTime/serviceTime dari sumber yang sama, dikurangi waktu permintaan secara konservatif. Saat waktu habis, data gagal, atau periode mundur, prediksi baru ditunda hingga server tersinkron. Request memiliki timeout dan percobaan ulang dengan jeda 2–30 detik; tidak ada request paralel dari satu halaman.

## Menjalankan pengujian

- Node.js 22 atau lebih baru: `npm test` (tanpa dependensi tambahan).
- Browser: pasang Playwright di lingkungan pengembangan, lalu `node tests/browser.mjs`. Uji memakai Microsoft Edge terisolasi, server localhost sementara, respons API buatan, dan iframe eksternal yang diisolasi. Uji ini tidak melakukan taruhan.
- Integrasi sumber asli diperiksa terpisah dengan memanggil handler API; respons valid berhasil diterima saat pengerjaan.

## Batas integrasi

Sumber eksternal menggunakan pasangan request/signature yang sudah bekerja dalam versi GitHub. Belum ada dokumentasi autentikasi resmi di repositori; tanda tangan tidak dihitung ulang berdasarkan dugaan. Jika kontrak atau masa berlaku berubah, API mengembalikan 502 dan panel menunda prediksi. API hanya mengambil data periode dan hasil, tanpa akun atau transaksi taruhan.

Vercel mendeteksi fungsi Node.js di folder api. Konfigurasi runtime lama diganti dengan maxDuration 15 detik. Referensi: https://vercel.com/docs/functions/runtimes/node-js

## Validasi yang dijalankan

13 uji otomatis: validasi angka dan ID, duplikasi/konflik hasil, riwayat sebelum target, prediksi tetap, pencocokan hasil terlambat, pergantian hari, respons lama, penyimpanan rusak, countdown, dan kegagalan upstream.

Uji browser: kegagalan awal pulih otomatis, jam perangkat salah, reload tanpa duplikasi, hasil cocok pada pergantian hari, penghentian countdown saat offline, retry tidak bertumpuk, tampilan ponsel, tanpa error JavaScript.
