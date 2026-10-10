import test from 'node:test';
import assert from 'node:assert/strict';
import { category } from '../logic.mjs';
test('invalid results never become a category (legacy regression)', () => {
  for (const value of [null, undefined, '', '8x', '1,8', NaN, -1, 10, false]) assert.equal(category(value), null);
  assert.equal(category(0), 'Kecil');
  assert.equal(category('9'), 'Besar');
});
