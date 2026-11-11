import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createGame, present, snapshot } from '../rules.mjs';
import { seatedSprite } from '../scene.mjs';
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

test('each direction reads its own sheet row and frames', () => {
  const directions = resolveDirections(sprites);
  const cell = walkMeta.cell[1];
  const order = ['idle', ...walkMeta.cycles.walk6];
  const role = { down: '正面', up: '背面', left: '左侧面', right: '右侧面' };
  const rowOf = { down: 0, up: 1, left: 2, right: 3 };
  assert.deepEqual(walkMeta.rows, ['down', 'up', 'left', 'right']);
  for (const name of ['up', 'down', 'left', 'right']) {
    const row = walkMeta.rows.indexOf(name);
    const spec = directions[name];
    const rects = spec.frames.map(frame => [frame.x, frame.y, frame.w, frame.h]);
    console.log(`${name} ${role[name]} row ${row} ${rects.map(rect => rect.join(',')).join(' | ')}`);
    assert.equal(row, rowOf[name], name);
    assert.equal(spec.count, order.length, name);
    assert.equal(spec.duration, walkMeta.frame_ms.walk6, name);
    assert.equal(spec.mirror, false, name);
    assert.deepEqual(spec.anchor, walkMeta.foot_anchor);
    assert.equal(rects.length, order.length, name);
    order.forEach((id, index) => {
      assert.deepEqual(rects[index], walkMeta.frames[name][id].rect, `${name} ${id}`);
      assert.equal(rects[index][1], row * cell, `${name} ${id} row`);
    });
    for (const rect of rects.slice(1)) assert.notDeepEqual(rect, rects[0], `${name} walk frame repeats the stand frame`);
    assert.equal(new Set(rects.map(rect => rect[0])).size, rects.length, `${name} frames share one column`);
  }
  assert.notEqual(directions.up.frames[0].y, directions.left.frames[0].y);
  assert.notEqual(directions.up.frames[0].y, directions.right.frames[0].y);
  assert.notEqual(directions.down.frames[0].y, directions.up.frames[0].y);
  assert.notEqual(directions.down.frames[0].y, directions.left.frames[0].y);
});

test('a missing direction falls back without throwing', () => {
  const front = { count: 1, duration: 160, anchor: [28, 54], mirror: false, frames: [{ x: 0, y: 0, w: 56, h: 56 }] };
  const directions = resolveDirections({ directions: { down: front } });
  assert.equal(directions.left.mirror, true);
  assert.deepEqual(directions.left.frames, directions.down.frames);
  assert.equal(directions.right.mirror, false);
  assert.ok(directions.up.frames.length >= 1);
});

test('walking advances the step frames and stopping returns to that direction stand', () => {
  const directions = resolveDirections(sprites);
  for (const name of ['up', 'down', 'left', 'right']) {
    const spec = directions[name];
    const row = walkMeta.rows.indexOf(name) * walkMeta.cell[1];
    const stopped = frameAt(spec, 480, false);
    assert.equal(stopped.pose, 'stand', name);
    assert.equal(stopped.index, 0, name);
    assert.deepEqual([stopped.frame.x, stopped.frame.y, stopped.frame.w, stopped.frame.h], walkMeta.frames[name].idle.rect);
    const seen = [];
    for (let step = 0; step < spec.frames.length - 1; step += 1) {
      const moving = frameAt(spec, step * spec.duration, true);
      assert.equal(moving.pose, 'walk', `${name} ${step}`);
      assert.equal(moving.index, step + 1, `${name} ${step}`);
      assert.equal(moving.frame.y, row, `${name} ${step}`);
      assert.notEqual(moving.frame.x, stopped.frame.x, `${name} ${step} stays on the stand frame`);
      seen.push(`${moving.frame.x},${moving.frame.y},${moving.frame.w},${moving.frame.h}`);
    }
    assert.equal(new Set(seen).size, seen.length, name);
    const wrapped = frameAt(spec, spec.duration * (spec.frames.length - 1), true);
    assert.equal(wrapped.index, 1, name);
    console.log(`${name} walk ${seen.join(' | ')} stop ${stopped.frame.x},${stopped.frame.y},${stopped.frame.w},${stopped.frame.h}`);
  }
});

test('sitting at the desk uses the sit sprite, not the front stand', () => {
  const table = JSON.parse(readFileSync(new URL('../art/sprites.meta.json', import.meta.url), 'utf8'));
  assert.equal(playerPoseKind({ sitting: true, moving: false }), 'sit');
  assert.equal(playerPoseKind({ sitting: true, moving: true }), 'sit');
  assert.equal(playerPoseKind({ sitting: false, moving: true }), 'walk');
  assert.equal(playerPoseKind({ sitting: false, moving: false }), 'stand');
  const seat = seatedSprite(table);
  assert.equal(seat.pose, 'seat_back_on_chair');
  assert.deepEqual(seat.origin, table.cells.player.seat_back_on_chair.origin);
  assert.notDeepEqual(seat.origin, table.cells.player.stand_front.origin);
  console.log(`sit ${seat.pose} ${seat.origin.join(',')} stand_front ${seat.standOrigin.join(',')}`);
});
