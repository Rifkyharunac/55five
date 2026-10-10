import { applySnapshot, restore, accuracy, category } from './logic.mjs';
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
    const status = row.result === null ? 'Menunggu hasil' : row.prediction.label === null ? 'Dilewati' :
      category(row.result) === row.prediction.label ? 'WIN' : 'LOSE';
    const cells = [row.issue.slice(-5), (row.prediction.label ?? 'Lewati') + (row.prediction.modelVersion === 2 ? '' : ' (lama)'),
      `${row.prediction.samples} hasil`, '-', row.result === null ? '-' : `${category(row.result)} ${row.result}`, status];
    for (const text of cells) { const td = document.createElement('td'); td.textContent = text; tr.append(td); }
    tr.children[0].title = row.issue; tr.children[0].setAttribute("aria-label", row.issue);
    tr.children[1].title = reasons[row.prediction.reason] ?? 'Prediksi metode lama; keputusan asli dipertahankan.';
    if (row.issue === state.issue && row.result === null) tr.children[3].id = 'countdown';
    else tr.children[3].textContent = row.result === null ? 'Menunggu hasil' : 'Selesai';
    tr.children[5].className = status === 'WIN' ? 'win' : status === 'LOSE' ? 'lose' : '';
    tbody.append(tr);
  }
  const currentRows = state.rows.filter(r => r.prediction.modelVersion === 2);
  const stats = accuracy(currentRows);
  const skipped = currentRows.filter(r => r.prediction.label === null).length;
  const legacy = state.rows.length-currentRows.length;
  document.getElementById('accuracy').textContent = (stats.total ?
    `Akurasi sinyal versi baru: ${stats.wins}/${stats.total} (${(100 * stats.wins / stats.total).toFixed(1)}%). ` :
    'Akurasi sinyal versi baru belum tersedia. ') + `Dilewati: ${skipped}/${currentRows.length} periode. Riwayat lama: ${legacy} periode (terpisah).`;
  const latest = state.rows.find(r=>r.issue===state.issue)?.prediction;
  document.getElementById('decision').textContent = latest?.modelVersion === 2 ? reasons[latest.reason] :
    'Metode baru mulai pada periode berikutnya; prediksi yang sudah tercatat tetap dipertahankan.';
  const e = latest?.modelVersion === 2 ? latest.evaluation : null;
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
