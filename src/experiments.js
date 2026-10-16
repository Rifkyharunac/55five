import { category } from './data.js';
import { mergeHistory, statistics } from './model.js';
import { predictAll, METHODS, primaryDecision } from './strategy.js';
export { predict } from './strategy.js';

export function analyzePatterns(history) {
  const rows = mergeHistory(history).slice(0, 100);
  const streak = statistics(rows).streak;
  let dragon = null,
    run = 0;
  for (let i = 0; i < rows.length; i++) {
    const current = category(rows[i].h);
    run++;
    if (i === rows.length - 1 || category(rows[i + 1].h) !== current) {
      if (run >= 4 && !dragon) dragon = { category: current, count: run, ago: i - run + 1 };
      run = 0;
    }
  }
  let longestAlternating = rows.length ? 1 : 0,
    alternating = longestAlternating;
  for (let i = 1; i < Math.min(20, rows.length); i++) {
    alternating = category(rows[i].h) !== category(rows[i - 1].h) ? alternating + 1 : 1;
    longestAlternating = Math.max(longestAlternating, alternating);
  }
  const alternating10 =
    rows.length >= 10 &&
    rows.slice(1, 10).every((row, i) => category(row.h) !== category(rows[i].h));
  return { streak, dragon, longestAlternating, alternating10 };
}

function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function backtest(history, { warmup = 100, seed = 20261014 } = {}) {
  const rows = mergeHistory(history, [], Infinity).reverse();
  const random = seededRandom(seed);
  const comparison = METHODS.map((method) => ({
    method,
    correct: 0,
    total: 0,
    abstained: 0,
    accuracy: null,
  }));
  const primary = { method: 'utama', correct: 0, total: 0, abstained: 0, accuracy: null };
  for (let t = warmup; t < rows.length; t++) {
    const past = rows.slice(0, t).reverse();
    const predictions = predictAll(past, random, rows[t].p);
    predictions.utama = primaryDecision(predictions);
    [primary, ...comparison].forEach((result) => {
      const pick = predictions[result.method];
      if (pick === null) {
        result.abstained++;
        return;
      }
      result.total++;
      if (pick === category(rows[t].h)) result.correct++;
    });
  }
  for (const result of [primary, ...comparison])
    result.accuracy = result.total
      ? Number(((100 * result.correct) / result.total).toFixed(2))
      : null;
  return { rounds: rows.length, warmup, seed, primary, comparison };
}
