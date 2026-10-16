import test from 'node:test';
import assert from 'node:assert/strict';
import { issueDayLabel } from '../src/data.js';

test('issueDayLabel membaca tanggal dari 8 digit pertama periode', () => {
  assert.equal(issueDayLabel('20261016100051444'), '16 Okt');
  assert.equal(issueDayLabel('20261015100051469'), '15 Okt');
  assert.equal(issueDayLabel('20260105100050082'), '5 Jan');
});

test('issueDayLabel memakai angka mentah bila tanggal tidak valid', () => {
  assert.equal(issueDayLabel('20261340100050082'), '20261340');
  assert.equal(issueDayLabel('20260000100050082'), '20260000');
});

test('issueDayLabel menolak input bukan periode', () => {
  assert.equal(issueDayLabel(''), '');
  assert.equal(issueDayLabel(null), '');
  assert.equal(issueDayLabel('1234567'), '');
  assert.equal(issueDayLabel(20261016100051444), '');
});
