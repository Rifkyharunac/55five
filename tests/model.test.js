import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newSession,
  advanceSession,
  restoreSession,
  mergeHistory,
  statistics,
  filterHistory,
  historyCsv,
  chiSquareUniform,
  wilsonInterval,
  transitions,
  streakLengths,
} from '../src/model.js';

const id = (n) => `2026101410005${String(n).padStart(4, '0')}`;
const snapshot = (issue, list = []) => ({ issue, list, fetchedAt: 1000, expiresAt: 20000 });
const result = (issueNumber, hasil) => ({ issueNumber, hasil, number: String(hasil) });

test('matches full issue IDs, never another day with the same suffix', () => {
  const state = newSession();
  advanceSession(state, snapshot(id(1)), () => 0.9);
  advanceSession(state, snapshot(id(2), [result('20261015100050001', 8)]));
  assert.equal(state.win, 0);
});
test('keeps cumulative totals after the visible and retained row limits, and reload', () => {
  const state = newSession();
  for (let i = 1; i <= 550; i++) {
    advanceSession(state, snapshot(id(i), i > 1 ? [result(id(i - 1), 8)] : []), () => 0.9);
  }
  // Empty history: only the explicitly random baseline predicts; all data methods abstain.
  assert.equal(state.win, 549);
  assert.equal(state.lose, 0);
  assert.equal(state.rounds, 549);
  assert.equal(state.methods['mayoritas-all'].win, 0);
  assert.equal(state.methods.acak.win, 549);
  assert.equal(state.primary.abstained, 549);
  assert.equal(state.primary.win, 0);
  assert.equal(state.methods['pola-6'].win + state.methods['pola-6'].lose, 0);
  assert.equal(state.rows.length, 500);
  const restored = restoreSession(JSON.parse(JSON.stringify(state)));
  advanceSession(restored, snapshot(id(550), [result(id(549), 8)]));
  assert.equal(restored.win, 549);
  assert.equal(restored.lose, 0);
  assert.equal(restored.rounds, 549);
  assert.equal(restored.primary.abstained, 549);
});
test('settles each prediction once and ignores older snapshots', () => {
  const state = newSession();
  advanceSession(state, snapshot(id(2)), () => 0.1);
  advanceSession(state, snapshot(id(3), [result(id(2), 9)]), () => 0.1);
  advanceSession(state, snapshot(id(1), [result(id(2), 9)]));
  assert.equal(state.currentIssue, id(3));
  // Only acak predicted Kecil (lose); no data-driven majority was invented.
  assert.equal(state.win, 0);
  assert.equal(state.lose, 1);
  assert.equal(state.rounds, 1);
  assert.equal(state.rows.length, 2);
});
test('scores all five methods independently on every round', () => {
  const state = newSession();
  const past = Array.from({ length: 40 }, (_, i) => ({ p: id(i + 1), h: 8 }));
  advanceSession(state, snapshot(id(41)), () => 0.9, past);
  assert.deepEqual(state.rows[0].picks, {
    'pola-6': 'Besar',
    'mayoritas-30': 'Besar',
    'mayoritas-all': 'Besar',
    acak: 'Besar',
    // Posterior seluruh arsip: (40 + 0,5) / 41 ≈ 0,9878 > 0,5102.
    'arsip-penuh': 'Besar',
  });
  advanceSession(state, snapshot(id(42), [result(id(41), 3)]), () => 0.9, past);
  assert.equal(state.rounds, 1);
  assert.equal(state.win, 0);
  assert.equal(state.lose, 5);
  for (const method of ['pola-6', 'mayoritas-30', 'mayoritas-all', 'acak', 'arsip-penuh']) {
    assert.equal(state.methods[method].lose, 1);
  }
  const restored = restoreSession(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.rounds, 1);
  assert.equal(restored.lose, 5);
});
test('restores v4 sessions stored before arsip-penuh without losing history', () => {
  const state = newSession();
  const past = Array.from({ length: 40 }, (_, i) => ({ p: id(i + 1), h: 8 }));
  advanceSession(state, snapshot(id(41)), () => 0.9, past);
  // Sesi lama: tidak ada kunci 'arsip-penuh' di methods maupun picks.
  const legacy = JSON.parse(JSON.stringify(state));
  delete legacy.methods['arsip-penuh'];
  for (const row of legacy.rows) delete row.picks['arsip-penuh'];
  const restored = restoreSession(legacy);
  assert.equal(restored.rows.length, 1);
  assert.equal(restored.rows[0].picks['arsip-penuh'], null);
  assert.deepEqual(restored.methods['arsip-penuh'], { win: 0, lose: 0 });
  assert.equal(restored.methods['pola-6'].win + restored.methods['pola-6'].lose, 0);
  assert.equal(restored.win, 0);
  assert.equal(restored.lose, 0);
  // Setelah migrasi, metode baru dinilai normal pada ronde berikutnya.
  // Baris lama yang dimigrasikan tidak punya prediksi arsip-penuh (metode
  // belum ada saat baris itu dibuat) → tidak dinilai untuk metode ini.
  advanceSession(restored, snapshot(id(42), [result(id(41), 8)]), () => 0.9, past);
  assert.equal(restored.methods['arsip-penuh'].win, 0);
  assert.equal(restored.methods['arsip-penuh'].lose, 0);
  // Baris baru id(42) dibuat setelah migrasi dengan prediksi lengkap.
  assert.equal(restored.rows[0].picks['arsip-penuh'], 'Besar');
  advanceSession(restored, snapshot(id(43), [result(id(42), 8)]), () => 0.9, past);
  assert.equal(restored.methods['arsip-penuh'].win, 1);
  assert.equal(restoreSession(JSON.parse(JSON.stringify(restored))).methods['arsip-penuh'].win, 1);
});
test('abstaining methods are not counted as wins or losses', () => {
  const state = newSession();
  advanceSession(state, snapshot(id(1)), () => 0.9);
  assert.equal(state.rows[0].picks['pola-6'], null);
  assert.equal(state.rows[0].picks['mayoritas-30'], null);
  advanceSession(state, snapshot(id(2), [result(id(1), 8)]));
  assert.equal(state.methods['pola-6'].win + state.methods['pola-6'].lose, 0);
  assert.equal(state.methods['mayoritas-30'].win + state.methods['mayoritas-30'].lose, 0);
  assert.equal(state.win, 1);
  assert.equal(state.lose, 0);
});
test('does not create predictions without reliable remaining time', () => {
  const state = newSession();
  advanceSession(state, { ...snapshot(id(1)), expiresAt: null });
  advanceSession(state, { ...snapshot(id(2)), expiresAt: 2000 });
  assert.equal(state.rows.length, 0);
});
test('marks gaps as missed without counting them as wins or losses', () => {
  const state = newSession();
  advanceSession(state, snapshot(id(1)), () => 0.1);
  advanceSession(state, snapshot(id(20), [result(id(19), 1), result(id(10), 5)]));
  assert.equal(state.rows.find((row) => row.issue === id(1)).status, 'missed');
  assert.equal(state.missed, 1);
  assert.equal(state.win + state.lose, 0);
});
test('migrates valid legacy history and discards malformed or out-of-range entries', () => {
  const merged = mergeHistory(
    [
      { p: id(1), h: 2 },
      { p: '<script>', h: 1 },
      { p: id(3), h: 99 },
    ],
    [result(id(2), 8), result(id(1), 3), { issueNumber: id(4), hasil: '2abc' }],
  );
  assert.deepEqual(merged, [
    { p: id(2), h: 8 },
    { p: id(1), h: 3 },
  ]);
});
test('restores malformed sessions to a valid empty state', () => {
  for (const value of [null, [], { version: 2, rows: [], win: -10 }, { version: 2, rows: 'bad' }]) {
    assert.equal(restoreSession(value).rows.length, 0);
    assert.equal(restoreSession(value).win, 0);
  }
});

