import { issueId, normalizeResult, compareIssues } from '../src/data.js';

const BASE_URL = 'https://newapi.55lottertttapi.com/api/webapi/';
// Preserve the working signed requests; do not guess a new signing algorithm.
const ISSUE_BODY = {
  typeId: 30,
  language: 0,
  random: '166b81d9568e4123a83a2c7fdb80b7d9',
  signature: '5DB43C344C7381B72B5262FFB3572444',
  timestamp: 1737252405,
};
const HISTORY_BODY = {
  pageSize: 10,
  pageNo: 1,
  typeId: 30,
  language: 0,
  random: 'b631eb26bac6403e99093913e5bb48c5',
  signature: 'A6203E85132E5FE26B5F43DDF1ECDD07',
  timestamp: 1737252405,
};

export class ProviderError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function requestBody(env, key, fallback) {
  if (!env[key]) return fallback;
  try {
    const body = JSON.parse(env[key]);
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      body.typeId !== 30 ||
      body.language !== 0 ||
      !Number.isSafeInteger(body.timestamp) ||
      typeof body.signature !== 'string' ||
      !body.signature ||
      typeof body.random !== 'string' ||
      !body.random ||
      (key === 'FIVE55_HISTORY_BODY' &&
        (body.pageNo !== 1 ||
          !Number.isInteger(body.pageSize) ||
          body.pageSize < 1 ||
          body.pageSize > 100))
    )
      throw new Error();
    return body;
  } catch {
    throw new ProviderError('CONFIGURATION_ERROR');
  }
}

function wallTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return NaN;
  const parsed = Date.parse(value.replace(' ', 'T') + 'Z');
  return Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 19).replace('T', ' ') === value
    ? parsed
    : NaN;
}

export function createProvider({ fetchImpl = fetch, env = process.env, timeoutMs = 8000 } = {}) {
  async function request(path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(BASE_URL + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
        redirect: 'error',
      });
      if (!response.ok) throw new ProviderError('UPSTREAM_UNAVAILABLE');
      let json;
      try {
        json = await response.json();
      } catch (error) {
        if (controller.signal.aborted) throw error;
        throw new ProviderError('UPSTREAM_INVALID');
      }
      if (json?.code !== 0) throw new ProviderError('UPSTREAM_REJECTED');
      if (!json.data || typeof json.data !== 'object') throw new ProviderError('UPSTREAM_INVALID');
      return json.data;
    } catch (error) {
      if (controller.signal.aborted) throw new ProviderError('UPSTREAM_TIMEOUT');
      if (error instanceof ProviderError) throw error;
      throw new ProviderError('UPSTREAM_UNAVAILABLE');
    } finally {
      clearTimeout(timer);
    }
  }

  async function history() {
    const data = await request(
      'GetNoaverageEmerdList',
      requestBody(env, 'FIVE55_HISTORY_BODY', HISTORY_BODY),
    );
    if (!Array.isArray(data.list) || !data.list.length || data.list.length > 100)
      throw new ProviderError('UPSTREAM_INVALID');
    const rows = data.list.map(normalizeResult);
    if (rows.some((row) => !row)) throw new ProviderError('UPSTREAM_INVALID');
    const list = [...new Map(rows.map((row) => [row.issueNumber, row])).values()].sort((a, b) =>
      compareIssues(b.issueNumber, a.issueNumber),
    );
    return { count: list.length, list, fetchedAt: Date.now(), source: 'live' };
  }

  async function snapshot() {
    const startedAt = Date.now();
    const [current, results] = await Promise.all([
      request('GetGameIssue', requestBody(env, 'FIVE55_ISSUE_BODY', ISSUE_BODY)),
      history(),
    ]);
    const issue = issueId(current.issueNumber);
    if (!issue) throw new ProviderError('UPSTREAM_INVALID');
    // Subtract the round trip conservatively. Both provider times use the same zone.
    const delta = wallTime(current.endTime) - wallTime(current.serviceTime);
    const fetchedAt = Date.now();
    const remaining =
      Number.isFinite(delta) && delta >= 0 && delta <= 30000
        ? Math.max(0, delta - (fetchedAt - startedAt))
        : null;
    if (results.list.some((row) => compareIssues(row.issueNumber, issue) >= 0))
      throw new ProviderError('UPSTREAM_TRANSITION');
    return {
      issue,
      periode: issue.slice(-5),
      hasil: results.list[0].hasil,
      number: results.list[0].number,
      list: results.list,
      fetchedAt,
      expiresAt: remaining === null ? null : fetchedAt + remaining,
      intervalSeconds: 30,
      source: 'live',
    };
  }
  return { snapshot, history };
}

// Coalesce requests within a warm function; expired cache is never served on failure.
export function coalesce(load, ttl = 1000) {
  let pending,
    cached,
    validUntil = 0;
  return async () => {
    if (cached && Date.now() < validUntil) return cached;
    if (pending) return pending;
    pending = load()
      .then((value) => {
        cached = value;
        validUntil = Date.now() + ttl;
        return value;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  };
}

export const provider = createProvider();
