import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { convertMeta } from '../walk/build-sprites.mjs';
import { frameIndex, poseKind, resolveSprites } from '../walk-sprites.mjs';

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
