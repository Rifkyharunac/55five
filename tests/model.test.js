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
  assert.equal(state.methods['pola-6'].win + state.methods['pola-6'].lose, 0);
  assert.equal(state.rows.length, 500);
  const restored = restoreSession(JSON.parse(JSON.stringify(state)));
  advanceSession(restored, snapshot(id(550), [result(id(549), 8)]));
  assert.equal(restored.win, 549);
  assert.equal(restored.lose, 0);
  assert.equal(restored.rounds, 549);
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
test('scores all four methods independently on every round', () => {
  const state = newSession();
  const past = Array.from({ length: 40 }, (_, i) => ({ p: id(i + 1), h: 8 }));
  advanceSession(state, snapshot(id(41)), () => 0.9, past);
  assert.deepEqual(state.rows[0].picks, {
    'pola-6': 'Besar',
    'mayoritas-30': 'Besar',
    'mayoritas-all': 'Besar',
    acak: 'Besar',
  });
  advanceSession(state, snapshot(id(42), [result(id(41), 3)]), () => 0.9, past);
  assert.equal(state.rounds, 1);
  assert.equal(state.win, 0);
  assert.equal(state.lose, 4);
  for (const method of ['pola-6', 'mayoritas-30', 'mayoritas-all', 'acak']) {
    assert.equal(state.methods[method].lose, 1);
  }
  const restored = restoreSession(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.rounds, 1);
  assert.equal(restored.lose, 4);
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
