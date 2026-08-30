import assert from 'node:assert/strict';
import test from 'node:test';
import { createMockId, decodeMockConfig, encodeMockConfig, isValidMockId, MOCK_TTL_SECONDS } from './mock-api.ts';

test('mock configurations round-trip Unicode response bodies', () => {
  const config = {
    v: 1,
    responses: {
      GET: { status: 200, body: { message: 'hello 👋' } },
      POST: { status: 201, body: { created: true } },
      PATCH: { status: 200, body: { updated: true } },
    },
  };

  assert.deepEqual(decodeMockConfig(encodeMockConfig(config)), config);
});

test('invalid response statuses are rejected', () => {
  const config = {
    v: 1,
    responses: {
      GET: { status: 0, body: null },
      POST: { status: 201, body: null },
      PATCH: { status: 200, body: null },
    },
  };

  assert.throws(() => decodeMockConfig(encodeMockConfig(config)), /Invalid GET response/);
});

test('short mock IDs avoid ambiguous characters', () => {
  const id = createMockId(() => 0);
  assert.equal(id, 'AAAAAAAAAA');
  assert.equal(isValidMockId(id), true);
  assert.equal(isValidMockId('ABC1O0XYZQ'), false);
});

test('mock endpoints expire after four hours', () => {
  assert.equal(MOCK_TTL_SECONDS, 4 * 60 * 60);
});
