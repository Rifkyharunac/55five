import test from 'node:test';
import assert from 'node:assert/strict';
import {
  patternPrediction,
  predictAll,
  arsipPenuhPrediction,
  arsipPenuhDigit,
  arsipPenuhBacktest,
} from '../src/strategy.js';
import { backtest } from '../src/experiments.js';
import { advanceSession, newSession, restoreSession } from '../src/model.js';
const id = (n) => String(20261015100050000n + BigInt(n));
const rows = (n, step = 1) =>
  Array.from({ length: n }, (_, i) => ({ p: id(i * step), h: 8 })).reverse();

test('patterns cannot bridge missing periods in their query or historical examples', () => {
  assert.equal(patternPrediction(rows(40, 2)), null);
  const history = rows(40, 2);
  history.splice(0, 6, ...rows(6).map((r, i) => ({ ...r, p: id(100 - i) })));
  assert.equal(patternPrediction(history), null);
});
test('one overlapping streak is not counted as three non-overlapping pattern examples', () => {
  assert.equal(patternPrediction(rows(20)), null);
  assert.equal(patternPrediction(rows(40)), 'Besar');
});
test('no majority is invented for empty or evenly split data', () => {
  for (const history of [
    [],
    [
      { p: id(1), h: 1 },
      { p: id(0), h: 8 },
    ],
  ]) {
    const picks = predictAll(history, () => 0.1);
    assert.equal(picks['mayoritas-all'], null);
    assert.equal(picks['mayoritas-30'], null);
    assert.equal(picks.acak, 'Kecil');
  }
});
test('live pattern requires the immediately preceding period and sorts past inputs', () => {
  const state = newSession();
  advanceSession(
    state,
    { issue: id(100), list: [], fetchedAt: 1000, expiresAt: 25000 },
    () => 0.1,
    rows(40),
  );
  assert.equal(state.rows[0].picks['pola-6'], null);
  const fresh = newSession();
  advanceSession(
    fresh,
    { issue: id(40), list: [], fetchedAt: 1000, expiresAt: 25000 },
    () => 0.1,
    rows(40).reverse(),
  );
  assert.equal(fresh.rows[0].picks['pola-6'], 'Besar');
});
test('backtest evaluates the same five live methods with explicit abstentions', () => {
  const history = Array.from({ length: 110 }, (_, i) => ({ p: id(i * 2), h: i % 2 ? 8 : 1 }));
  const result = backtest(history);
  assert.deepEqual(
    result.comparison.map((r) => r.method),
    ['pola-6', 'mayoritas-30', 'mayoritas-all', 'acak', 'arsip-penuh'],
  );
  assert.equal(result.comparison[0].total, 0);
  assert.equal(result.comparison[0].abstained, 10);
  for (const r of result.comparison) assert.equal(r.total + r.abstained, 10);
  const state = newSession();
  for (let t = 100; t < history.length; t++) {
    const target = history[t];
    advanceSession(
      state,
      {
        issue: target.p,
        list: t > 100 ? [{ issueNumber: history[t - 1].p, hasil: history[t - 1].h }] : [],
        fetchedAt: 1000,
        expiresAt: 25000,
      },
      () => 0.1,
      history.slice(0, t).reverse(),
    );
  }
  advanceSession(
    state,
    {
      issue: id(999),
      list: [{ issueNumber: history.at(-1).p, hasil: history.at(-1).h }],
      fetchedAt: 1000,
      expiresAt: null,
    },
    () => 0.1,
    history,
  );
  for (const r of result.comparison.filter((r) => r.method !== 'acak')) {
    assert.equal(r.correct, state.methods[r.method].win);
    assert.equal(r.total, state.methods[r.method].win + state.methods[r.method].lose);
  }
});

