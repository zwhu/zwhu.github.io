import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { convertMeta } from '../walk/build-sprites.mjs';
import { frameIndex, resolveSprites } from '../walk-sprites.mjs';

const data = JSON.parse(readFileSync(new URL('../walk/walk.sprites.json', import.meta.url), 'utf8'));

test('the sprite json resolves a frame for every direction', () => {
  const sprites = resolveSprites(data);
  for (const name of ['down', 'up', 'left', 'right']) {
    assert.ok(sprites.directions[name].frames.length >= 1, name);
    assert.equal(sprites.directions[name].frames[0].w, 28);
    assert.equal(sprites.directions[name].frames[0].h, 44);
  }
  for (const name of ['down', 'up', 'left', 'right']) {
    assert.equal(sprites.directions[name].mirror, false, name);
  }
  assert.equal(sprites.directions.left.file, 'left.png');
  assert.equal(sprites.directions.right.file, 'right.png');
  assert.notEqual(sprites.directions.left.file, sprites.directions.right.file);
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
  assert.equal(sprites.directions.up.file, 'up.png');
  assert.equal(sprites.directions.down.file, 'down.png');
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
  assert.equal(first, 0);
  assert.equal(second, 1);
  assert.equal(third, 2);
  assert.notEqual(first, second);
});
