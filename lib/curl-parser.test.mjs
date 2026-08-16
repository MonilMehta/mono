import assert from 'node:assert/strict';
import test from 'node:test';
import { curlToBrowserRequest, parseCurl } from './curl-parser.ts';

test('browser requests omit restricted cURL headers', () => {
  const parsed = parseCurl("curl 'https://example.com' -H 'Cookie: secret=1' -H 'Accept: application/json'");
  const request = curlToBrowserRequest(parsed);
  assert.deepEqual(request.init.headers, { Accept: 'application/json' });
  assert.deepEqual(request.omittedHeaders, ['Cookie']);
  assert.equal(request.init.credentials, 'omit');
});

test('browser requests reject GET bodies', () => {
  const parsed = parseCurl("curl 'https://example.com' -X GET --data 'hello'");
  assert.throws(() => curlToBrowserRequest(parsed), /cannot send a body with GET/);
});