test('arsip-penuh memakai seluruh arsip dan abstain di bawah ambang EV', () => {
  const mixed = (big, small) =>
    [
      ...Array.from({ length: big }, (_, i) => ({ p: id(i + 1), h: 8 })),
      ...Array.from({ length: small }, (_, i) => ({ p: id(big + i + 1), h: 1 })),
    ].reverse();
  // (40 + 0,5) / 61 ≈ 0,6639 > 0,5102 → Besar.
  assert.equal(arsipPenuhPrediction(mixed(40, 20)), 'Besar');
  // (30 + 0,5) / 61 = 0,5 → LEWATI.
  assert.equal(arsipPenuhPrediction(mixed(30, 30)), null);
  // P(Kecil) = 1 − 20,5/61 ≈ 0,6639 > 0,5102 → Kecil.
  assert.equal(arsipPenuhPrediction(mixed(20, 40)), 'Kecil');
  assert.equal(arsipPenuhPrediction([]), null);
  assert.equal(predictAll(mixed(40, 20), () => 0.1)['arsip-penuh'], 'Besar');
  assert.equal(predictAll(mixed(30, 30), () => 0.1)['arsip-penuh'], null);
  // Digit terbanyak hanya info deskriptif: 40× angka 8 → (40 + 0,5) / 65.
  assert.deepEqual(arsipPenuhDigit(mixed(40, 20)), { digit: 8, posterior: 40.5 / 65 });
  assert.equal(arsipPenuhDigit([]), null);
});

test('arsip-penuh backtest walk-forward hanya memakai ronde sebelumnya', () => {
  // 50 ronde Besar lalu 8, 1, 8, 1, 8. Lima target dinilai; posterior dari
  // ronde sebelumnya selalu > 0,95 → lima sinyal Besar, 3 menang, 2 kalah.
  const values = [...Array(50).fill(8), 8, 1, 8, 1, 8];
  const history = values.map((h, i) => ({ p: id(i + 1), h }));
  const result = arsipPenuhBacktest(history);
  assert.equal(result.n, 55);
  assert.equal(result.dievaluasi, 5);
  assert.equal(result.sinyal, 5);
  assert.equal(result.menang, 3);
  assert.equal(result.kalah, 2);
  assert.equal(result.winRate, 0.6);
  assert.ok(Math.abs(result.ev - 0.176) < 1e-12);
  assert.deepEqual(result.baseline, { menang: 3, winRate: 0.6 });
  assert.ok(Math.abs(result.rasioBesar - 53 / 55) < 1e-12);
  // Urutan masukan bebas: terbaru-dahulu memberi angka yang sama persis.
  assert.deepEqual(arsipPenuhBacktest([...history].reverse()), result);
  assert.equal(arsipPenuhPrediction(history), 'Besar');
  assert.deepEqual(arsipPenuhDigit(history), { digit: 8, posterior: 53.5 / 60 });
  // Selang-seling 8,1: posterior selalu ≈ 0,5 → 0 sinyal, bukan 0 menang.
  const alternating = Array.from({ length: 60 }, (_, i) => ({ p: id(i + 1), h: i % 2 ? 1 : 8 }));
  const flat = arsipPenuhBacktest(alternating);
  assert.equal(flat.dievaluasi, 10);
  assert.equal(flat.sinyal, 0);
  assert.equal(flat.menang, 0);
  assert.equal(flat.winRate, null);
  assert.equal(flat.ev, null);
  assert.deepEqual(flat.baseline, { menang: 5, winRate: 0.5 });
  // Arsip kosong: semua null/nol, tanpa crash.
  assert.deepEqual(arsipPenuhBacktest([]), {
    n: 0,
    dievaluasi: 0,
    sinyal: 0,
    menang: 0,
    kalah: 0,
    winRate: null,
    ev: null,
    baseline: { menang: 0, winRate: null },
    rasioBesar: null,
  });
});

test('an issued prediction stays locked when more history arrives and survives reload', () => {
  const state = newSession();
  const snapshot = { issue: id(40), list: [], fetchedAt: 1000, expiresAt: 25000 };
  advanceSession(state, snapshot, () => 0.1, rows(40));
  const original = structuredClone(state.rows[0].picks);
  advanceSession(
    state,
    snapshot,
    () => 0.9,
    rows(40).map((r) => ({ ...r, h: 1 })),
  );
  assert.deepEqual(state.rows[0].picks, original);
  assert.deepEqual(restoreSession(JSON.parse(JSON.stringify(state))).rows[0].picks, original);
});
