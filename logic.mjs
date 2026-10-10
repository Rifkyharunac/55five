import { evaluatePrediction } from './model.mjs';
export function issueId(value) {
  return typeof value === 'string' && /^\d{10,30}$/.test(value) ? value : null;
}
export function compareIssue(a, b) {
  return a.length - b.length || a.localeCompare(b);
}
export function digit(value) {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0 && value <= 9 ? value : null;
  if (typeof value !== 'string' || !/^\s*\d\s*$/.test(value)) return null;
  return Number(value.trim());
}
export function category(value) {
  const n = digit(value);
  return n === null ? null : n <= 4 ? 'Kecil' : 'Besar';
}
export function normalizeResults(list) {
  if (!Array.isArray(list)) throw new Error('Daftar hasil tidak valid');
  const results = new Map();
  const conflicts = new Set();
  for (const item of list) {
    const issue = issueId(item?.issueNumber);
    const number = digit(item?.number);
    if (!issue || number === null || conflicts.has(issue)) continue;
    if (results.has(issue) && results.get(issue).number !== number) {
      results.delete(issue);
      conflicts.add(issue);
    } else results.set(issue, { issueNumber: issue, number });
  }
  return [...results.values()].sort((a, b) => compareIssue(a.issueNumber, b.issueNumber));
}
export function predict(history, issue) {
  const sample = normalizeResults(history).filter(r => compareIssue(r.issueNumber, issue) < 0).slice(-1000);
  return evaluatePrediction(sample, issue);
}
export function applySnapshot(state, data) {
  const issue = issueId(data?.issue);
  if (!issue || !Array.isArray(data.list)) throw new Error('Data periode tidak valid');
  if (state.issue && compareIssue(issue, state.issue) < 0) throw new Error('Server mengirim periode lama');
  const results = normalizeResults(data.list);
  const history = normalizeResults([...state.history, ...results]).slice(-1000);
  const rows = state.rows.map(row => {
    if (row.result !== null) return row;
    const found = results.find(r => r.issueNumber === row.issue);
    return found ? { ...row, result: found.number } : row;
  });
  // Never create a prediction retrospectively after its result is already known.
  if (!rows.some(r => r.issue === issue) && !history.some(r => compareIssue(r.issueNumber, issue) >= 0)) {
    rows.unshift({ issue, prediction: predict(history, issue), result: null });
  }
  return { issue, history, rows: rows.slice(0, 200) };
}
export function accuracy(rows) {
  const scored = rows.filter(r => r.result !== null && r.prediction.label !== null);
  return { total: scored.length, wins: scored.filter(r => category(r.result) === r.prediction.label).length };
}
function validEvidence(prediction) {
  if (prediction.modelVersion !== 2) return prediction.modelVersion === undefined;
  const estimate = prediction.estimate;
  if (estimate !== undefined) {
    if (estimate?.version !== 1 || ![null,'Besar','Kecil'].includes(estimate.label) ||
      !['none','frequency','transition'].includes(estimate.method)) return false;
    if (estimate.probability === null) {
      if (estimate.label !== null || estimate.method !== 'none') return false;
    } else {
      if (!Number.isFinite(estimate.probability) || estimate.probability < 0 || estimate.probability > 1 || estimate.method === 'none') return false;
      const expected = estimate.probability === .5 ? null : estimate.probability > .5 ? 'Besar' : 'Kecil';
      if (estimate.label !== expected) return false;
    }
  }
  const e = prediction.evaluation;
  const reasons = ['insufficient','gap','context','baseline','unstable','weak','eligible'];
  if (!reasons.includes(prediction.reason) || (prediction.reason === 'eligible') !== (prediction.label !== null)) return false;
  if (!e || !Number.isInteger(e.tested) || e.tested < 0 || e.tested > 200) return false;
  for (const key of ['wins','baselineWins']) if (!Number.isInteger(e[key]) || e[key] < 0 || e[key] > e.tested) return false;
  return ['brier','baselineBrier'].every(key => e.tested === 0 ? e[key] === null : Number.isFinite(e[key]) && e[key] >= 0 && e[key] <= 1);
}
export function restore(value) {
  const empty = { issue: null, history: [], rows: [] };
  try {
    const state = JSON.parse(value);
    if (state?.version !== 1 || !Array.isArray(state.rows)) return empty;
    const seen = new Set();
    const rows = state.rows.filter(r => {
      if (!issueId(r?.issue) || seen.has(r.issue) || ![null, 'Besar', 'Kecil'].includes(r.prediction?.label) ||
          !validEvidence(r.prediction) || !Number.isInteger(r.prediction?.samples) || r.prediction.samples < 0 || r.prediction.samples > 100 ||
          !Number.isFinite(r.prediction.bigRate) || r.prediction.bigRate < 0 || r.prediction.bigRate > 1 ||
          (r.result !== null && digit(r.result) === null)) return false;
      seen.add(r.issue);
      return true;
    }).map(r => ({ issue: r.issue, prediction: r.prediction, result: r.result === null ? null : digit(r.result) }))
      .sort((a,b) => compareIssue(b.issue,a.issue)).slice(0,200);
    return { issue: rows[0]?.issue ?? null, rows, history: normalizeResults(state.history).slice(-1000) };
  } catch { return empty; }
}
export function serverRemaining(data) {
  // Both timestamps share the upstream clock; subtract without guessing its timezone.
  const parse = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value)) return NaN;
    return Date.parse(value.replace(' ', 'T') + 'Z');
  };
  const remaining = parse(data?.endTime) - parse(data?.serviceTime);
  return Number.isFinite(remaining) && remaining >= 0 && remaining <= 30000 ? remaining : null;
}
// Wilson interval for a binomial proportion. Diagnostic only: independence and
// constant success probability are assumptions, not established properties here.
export function wilson(wins,total) {
  if(!Number.isInteger(total) || total<=0 || !Number.isInteger(wins) || wins<0 || wins>total) return null;
  const z=1.959963984540054, p=wins/total, denominator=1+z*z/total;
  const centre=(p+z*z/(2*total))/denominator;
  const radius=z*Math.sqrt(p*(1-p)/total+z*z/(4*total*total))/denominator;
  return { low:Math.max(0,centre-radius), high:Math.min(1,centre+radius) };
}
export function estimateAccuracy(rows) {
  const resolved=rows.filter(r=>r.result!==null && r.prediction.estimate?.version===1 && r.prediction.estimate.label!==null);
  const wins=resolved.filter(r=>category(r.result)===r.prediction.estimate.label).length;
  return {total:resolved.length,wins,interval:wilson(wins,resolved.length)};
}
export function learningProgress(samples,tested) {
  const training=Math.min(100,Math.max(0,samples));
  const validation=Math.min(100,Math.max(0,tested));
  return {training,validation,remaining:100-training+100-validation};
}