test('numeric IDs in corrupt session storage cannot crash restoration', () => {
  const state = {
    ...newSession(),
    currentIssue: 20261014,
    rows: [{ issue: 20261014, prediction: 'Besar', status: 'pending', result: null }],
  };
  assert.doesNotThrow(() => restoreSession(state));
  assert.equal(restoreSession(state).rows.length, 0);
});
test('filters and statistics agree, including overlapping violet color membership', () => {
  const history = [0, 5, 7, 3, 2].map((h, i) => ({ p: id(i + 1), h }));
  const stats = statistics(history);
  assert.equal(stats.total, 5);
  assert.equal(stats.big, 2);
  assert.deepEqual(stats.colors, { Hijau: 3, Merah: 2, Ungu: 2 });
  assert.equal(
    stats.frequency.reduce((sum, n) => sum + n, 0),
    5,
  );
  assert.equal(filterHistory(history, { category: 'Besar', query: '', limit: 100 }).length, 2);
  assert.equal(filterHistory(history, { query: id(1), limit: 100 }).length, 1);
});
test('CSV exports full safe issue IDs and correct category with no invalid rows', () => {
  const csv = historyCsv([
    { p: id(1), h: 5 },
    { p: '=1+1', h: 2 },
  ]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes(id(1)));
  assert.ok(csv.includes('Besar'));
  assert.ok(!csv.includes('=1+1'));
});

