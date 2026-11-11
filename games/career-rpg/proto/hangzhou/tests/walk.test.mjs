import assert from 'node:assert/strict';
import test from 'node:test';
import { NAV } from '../nav.mjs';
import { createGame, snapshot } from '../rules.mjs';
import { effectFor, findPath, isWalkable, nearestWalkable } from '../walk.mjs';

const start = nearestWalkable(NAV, NAV.seat.stand[0], NAV.seat.stand[1]);

test('each clickable spot has a path that stays on walkable cells', () => {
  assert.ok(start);
  for (const spot of NAV.spots) {
    for (const at of [spot.at, spot.boss ? nearestCenter(spot.boss) : null].filter(Boolean)) {
      const goal = nearestWalkable(NAV, at[0], at[1]);
      const path = findPath(NAV, start, goal);
      assert.ok(path && path.length > 0, spot.id);
      for (const cell of path) assert.equal(isWalkable(NAV, cell), true, `${spot.id} ${cell}`);
    }
  }
});

test('clicking empty ground does not change the game', () => {
  const state = createGame('ground');
  const before = snapshot(state);
  assert.equal(effectFor(null), null);
  assert.equal(effectFor({ kind: 'ground', at: [40, 200] }), null);
  assert.deepEqual(snapshot(state), before);
});

test('walking does not spend action points or stamina', () => {
  const state = createGame('pace');
  const goal = nearestWalkable(NAV, 142, 198);
  const path = findPath(NAV, start, goal);
  assert.ok(path.length > 1);
  for (const cell of path) assert.equal(isWalkable(NAV, cell), true);
  assert.equal(state.ap, createGame('pace').ap);
  assert.equal(state.stamina, createGame('pace').stamina);
  assert.deepEqual(snapshot(state), snapshot(createGame('pace')));
});

function nearestCenter(hit) {
  return [hit[0] + hit[2] / 2, hit[1] + hit[3] / 2];
}
