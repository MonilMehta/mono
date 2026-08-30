import assert from 'node:assert/strict';
import test from 'node:test';
import { createTransferCode, isValidTransferCode, normalizeTransferCode, sanitizeFilename } from './transfer-shared.ts';

test('transfer codes and filenames are safe at API boundaries', () => {
  assert.equal(normalizeTransferCode('ab-c1 239z'), 'ABC239Z');
  assert.equal(isValidTransferCode('ABC239ZX'), true);
  assert.equal(isValidTransferCode('ABC1O0ZX'), false);
  assert.equal(sanitizeFilename('../bad\r\nname.txt'), 'badname.txt');
  assert.equal(createTransferCode(() => 0), 'AAAAAAAA');
});
