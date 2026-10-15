# 55FIVE

Dashboard berbahasa Indonesia untuk memantau periode WinGo 30 detik, melihat riwayat, membaca statistik deskriptif, dan menjalankan **simulasi metode historis** besar/kecil. Prediksi tidak menjamin hasil. Saldo berupa poin virtual, bukan uang atau saldo akun eksternal.

## Menjalankan lokal

Prasyarat: **Node.js 24.x** dan npm.

```sh
npm ci
npm run dev
```

Buka `http://127.0.0.1:3000`. Server lokal melayani frontend dan endpoint API yang sama dengan Vercel. Tidak ada dependensi runtime frontend dan tidak ada CDN grafik.

Konfigurasi opsional: salin `.env.example` ke `.env`. Jika file tidak ada, aplikasi memakai konfigurasi bawaan. Jangan commit `.env` atau payload akses privat.

## Fitur

- Periode dikonfirmasi API dengan ID lengkap; hitung mundur berasal dari selisih waktu server penyedia.
- Simulasi dibuat hanya jika waktu tersisa terkonfirmasi lebih dari 3 detik. Metode pola-6, mayoritas-30, mayoritas-all, atau acak ditampilkan pada setiap baris; riwayat prediksi tidak dibuat retroaktif.
- Scorecard kumulatif tetap benar setelah lebih dari 30 baris. Tabel menampilkan 30 catatan terbaru; hingga 500 catatan disimpan dalam sesi.
- Riwayat perangkat hingga 500 hasil digabung dengan arsip proyek, dilengkapi filter kategori/pencarian dan CSV sesuai filter, termasuk seluruh arsip.
- Frekuensi digit, besar/kecil, distribusi warna, pola streak/dragon/ABAB, edukasi, serta backtest walk-forward empat strategi.
- Tema terang/gelap, mode ringkas, navigasi keyboard, dan status koneksi yang eksplisit.
- Pemulihan koneksi otomatis, jeda manual, serta penghentian polling saat tab tidak aktif.
- Situs eksternal dimuat hanya saat tombol panel dipilih. Tombol tab terpisah tetap tersedia jika situs menolak iframe.

## Perilaku data

Riwayat hasil disimpan dalam `localStorage` (`five55_history_v2`), maksimal 500 hasil unik. Format lama `five55_history_v1` dibaca dan digabung; sumber lama tidak dihapus. Data invalid dibuang dari pembacaan. Arsip `data/riwayat.json` dimuat terpisah ke memori dan digabung untuk analisis. Dataset ini juga bukan arsip lengkap: kolektor mengambil sekitar 10 hasil tiap 30 menit sehingga terdapat celah. Kegagalan memuat arsip tidak menghentikan data langsung.

Simulasi dan total sesi disimpan di `sessionStorage` (`five55_session_v2`). Setiap tab memiliki sesi sendiri; reload mempertahankan sesi, penutupan tab dapat mengakhirinya. Browser dapat menyalin sesi awal saat tab diduplikasi, lalu kedua tab berjalan independen. Tidak ada akun, database, atau sinkronisasi lintas perangkat.

Saldo awal 1.000 poin; WIN menambah 10, LOSE mengurangi 10. Saldo dapat negatif karena ini perhitungan simulasi. Hasil yang tidak lagi tersedia ditandai **Terlewat** dan tidak masuk akurasi. Reset sesi membutuhkan konfirmasi dan tidak menghapus riwayat hasil.

Akurasi = WIN / (WIN + LOSE). Rangkaian statistik adalah urutan hasil yang tersimpan, yang dapat memiliki celah ketika aplikasi tidak aktif. Warna mengikuti aturan UI sebelumnya: ganjil hijau, genap merah, 0 dan 5 juga ungu; total warna dapat melebihi jumlah ronde.

CSV menggunakan UTF-8 dengan BOM dan ID periode lengkap. Saat membuka melalui Excel, impor kolom **Periode** sebagai teks untuk mempertahankan angka panjang tanpa pembulatan.

## API

### `GET /api`

Mengembalikan periode aktif dan hasil terakhir. Field kompatibilitas lama (`periode`, `issue`, `hasil`, `number`, `list`) tetap tersedia, ditambah metadata:

```json
{
  "issue": "20261014100050002",
  "periode": "50002",
  "hasil": 9,
  "number": "9",
  "list": [{ "issueNumber": "20261014100050001", "number": "9", "hasil": 9, "colour": "green" }],
  "fetchedAt": 1791979200000,
  "serverTime": 1791979200001,
  "expiresAt": 1791979215000,
  "intervalSeconds": 30,
  "source": "live"
}
```

