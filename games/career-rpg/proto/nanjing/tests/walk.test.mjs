import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createGame, present, snapshot } from '../rules.mjs';
import { findPath, frameAt, isWalkable, parseGrid, planClick, playerPoseKind, resolveDirections } from '../walk.mjs';

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
const walkMeta = JSON.parse(readFileSync(new URL('../walk/meta.json', import.meta.url), 'utf8'));

test('each direction has the frame count from meta and is not mirrored', () => {
  const directions = resolveDirections(sprites);
  const expected = 1 + walkMeta.cycles.walk6.length;
  for (const name of walkMeta.rows) {
    assert.equal(directions[name].count, expected, name);
    assert.equal(directions[name].frames.length, expected);
    assert.equal(directions[name].duration, walkMeta.frame_ms.walk6);
    assert.equal(directions[name].mirror, false);
    assert.deepEqual(directions[name].anchor, walkMeta.foot_anchor);
    assert.deepEqual(
      [directions[name].frames[0].x, directions[name].frames[0].y, directions[name].frames[0].w, directions[name].frames[0].h],
      walkMeta.frames[name].idle.rect,
    );
  }
});

test('a missing direction falls back without throwing', () => {
  const front = { count: 1, duration: 160, anchor: [28, 54], mirror: false, frames: [{ x: 0, y: 0, w: 56, h: 56 }] };
  const directions = resolveDirections({ directions: { down: front } });
  assert.equal(directions.left.mirror, true);
  assert.deepEqual(directions.left.frames, directions.down.frames);
  assert.equal(directions.right.mirror, false);
  assert.ok(directions.up.frames.length >= 1);
});

test('walking cycles the step frames and stopping returns to the stand frame', () => {
  const spec = resolveDirections(sprites).right;
  assert.equal(frameAt(spec, 0, false).pose, 'stand');
  assert.equal(frameAt(spec, 500, false).index, 0);
  assert.equal(frameAt(spec, 0, true).pose, 'walk');
  assert.equal(frameAt(spec, 0, true).index, 1);
  assert.equal(frameAt(spec, 120, true).index, 2);
  assert.equal(frameAt(spec, 120 * 6, true).index, 1);
});

test('sitting uses the sit pose instead of a standing frame', () => {
  assert.equal(playerPoseKind({ sitting: true, moving: false }), 'sit');
  assert.equal(playerPoseKind({ sitting: false, moving: true }), 'walk');
  assert.equal(playerPoseKind({ sitting: false, moving: false }), 'stand');
});
