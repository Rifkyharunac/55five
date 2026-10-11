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

## Pembaruan fase data awal: estimasi terpisah dari sinyal

Pada screenshot pengguna terdapat 47 hasil. Aturan sebelumnya memang belum bisa menguji satu target: dibutuhkan 100 hasil awal sebelum evaluasi dimulai, lalu minimal 100 target uji valid. Tidak ada bukti bahwa menurunkan batas untuk menghilangkan tulisan Lewati akan meningkatkan akurasi.

Perubahan terbaru merekam estimasi eksperimen mulai 10 hasil, asalkan hasil periode tepat sebelumnya tersedia. Bila konteks transisi memiliki kurang dari 20 contoh, estimasi memakai frekuensi sederhana dengan perataan; setelah itu memakai kandidat transisi. Skor tepat 0,5 ditampilkan Seimbang. Estimasi belum terbukti berguna untuk hasil permainan ini; dapat terus memilih kategori yang sama dan dapat salah. Sinyal lolos filter mempertahankan seluruh aturan versi 2.

Kolom Estimasi sementara dan Sinyal dipisahkan. Estimasi yang belum lolos dinilai Cocok (estimasi)/Meleset (estimasi), bukan WIN/LOSE sinyal. Seluruh estimasi terselesaikan dengan arah yang tercatat sebelum hasil dihitung, termasuk yang tidak lolos filter. Riwayat lama tidak diisi estimasi secara retrospektif. Refresh mempertahankan keputusan yang sudah dibuat.

Kemajuan menampilkan jumlah pelatihan dan target uji. Dengan 47 hasil/0 target uji, kekurangan minimum 153 hasil. Ini batas bawah, bukan janji selesai atau sinyal pasti muncul. Pengumpulan masih bergantung pada halaman tersambung. Belum ditemukan dokumentasi resmi penyedia mengenai pengambilan arsip yang lebih panjang; API dan pasangan signature yang telah bekerja dipertahankan.

### Referensi tambahan yang ditinjau

- NIST/SEMATECH, 7.2.4.1 Confidence intervals: https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm
  Diterapkan interval Wilson 95% untuk proporsi estimasi benar. Untuk 3/7, rentangnya sekitar 15,8–75,0%, bukan hanya angka tunggal 42,9%. Formula memakai z=1,959963984540054. Asumsi Bernoulli independen dengan probabilitas tetap belum diverifikasi pada hasil ini; interval hanya diagnostik, tidak dipakai membuka gate dan tidak berarti peluang menang periode berikutnya.
- Hyndman & Athanasopoulos, FPP3 5.2 Some simple forecasting methods: https://otexts.com/fpp3/simple-methods.html
  Model sederhana berfungsi sebagai pembanding penting. Pendekatan mean digunakan pada indikator biner (dengan perataan yang merupakan pilihan implementasi) untuk estimasi awal; bukan klaim pola ekonomi atau random walk berlaku pada permainan.
- scikit-learn, Validation/learning curves: https://scikit-learn.org/stable/modules/learning_curve.html
  Lebih banyak data tidak otomatis membuat model berguna; skor yang dioptimasi pada validation set juga bisa bias. Karena itu jumlah data minimum dan kelulusan kualitas tetap dipisah. Tampilan progress bukan learning curve; tidak ada optimasi parameter baru atau klaim kalibrasi yang dilakukan.

Ini merupakan peninjauan referensi utama yang relevan, bukan klaim mencakup seluruh publikasi atau semua metode. Model tetap sederhana dan diuji berurutan; menambahkan banyak algoritma tanpa data evaluasi independen tidak membuktikan keunggulan.

### Validasi tambahan

30 uji logika/API lulus. Kasus baru meliputi estimasi pada 47 hasil tanpa lolos gate, target/masa depan tidak memengaruhi keputusan, data kurang/seimbang/terputus, rentang Wilson 3/7 dan ekstrem, perhitungan estimasi yang meleset, penyimpanan serta tidak adanya pengisian riwayat secara retrospektif.

Uji browser lulus untuk estimasi data awal, pemisahan statistik, refresh, gangguan koneksi, sinyal pola buatan yang lolos, dan tampilan ponsel tanpa error JavaScript. Belum ada bukti peningkatan akurasi pada data nyata.
