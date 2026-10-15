import test from 'node:test';
import assert from 'node:assert/strict';
import { patternPrediction, predictAll } from '../src/strategy.js';
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
test('backtest evaluates the same four live methods with explicit abstentions', () => {
  const history = Array.from({ length: 110 }, (_, i) => ({ p: id(i * 2), h: i % 2 ? 8 : 1 }));
  const result = backtest(history);
  assert.deepEqual(
    result.comparison.map((r) => r.method),
    ['pola-6', 'mayoritas-30', 'mayoritas-all', 'acak'],
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
