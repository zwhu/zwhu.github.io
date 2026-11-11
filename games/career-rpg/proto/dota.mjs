import { hashSeed, rngNext } from './rng.mjs';

// 影魔站在 0。小兵从 7 往 1 走。短中远各打一个格子。
export const RAZES = Object.freeze([
  Object.freeze({ id: 'short', key: 'z', name: '短', distance: 2 }),
  Object.freeze({ id: 'mid', key: 'x', name: '中', distance: 4 }),
  Object.freeze({ id: 'long', key: 'c', name: '远', distance: 6 }),
]);

export const SPAWN_AT = 7;
export const MATCH_TICKS = 32;
export const TICK_MS = 450;
const SPAWN_CHANCE = 0.42;

export function razeById(id) {
  return RAZES.find(raze => raze.id === id) || null;
}

export function razeHits(position, razeId) {
  const raze = razeById(razeId);
  return Boolean(raze) && position === raze.distance;
}

export function createMatch(seed) {
  const text = String(seed || 'hefei').slice(0, 64) || 'hefei';
  return {
    seed: text,
    rng: hashSeed(`${text}:dota`),
    tick: 0,
    creeps: [],
    nextId: 1,
    kills: 0,
    lastRaze: '',
    over: false,
  };
}

export function tickMatch(match) {
  if (match.over) return match;
  const creeps = [];
  for (const creep of match.creeps) {
    const pos = creep.pos - 1;
    if (pos >= 1) creeps.push({ ...creep, pos });
  }
  const roll = rngNext(match.rng);
  let nextId = match.nextId;
  if (roll.value < SPAWN_CHANCE) {
    creeps.push({ id: nextId, pos: SPAWN_AT, name: '小兵' });
    nextId += 1;
  }
  const tick = match.tick + 1;
  return {
    ...match,
    rng: roll.state,
    tick,
    creeps,
    nextId,
    lastRaze: '',
    over: tick >= MATCH_TICKS,
  };
}

export function castRaze(match, razeId) {
  if (match.over || !razeById(razeId)) return match;
  let kills = match.kills;
  const creeps = [];
  for (const creep of match.creeps) {
    if (razeHits(creep.pos, razeId)) kills += 1;
    else creeps.push(creep);
  }
  return { ...match, creeps, kills, lastRaze: razeId };
}
