import { category, issueId } from './data.js';

export const METHODS = ['pola-6', 'mayoritas-30', 'mayoritas-all', 'acak'];

// Conservative adjacency: a date rollover or unknown ID format starts a new segment.
// Never convert full provider IDs to Number (they exceed safe integer precision).
export function adjacent(newer, older) {
  return Boolean(issueId(newer) && issueId(older) && BigInt(newer) - BigInt(older) === 1n);
}

function contiguous(history) {
  return history.every((row, i) => i === 0 || adjacent(history[i - 1].p, row.p));
}

// Input is validated history, newest first. A pattern and its observed next result
// must be consecutive rounds. Missing archive rounds are not adjacent observations.
export function patternPrediction(history, targetIssue = null) {
  if (history.length < 27 || !contiguous(history.slice(0, 6))) return null;
  if (targetIssue !== null && !adjacent(targetIssue, history[0].p)) return null;
  const query = history.slice(0, 6).map((row) => category(row.h));
  let matches = 0,
    big = 0;
  // Start after the entire query, including the candidate's outcome. Once matched,
  // skip its seven rows so one long streak cannot supply overlapping examples.
  for (let j = 7; j + 6 <= history.length; j++) {
    if (
      contiguous(history.slice(j - 1, j + 6)) &&
      query.every((value, k) => value === category(history[j + k].h))
    ) {
      matches++;
      if (history[j - 1].h >= 5) big++;
      j += 6;
    }
  }
  // Three examples is a minimum availability rule, not statistical confidence.
  return matches < 3 || big * 2 === matches ? null : big * 2 > matches ? 'Besar' : 'Kecil';
}

export function majority(history) {
  const big = history.filter((row) => row.h >= 5).length;
  return big * 2 === history.length ? null : big * 2 > history.length ? 'Besar' : 'Kecil';
}

export function predict(history, random = Math.random) {
  const pattern = patternPrediction(history);
  if (pattern) return { prediction: pattern, method: 'pola-6' };
  if (!history.length) return { prediction: random() > 0.5 ? 'Besar' : 'Kecil', method: 'acak' };
  const recent = majority(history.slice(0, 30));
  if (recent) return { prediction: recent, method: 'mayoritas-30' };
  const overall = majority(history);
  return overall
    ? { prediction: overall, method: 'mayoritas-all' }
    : { prediction: random() > 0.5 ? 'Besar' : 'Kecil', method: 'acak' };
}

// Prediksi keempat metode sekaligus untuk satu ronde. Nilai null berarti
// metode abstain (tidak punya sinyal) dan tidak dihitung menang/kalah.
export function predictAll(history, random = Math.random, targetIssue = null) {
  return {
    'pola-6': patternPrediction(history, targetIssue),
    'mayoritas-30': majority(history.slice(0, 30)),
    'mayoritas-all': majority(history),
    acak: random() > 0.5 ? 'Besar' : 'Kecil',
  };
}
