import { applySnapshot, restore, accuracy, category, estimateAccuracy, learningProgress } from './logic.mjs';
const reasons = { insufficient: 'Data belum cukup: perlu 100 hasil pelatihan dan 100 hasil uji berdasarkan urutan waktu.', gap: 'Hasil periode tepat sebelumnya belum tersedia.', context: 'Contoh transisi sejenis belum cukup.', baseline: 'Model belum mengungguli pembanding sederhana.', unstable: 'Kinerja 50 hasil uji terakhir melemah.', weak: 'Sinyal model terlalu dekat dengan seimbang.', eligible: 'Lolos filter eksperimen; bukan jaminan hasil berikutnya.' };
const storageKey = '55five-predictions-v1';
let storageOK = true;
let state;
try { state = restore(localStorage.getItem(storageKey)); }
catch { state = restore(null); storageOK = false; }
let deadline = null;
let failures = 0;
let pending = false;
let nextPoll;
const tbody = document.getElementById('dataBody');
const connection = document.getElementById('connection');
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify({ ...state, version: 1 })); }
  catch { storageOK = false; }
}
function render() {
  tbody.replaceChildren();
  for (const row of state.rows.slice(0, 30)) {
    const tr = document.createElement('tr');
    const estimate = row.prediction.estimate;
    const status = row.result === null ? 'Menunggu hasil' : row.prediction.label !== null ?
      (category(row.result) === row.prediction.label ? 'WIN' : 'LOSE') : estimate?.label ?
      (category(row.result) === estimate.label ? 'Cocok (estimasi)' : 'Meleset (estimasi)') : 'Tanpa estimasi';
    const estimateText = estimate?.label ? `${estimate.label} (eksperimen)` : estimate?.probability === .5 ? 'Seimbang' : '-';
    const signalText = row.prediction.modelVersion !== 2 ? `${row.prediction.label ?? '-'} (lama)` :
      row.prediction.label ? `${row.prediction.label} (lolos)` : 'Belum lolos';
    const cells = [row.issue.slice(-5), estimateText, signalText,
      `${row.prediction.samples} hasil`, '-', row.result === null ? '-' : `${category(row.result)} ${row.result}`, status];
    for (const text of cells) { const td = document.createElement('td'); td.textContent = text; tr.append(td); }
    tr.children[0].title = row.issue; tr.children[0].setAttribute('aria-label', row.issue);
    tr.children[1].title = estimate?.method === 'transition' ? 'Model transisi; belum terbukti akurat.' : 'Frekuensi riwayat; belum terbukti akurat.';
    tr.children[2].title = reasons[row.prediction.reason] ?? 'Keputusan metode lama dipertahankan.';
    if (row.issue === state.issue && row.result === null) tr.children[4].id = 'countdown';
    else tr.children[4].textContent = row.result === null ? 'Menunggu hasil' : 'Selesai';
    tr.children[6].className = status === 'WIN' ? 'win' : status === 'LOSE' ? 'lose' : '';
    tbody.append(tr);
  }
  const currentRows = state.rows.filter(r => r.prediction.modelVersion === 2);
  const stats = accuracy(currentRows);
  const skipped = currentRows.filter(r => r.prediction.label === null).length;
  const legacy = state.rows.length-currentRows.length;
  document.getElementById('accuracy').textContent = (stats.total ?
    `Sinyal lolos filter: ${stats.wins}/${stats.total} cocok (${(100 * stats.wins / stats.total).toFixed(1)}%). ` :
    'Belum ada hasil sinyal lolos filter. ') + `Belum lolos: ${skipped}/${currentRows.length} periode. Riwayat lama: ${legacy} (terpisah).`;
  const experiment = estimateAccuracy(state.rows);
  document.getElementById('experiment').textContent = experiment.total ?
    `Estimasi eksperimen: ${experiment.wins}/${experiment.total} cocok (${(100*experiment.wins/experiment.total).toFixed(1)}%); ${experiment.total-experiment.wins} meleset. Belum membuktikan kemampuan memprediksi.` :
    'Estimasi eksperimen belum memiliki hasil. Estimasi baru mulai dicatat pada periode berikutnya jika data cukup.';
  document.getElementById('uncertainty').textContent = experiment.interval ?
    `Rentang Wilson 95% untuk akurasi estimasi: ${(100*experiment.interval.low).toFixed(1)}–${(100*experiment.interval.high).toFixed(1)}%. Diagnostik dengan asumsi hasil independen dan peluang benar tetap; kedua asumsi belum diverifikasi. Bukan peluang menang periode berikutnya.` :
    'Rentang ketidakpastian belum tersedia.';
  const latest = state.rows.find(r=>r.issue===state.issue)?.prediction;
  document.getElementById('decision').textContent = latest?.modelVersion === 2 ? reasons[latest.reason] :
    'Metode baru mulai pada periode berikutnya; prediksi yang sudah tercatat tetap dipertahankan.';
  const e = latest?.modelVersion === 2 ? latest.evaluation : null;
  const progress = learningProgress(latest?.samples ?? 0,e?.tested ?? 0);
  document.getElementById('progress').textContent = `Pelatihan ${progress.training}/100 | Uji ${progress.validation}/100. ` +
    (progress.remaining ? `Sedikitnya ${progress.remaining} hasil tambahan untuk memenuhi jumlah minimum; data terlewat bisa menambah kebutuhan. ` : 'Jumlah minimum tercapai; kualitas model tetap diperiksa. ') +
    'Data bertambah selama halaman tersambung; angka 200 bukan jaminan sinyal akan lolos.';
  document.getElementById('validation').textContent = e ?
    `Uji historis kandidat: ${e.tested} hasil uji; minimum 100, maksimal 200 hasil terbaru. ` + (e.tested ?
      `Benar ${e.wins}/${e.tested}; pembanding frekuensi ${e.baselineWins}/${e.tested}. Brier model ${e.brier.toFixed(3)}, frekuensi ${e.baselineBrier.toFixed(3)}, netral 0.250; lebih kecil lebih baik. Ini bukan akurasi sinyal live atau probabilitas menang yang terkalibrasi.` :
      'Menunggu data. Pelatihan menggunakan 100 hasil sebelum setiap target uji.') : 'Evaluasi metode baru belum tersedia.';
  document.getElementById('storage').textContent = storageOK ?
    'Tersimpan di browser ini: hingga 1.000 hasil untuk analisis, 200 keputusan, dan 30 baris terbaru.' :
    'Penyimpanan browser tidak tersedia. Riwayat hanya bertahan selama halaman terbuka.';
  tick();
}
function tick() {
  const cell = document.getElementById('countdown');
  if (!cell) return;
  const remaining = deadline === null ? 0 : Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
  cell.textContent = remaining > 0 ? `${remaining} dtk` : 'Menunggu sinkronisasi';
}
async function poll() {
  if (pending) return;
  clearTimeout(nextPoll);
  pending = true;
  const started = performance.now();
  try {
    const response = await fetch('/api', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Respons gagal');
    const data = await response.json();
    if (data.error || !Number.isFinite(data.remainingMs) || data.remainingMs < 0 || data.remainingMs > 30000) {
      throw new Error('Data tidak valid');
    }
    // Conservative deadline: never advertise extra betting/prediction time due to network latency.
    const available = Math.max(0, data.remainingMs - (performance.now() - started));
    if (available <= 0) throw new Error('Periode sedang berganti');
    state = applySnapshot(state, data);
    deadline = performance.now() + available;
    failures = 0;
    save();
    connection.textContent = 'Terhubung. Periode dan waktu mengikuti server.';
    render();
  } catch {
    failures++;
    deadline = null;
    connection.textContent = 'Data belum tersinkron. Mencoba lagi otomatis; prediksi baru ditunda.';
    tick();
  } finally {
    pending = false;
    nextPoll = setTimeout(poll, failures ? Math.min(30000, 2000 * 2 ** Math.min(failures - 1, 4)) : 2000);
  }
}
document.getElementById('retry').addEventListener('click', poll);
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
window.addEventListener('online', poll);
render();
setInterval(tick, 250);
poll();
