import test from 'node:test';
import assert from 'node:assert/strict';
import { createProvider, coalesce } from '../server/provider.js';
import { createHandler } from '../server/handler.js';

const issue = '20261014100050002';
const result = { issueNumber: '20261014100050001', number: '1,2,3,4,9', colour: 'green' };
function provider(fetchImpl, extra = {}) {
  return createProvider({ fetchImpl, timeoutMs: 30, ...extra });
}
function success(url) {
  return Promise.resolve(
    Response.json({
      code: 0,
      data: url.endsWith('GetGameIssue')
        ? { issueNumber: issue, endTime: '2026-10-15 00:00:00', serviceTime: '2026-10-14 23:59:45' }
        : { list: [result] },
    }),
  );
}
function response() {
  return {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(s) {
      this.statusCode = s;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    end() {},
  };
}

test('snapshot preserves the full issue and derives server countdown across midnight', async () => {
  const snapshot = await provider(success).snapshot();
  assert.equal(snapshot.issue, issue);
  assert.equal(snapshot.periode, '50002');
  assert.equal(snapshot.hasil, 9);
  assert.equal(snapshot.list[0].issueNumber, result.issueNumber);
  assert.ok(snapshot.expiresAt - snapshot.fetchedAt <= 15000);
  assert.ok(snapshot.expiresAt - snapshot.fetchedAt > 14000);
});
test('history returns validated provider rows without requiring an active period', async () => {
  const data = await provider(success).history();
  assert.equal(data.list[0].hasil, 9);
});
test('invalid digits and unsafe issue numbers fail instead of becoming false results', async () => {
  for (const row of [
    { ...result, number: '1,9oops' },
    { ...result, issueNumber: 20261014100050001 },
  ]) {
    await assert.rejects(
      provider(async () => Response.json({ code: 0, data: { list: [row] } })).history(),
      { code: 'UPSTREAM_INVALID' },
    );
  }
});
test('provider application errors and HTTP failures are not interpreted as data', async () => {
  await assert.rejects(
    provider(async () => Response.json({ code: 4, data: { list: [result] } })).history(),
    { code: 'UPSTREAM_REJECTED' },
  );
  await assert.rejects(provider(async () => new Response('down', { status: 503 })).snapshot(), {
    code: 'UPSTREAM_UNAVAILABLE',
  });
});
test('malformed JSON is a controlled upstream error', async () => {
  await assert.rejects(provider(async () => new Response('<html>')).history(), {
    code: 'UPSTREAM_INVALID',
  });
});
test('timeout aborts the upstream request', async () => {
  const fetchImpl = (_, { signal }) =>
    new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  await assert.rejects(provider(fetchImpl).history(), { code: 'UPSTREAM_TIMEOUT' });
});
test('handler rejects writes and returns sanitized errors', async () => {
  let called = false;
  const handler = createHandler(async () => {
    called = true;
    throw new Error('secret-value');
  });
  const write = response();
  await handler({ method: 'POST' }, write);
  assert.equal(write.statusCode, 405);
  assert.equal(called, false);
  const read = response();
  await handler({ method: 'GET' }, read);
  assert.equal(read.statusCode, 502);
  assert.ok(!JSON.stringify(read.body).includes('secret-value'));
  assert.equal(read.headers['Cache-Control'], 'no-store');
});

test('invalid provider time disables countdown instead of using the client clock', async () => {
  const service = provider(async (url) =>
    url.endsWith('GetGameIssue')
      ? Response.json({
          code: 0,
          data: { issueNumber: issue, endTime: 'invalid', serviceTime: 'invalid' },
        })
      : success(url),
  );
  assert.equal((await service.snapshot()).expiresAt, null);
});

test('inconsistent period rollover returns a controlled retryable error', async () => {
  const service = provider(async (url) =>
    url.endsWith('GetGameIssue')
      ? success(url)
      : Response.json({ code: 0, data: { list: [{ ...result, issueNumber: issue }] } }),
  );
  await assert.rejects(service.snapshot(), { code: 'UPSTREAM_TRANSITION' });
});

test('invalid environment overrides do not leak the submitted configuration', async () => {
  const service = provider(success, { env: { FIVE55_ISSUE_BODY: 'secret-not-json' } });
  await assert.rejects(service.snapshot(), { code: 'CONFIGURATION_ERROR' });
});

test('concurrent loads are coalesced and expired data is not returned after an error', async () => {
  let finish,
    calls = 0;
  const load = coalesce(() => {
    calls++;
    return new Promise((resolve) => {
      finish = resolve;
    });
  }, 0);
  const first = load(),
    second = load();
  assert.equal(calls, 1);
  finish({ value: 1 });
  assert.deepEqual(await first, await second);
  let shouldFail = false;
  const failing = coalesce(async () => {
    if (shouldFail) throw new Error('down');
    return { value: 1 };
  }, 0);
  await failing();
  shouldFail = true;
  await assert.rejects(failing(), /down/);
});
