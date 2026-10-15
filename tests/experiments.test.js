import test from 'node:test';
import assert from 'node:assert/strict';
import { predict, analyzePatterns, backtest } from '../src/experiments.js';
import { newSession, advanceSession, restoreSession } from '../src/model.js';
const rows = (values) =>
  values.map((h, i) => ({ p: String(20261014000000000n + BigInt(i)), h })).reverse();

test('pattern strategy keeps its method label and only uses the supplied past', () => {
  const history = rows(Array(40).fill(8));
  assert.deepEqual(predict(history), { prediction: 'Besar', method: 'pola-6' });
  assert.deepEqual(predict(rows([1, 1, 8])), { prediction: 'Kecil', method: 'mayoritas-30' });
  assert.deepEqual(
    predict([], () => 0.1),
    { prediction: 'Kecil', method: 'acak' },
  );
});
test('pattern indicators describe complete streaks and alternating samples', () => {
  const result = analyzePatterns(rows([1, 8, 1, 8, 8, 8, 8, 8]));
  assert.deepEqual(result.dragon, { category: 'Besar', count: 5, ago: 0 });
  assert.equal(result.streak.count, 5);
  assert.equal(analyzePatterns(rows([1, 8, 1, 8, 1, 8, 1, 8, 1, 8])).alternating10, true);
  assert.equal(analyzePatterns([]).longestAlternating, 0);
});
test('walk-forward backtest is deterministic and needs a warmup', () => {
  const history = rows(Array.from({ length: 150 }, (_, i) => i % 10));
  assert.deepEqual(backtest(history), backtest(history));
  assert.equal(backtest(history).comparison[0].total, 50);
  assert.equal(backtest(rows([1, 2])).comparison[0].accuracy, null);
  for (const row of backtest(rows(Array(110).fill(8))).comparison.filter(
    (row) => row.method !== 'acak',
  )) {
    assert.equal(row.correct, 10);
  }
});
test('per-method totals are persisted and match cumulative session totals', () => {
  const session = newSession();
  const history = rows(Array(40).fill(8));
  advanceSession(
    session,
    { issue: '20261014000000040', list: [], fetchedAt: 1000, expiresAt: 25000 },
    () => 0.1,
    history,
  );
  assert.equal(session.rows[0].picks['pola-6'], 'Besar');
  advanceSession(
    session,
    {
      issue: '20261014000000041',
      list: [{ issueNumber: '20261014000000040', hasil: 8 }],
      fetchedAt: 1000,
      expiresAt: 25000,
    },
    () => 0.1,
    history,
  );
  assert.equal(restoreSession(JSON.parse(JSON.stringify(session))).methods['pola-6'].win, 1);
});

test('live predictions exclude archive results at or after the current issue', () => {
  const session = newSession();
  const future = Array.from({ length: 40 }, (_, i) => ({
    p: String(20261015000000100n + BigInt(i)),
    h: 8,
  }));
  const past = [{ p: '20261014000000001', h: 1 }];
  advanceSession(
    session,
    { issue: '20261015000000001', list: [], fetchedAt: 1000, expiresAt: 25000 },
    () => 0.9,
    [...future, ...past],
  );
  assert.equal(session.rows[0].picks['mayoritas-30'], 'Kecil');
});