Angka waktu adalah milidetik epoch. `expiresAt` dapat `null` bila waktu penyedia tidak valid; UI tidak membuat perkiraan countdown. Browser menggunakan selisih waktu metadata dikurangi durasi permintaan, sehingga zona waktu browser tidak digunakan untuk menebak periode. Respons periode yang saling bertentangan saat pergantian ditolak dan dicoba ulang.

### `GET /api/history`

Mengembalikan `{ count, list, fetchedAt, serverTime, source }`. Secara bawaan mengambil **10 hasil terakhir**, sesuai payload bertanda tangan yang sudah digunakan proyek. Endpoint ini bukan arsip 100/500 ronde; riwayat lokal dikumpulkan saat aplikasi berjalan, sedangkan arsip proyek dimuat dari `/data/riwayat.json`. Dashboard memakai hasil dari `/api` sehingga tidak menambah permintaan riwayat yang redundant.

Hanya GET didukung (405 untuk metode lain). Kegagalan menghasilkan `{ error, code }` dengan HTTP 502, 503 untuk konfigurasi invalid, atau 504 untuk timeout. Detail exception internal dan payload akses tidak dikirim ke browser. Cache HTTP dimatikan; permintaan bersamaan pada instance hangat digabung dengan cache internal maksimum 1 detik, tanpa fallback data kadaluwarsa.

Timeout penyedia 8 detik, timeout browser 12 detik. Poll berikut dijadwalkan 2 detik setelah permintaan selesai, dengan backoff 4, 8, 16, hingga 30 detik saat gagal. Kembali ke interval normal setelah berhasil.

## Metode dan backtest

Simulator menjalankan **pola-6**, **mayoritas-30**, **mayoritas-all**, dan **acak** secara paralel. Pola-6 hanya mencocokkan enam periode berurutan, dengan hasil sesudah contoh yang juga berurutan. Minimal tiga contoh harus tidak bertumpuk dan tidak memakai baris query. Periode aktif harus tepat sesudah periode terbaru; celah arsip atau pergantian ID yang tidak bisa dipastikan memutus konteks pola. Minimum tiga contoh adalah aturan ketersediaan data, bukan bukti keunggulan statistik.

Mayoritas-30 menghitung 30 sampel terbaru; mayoritas-all memakai seluruh sampel tersedia (keduanya bisa mencakup celah waktu). Saat seri atau kosong, metode tersebut abstain. Acak tetap menjadi pembanding. Hanya hasil dengan ID lebih kecil dari periode aktif boleh masuk prediksi. Prediksi dikunci sebelum hasil dan tidak diubah ketika arsip diperbarui. Penghitung sesi lama tetap dipertahankan; mulai sesi baru bila ingin mengukur aturan baru secara terpisah.

Tab **Pola** menyediakan backtest dalam Web Worker pada maksimal 2.000 sampel terbaru. Untuk seluruh dataset:

```sh
node backtest-pola.js data/riwayat.json
```

Uji memakai warmup 100, seed acak tetap 20261014, dan fungsi `predictAll` yang sama dengan simulator. Setiap target hanya melihat hasil yang lebih lama. Empat metode dibandingkan: pola-6, mayoritas-30, mayoritas-all, acak. Jumlah abstain ditampilkan terpisah; akurasi adalah benar / prediksi yang dibuat, bukan benar / seluruh ronde. Bandingkan cakupan juga: metode yang banyak abstain diuji pada subset berbeda. Tidak ada fallback tersembunyi pada hasil backtest pola.

Pemisahan waktu mengikuti prinsip evaluasi data berurutan dalam [dokumentasi TimeSeriesSplit](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html); implementasi di sini mandiri, tidak memakai scikit-learn. Data arsip memiliki celah, sehingga tidak diperlakukan sebagai rangkaian ronde lengkap.

Pemeriksaan 15 Oktober 2026 pada arsip commit `7b11491`: 1.685 hasil, 160 celah, 100 warmup, 1.585 target uji. Aturan pola baru menghasilkan 258 benar dari 475 prediksi (54,32%), dengan 1.110 abstain. Aturan live sebelumnya menghasilkan 708/1.342 (52,76%) pada dataset yang sama, tetapi cakupannya berbeda sehingga angka ini **bukan bukti peningkatan**. Mayoritas-30 676/1.390 (48,63%), mayoritas-all 742/1.533 (48,40%), acak berseed 785/1.585 (49,53%). Tidak ada klaim bahwa hasil di luar sampel akan lebih baik; validasi prospektif masih diperlukan.

## Kolektor arsip

Dashboard memuat ulang arsip setiap 30 menit. Jika pembaruan gagal, arsip terakhir tetap tersedia; pemberitahuan otomatis hilang setelah pembaruan berikutnya berhasil.

