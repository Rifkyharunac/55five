import test from 'node:test';
import assert from 'node:assert/strict';
import { picksSummary } from '../src/render.js';

test('picksSummary menampilkan hitungan suara metode, bukan pengali', () => {
  assert.equal(
    picksSummary({
      'pola-6': 'Besar',
      'mayoritas-30': 'Kecil',
      'mayoritas-all': 'Kecil',
      acak: 'Kecil',
    }),
    'Kecil (3 suara) · Besar (1 suara)',
  );
});

test('picksSummary menaruh suara terbanyak dulu dan menangani seri/abstain', () => {
  assert.equal(
    picksSummary({
      'pola-6': 'Besar',
      'mayoritas-30': 'Besar',
      'mayoritas-all': 'Kecil',
      acak: null,
    }),
    'Besar (2 suara) · Kecil (1 suara)',
  );
  assert.equal(
    picksSummary({
      'pola-6': 'Besar',
      'mayoritas-30': 'Kecil',
      'mayoritas-all': null,
      acak: null,
    }),
    'Besar (1 suara) · Kecil (1 suara)',
  );
  assert.equal(
    picksSummary({
      'pola-6': null,
      'mayoritas-30': null,
      'mayoritas-all': null,
      acak: null,
    }),
    '—',
  );
});
