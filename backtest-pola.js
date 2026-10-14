// Backtest walk-forward MULTI-STRATEGI pada dataset riwayat WinGo.
// Untuk tiap ronde t (kronologis), tiap strategi memprediksi HANYA memakai ronde < t.
// Strategi: pola-6 (pola mirip riwayat), mayoritas-30, ikut-streak, acak (seeded).
// Hasilnya dibandingkan berdampingan — ekspektasi jujur: semuanya ≈ 50%.
const fs = require("fs");
const data = JSON.parse(fs.readFileSync(process.argv[2] || "data/riwayat.json", "utf8"));
// data: [{p, h}] kronologis (tertua dulu). Pastikan urut.
data.sort((a, b) => (a.p < b.p ? -1 : a.p > b.p ? 1 : 0));
const bk = (e) => (e.h >= 5 ? "Besar" : "Kecil");
const N = 6, MIN_MATCH = 3, WARM = 100;

// PRNG seeded (mulberry32) agar strategi "acak" bisa direproduksi.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function prediksiPola(hist) {
  // hist kronologis (tertua dulu). Query = 6 ronde terakhir.
  if (hist.length < N + 10) return null;
  const q = hist.slice(-N).map(bk);
  const nexts = [];
  // window [i..i+5] harus selesai sebelum query mulai: i+5 <= len-N-1 -> i <= len-2N-1
  for (let i = 0; i <= hist.length - 2 * N - 1; i++) {
    let sama = true;
    for (let k = 0; k < N; k++) {
      if (bk(hist[i + k]) !== q[k]) { sama = false; break; }
    }
    if (sama) nexts.push(bk(hist[i + N]));
  }
  if (nexts.length < MIN_MATCH) return null;
  let b = 0;
  for (const c of nexts) if (c === "Besar") b++;
  if (b * 2 === nexts.length) return null; // seri -> fallback
  return b * 2 > nexts.length ? "Besar" : "Kecil";
}

function prediksiMayoritas30(hist) {
  const w = hist.slice(-30);
  let b = 0;
  for (const e of w) if (e.h >= 5) b++;
  if (b * 2 === w.length) return bk(hist[hist.length - 1]); // seri -> ikut ronde terakhir
  return b * 2 > w.length ? "Besar" : "Kecil";
}

function prediksiIkutStreak(hist) {
  return bk(hist[hist.length - 1]); // ikuti kategori ronde terakhir
}

const rand = mulberry32(20261014);
function prediksiAcak() {
  return rand() > 0.5 ? "Besar" : "Kecil";
}

const STRATEGI = {
  "pola-6": (hist) => prediksiPola(hist) || prediksiMayoritas30(hist),
  "mayoritas-30": prediksiMayoritas30,
  "ikut-streak": prediksiIkutStreak,
  "acak": prediksiAcak,
};

const hasil = {};
for (const nama of Object.keys(STRATEGI)) hasil[nama] = { benar: 0, total: 0 };

for (let t = WARM; t < data.length; t++) {
  const hist = data.slice(0, t);
  const aktual = bk(data[t]);
  for (const [nama, fn] of Object.entries(STRATEGI)) {
    const pred = fn(hist);
    hasil[nama].total++;
    if (pred === aktual) hasil[nama].benar++;
  }
}

const baris = Object.entries(hasil).map(([nama, h]) => ({
  strategi: nama,
  prediksi: h.total,
  benar: h.benar,
  akurasi: +((100 * h.benar) / h.total).toFixed(2),
}));
baris.sort((a, b) => b.akurasi - a.akurasi);
console.log(JSON.stringify({
  ronde: data.length,
  warmup: WARM,
  catatan: "Tiap ronde acak & independen — ekspektasi semua strategi ≈ 50%.",
  perbandingan: baris,
}, null, 2));
