import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  LAST_HITS,
  MATCH_TICKS,
  MOVE_WEIGHTS,
  RAZES,
  SF_HP,
  castRaze,
  createMatch,
  creepDelta,
  razeHits,
  tickMatch,
} from '../dota.mjs';
import { applyAction, createGame, replay, snapshot } from '../rules.mjs';
import { rngNext } from '../rng.mjs';

const mainSource = readFileSync(new URL('../main.mjs', import.meta.url), 'utf8');

function frame(match) {
  return {
    hp: match.hp,
    tick: match.tick,
    creeps: match.creeps.map(creep => [creep.id, creep.pos]),
  };
}

function trace(seed, rngState) {
  const frames = [];
  let match = createMatch(seed, rngState);
  while (!match.over) {
    match = tickMatch(match);
    frames.push(frame(match));
  }
  return frames;
}

function stateFor(predicate) {
  let state = 1;
  for (let i = 0; i < 5000; i += 1) {
    const roll = rngNext(state);
    if (predicate(roll.value)) return state;
    state = roll.state;
  }
  throw new Error('no matching roll');
}

function aim(match) {
  const spots = match.creeps.map(creep => creep.pos).filter(pos => RAZES.some(raze => raze.distance === pos));
  if (!spots.length) return null;
  spots.sort((a, b) => a - b);
  return RAZES.find(raze => raze.distance === spots[0]).id;
}

function playMatch(seed, rngState, policy) {
  let match = createMatch(seed, rngState);
  let guard = 0;
  while (!match.over && guard < 80) {
    if (match.cooldown === 0) {
      const id = policy(match);
      if (id) match = castRaze(match, id);
    }
    if (!match.over) match = tickMatch(match);
    guard += 1;
  }
  return match;
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
  assert.equal(razeHits(3, 'short'), false);
  assert.equal(razeHits(3, 'mid'), false);
  assert.equal(razeHits(3, 'long'), false);
  assert.deepEqual(RAZES.map(raze => raze.distance), [2, 4, 6]);

  const match = {
    ...createMatch('distances'),
    cooldown: 0,
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
  const missed = castRaze({ ...match, creeps: [{ id: 4, pos: 3, name: '小兵' }] }, 'short');
  assert.equal(missed.kills, 0);
  assert.equal(missed.creeps.length, 1);
  assert.equal(castRaze(missed, 'mid'), missed);
});

test('creeps reposition, and melee hits can down shadow fiend', () => {
  assert.equal(MOVE_WEIGHTS.dash + MOVE_WEIGHTS.toward + MOVE_WEIGHTS.stay + MOVE_WEIGHTS.away, 100);
  assert.equal(creepDelta(0), -2);
  assert.equal(creepDelta(0.3), -1);
  assert.equal(creepDelta(0.6), 0);
  assert.equal(creepDelta(0.99), 1);

  const toward = stateFor(roll => creepDelta(roll) === -1);
  const away = stateFor(roll => creepDelta(roll) === 1);
  const stepped = tickMatch({
    ...createMatch('step'),
    hp: SF_HP,
    rng: toward,
    creeps: [{ id: 7, pos: 4, name: '小兵' }],
  });
  assert.equal(stepped.creeps[0].pos, 3);
  assert.equal(stepped.hp, SF_HP);
  const backed = tickMatch({
    ...createMatch('step'),
    hp: SF_HP,
    rng: away,
    creeps: [{ id: 7, pos: 4, name: '小兵' }],
  });
  assert.equal(backed.creeps[0].pos, 5);
  assert.equal(backed.hp, SF_HP);

  const intoFace = tickMatch({
    ...createMatch('face'),
    hp: SF_HP,
    rng: toward,
    creeps: [{ id: 7, pos: 2, name: '小兵' }],
  });
  assert.equal(intoFace.creeps[0].pos, 1);
  assert.equal(intoFace.hp, SF_HP - 1);
  assert.equal(intoFace.hurt, true);

  const dead = tickMatch({
    ...createMatch('dead'),
    hp: 1,
    creeps: [{ id: 7, pos: 1, name: '小兵' }],
  });
  assert.equal(dead.hp, 0);
  assert.equal(dead.over, true);
  assert.equal(dead.won, false);
});

