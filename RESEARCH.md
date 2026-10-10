# Dasar metode prediksi versi 2

## Referensi dan penerapannya

1. Hyndman & Athanasopoulos, *Forecasting: Principles and Practice*, 5.10, Time series cross-validation: https://otexts.com/fpp3/tscv.html
   Setiap target diuji menggunakan data yang terjadi sebelumnya. Implementasi `walkForward` melatih pada 100 hasil sebelumnya lalu menilai satu hasil berikutnya; urutan tidak diacak. Hasil target dan masa depan tidak boleh masuk pelatihan.
2. Dokumentasi resmi scikit-learn, DummyClassifier: https://scikit-learn.org/stable/modules/generated/sklearn.dummy.DummyClassifier.html
   Model kompleks harus dibandingkan dengan pembanding sederhana. Di sini pembanding memakai frekuensi Besar dari jendela pelatihan yang sama, dengan perataan (jumlah Besar+1)/(N+2). Pembanding netral memakai probabilitas 0,5 (Brier 0,25 untuk hasil biner).
3. Dokumentasi resmi scikit-learn, Probability calibration: https://scikit-learn.org/stable/modules/calibration.html
   Brier score adalah rata-rata (perkiraan probabilitas Besar - hasil biner)^2. Skor yang lebih rendah lebih baik untuk kesalahan probabilitas, tetapi tidak membuktikan kalibrasi dengan sendirinya. Karena itu angka model tidak disebut peluang menang atau confidence teruji.
4. UK Gambling Commission, RTS 7, Generation of random outcomes: https://www.gamblingcommission.gov.uk/standards/remote-gambling-and-software-technical-standards/rts-7-generation-of-random-outcomes
   Standar ini mengharuskan hasil RNG tidak dapat diprediksi. Referensi ini menjelaskan batas umum prediksi permainan acak, bukan bukti bahwa 55five tunduk pada standar tersebut atau bahwa sumber datanya telah diaudit.

## Model eksperimen, bukan metode kemenangan dari referensi

Model transisi orde pertama membandingkan apa yang terjadi setelah kategori terakhir (Besar/Kecil). Hanya pasangan ID periode berurutan dalam tanggal yang sama dihitung. Periode terlewat dan pergantian hari tidak dianggap pasangan berurutan. Model tidak berasumsi bahwa rentetan hasil harus berbalik.

Probabilitas model = (jumlah transisi ke Besar + 20 × frekuensi pembanding)/(jumlah transisi + 20). Ini mengurangi pengaruh kelompok kecil. Model, angka 20, dan batas berikut adalah pilihan desain tetap untuk eksperimen aplikasi, bukan rekomendasi khusus permainan dari referensi dan bukan hasil optimasi terhadap tujuh hasil pengguna.

## Aturan mengeluarkan sinyal

- Pelatihan: 100 hasil valid sebelum target; minimal 20 transisi dengan konteks kategori yang sama.
- Evaluasi: minimal 100 target valid dari maksimal 200 target historis terbaru. Masing-masing memakai jendela pelatihan sebelumnya. Minimum praktis 200 hasil tersimpan; celah/invaliditas dapat membuat kebutuhan lebih besar.
- Rata-rata Brier harus lebih baik dari pembanding frekuensi dan 0,25 dengan selisih lebih dari 0,01.
- Akurasi klasifikasi kandidat setidaknya 55% dan minimal 3 poin persentase lebih baik dari pembanding frekuensi pada target yang sama.
- Pada 50 target uji terakhir, Brier juga harus lebih baik dari kedua pembanding untuk menahan kinerja yang melemah.
- Skor model untuk target sekarang harus berjarak minimal 0,10 dari 0,50.
- Jika salah satu syarat gagal: Lewati, dengan alasan. Keputusan dikunci pada awal pencatatan periode; penambahan hasil tidak mengubah keputusan yang sudah ada.

Filter ini bukan uji signifikansi, bukan interval kepercayaan, dan bukan jaminan keuntungan. Evaluasi diulang pada jendela bergeser sehingga ketergantungan antarhasil dan pemeriksaan berulang dapat menghasilkan sinyal kebetulan. Tidak ada penyesuaian payout atau klaim profitabilitas. Kandidat historis dievaluasi sebelum filter: skor historis tidak boleh dianggap akurasi keseluruhan kebijakan sinyal yang dilewati.

## Statistik dan data

Akurasi sinyal versi 2 hanya menghitung keputusan versi 2 yang benar-benar dibuat sebelum hasil tersedia, sudah terselesaikan, dan tidak dilewati. Jumlah periode yang dilewati ditampilkan agar pengurangan sinyal tidak menyembunyikan cakupan. Keputusan metode lama tetap ditampilkan dengan label lama dan tidak dicampur dengan statistik versi baru.

Riwayat analisis menyimpan maksimal 1.000 hasil, keputusan maksimal 200, tabel 30 baris. Endpoint sumber tetap meminta 10 hasil terakhir sesuai kontrak yang sudah bekerja. Data bertambah ketika halaman mengambil hasil; tanpa arsip server tidak ada jaminan melengkapi periode yang terlewat saat browser ditutup. Tidak ada riwayat buatan atau perubahan signature upstream berdasarkan dugaan.

## Validasi perubahan

22 uji unit/integrasi lulus: mencakup pengujian lama dan kasus data sedikit, baseline konstan, pola transisi buatan, tidak ada kebocoran target/masa depan, periode terlewat, pola tanpa sinyal orde pertama, data acak buatan dengan seed tetap, penyimpanan rusak, dan kompatibilitas keputusan lama.

Uji browser Edge terisolasi lulus: data sedikit ditandai Lewati tanpa menambah kemenangan, pola buatan yang memenuhi syarat menghasilkan sinyal, hasil live terpisah dari evaluasi historis, refresh/pemulihan koneksi/countdown tetap berjalan, layout ponsel tanpa error JavaScript.

Data buatan dipakai menguji perilaku kode, bukan membuktikan performa prediksi 55five. Belum ada evaluasi independen pada arsip panjang data nyata; perbaikan ini tidak mengklaim menaikkan akurasi nyata.
