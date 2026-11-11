import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createGame, present, snapshot } from '../rules.mjs';
import { findPath, isWalkable, parseGrid, planClick } from '../walk.mjs';

const map = JSON.parse(readFileSync(new URL('../art/walk.json', import.meta.url), 'utf8'));
const grid = parseGrid(map.rows);

test('every click target has a path that stays off the furniture', () => {
  for (const [mode, targets] of Object.entries(map.modes)) {
    for (const [id, spec] of Object.entries(targets)) {
      const path = findPath(grid, map.start, spec.tile);
      assert.ok(path, `${mode} ${id}`);
      assert.deepEqual(path[0], map.start);
      assert.deepEqual(path[path.length - 1], spec.tile);
      for (const [x, y] of path) assert.equal(isWalkable(grid, x, y), true, `${mode} ${id} ${x},${y}`);
    }
  }
});

test('clicking empty floor does not change the game and does not spend action points', () => {
  const state = createGame('n0');
  const before = snapshot(state);
  const view = present(state);
  const plan = planClick(grid, Object.values(map.modes.day), map.start, [200, 148]);
  assert.equal(plan.effect, null);
  assert.ok(plan.path.length > 1);
  assert.deepEqual(snapshot(state), before);
  assert.equal(present(state).ap, view.ap);
  assert.equal(present(state).stamina, view.stamina);
});

test('walking to a person is the same talk action, and the plan itself does not spend points', () => {
  const state = createGame('n0');
  const before = snapshot(state);
  const plan = planClick(grid, Object.values(map.modes.day), map.start, [120, 110]);
  assert.deepEqual(plan.effect, { kind: 'talk', person: 'pm' });
  assert.deepEqual(snapshot(state), before);
  assert.equal(present(state).ap, before.ap);
  assert.equal(present(state).stamina, before.stamina);
});
