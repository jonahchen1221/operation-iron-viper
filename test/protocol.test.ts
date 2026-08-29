import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_INPUT } from '../src/core/constants';
import { normalizePlayerName, sanitizeInput } from '../src/net/protocol';

test('player names are safe, uppercase and bounded', () => {
  assert.equal(normalizePlayerName('  viper <script>  '), 'VIPER SCRIPT');
  assert.equal(normalizePlayerName('abcdefghijklmnop'), 'ABCDEFGHIJKL');
  assert.equal(normalizePlayerName('   '), 'ROOKIE');
});

test('network inputs require the complete boolean shape', () => {
  assert.deepEqual(sanitizeInput({ ...EMPTY_INPUT, fire: true }), { ...EMPTY_INPUT, fire: true });
  assert.equal(sanitizeInput({ ...EMPTY_INPUT, fire: 'yes' }), null);
  assert.equal(sanitizeInput(null), null);
});