Workflow `.github/workflows/update-riwayat.yml` mempertahankan jadwal setiap 30 menit dan pemicu manual. Kolektor memakai validasi/timeout API yang sama, menolak menimpa dataset yang invalid, melakukan deduplikasi, lalu menulis file secara atomik. Override akses kolektor tersedia lewat GitHub Actions secret `FIVE55_HISTORY_BODY`.

Arsip bertambah dalam Git, bukan dalam browser. Workflow hanya mengubah file bila ada ID baru. Perubahan dari bot dapat memicu deployment sesuai konfigurasi integrasi hosting; jadwal tidak menjamin semua ronde terkumpul. Jadwal dijalankan GitHub pada default branch setelah perubahan digabung.

## Konfigurasi penyedia

Host tetap: `newapi.55lottertttapi.com`. Tidak menerima URL upstream dari request pengguna.

| Variabel              | Kegunaan                                                                 |
| --------------------- | ------------------------------------------------------------------------ |
| `FIVE55_ISSUE_BODY`   | JSON lengkap permintaan GetGameIssue bertanda tangan yang valid          |
| `FIVE55_HISTORY_BODY` | JSON lengkap permintaan GetNoaverageEmerdList bertanda tangan yang valid |
| `PORT`                | Port server lokal, default 3000                                          |

Nilai kosong memakai payload lama yang diverifikasi berhasil pada 14 Oktober 2026. Signature/timestamp tidak diganti secara spekulatif: dokumentasi resmi penandatanganan belum tersedia. Jika akses ditolak di kemudian hari, gunakan payload sah dari penyedia. Body harus cocok dengan game `typeId: 30`, `language: 0`; history memakai `pageNo: 1` dan validator menerima `pageSize` 1–100. Payload bawaan meminta 10; batas penyedia yang diamati hanya 10 dan ukuran lebih besar belum didukung. Mengubah pageSize tanpa signature yang sesuai mungkin ditolak penyedia.

## Pengujian dan kualitas

```sh
npm run format:check
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit --audit-level=high
```

`check` memeriksa sintaks JavaScript; proyek tidak memakai TypeScript. `format:check` memeriksa format Prettier. Jalankan `npm run format` untuk merapikan kode.

Playwright memakai Chrome terpasang pada Windows jika tersedia di lokasi standar. `E2E_PORT` dapat mengganti port pengujian bila 3000 sedang digunakan. `PLAYWRIGHT_CHROME_PATH` dapat menunjuk executable pengujian lain; jika tidak ditemukan, Chromium bawaan Playwright dipakai. Pengujian selalu menggunakan profil browser terisolasi. Tes browser menggunakan respons fixture di batas jaringan agar deterministik dan tidak bergantung pada penyedia.

CI menjalankan format, sintaks, unit/integrasi, build, audit dependensi, serta browser dan axe accessibility. Screenshot dan trace kegagalan tersedia sebagai artefak CI. Pembatasan akses repo/branch protection tetap perlu dikonfigurasi pemilik GitHub jika hasil CI ingin dijadikan syarat merge.

## Deployment Vercel

1. Impor repositori, gunakan framework preset **Other** dan Node.js **24.x**.
2. Gunakan pengaturan dari `vercel.json`: build `npm run build`, output `dist`.
3. Tambahkan variabel akses penyedia hanya jika perlu mengganti payload bawaan.
4. Deploy preview lalu periksa `/`, `/api`, dan `/api/history`.
5. Verifikasi periode berganti, hasil tertaut benar, dan error dapat pulih sebelum promosi produksi.

Vercel mengemas `api/*.js` sebagai fungsi Node dan menyertakan modul impor server. `dist` hanya berisi HTML, favicon, modul/aset frontend, dan arsip hasil publik; payload server, tes, serta `.env` tidak disalin ke output statis. Header CSP membatasi script/connect ke origin sendiri; iframe dibatasi ke situs eksternal yang sudah dipakai proyek.

Rujukan: [Vercel Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js), [konfigurasi ESM](https://vercel.com/docs/functions/configuring-functions/runtime), dan [versi Node.js](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

Rollback: promosikan deployment Vercel sebelumnya. Untuk kode, revert commit perubahan melalui PR lalu deploy kembali. Riwayat format lama tetap tersedia karena migrasi tidak menghapus kunci v1. Tidak ada migrasi database.

## Struktur

```text
api/         Endpoint Vercel
server/      Integrasi penyedia dan respons HTTP
src/         Data, sesi, jaringan, penyimpanan, render, UI dan CSS
scripts/     Server lokal, pemeriksaan sintaks, build statis
tests/       Pengujian unit dan integrasi (Node test runner)
e2e/         Pengujian browser dan aksesibilitas
tasks/       Cakupan kerja dan catatan verifikasi
```

Lihat [cakupan modul](CAPABILITY-MAP.md), [rencana](tasks/plan.md), dan [changelog](CHANGELOG.md).
