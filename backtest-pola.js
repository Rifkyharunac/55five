// Backtest walk-forward strategi "pola mirip riwayat" pada dataset 922 ronde.
// Untuk tiap ronde t (kronologis), prediksi HANYA memakai ronde < t.
const fs = require("fs");
const data = JSON.parse(fs.readFileSync(process.argv[2] || "data/riwayat.json", "utf8"));
// data: [{p, h}] kronologis (tertua dulu). Pastikan urut.
data.sort((a, b) => (a.p < b.p ? -1 : a.p > b.p ? 1 : 0));
const bk = (e) => (e.h >= 5 ? "Besar" : "Kecil");
const N = 6, MIN_MATCH = 3, WARM = 100;

function mayoritasBaseline(hist) {
  // hist: array entri kronologis (tertua dulu), pakai 30 terakhir
  const w = hist.slice(-30);
  let b = 0;
  for (const e of w) if (e.h >= 5) b++;
  if (b * 2 !== w.length) return b * 2 > w.length ? "Besar" : "Kecil";
  let ba = 0;
  for (const e of hist) if (e.h >= 5) ba++;
  return ba * 2 >= hist.length ? "Besar" : "Kecil";
}

function prediksiPola(hist) {
  // hist kronologis (tertua dulu). Query = 6 ronde terakhir.
  if (hist.length < N + 10) return null;
  const q = hist.slice(-N).map(bk);
  const nexts = [];
  // window [i..i+5] harus selesai sebelum query mulai: i+5 <= len-N-1  -> i <= len-2N-1
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

let benar = 0, total = 0, pakaiPola = 0, pakaiFallback = 0;
for (let t = WARM; t < data.length; t++) {
  const hist = data.slice(0, t);
  const aktual = bk(data[t]);
  let pred = prediksiPola(hist);
  if (pred) pakaiPola++;
  else { pred = mayoritasBaseline(hist); pakaiFallback++; }
  total++;
  if (pred === aktual) benar++;
}
console.log(JSON.stringify({
  ronde: data.length, warmup: WARM, total_prediksi: total,
  benar, akurasi: +(100 * benar / total).toFixed(2) + "%",
  pakai_pola_mirip: pakaiPola, pakai_fallback_mayoritas: pakaiFallback
}, null, 2));
