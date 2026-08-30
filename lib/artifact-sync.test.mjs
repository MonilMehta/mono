import assert from 'node:assert/strict';
import test from 'node:test';
import { changedRecords, mergeRecords } from './artifact-sync.ts';

test('stale windows persist only their changed records', () => {
  const original = { id: 'original', priority: 'p1' };
  const added = { id: 'added', priority: 'p1' };
  const updated = { ...original, priority: 'p0' };
  const windowA = [added, original];
  const windowB = [updated];

  let stored = mergeRecords([original], changedRecords([original], windowA));
  stored = mergeRecords(stored, changedRecords([original], windowB));

  assert.deepEqual(stored, [updated, added]);
});
