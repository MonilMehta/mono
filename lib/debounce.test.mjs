import assert from 'node:assert/strict';
import test from 'node:test';
import { debounce } from './debounce.ts';

test('Markdown edits commit only the latest value after a fresh three-second pause', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const committed = [];
  const update = debounce((value) => committed.push(value), 3000);
  update('first draft');
  context.mock.timers.tick(2999);
  assert.deepEqual(committed, []);
  update('latest draft');
  context.mock.timers.tick(2999);
  assert.deepEqual(committed, []);
  context.mock.timers.tick(1);
  assert.deepEqual(committed, ['latest draft']);
  update('discarded update');
  update.cancel();
  context.mock.timers.tick(3000);
  assert.deepEqual(committed, ['latest draft']);
});
