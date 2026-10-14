import { issueId, digit, category, colors, compareIssues } from './data.js';
import { predict, METHODS } from './strategy.js';

export const HISTORY_LIMIT = 500;
export const INITIAL_BALANCE = 1000;
export const STAKE = 10;

export function newSession() {
  return {
    version: 2,
    currentIssue: null,
    rows: [],
    win: 0,
    lose: 0,
    missed: 0,
    methods: Object.fromEntries(METHODS.map((method) => [method, { win: 0, lose: 0 }])),
    createdAt: Date.now(),
  };
}

export function restoreSession(value) {
  if (
    !value ||
    value.version !== 2 ||
    !Array.isArray(value.rows) ||
    value.rows.length > HISTORY_LIMIT ||
    !['win', 'lose', 'missed'].every(
      (key) => Number.isSafeInteger(value[key]) && value[key] >= 0,
    ) ||
    !Number.isFinite(value.createdAt) ||
    (value.currentIssue !== null &&
      (typeof value.currentIssue !== 'string' || !issueId(value.currentIssue)))
  )
    return newSession();
  const seen = new Set();
  for (const row of value.rows) {
    if (
      !row ||
      typeof row.issue !== 'string' ||
      !issueId(row.issue) ||
      !['Besar', 'Kecil'].includes(row.prediction) ||
      !['pending', 'win', 'lose', 'missed'].includes(row.status) ||
      (row.method !== undefined && !METHODS.includes(row.method)) ||
      seen.has(row.issue) ||
      !value.currentIssue ||
      compareIssues(row.issue, value.currentIssue) > 0 ||
      (['win', 'lose'].includes(row.status) &&
        (digit(row.result) === null ||
          (category(row.result) === row.prediction ? 'win' : 'lose') !== row.status))
    )
      return newSession();
    seen.add(row.issue);
  }
  if (
    ['win', 'lose', 'missed'].some(
      (key) => value[key] < value.rows.filter((row) => row.status === key).length,
    )
  )
    return newSession();
  const methods =
    value.methods ??
    Object.fromEntries(
      METHODS.map((method) => [
        method,
        {
          win: method === 'acak' ? value.win : 0,
          lose: method === 'acak' ? value.lose : 0,
        },
      ]),
    );
  if (
    METHODS.some(
      (method) =>
        !methods[method] ||
        ['win', 'lose'].some(
          (key) => !Number.isSafeInteger(methods[method][key]) || methods[method][key] < 0,
        ),
    ) ||
    ['win', 'lose'].some(
      (key) => METHODS.reduce((sum, method) => sum + methods[method][key], 0) !== value[key],
    )
  )
    return newSession();
  return {
    version: 2,
    currentIssue: value.currentIssue,
    createdAt: value.createdAt,
    win: value.win,
    lose: value.lose,
    missed: value.missed,
    methods: Object.fromEntries(
      METHODS.map((method) => [method, { win: methods[method].win, lose: methods[method].lose }]),
    ),
    rows: value.rows.map((row) => ({
      issue: row.issue,
      prediction: row.prediction,
      method: row.method || 'acak',
      status: row.status,
      result: ['win', 'lose'].includes(row.status) ? Number(row.result) : null,
    })),
  };
}

export function advanceSession(state, data, random = Math.random, history = []) {
  const issue = issueId(data?.issue);
  if (!issue || (state.currentIssue && compareIssues(issue, state.currentIssue) < 0)) return false;
  const results = new Map(
    (data.list || [])
      .filter((row) => issueId(row.issueNumber) && digit(row.hasil) !== null)
      .map((row) => [row.issueNumber, Number(row.hasil)]),
  );
  const oldest = [...results.keys()].sort(compareIssues)[0];
  let changed = false;
  for (const row of state.rows) {
    if (row.status !== 'pending') continue;
    if (results.has(row.issue)) {
      row.result = results.get(row.issue);
      row.status = category(row.result) === row.prediction ? 'win' : 'lose';
      state[row.status]++;
      state.methods[row.method || 'acak'][row.status]++;
      changed = true;
    } else if (oldest && compareIssues(row.issue, oldest) < 0) {
      row.status = 'missed';
      state.missed++;
      changed = true;
    }
  }
  if (issue !== state.currentIssue) {
    state.currentIssue = issue;
    changed = true;
  }
  if (
    !state.rows.some((row) => row.issue === issue) &&
    !results.has(issue) &&
    Number.isFinite(data.expiresAt) &&
    data.expiresAt - data.fetchedAt > 3000
  ) {
    const estimate = predict(
      history.filter((row) => compareIssues(row.p, issue) < 0),
      random,
    );
    state.rows.unshift({
      issue,
      ...estimate,
      status: 'pending',
      result: null,
    });
    const removed = state.rows.splice(HISTORY_LIMIT);
    state.missed += removed.filter((row) => row.status === 'pending').length;
    changed = true;
  }
  return changed;
}

export function mergeHistory(previous = [], incoming = [], limit = HISTORY_LIMIT) {
  const entries = new Map();
  for (const row of [
    ...(Array.isArray(previous) ? previous : []),
    ...(Array.isArray(incoming) ? incoming : []),
  ]) {
    if (!row || typeof row !== 'object') continue;
    const p = issueId(row.p ?? row.issueNumber);
    const h = digit(row.h ?? row.hasil);
    if (p && h !== null) entries.set(p, { p, h });
  }
  return [...entries.values()].sort((a, b) => compareIssues(b.p, a.p)).slice(0, limit);
}

export function filterHistory(
  history,
  { category: selected = '', query = '', limit = HISTORY_LIMIT } = {},
) {
  const count =
    Number(limit) === 0
      ? Infinity
      : [30, 100, 500].includes(Number(limit))
        ? Number(limit)
        : HISTORY_LIMIT;
  return mergeHistory(history, [], Infinity)
    .filter((row) => (!selected || category(row.h) === selected) && row.p.includes(query.trim()))
    .slice(0, count);
}

export function statistics(history) {
  const rows = mergeHistory(history, [], Infinity);
  const stats = {
    total: rows.length,
    big: 0,
    small: 0,
    frequency: Array(10).fill(0),
    colors: { Hijau: 0, Merah: 0, Ungu: 0 },
    streak: { category: null, count: 0 },
    maxBig: 0,
    maxSmall: 0,
  };
  let run = 0,
    previous = null;
  for (const row of rows) {
    stats.frequency[row.h]++;
    const name = category(row.h);
    stats[name === 'Besar' ? 'big' : 'small']++;
    for (const color of colors(row.h)) stats.colors[color]++;
    run = name === previous ? run + 1 : 1;
    previous = name;
    const key = name === 'Besar' ? 'maxBig' : 'maxSmall';
    stats[key] = Math.max(stats[key], run);
  }
  if (rows.length) {
    stats.streak.category = category(rows[0].h);
    for (const row of rows) {
      if (category(row.h) !== stats.streak.category) break;
      stats.streak.count++;
    }
  }
  return stats;
}

export function historyCsv(history) {
  const rows = [
    ['Periode', 'Angka', 'Kategori', 'Warna'],
    ...mergeHistory(history, [], Infinity).map((row) => [
      row.p,
      row.h,
      category(row.h),
      colors(row.h).join(' + '),
    ]),
  ];
  return (
    '\uFEFF' +
    rows
      .map((row) => row.map((cell) => '"' + String(cell).replaceAll('"', '""') + '"').join(','))
      .join('\r\n')
  );
}
