import { backtest } from './experiments.js';
self.onmessage = (event) => {
  try {
    self.postMessage({ result: backtest(event.data) });
  } catch {
    self.postMessage({ error: 'Backtest tidak dapat dihitung dari data ini.' });
  }
};
