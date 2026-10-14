import { category } from './data.js';

export const METHODS = ['pola-6', 'mayoritas-30', 'mayoritas-all', 'acak'];

// Input is validated history, newest first. All targets are older than the active issue.
export function patternPrediction(history) {
  if (history.length < 16) return null;
  const query = history.slice(0, 6).map((row) => category(row.h));
  let matches = 0,
    big = 0;
  for (let j = 6; j + 6 <= history.length; j++) {
    if (query.every((value, k) => value === category(history[j + k].h))) {
      matches++;
      if (history[j - 1].h >= 5) big++;
    }
  }
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
  return { prediction: majority(history) || 'Besar', method: 'mayoritas-all' };
}
