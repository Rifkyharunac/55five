import { issueId, digit, category, colors, compareIssues } from './data.js';
import { predictAll, METHODS, primaryDecision } from './strategy.js';

export const HISTORY_LIMIT = 500;
export const INITIAL_BALANCE = 1000;
export const STAKE = 10;

const PICK_VALUES = ['Besar', 'Kecil', null];

export function newSession() {
  return {
    version: 4,
    primary: { win: 0, lose: 0, abstained: 0, missed: 0 },
    currentIssue: null,
    rows: [],
    rounds: 0,
    win: 0,
    lose: 0,
    missed: 0,
    methods: Object.fromEntries(METHODS.map((method) => [method, { win: 0, lose: 0 }])),
    createdAt: Date.now(),
  };
}

function validPicks(picks) {
  return (
    picks &&
    typeof picks === 'object' &&
    METHODS.every((method) => PICK_VALUES.includes(picks[method]))
  );
}

export function restoreSession(value) {
  if (
    !value ||
    ![3, 4].includes(value.version) ||
    !Array.isArray(value.rows) ||
    value.rows.length > HISTORY_LIMIT ||
    !['rounds', 'win', 'lose', 'missed'].every(
      (key) => Number.isSafeInteger(value[key]) && value[key] >= 0,
    ) ||
    !Number.isFinite(value.createdAt) ||
    (value.currentIssue !== null &&
      (typeof value.currentIssue !== 'string' || !issueId(value.currentIssue)))
  )
    return newSession();
  const seen = new Set();
  let scored = 0;
  for (const row of value.rows) {
    if (
      !row ||
      typeof row.issue !== 'string' ||
      !issueId(row.issue) ||
      !validPicks(row.picks) ||
      (row.legacy !== undefined && typeof row.legacy !== 'boolean') ||
      (value.version === 4 &&
        row.legacy !== true &&
        (!PICK_VALUES.includes(row.decision) || row.decision !== primaryDecision(row.picks))) ||
      !['pending', 'scored', 'missed'].includes(row.status) ||
      seen.has(row.issue) ||
      !value.currentIssue ||
      compareIssues(row.issue, value.currentIssue) > 0 ||
      (row.status === 'scored' ? digit(row.result) === null : row.result !== null)
    )
      return newSession();
    seen.add(row.issue);
    if (row.status === 'scored') scored++;
  }
  // Totals are cumulative while rows are capped at HISTORY_LIMIT, so only the
  // weaker invariant (cumulative >= retained) can be checked, plus internal
  // consistency: per-method sums match the grand totals and no method can have
  // more than one outcome per scored round.
  if (
    value.rounds < scored ||
    value.missed < value.rows.filter((row) => row.status === 'missed').length ||
    METHODS.some(
      (method) =>
        !value.methods?.[method] ||
        ['win', 'lose'].some(
          (key) =>
            !Number.isSafeInteger(value.methods[method][key]) || value.methods[method][key] < 0,
        ) ||
        value.methods[method].win + value.methods[method].lose > value.rounds,
    ) ||
    ['win', 'lose'].some(
      (key) => METHODS.reduce((sum, method) => sum + value.methods[method][key], 0) !== value[key],
    )
  )
    return newSession();
  const primary =
    value.version === 3 ? { win: 0, lose: 0, abstained: 0, missed: 0 } : value.primary;
  if (
    !primary ||
    !['win', 'lose', 'abstained', 'missed'].every(
      (key) => Number.isSafeInteger(primary[key]) && primary[key] >= 0,
    )
  )
    return newSession();
  const retained = { win: 0, lose: 0, abstained: 0, missed: 0 };
  if (value.version === 4)
    for (const row of value.rows) {
      if (row.legacy) continue;
      if (row.status === 'missed') retained.missed++;
      if (row.status === 'scored') {
        const outcome =
          row.decision === null
            ? 'abstained'
            : category(row.result) === row.decision
              ? 'win'
              : 'lose';
        retained[outcome]++;
      }
    }
  if (
    Object.keys(retained).some((key) => primary[key] < retained[key]) ||
    primary.win + primary.lose + primary.abstained > value.rounds ||
    primary.missed > value.missed
  )
    return newSession();
  return {
    version: 4,
    primary: { ...primary },
    currentIssue: value.currentIssue,
    createdAt: value.createdAt,
    rounds: value.rounds,
    win: value.win,
    lose: value.lose,
    missed: value.missed,
    methods: Object.fromEntries(
      METHODS.map((method) => [
        method,
        { win: value.methods[method].win, lose: value.methods[method].lose },
      ]),
    ),
    rows: value.rows.map((row) => ({
      issue: row.issue,
      ...(value.version === 3 || row.legacy === true
        ? { legacy: true }
        : { decision: row.decision }),
      picks: Object.fromEntries(METHODS.map((method) => [method, row.picks[method]])),
      status: row.status,
      result: row.status === 'scored' ? Number(row.result) : null,
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
      const actual = category(row.result);
      for (const method of METHODS) {
        const pick = row.picks[method];
        if (pick === null) continue;
        const outcome = actual === pick ? 'win' : 'lose';
        state[outcome]++;
        state.methods[method][outcome]++;
      }
      if (!row.legacy) {
        const outcome =
          row.decision === null ? 'abstained' : actual === row.decision ? 'win' : 'lose';
        state.primary[outcome]++;
      }
      row.status = 'scored';
      state.rounds++;
      changed = true;
    } else if (oldest && compareIssues(row.issue, oldest) < 0) {
      row.status = 'missed';
      state.missed++;
      if (!row.legacy) state.primary.missed++;
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
    const picks = predictAll(
      mergeHistory(history, [], Infinity).filter((row) => compareIssues(row.p, issue) < 0),
      random,
      issue,
    );
    state.rows.unshift({
      issue,
      picks,
      decision: primaryDecision(picks),
      status: 'pending',
      result: null,
    });
    const removed = state.rows.splice(HISTORY_LIMIT);
    state.missed += removed.filter((row) => row.status === 'pending').length;
    state.primary.missed += removed.filter((row) => row.status === 'pending' && !row.legacy).length;
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
  stats.uniformity = chiSquareUniform(stats.frequency);
  return stats;
}

// Nilai kritis chi-square df=9 pada alpha=0,05 (tabel baku statistik).
export const CHI_SQUARE_DF9_CRITICAL_95 = 16.919;

// Uji goodness-of-fit: apakah frekuensi angka 0-9 pada sampel terlihat
// merata (distribusi seragam)? Murni deskriptif: hasilnya hanya
// menggambarkan sampel, tidak mengatakan apa pun tentang ronde berikutnya.
export function chiSquareUniform(frequency) {
  const counts = Array.isArray(frequency) ? frequency.slice(0, 10) : [];
  if (counts.length < 10 || counts.some((count) => !Number.isInteger(count) || count < 0))
    return null;
  const n = counts.reduce((sum, count) => sum + count, 0);
  if (n === 0) return null;
  const expected = n / 10;
  const chi2 = counts.reduce((sum, observed) => sum + (observed - expected) ** 2 / expected, 0);
  return {
    n,
    chi2,
    df: 9,
    critical: CHI_SQUARE_DF9_CRITICAL_95,
    uniform: chi2 <= CHI_SQUARE_DF9_CRITICAL_95,
  };
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
