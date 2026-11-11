import { hashSeed, rngInt, rngNext } from './rng.mjs';

// 影魔站在 0。小兵在 1–7 走位。短中远只打自己那一格。
export const RAZES = Object.freeze([
  Object.freeze({ id: 'short', key: 'z', name: '短', distance: 2 }),
  Object.freeze({ id: 'mid', key: 'x', name: '中', distance: 4 }),
  Object.freeze({ id: 'long', key: 'c', name: '远', distance: 6 }),
]);

export const SPAWN_AT = 7;
export const MELEE_POS = 1;
export const THREAT_POS = 2;
export const MELEE_DAMAGE = 1;
export const MATCH_TICKS = 36;
export const TICK_MS = 1000;
export const SF_HP = 6;
export const LAST_HITS = 6;
export const MAX_CREEPS = 3;
export const RAZE_COOLDOWN = 2;
// 百分桶：冲两格 / 走近一格 / 停 / 后退一格。合计 100。
export const MOVE_WEIGHTS = Object.freeze({ dash: 22, toward: 34, stay: 16, away: 28 });

const SPAWN_CHANCE = 0.62;

export function razeById(id) {
  return RAZES.find(raze => raze.id === id) || null;
}

export function razeHits(position, razeId) {
  const raze = razeById(razeId);
  return Boolean(raze) && position === raze.distance;
}

export function creepDelta(roll) {
  const bucket = Math.floor(roll * 100);
  if (bucket < MOVE_WEIGHTS.dash) return -2;
  if (bucket < MOVE_WEIGHTS.dash + MOVE_WEIGHTS.toward) return -1;
  if (bucket < MOVE_WEIGHTS.dash + MOVE_WEIGHTS.toward + MOVE_WEIGHTS.stay) return 0;
  return 1;
}

function threatens(pos) {
  return pos <= THREAT_POS;
}

function forkRng(seed, rngState) {
  const text = String(seed || 'hefei').slice(0, 64) || 'hefei';
  if (rngState == null) return { seed: text, rng: hashSeed(`${text}:dota`) };
  return { seed: text, rng: hashSeed(`${text}:dota:${rngState >>> 0}`) };
}

function finish(match) {
  if (match.hp <= 0) return { ...match, hp: 0, over: true, won: false };
  if (match.kills >= LAST_HITS) return { ...match, over: true, won: true };
  if (match.tick >= MATCH_TICKS) return { ...match, over: true, won: false };
  return match;
}

export function createMatch(seed, rngState) {
  const forked = forkRng(seed, rngState);
  const open = rngInt(forked.rng, 5, SPAWN_AT);
  return {
    seed: forked.seed,
    rng: open.state,
    tick: 0,
    creeps: [{ id: 1, pos: open.value, name: '小兵' }],
    nextId: 2,
    kills: 0,
    lastRaze: '',
    over: false,
    won: false,
    hp: SF_HP,
    cooldown: 0,
    hurt: false,
  };
}

export function tickMatch(match) {
  if (match.over) return match;
  let rng = match.rng;
  let hp = match.hp;
  const creeps = [];
  for (const creep of match.creeps) {
    const roll = rngNext(rng);
    rng = roll.state;
    const pos = Math.min(SPAWN_AT, Math.max(MELEE_POS, creep.pos + creepDelta(roll.value)));
    creeps.push({ ...creep, pos });
    if (threatens(creep.pos) || threatens(pos)) hp -= MELEE_DAMAGE;
  }
  let nextId = match.nextId;
  if (creeps.length < MAX_CREEPS) {
    const roll = rngNext(rng);
    rng = roll.state;
    if (roll.value < SPAWN_CHANCE) {
      creeps.push({ id: nextId, pos: SPAWN_AT, name: '小兵' });
      nextId += 1;
    }
  }
  return finish({
    ...match,
    rng,
    tick: match.tick + 1,
    creeps,
    nextId,
    hp,
    cooldown: Math.max(0, match.cooldown - 1),
    lastRaze: '',
    hurt: hp < match.hp,
  });
}

export function castRaze(match, razeId) {
  if (match.over || match.cooldown > 0 || !razeById(razeId)) return match;
  let kills = match.kills;
  const creeps = [];
  for (const creep of match.creeps) {
    if (razeHits(creep.pos, razeId)) kills += 1;
    else creeps.push(creep);
  }
  return finish({
    ...match,
    creeps,
    kills,
    lastRaze: razeId,
    cooldown: RAZE_COOLDOWN,
    hurt: false,
  });
}
