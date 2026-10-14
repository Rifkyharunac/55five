import test from 'node:test';
import assert from 'node:assert/strict';
import { createPoller, fetchSnapshot } from '../src/network.js';
import { createStorage } from '../src/storage.js';

test('failed startup schedules a retry and a later success resets the backoff', async () => {
  let calls = 0;
  const scheduled = [];
  const states = [];
  const poller = createPoller({
    load: async () => {
      if (++calls === 1) throw new Error('offline');
      return { issue: 'ok' };
    },
    onData: (data) => states.push(data.issue),
    onStatus: (state) => states.push(state),
    schedule: (fn, ms) => {
      scheduled.push({ fn, ms });
      return scheduled.length;
    },
    cancel: () => {},
  });
  await poller.refresh();
  assert.ok(states.includes('error'));
  assert.equal(scheduled.at(-1).ms, 4000);
  await scheduled.at(-1).fn();
  assert.ok(states.includes('ok'));
  assert.equal(scheduled.at(-1).ms, 2000);
  poller.stop();
});
test('manual refresh cannot overlap an active request', async () => {
  let complete,
    calls = 0;
  const poller = createPoller({
    load: () => {
      calls++;
      return new Promise((resolve) => {
        complete = resolve;
      });
    },
    onData() {},
    onStatus() {},
    schedule: () => 1,
    cancel() {},
  });
  const pending = poller.refresh();
  await poller.refresh();
  assert.equal(calls, 1);
  complete({});
  await pending;
  poller.stop();
});
test('paused poll does not apply responses that arrive after pause', async () => {
  let complete,
    applied = 0;
  const poller = createPoller({
    load: () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
    onData: () => applied++,
    onStatus() {},
    schedule: () => 1,
    cancel() {},
  });
  const pending = poller.refresh();
  poller.stop();
  complete({});
  await pending;
  assert.equal(applied, 0);
});
test('client rejects HTTP failures and incomplete payloads', async () => {
  await assert.rejects(
    fetchSnapshot({
      fetchImpl: async () => Response.json({ error: 'Unavailable' }, { status: 502 }),
    }),
  );
  await assert.rejects(
    fetchSnapshot({ fetchImpl: async () => Response.json({ issue: '<script>', list: [] }) }),
  );
});
test('blocked storage falls back without crashing and announces persistence failure', () => {
  const errors = [];
  const unavailable = () => {
    throw new Error('blocked');
  };
  const storage = createStorage(unavailable, unavailable, (message) => errors.push(message));
  assert.deepEqual(storage.loadHistory(), []);
  const state = storage.loadSession();
  assert.equal(state.win, 0);
  assert.equal(storage.saveSession(state), false);
  assert.ok(errors.length > 0);
});
test('legacy history is retained and session storage is separate from device history', () => {
  const local = new Map([
    ['five55_history_v1', JSON.stringify([{ p: '20261014100050001', h: 5 }])],
  ]);
  const session = new Map();
  const store = (map) => ({
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
  });
  const storage = createStorage(
    () => store(local),
    () => store(session),
  );
  storage.saveHistory(storage.loadHistory());
  storage.saveSession(storage.loadSession());
  assert.ok(local.has('five55_history_v1'));
  assert.ok(local.has('five55_history_v2'));
  assert.ok(!local.has('five55_session_v2'));
  assert.ok(session.has('five55_session_v2'));
});
