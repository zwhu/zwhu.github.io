import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createGame, present, snapshot } from '../rules.mjs';
import { findPath, frameAt, isWalkable, parseGrid, planClick, resolveDirections } from '../walk.mjs';

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

const sprites = JSON.parse(readFileSync(new URL('../walk/walk.sprites.json', import.meta.url), 'utf8'));

test('the sprite file resolves a frame for every direction', () => {
  const directions = resolveDirections(sprites);
  for (const name of ['up', 'down', 'left', 'right']) {
    assert.ok(directions[name].frames.length >= 1, name);
    assert.equal(directions[name].count, directions[name].frames.length);
  }
  assert.equal(directions.left.mirror, true);
  assert.equal(directions.up.frames[0].x, 56);
  assert.equal(directions.down.frames[0].x, 0);
});

test('a missing direction falls back without throwing', () => {
  const front = { count: 1, duration: 160, anchor: [28, 54], mirror: false, frames: [{ x: 0, y: 0, w: 56, h: 56 }] };
  const directions = resolveDirections({ directions: { down: front } });
  assert.equal(directions.left.mirror, true);
  assert.deepEqual(directions.left.frames, directions.down.frames);
  assert.equal(directions.right.mirror, false);
  assert.ok(directions.up.frames.length >= 1);
});

test('more than one frame advances while walking', () => {
  const spec = resolveDirections({
    directions: {
      down: {
        duration: 100,
        anchor: [4, 8],
        mirror: false,
        frames: [{ x: 0, y: 0, w: 8, h: 8 }, { x: 8, y: 0, w: 8, h: 8 }],
      },
    },
  }).down;
  assert.equal(frameAt(spec, 0).index, 0);
  assert.equal(frameAt(spec, 100).index, 1);
  assert.equal(frameAt(spec, 200).index, 0);
  assert.equal(frameAt(spec, 100).frame.x, 8);
});