test('last hits win inside the limit and a timeout loses', () => {
  const ready = {
    ...createMatch('goal'),
    cooldown: 0,
    kills: LAST_HITS - 1,
    creeps: [{ id: 9, pos: 2, name: '小兵' }],
  };
  const missed = castRaze(ready, 'long');
  assert.equal(missed.over, false);
  assert.equal(missed.won, false);
  assert.equal(missed.kills, LAST_HITS - 1);
  const won = castRaze({ ...missed, cooldown: 0 }, 'short');
  assert.equal(won.kills, LAST_HITS);
  assert.equal(won.over, true);
  assert.equal(won.won, true);

  let timed = { ...createMatch('clock'), hp: 100, kills: 0, creeps: [] };
  while (!timed.over) timed = tickMatch(timed);
  assert.equal(timed.won, false);
  assert.equal(timed.tick, MATCH_TICKS);
});

test('the same seed spawns the same creeps', () => {
  const hefei = trace('hefei');
  assert.deepEqual(hefei, trace('hefei'));
  assert.notDeepEqual(hefei, trace('nanjing'));
  assert.ok(hefei.some(item => item.creeps.length > 0));
  let sawBack = false;
  for (let i = 0; i < 40 && !sawBack; i += 1) {
    let match = createMatch(`move${i}`);
    const prev = new Map(match.creeps.map(creep => [creep.id, creep.pos]));
    while (!match.over && !sawBack) {
      match = tickMatch(match);
      for (const creep of match.creeps) {
        const was = prev.get(creep.id);
        if (was != null && creep.pos > was) sawBack = true;
      }
      prev.clear();
      for (const creep of match.creeps) prev.set(creep.id, creep.pos);
    }
  }
  assert.equal(sawBack, true);
});

test('the run rng reproduces a match without changing the run', () => {
  const game = createGame('hefei');
  const before = snapshot(game);
  const once = trace('hefei', game.rng);
  assert.deepEqual(snapshot(game), before);
  assert.deepEqual(once, trace('hefei', game.rng));
  assert.notDeepEqual(once, trace('nanjing', createGame('nanjing').rng));
  assert.notDeepEqual(once, trace('hefei', game.rng + 1));

  const rest = [
    { type: 'rest' },
    { type: 'rest' },
    { type: 'rest' },
    { type: 'rest' },
    { type: 'sleep' },
  ];
  let beside = applyAction(createGame('mix'), { type: 'overnight' });
  const match = playMatch(beside.seed, beside.rng, aim);
  assert.equal(match.over, true);
  beside = applyAction(beside, { type: 'dota', won: false });
  for (const action of rest) beside = applyAction(beside, action);
  let plain = applyAction(createGame('mix'), { type: 'overnight' });
  for (const action of rest) plain = applyAction(plain, action);
  assert.equal(beside.rng, plain.rng);
  assert.equal(beside.stamina, plain.stamina);
  assert.deepEqual(beside.tickets, plain.tickets);
  assert.deepEqual(snapshot(replay('mix', [{ type: 'overnight' }, ...rest])), snapshot(plain));
});

test('accurate distances can win, and standing still loses the same seed', () => {
  const win = playMatch('s1', createGame('s1').rng, aim);
  assert.equal(win.won, true);
  assert.ok(win.kills >= LAST_HITS);
  const idle = playMatch('s1', createGame('s1').rng, () => null);
  assert.equal(idle.won, false);
  assert.equal(idle.hp, 0);
  const pressed = playMatch('s0', createGame('s0').rng, aim);
  assert.equal(pressed.won, false);
  assert.equal(pressed.hp, 0);
});

test('screen copy does not print the raze keys', () => {
  assert.equal(mainSource.includes('toUpperCase'), false);
  assert.match(mainSource, /createMatch\(state\.seed, state\.rng\)/);
  assert.equal(mainSource.includes('${raze.key'), false);
  assert.equal(mainSource.includes('快捷键'), false);
  assert.match(mainSource, /\[raze\.name\]/);
});
