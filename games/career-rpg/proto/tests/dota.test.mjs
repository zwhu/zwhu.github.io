import assert from 'node:assert/strict';
import test from 'node:test';
import { castRaze, createMatch, RAZES, razeHits, tickMatch } from '../dota.mjs';

function occupied(seed) {
  const frames = [];
  let match = createMatch(seed);
  while (!match.over) {
    match = tickMatch(match);
    frames.push(match.creeps.map(creep => [creep.id, creep.pos]));
  }
  return frames;
}

test('three razes hit only their own distance', () => {
  assert.equal(razeHits(2, 'short'), true);
  assert.equal(razeHits(2, 'mid'), false);
  assert.equal(razeHits(2, 'long'), false);
  assert.equal(razeHits(4, 'mid'), true);
  assert.equal(razeHits(4, 'short'), false);
  assert.equal(razeHits(4, 'long'), false);
  assert.equal(razeHits(6, 'long'), true);
  assert.equal(razeHits(6, 'short'), false);
  assert.equal(razeHits(6, 'mid'), false);
  assert.deepEqual(RAZES.map(raze => raze.distance), [2, 4, 6]);

  const match = {
    ...createMatch('distances'),
    creeps: [
      { id: 1, pos: 2, name: '小兵' },
      { id: 2, pos: 4, name: '小兵' },
      { id: 3, pos: 6, name: '小兵' },
    ],
  };
  const short = castRaze(match, 'short');
  assert.equal(short.kills, 1);
  assert.deepEqual(short.creeps.map(creep => creep.pos), [4, 6]);
  const mid = castRaze(match, 'mid');
  assert.equal(mid.kills, 1);
  assert.deepEqual(mid.creeps.map(creep => creep.pos), [2, 6]);
  const long = castRaze(match, 'long');
  assert.equal(long.kills, 1);
  assert.deepEqual(long.creeps.map(creep => creep.pos), [2, 4]);
  assert.equal(match.kills, 0);
  assert.equal(castRaze(match, 'nope'), match);
});

test('the same seed spawns the same creeps', () => {
  const hefei = occupied('hefei');
  assert.deepEqual(hefei, occupied('hefei'));
  assert.notDeepEqual(hefei, occupied('nanjing'));
  assert.ok(hefei.some(frame => frame.length > 0));
});
