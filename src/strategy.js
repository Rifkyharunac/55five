import { category, issueId } from './data.js';

export const METHODS = ['pola-6', 'mayoritas-30', 'mayoritas-all', 'acak', 'arsip-penuh'];

// Arsip-penuh: satu-satunya metode yang memakai SELURUH arsip yang dimuat,
// bukan hanya 30 ronde terakhir atau pola 6 ronde. Posterior Laplace
// P(Besar) = (jumlahBesar + 0,5) / (N + 1); sinyal hanya bila satu sisi
// melewati ambang impas payout 1,96 (p > 1/1,96 ≈ 0,5102). Di bawah ambang,
// metode abstain (LEWATI) — itu hasil yang jujur dari arsip, bukan kegagalan.
// Ronde WinGo acak dan independen; arsip tidak menunjukkan edge.
export const PAYOUT = 1.96;
export const AMBANG_EV = 1 / PAYOUT; // 0,51020408…
export const ARSIP_PENUH_WARM_UP = 50;

export function posteriorBesar(jumlahBesar, n) {
  return (jumlahBesar + 0.5) / (n + 1);
}

// Sinyal EV dari posterior P(Besar): 'Besar' | 'Kecil' | null (LEWATI).
export function sinyalArsipPenuh(pBesar) {
  if (pBesar > AMBANG_EV) return 'Besar';
  if (1 - pBesar > AMBANG_EV) return 'Kecil';
  return null;
}

export function arsipPenuhPosterior(history) {
  if (!history.length) return null;
  let jumlahBesar = 0;
  for (const row of history) if (row.h >= 5) jumlahBesar++;
  return { n: history.length, jumlahBesar, pBesar: posteriorBesar(jumlahBesar, history.length) };
}

// Sinyal ronde berikutnya dari seluruh arsip. null = LEWATI (abstain).
export function arsipPenuhPrediction(history) {
  const posterior = arsipPenuhPosterior(history);
  return posterior ? sinyalArsipPenuh(posterior.pBesar) : null;
}

// Digit dengan posterior Laplace tertinggi — info deskriptif saja, BUKAN
// sinyal taruhan. Posterior per digit = (count + 0,5) / (N + 5).
export function arsipPenuhDigit(history) {
  if (!history.length) return null;
  const count = Array(10).fill(0);
  for (const row of history) count[row.h]++;
  let best = 0;
  for (let d = 1; d < 10; d++) if (count[d] > count[best]) best = d;
  return { digit: best, posterior: (count[best] + 0.5) / (history.length + 5) };
}

// Backtest walk-forward expanding window atas seluruh arsip: warm-up i >= 50;
// untuk tiap ronde i, posterior dihitung dari ronde [0..i-1] saja (kronologis),
// lalu aturan EV diterapkan. Menang/kalah hanya Besar/Kecil; JP bukan win.
// Urutan masukan bebas — fungsi mengurutkan salinannya menurut periode.
// EV = winRate * 1,96 − 1; baseline = "selalu Besar" pada ronde yang dinilai.
export function arsipPenuhBacktest(history) {
  const rows = [...history].sort((a, b) => (a.p < b.p ? -1 : a.p > b.p ? 1 : 0));
  const n = rows.length;
  const dievaluasi = Math.max(0, n - ARSIP_PENUH_WARM_UP);
  let sinyal = 0;
  let menang = 0;
  let baselineMenang = 0;
  let besar = 0;
  for (let i = 0; i < ARSIP_PENUH_WARM_UP && i < n; i++) if (rows[i].h >= 5) besar++;
  for (let i = ARSIP_PENUH_WARM_UP; i < n; i++) {
    const pick = sinyalArsipPenuh(posteriorBesar(besar, i));
    const aktualBesar = rows[i].h >= 5;
    if (aktualBesar) baselineMenang++;
    if (pick !== null) {
      sinyal++;
      if ((pick === 'Besar') === aktualBesar) menang++;
    }
    if (aktualBesar) besar++;
  }
  const winRate = sinyal ? menang / sinyal : null;
  return {
    n,
    dievaluasi,
    sinyal,
    menang,
    kalah: sinyal - menang,
    winRate,
    ev: winRate === null ? null : winRate * PAYOUT - 1,
    baseline: {
      menang: baselineMenang,
      winRate: dievaluasi ? baselineMenang / dievaluasi : null,
    },
    rasioBesar: n ? besar / n : null,
  };
}

// Conservative adjacency: a date rollover or unknown ID format starts a new segment.
// Never convert full provider IDs to Number (they exceed safe integer precision).
export function adjacent(newer, older) {
  return Boolean(issueId(newer) && issueId(older) && BigInt(newer) - BigInt(older) === 1n);
}

function contiguous(history) {
  return history.every((row, i) => i === 0 || adjacent(history[i - 1].p, row.p));
}

// Input is validated history, newest first. A pattern and its observed next result
// must be consecutive rounds. Missing archive rounds are not adjacent observations.
export function patternPrediction(history, targetIssue = null) {
  if (history.length < 27 || !contiguous(history.slice(0, 6))) return null;
  if (targetIssue !== null && !adjacent(targetIssue, history[0].p)) return null;
  const query = history.slice(0, 6).map((row) => category(row.h));
  let matches = 0,
    big = 0;
  // Start after the entire query, including the candidate's outcome. Once matched,
  // skip its seven rows so one long streak cannot supply overlapping examples.
  for (let j = 7; j + 6 <= history.length; j++) {
    if (
      contiguous(history.slice(j - 1, j + 6)) &&
      query.every((value, k) => value === category(history[j + k].h))
    ) {
      matches++;
      if (history[j - 1].h >= 5) big++;
      j += 6;
    }
  }
  // Three examples is a minimum availability rule, not statistical confidence.
  return matches < 3 || big * 2 === matches ? null : big * 2 > matches ? 'Besar' : 'Kecil';
}

export function majority(history) {
  const big = history.filter((row) => row.h >= 5).length;
  return big * 2 === history.length ? null : big * 2 > history.length ? 'Besar' : 'Kecil';
}

export function predict(history, random = Math.random) {
  const pattern = patternPrediction(history);
  if (pattern) return { prediction: pattern, method: 'pola-6' };
  if (!history.length) return { prediction: random() > 0.5 ? 'Besar' : 'Kecil', method: 'acak' };
  const recent = majority(history.slice(0, 30));
  if (recent) return { prediction: recent, method: 'mayoritas-30' };
  const overall = majority(history);
  return overall
    ? { prediction: overall, method: 'mayoritas-all' }
    : { prediction: random() > 0.5 ? 'Besar' : 'Kecil', method: 'acak' };
}

// Prediksi kelima metode sekaligus untuk satu ronde. Nilai null berarti
// metode abstain (tidak punya sinyal) dan tidak dihitung menang/kalah.
export function predictAll(history, random = Math.random, targetIssue = null) {
  return {
    'pola-6': patternPrediction(history, targetIssue),
    'mayoritas-30': majority(history.slice(0, 30)),
    'mayoritas-all': majority(history),
    acak: random() > 0.5 ? 'Besar' : 'Kecil',
    'arsip-penuh': arsipPenuhPrediction(history),
  };
}

// A presentation rule, not a probability estimate: correlated methods are not
// independent evidence. Random is a comparison only and cannot decide the primary.
export function primaryDecision(picks) {
  const values = ['pola-6', 'mayoritas-30', 'mayoritas-all'].map((method) => picks[method]);
  for (const side of ['Besar', 'Kecil']) {
    if (values.filter((value) => value === side).length >= 2) return side;
  }
  return null;
}
