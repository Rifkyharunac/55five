// Walk-forward comparison; each prediction only sees earlier observations.
import { readFile } from 'node:fs/promises';
import { backtest } from './src/experiments.js';
const input = JSON.parse(await readFile(process.argv[2] || 'data/riwayat.json', 'utf8'));
if (!Array.isArray(input)) throw new Error('Dataset must be an array');
console.log(JSON.stringify(backtest(input), null, 2));
