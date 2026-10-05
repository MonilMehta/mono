import assert from 'node:assert/strict';
import test from 'node:test';
import { boardPlacement, boardPosition, nextBoardLayer } from './task-board.ts';
import { changedRecords, mergeRecords } from './artifact-sync.ts';

test('free placement stays in bounds, survives resizing and merges across windows', () => {
  const position = boardPosition(480, 260, 1100, 700, 220);
  const placed = boardPlacement(0, 1100, position);
  assert.ok(Math.abs(placed.left - 480) < 0.001);
  assert.equal(placed.top, 260);
  assert.deepEqual(boardPosition(-100, -100, 1100, 700, 220), { x: 0, y: 52 });
  assert.deepEqual(boardPosition(2000, 2000, 1100, 700, 220), { x: 1, y: 452 });
  const resized = boardPlacement(0, 520, position);
  assert.ok(resized.left >= 28 && resized.left + 250 <= 520 - 28);
  assert.equal(resized.top, 260);

  const original = { id: 'task', boardPosition: { x: 0, y: 64 } };
  const moved = { ...original, boardPosition: position };
  const addedElsewhere = { id: 'other-task' };
  assert.deepEqual(mergeRecords([original, addedElsewhere], changedRecords([original], [moved])), [moved, addedElsewhere]);
});

test('the last lifted card stays above overlapping cards after saving and syncing', () => {
  const original = [{ id: 'first' }, { id: 'second' }, { id: 'third', boardLayer: 12 }];
  const lifted = original.map((item) => item.id === 'first' ? { ...item, boardLayer: nextBoardLayer(original) } : item);
  const changes = changedRecords(original, lifted);
  assert.equal(changes.length, 1);
  const saved = JSON.parse(JSON.stringify(changes));
  const synced = mergeRecords(original, saved);
  assert.equal(synced[0].boardLayer, 13);
  assert.ok(synced[0].boardLayer > synced[2].boardLayer);
  assert.equal(nextBoardLayer(synced), 14);
  assert.ok(nextBoardLayer([{ id: 'legacy' }, { id: 'legacy-2' }]) > 3);
});
