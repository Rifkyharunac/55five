import test from 'node:test';
import assert from 'node:assert/strict';
import { primaryDecision } from '../src/strategy.js';
import { backtest } from '../src/experiments.js';
import { newSession, advanceSession, restoreSession } from '../src/model.js';
const id = (n) => String(20261016100050000n + BigInt(n));
const snap = (n, list = []) => ({ issue: id(n), list, fetchedAt: 1000, expiresAt: 25000 });
const past = Array.from({ length: 40 }, (_, i) => ({ p: id(i), h: 1 })).reverse();
test('primary ignores random, requires two agreeing historical methods and abstains on ties', () => {
  assert.equal(
    primaryDecision({
      'pola-6': 'Besar',
      'mayoritas-30': 'Kecil',
      'mayoritas-all': 'Kecil',
      acak: 'Besar',
    }),
    'Kecil',
  );
  assert.equal(
    primaryDecision({
      'pola-6': null,
      'mayoritas-30': 'Besar',
      'mayoritas-all': 'Kecil',
      acak: 'Besar',
    }),
    null,
  );
  assert.equal(
    primaryDecision({
      'pola-6': null,
      'mayoritas-30': null,
      'mayoritas-all': 'Kecil',
      acak: 'Kecil',
    }),
    null,
  );
});
test('one round contributes one primary outcome, independent of all method outcomes', () => {
  const s = newSession();
  advanceSession(s, snap(40), () => 0.9, past);
  assert.equal(s.rows[0].decision, 'Kecil');
  advanceSession(s, snap(41, [{ issueNumber: id(40), hasil: 8 }]), () => 0.1, past);
  assert.deepEqual(s.primary, { win: 0, lose: 1, abstained: 0, missed: 0 });
  assert.equal(s.methods.acak.win, 1);
  advanceSession(s, snap(41, [{ issueNumber: id(40), hasil: 8 }]), () => 0.9, past);
  assert.equal(s.primary.lose, 1);
  assert.deepEqual(restoreSession(JSON.parse(JSON.stringify(s))).primary, s.primary);
});
test('abstention never affects primary balance or accuracy', () => {
  const s = newSession();
  advanceSession(s, snap(1), () => 0.9);
  advanceSession(s, snap(2, [{ issueNumber: id(1), hasil: 8 }]), () => 0.9);
  assert.deepEqual(s.primary, { win: 0, lose: 0, abstained: 1, missed: 0 });
});
test('v3 sessions keep method history but never invent retrospective primary predictions', () => {
  const s = newSession();
  advanceSession(s, snap(40), () => 0.9, past);
  s.version = 3;
  delete s.primary;
  for (const r of s.rows) delete r.decision;
  const restored = restoreSession(s);
  assert.equal(restored.rows.length, 1);
  assert.equal(restored.rows[0].legacy, true);
  advanceSession(restored, snap(41, [{ issueNumber: id(40), hasil: 1 }]), () => 0.9, past);
  assert.equal(restored.primary.win, 0);
  assert.equal(restored.methods['pola-6'].win, 1);
  assert.equal(restoreSession(JSON.parse(JSON.stringify(restored))).rows.length, 2);
});

test('primary backtest uses the same frozen decision as live scoring', () => {
  const history = Array.from({ length: 130 }, (_, i) => ({ p: id(i), h: i % 7 === 0 ? 8 : 1 }));
  const state = newSession();
  for (let i = 100; i < 130; i++)
    advanceSession(
      state,
      snap(i, i > 100 ? [{ issueNumber: id(i - 1), hasil: history[i - 1].h }] : []),
      () => 0.9,
      history.slice(0, i),
    );
  advanceSession(state, {
    ...snap(130, [{ issueNumber: id(129), hasil: history[129].h }]),
    expiresAt: null,
  });
  const result = backtest(history).primary;
  assert.equal(result.correct, state.primary.win);
  assert.equal(result.total, state.primary.win + state.primary.lose);
  assert.equal(result.abstained, state.primary.abstained);
});