test('archive filtering and CSV can include more than the local 500-result limit', () => {
  const archive = Array.from({ length: 800 }, (_, i) => ({ p: id(i), h: i % 10 }));
  const filtered = filterHistory(archive, { limit: 0 });
  assert.equal(filtered.length, 800);
  assert.equal(filterHistory(archive, { query: id(1), limit: 30 })[0].p, id(1));
  assert.equal(historyCsv(filtered).split('\r\n').length, 801);
  assert.equal(statistics(archive).total, 800);
});

test('chiSquareUniform mengukur penyimpangan frekuensi dari seragam', () => {
  const uniform = chiSquareUniform(Array(10).fill(100));
  assert.equal(uniform.n, 1000);
  assert.equal(uniform.df, 9);
  assert.equal(uniform.chi2, 0);
  assert.equal(uniform.uniform, true);
  // 500 ronde semuanya angka 0: ekspektasi 50 per angka.
  // chi2 = (450^2/50) + 9*(50^2/50) = 4050 + 450 = 4500.
  const skewed = chiSquareUniform([500, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(skewed.chi2, 4500);
  assert.equal(skewed.uniform, false);
  assert.equal(chiSquareUniform(Array(10).fill(0)), null);
  assert.equal(chiSquareUniform([1, 2, 3]), null);
});

test('wilsonInterval memberi selang kepercayaan 95% untuk porsi besar', () => {
  // 500 dari 1000: selang Wilson 95% ≈ 46,91%–53,09%, memuat 50%.
  const even = wilsonInterval(500, 1000);
  assert.ok(Math.abs(even.lo - 0.4691) < 0.001);
  assert.ok(Math.abs(even.hi - 0.5309) < 0.001);
  assert.ok(even.lo <= 0.5 && 0.5 <= even.hi);
  // 5 dari 5: batas bawah di atas 50% tapi tidak pernah melebihi 100%.
  const all = wilsonInterval(5, 5);
  assert.ok(all.lo > 0.5 && all.hi <= 1);
  assert.equal(wilsonInterval(0, 0), null);
  assert.equal(wilsonInterval(3, 2), null);
  assert.equal(wilsonInterval(-1, 10), null);
  // statistics melampirkan selang untuk porsi besar pada sampel yang sama.
  const stats = statistics(Array.from({ length: 20 }, (_, i) => ({ p: id(i + 1), h: i % 10 })));
  assert.equal(stats.big, 10);
  assert.ok(stats.bigShare.lo < 0.5 && 0.5 < stats.bigShare.hi);
});

test('statistics melampirkan hasil uji sebaran angka', () => {
  const history = Array.from({ length: 20 }, (_, i) => ({ p: id(i + 1), h: i % 10 }));
  const stats = statistics(history);
  assert.ok(stats.uniformity);
  assert.equal(stats.uniformity.n, 20);
  assert.equal(stats.uniformity.chi2, 0);
});

test('statistics melampirkan backtest arsip-penuh dan verdict sampel', () => {
  const values = [...Array(50).fill(8), 8, 1, 8, 1, 8];
  const history = values.map((h, i) => ({ p: id(i + 1), h }));
  const stats = statistics(history);
  const arsip = stats.arsipPenuh;
  assert.equal(arsip.n, 55);
  assert.equal(arsip.dievaluasi, 5);
  assert.equal(arsip.sinyal, 5);
  assert.equal(arsip.menang, 3);
  assert.equal(arsip.kalah, 2);
  assert.equal(arsip.winRate, 0.6);
  assert.ok(Math.abs(arsip.ev - 0.176) < 1e-12);
  assert.deepEqual(arsip.baseline, { menang: 3, winRate: 0.6 });
  // Selang Wilson 95% untuk 3 dari 5 ≈ 23,07%–88,24%.
  assert.ok(Math.abs(arsip.ci95.lo - 0.23072) < 0.001);
  assert.ok(Math.abs(arsip.ci95.hi - 0.88238) < 0.001);
  assert.equal(arsip.verdict, 'Besar');
  assert.ok(Math.abs(arsip.pBesar - 53.5 / 56) < 1e-12);
  assert.deepEqual(arsip.digit, { digit: 8, posterior: 53.5 / 60 });
  // Sampel kosong: tidak ada verdict, tidak ada sinyal, tanpa crash.
  const empty = statistics([]).arsipPenuh;
  assert.equal(empty.n, 0);
  assert.equal(empty.sinyal, 0);
  assert.equal(empty.verdict, null);
  assert.equal(empty.ci95, null);
});

test('transitions hanya menghitung pasangan periode berurutan', () => {
  const history = [
    { p: id(1), h: 8 },
    { p: id(2), h: 3 },
    { p: id(3), h: 9 },
    { p: id(4), h: 2 },
  ];
  assert.deepEqual(transitions(history), {
    pairs: 3,
    afterBig: { big: 0, small: 2 },
    afterSmall: { big: 1, small: 0 },
  });
  // Jeda (id 2 dilewati) dan ganti hari bukan transisi.
  assert.equal(
    transitions([
      { p: id(1), h: 8 },
      { p: id(3), h: 9 },
    ]),
    null,
  );
  assert.equal(
    transitions([
      { p: id(1), h: 8 },
      { p: '20261015100050002', h: 9 },
    ]),
    null,
  );
  assert.equal(transitions([]), null);
  // statistics melampirkan transisi pada sampel yang sama.
  assert.equal(statistics(history).transitions.pairs, 3);
});

test('streakLengths menghitung distribusi panjang rangkaian vs harapan koin adil', () => {
  // B,K,B,K: empat rangkaian panjang 1; harapan tiap panjang k = 4 / 2^k.
  const alternating = streakLengths([
    { p: id(1), h: 8 },
    { p: id(2), h: 3 },
    { p: id(3), h: 9 },
    { p: id(4), h: 2 },
  ]);
  assert.equal(alternating.runs, 4);
  assert.equal(alternating.longest, 1);
  assert.equal(alternating.buckets[0].observed, 4);
  assert.equal(alternating.buckets[0].expected, 2);
  assert.equal(alternating.buckets[1].observed, 0);
  assert.equal(alternating.buckets[1].expected, 1);
  // B,B,B,K: satu rangkaian panjang 3 dan satu panjang 1.
  const run = streakLengths([
    { p: id(1), h: 8 },
    { p: id(2), h: 9 },
    { p: id(3), h: 7 },
    { p: id(4), h: 2 },
  ]);
  assert.equal(run.runs, 2);
  assert.equal(run.longest, 3);
  assert.equal(run.buckets[0].observed, 1);
  assert.equal(run.buckets[2].observed, 1);
  assert.equal(run.buckets[2].expected, 0.25);
  assert.equal(run.buckets[8].label, '9+');
  assert.equal(run.buckets[8].expected, 2 * 2 ** -8);
  // Jeda (id 2 dilewati) memutus rangkaian: dua rangkaian panjang 1, bukan satu panjang 2.
  const gapped = streakLengths([
    { p: id(1), h: 8 },
    { p: id(3), h: 9 },
  ]);
  assert.equal(gapped.runs, 2);
  assert.equal(gapped.longest, 1);
  assert.equal(streakLengths([]), null);
  // statistics melampirkan distribusi pada sampel yang sama.
  const stats = statistics([
    { p: id(1), h: 8 },
    { p: id(2), h: 9 },
    { p: id(3), h: 7 },
    { p: id(4), h: 2 },
  ]);
  assert.equal(stats.streakLengths.runs, 2);
  assert.equal(stats.streakLengths.longest, 3);
});
