import assert from 'node:assert/strict';
import test from 'node:test';
import { parseJsonWithRepair } from './json-utils.ts';

test('repairs common JSON mistakes only when the result is valid', () => {
  const result = parseJsonWithRepair("{name: 'Mono', enabled: True,}");

  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { name: 'Mono', enabled: true });
  assert.equal(result.text, '{"name": "Mono", "enabled": true}');
});

test('leaves unrepairable JSON invalid', () => {
  assert.equal(parseJsonWithRepair('{"name": }').ok, false);
});

test('repairs Markdown-wrapped lists of JSON objects', () => {
  const input = [
    '{"looking\\_for":"Backend developers!","logo":"[https://example.com/logo\\_1.png](https://example.com/logo_1.png)"},',
    '```json',
    '{"looking_for":"Entrepreneur in Residence","logo":"https://example.com/logo_2.png"},',
    '```',
  ].join('\n');
  const result = parseJsonWithRepair(input);

  assert.equal(result.ok, true);
  assert.deepEqual(result.data, [
    { looking_for: 'Backend developers!', logo: 'https://example.com/logo_1.png' },
    { looking_for: 'Entrepreneur in Residence', logo: 'https://example.com/logo_2.png' },
  ]);
});
