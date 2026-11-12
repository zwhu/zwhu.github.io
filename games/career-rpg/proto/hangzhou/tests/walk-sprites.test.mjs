import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { convertMeta } from '../walk/build-sprites.mjs';
import { clipFor, frameIndex, poseKind, resolveSprites } from '../walk-sprites.mjs';

const data = JSON.parse(readFileSync(new URL('../walk/walk.sprites.json', import.meta.url), 'utf8'));

test('the sprite json resolves a frame for every direction', () => {
  const sprites = resolveSprites(data);
  assert.equal(sprites.frameDuration, 140);
  for (const name of ['down', 'up', 'left', 'right']) {
    const direction = sprites.directions[name];
    assert.equal(direction.frames.length, 5, name);
    assert.equal(direction.mirror, false, name);
    assert.equal(direction.file, 'walk-sheet.png');
    assert.deepEqual(direction.anchor, [28, 52]);
  }
  assert.notDeepEqual(sprites.directions.left.frames[0], sprites.directions.right.frames[0]);
  const moving = frameIndex(5, sprites.frameDuration, 0, true);
  const later = frameIndex(5, sprites.frameDuration, 140, true);
  const stopped = frameIndex(5, sprites.frameDuration, 500, false);
  assert.equal(stopped, 0);
  assert.equal(moving, 1);
  assert.equal(later, 2);
  assert.notEqual(moving, later);
  assert.equal(poseKind({ seated: true, moving: false }), 'sit');
  assert.equal(poseKind({ seated: false, moving: false }), 'stand');
  assert.equal(poseKind({ seated: false, moving: true }), 'walk');
});

test('meta.json converts to walk.sprites.json with mirror off', () => {
  const meta = JSON.parse(readFileSync(new URL('../walk/meta.json', import.meta.url), 'utf8'));
  const converted = convertMeta(meta);
  assert.deepEqual(converted, data);
  for (const name of ['down', 'up', 'left', 'right']) {
    assert.equal(converted.directions[name].mirror, false);
  }
});

test('a missing direction falls back without throwing', () => {
  const sprites = resolveSprites({
    frameDuration: 160,
    directions: {
      down: data.directions.down,
      up: data.directions.up,
    },
  });
  assert.equal(sprites.directions.left.mirror, false);
  assert.equal(sprites.directions.left.file, 'left.png');
  assert.equal(sprites.directions.right.mirror, false);
  assert.equal(sprites.directions.right.file, 'right.png');
  assert.equal(sprites.directions.up.file, 'walk-sheet.png');
  assert.equal(sprites.directions.down.file, 'walk-sheet.png');
});

test('each direction reads its own row and walk frames on the sheet', () => {
  const meta = JSON.parse(readFileSync(new URL('../walk/meta.json', import.meta.url), 'utf8'));
  const sprites = resolveSprites(data);
  const cell = meta.cell[1];
  const standName = meta.stand;
  const meaning = { up: '背面', down: '正面', left: '朝左', right: '朝右' };
  for (const name of ['down', 'up', 'left', 'right']) {
    const row = meta.rows.indexOf(name);
    const order = meta.frame_order[name];
    const frames = sprites.directions[name].frames;
    const rects = frames.map(frame => `(${frame.x},${frame.y},${frame.w},${frame.h})`).join(' ');
    console.log(`${name} row=${row} ${meaning[name]} y=${row * cell} ${rects}`);
    assert.equal(row, meta.rows.indexOf(name), name);
    assert.equal(frames.length, order.length, name);
    for (let index = 0; index < order.length; index += 1) {
      const [x0, y0, x1, y1] = meta.cells[name][order[index]].rect;
      const frame = frames[index];
      assert.equal(frame.y, row * cell, `${name} 行`);
      assert.deepEqual(frame, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      assert.match(meta.cells[name][order[index]].source, new RegExp(`/frames/${name}/`));
    }
    const stand = clipFor(sprites, name, { moving: false, elapsedMs: 800 });
    assert.equal(stand.pose, 'stand');
    assert.equal(stand.index, 0);
    assert.deepEqual(stand.rect, frames[0], `${name} 停下应是该方向站姿`);
    const first = clipFor(sprites, name, { moving: true, elapsedMs: 0 });
    const second = clipFor(sprites, name, { moving: true, elapsedMs: sprites.frameDuration });
    assert.equal(first.pose, 'walk');
    assert.ok(first.index > 0, `${name} 走路不能停在站姿帧`);
    assert.notDeepEqual(first.rect, frames[0]);
    assert.notDeepEqual(second.rect, first.rect, `${name} 走路帧要往前`);
    assert.equal(order[0], standName);
    assert.deepEqual(first.rect, frames[1]);
  }
  assert.notEqual(sprites.directions.up.frames[0].y, sprites.directions.left.frames[0].y);
  assert.notEqual(sprites.directions.down.frames[0].y, sprites.directions.up.frames[0].y);
  const sitting = clipFor(sprites, 'down', { seated: true, moving: false, elapsedMs: 0 });
  assert.equal(sitting.pose, 'sit');
  assert.equal(sitting.rect, undefined);
  assert.notEqual(sitting.pose, 'stand');
});

test('more than one frame advances while walking', () => {
  const fixture = {
    frameDuration: 100,
    directions: {
      down: {
        file: 'down.png',
        frames: [
          { x: 0, y: 0, w: 28, h: 44 },
          { x: 28, y: 0, w: 28, h: 44 },
          { x: 56, y: 0, w: 28, h: 44 },
        ],
        anchor: [14, 44],
        mirror: false,
      },
    },
  };
  const sprites = resolveSprites(fixture);
  const frames = sprites.directions.down.frames;
  const duration = sprites.frameDuration;
  const standing = frameIndex(frames.length, duration, 500, false);
  const first = frameIndex(frames.length, duration, 0, true);
  const second = frameIndex(frames.length, duration, 100, true);
  const third = frameIndex(frames.length, duration, 200, true);
  assert.equal(standing, 0);
  assert.equal(first, 1);
  assert.equal(second, 2);
  assert.equal(third, 1);
  assert.notEqual(first, second);
});
