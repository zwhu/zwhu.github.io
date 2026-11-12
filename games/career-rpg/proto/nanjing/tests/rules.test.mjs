import './scale.test.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CONFIG as HEFEI } from '../../config.mjs';
import { CONFIG } from '../config.mjs';
import {
  applyAction,
  bossChoices,
  buildCost,
  createGame,
  present,
  replay,
  shipChance,
  snapshot,
} from '../rules.mjs';
import { play, rateProblems, runReport } from '../sim.mjs';

const rulesSource = readFileSync(new URL('../rules.mjs', import.meta.url), 'utf8');
const saved = JSON.parse(readFileSync(new URL('../review/strategies.json', import.meta.url), 'utf8'));

const quiet = {
  dauTargets: [0, 0, 0, 0],
  lateRep: 0,
  baseChance: 0,
  incidentDaily: 0,
  bossNightRep: 0,
  bossRepPerAp: 0,
};

function until(seed, config, pred) {
  let state = createGame(seed, config);
  let guard = 0;
  while (state.phase === 'play' && !pred(state) && guard < 500) {
    state = applyAction(state, state.ap > 0 ? { type: 'rest' } : { type: 'sleep' });
    guard += 1;
  }
  assert.ok(guard < 500, 'did not arrive');
  return state;
}

function spend(state, action) {
  return applyAction(state, state.ap > 0 ? action : { type: 'sleep' });
}

test('shared stamina rules and the documented nanjing numbers stay put', () => {
  assert.equal(CONFIG.dailyAp, HEFEI.dailyAp);
  assert.equal(CONFIG.exhaustedAp, HEFEI.exhaustedAp);
  assert.equal(CONFIG.staminaMax, HEFEI.staminaMax);
  assert.equal(CONFIG.staminaStart, HEFEI.staminaStart);
  assert.equal(CONFIG.overnightAp, HEFEI.overnightAp);
  assert.equal(CONFIG.overnightStaminaCost, HEFEI.overnightStaminaCost);
  assert.equal(CONFIG.restStamina, HEFEI.restStamina);
  assert.equal(CONFIG.dotaWinStamina, HEFEI.dotaWinStamina);
  assert.equal(CONFIG.reputationStart, 50);
  assert.equal(CONFIG.reputationLine, 30);
  assert.equal(CONFIG.reputationDropBelow, 20);
  assert.equal(CONFIG.baseChance, 30);
  assert.equal(CONFIG.testedChance, 15);
  assert.equal(CONFIG.pmChanceAdd, 15);
  assert.equal(CONFIG.bossRepPerAp, 5);
  assert.equal(CONFIG.lateRep, 4);
  assert.equal(CONFIG.goodReputation, 34);
  assert.equal(rulesSource.includes('document'), false);
  assert.equal(rulesSource.includes('window'), false);
});

test('the same seed replays the same game and another seed deals different tickets', () => {
  const random = play('n4', 'random');
  assert.deepEqual(snapshot(replay('n4', random.actions)), snapshot(random.state));
  const left = createGame('n0').tickets.map(ticket => [ticket.title, ticket.difficulty, ticket.dueIn].join('/')).join('|');
  const right = createGame('n1').tickets.map(ticket => [ticket.title, ticket.difficulty, ticket.dueIn].join('/')).join('|');
  assert.notEqual(left, right);
});

test('dau moves when a ticket ships, not when it is only built', () => {
  let state = createGame('dau', quiet);
  const id = state.tickets[0].id;
  let guard = 0;
  while (state.tickets.some(ticket => ticket.id === id && ticket.status === 'build') && guard < 20) {
    state = spend(state, { type: 'work', ticketId: id });
    guard += 1;
  }
  assert.equal(state.dau, 0);
  const shipped = applyAction(state, { type: 'ship', ticketIds: [id], canary: false });
  assert.ok(shipped.dau > 0);
  assert.equal(shipped.tickets.some(ticket => ticket.id === id), false);
});

test('testing, ci, and the pm rush change the visible accident chance', () => {
  const fresh = createGame('chance');
  const ticket = { tested: false };
  assert.equal(shipChance(ticket, fresh), 30);
  assert.equal(shipChance({ tested: true }, fresh), 15);
  const ci = { ...fresh, learned: { ...fresh.learned, ci: true } };
  assert.equal(shipChance({ tested: true }, ci), 7.5);
  assert.equal(shipChance(ticket, fresh, { rushed: true }), 45);

  let state = createGame('pm', { lateRep: 0, incidentDaily: 0, bossNightRep: 0, dauTargets: [0, 0, 0, 0] });
  const id = state.tickets[0].id;
  let guard = 0;
  while (state.tickets.some(item => item.id === id && item.status === 'build') && guard < 20) {
    state = spend(state, { type: 'work', ticketId: id });
    guard += 1;
  }
  const ap = state.ap;
  const dau = state.dau;
  state = applyAction(state, { type: 'talk', person: 'pm' });
  state = applyAction(state, { type: 'pm-yes' });
  assert.equal(state.ap, ap);
  assert.equal(state.lastShip.from, 30);
  assert.equal(state.lastShip.to, 45);
  assert.ok(state.dau > dau);
  assert.match(state.log[0], /30% → 45%/);
});

test('testing is done by yourself and costs one action', () => {
  let state = createGame('selftest', { lateRep: 0, incidentDaily: 0, bossNightRep: 0, dauTargets: [0, 0, 0, 0] });
  assert.equal(present(state).colleagues.some(person => person.id === 'qa'), false);
  const id = state.tickets[0].id;
  let guard = 0;
  while (state.tickets.some(item => item.id === id && item.status === 'build') && guard < 20) {
    state = spend(state, { type: 'work', ticketId: id });
    guard += 1;
  }
  const ap = state.ap;
  state = applyAction(state, { type: 'test', ticketId: id });
  assert.equal(state.ap, ap - 1);
  const ticket = state.tickets.find(item => item.id === id);
  assert.equal(ticket.testedBy, 'self');
  assert.equal(shipChance(ticket, state), 15);
  assert.match(state.log[0], /补了测试/);
});

test('fibjs discounts front and back tickets and not data tickets', () => {
  const state = createGame('fib');
  const learned = { ...state, learned: { ...state.learned, fibjs: true } };
  assert.equal(buildCost({ kind: 'front', difficulty: 3 }, learned), 2);
  assert.equal(buildCost({ kind: 'back', difficulty: 2 }, learned), 1);
  assert.equal(buildCost({ kind: 'front', difficulty: 1 }, learned), 1);
  assert.equal(buildCost({ kind: 'data', difficulty: 3 }, learned), 3);
  assert.equal(buildCost({ kind: 'front', difficulty: 3 }, state), 3);
});

test('two missed fridays end the game and low reputation eats dau', () => {
  const lost = until('miss', { dauTargets: [999, 999, 999, 999] }, state => state.phase !== 'play');
  assert.equal(lost.phase, 'lost');
  assert.equal(lost.talks, 2);
  assert.match(lost.failReason, /约谈/);

  let state = createGame('drop', quiet);
  const id = state.tickets[0].id;
  let guard = 0;
  while (state.tickets.some(ticket => ticket.id === id && ticket.status === 'build') && guard < 20) {
    state = spend(state, { type: 'work', ticketId: id });
    guard += 1;
  }
  state = applyAction(state, { type: 'ship', ticketIds: [id] });
  state = { ...state, reputation: 10 };
  const dau = state.dau;
  while (state.ap > 0) state = applyAction(state, { type: 'rest' });
  state = applyAction(state, { type: 'sleep' });
  assert.ok(state.dau < dau);
  assert.match(state.log.join(' '), /日活 -/);
});

test('batching ships several tickets for one action', () => {
  let state = createGame('batch', quiet);
  let guard = 0;
  while (state.tickets.filter(ticket => ticket.status === 'ready').length < 2 && guard < 40) {
    const build = state.tickets.find(ticket => ticket.status === 'build');
    state = spend(state, build ? { type: 'work', ticketId: build.id } : { type: 'rest' });
    guard += 1;
  }
  if (state.ap === 0) state = applyAction(state, { type: 'sleep' });
  const ids = state.tickets.filter(ticket => ticket.status === 'ready').map(ticket => ticket.id);
  assert.ok(ids.length >= 2);
  assert.ok(state.ap > 0);
  const next = applyAction(state, { type: 'ship', ticketIds: ids });
  assert.equal(next.ap, state.ap - 1);
  assert.ok(next.dau > state.dau);
  assert.equal(next.tickets.some(ticket => ids.includes(ticket.id)), false);
});

test('homepage login breaks on week 4 tuesday and a wrong step costs reputation', () => {
  const monday = until('boss', quiet, state => state.week === 4 && state.day === 1);
  assert.equal(monday.week, 4);
  assert.equal(monday.day, 1);
  assert.equal(monday.boss.active, false);
  const tuesday = until('boss', { ...quiet, bossRepPerAp: 5 }, state => state.week === 4 && state.day === 2);
  assert.equal(tuesday.boss.active, true);
  const missed = applyAction(tuesday, { type: 'boss', option: 'monitor' });
  assert.equal(missed.boss.stage, 0);
  assert.equal(missed.reputation, tuesday.reputation - 5);
  assert.match(missed.log[0], /对不上/);
  const asked = applyAction(missed, { type: 'boss', option: 'posts' });
  assert.equal(asked.boss.stage, 2);
  assert.match(asked.log[0], /少走了一步/);
});

test('observation removes half the wrong leads and rollback stops the bleed', () => {
  const tuesday = until('obs', { ...quiet, bossRepPerAp: 5 }, state => state.boss.active);
  const plain = bossChoices(tuesday);
  const skilled = bossChoices({ ...tuesday, learned: { ...tuesday.learned, release: true } });
  const hidden = plain.filter(choice => !skilled.some(item => item.id === choice.id));
  const wrong = plain.filter(choice => !choice.correct && !choice.stopBleed);
  assert.equal(hidden.length, Math.floor(wrong.length / 2));
  assert.ok(hidden.every(choice => !choice.correct && !choice.stopBleed));
  for (const choice of plain.filter(item => item.correct || item.stopBleed)) {
    assert.ok(skilled.some(item => item.id === choice.id));
  }
  const stopped = applyAction({ ...tuesday, learned: { ...tuesday.learned, release: true } }, { type: 'boss', option: 'rollback' });
  assert.equal(stopped.boss.bleed, false);
  const after = applyAction(stopped, { type: 'boss', option: 'monitor' });
  assert.equal(after.reputation, stopped.reputation);
});

test('reviewing the boss is the good ending and skipping it is the other', () => {
  let done = until('good', quiet, state => state.boss.active);
  for (const option of ['posts', 'logs', 'config']) {
    if (done.ap === 0) done = applyAction(done, { type: 'sleep' });
    done = applyAction(done, { type: 'boss', option });
  }
  assert.equal(done.boss.resolved, true);
  if (done.ap === 0) done = applyAction(done, { type: 'sleep' });
  done = applyAction(done, { type: 'review', target: 'boss' });
  assert.equal(done.learned.failure, true);
  done = untilAlive(done);
  assert.equal(done.phase, 'won');
  assert.equal(done.ending, 'learned');
  assert.match(present(done).victoryTitle, /扛住了/);

  let barely = until('bare', quiet, state => state.boss.active);
  barely = untilAlive(barely);
  assert.equal(barely.phase, 'won');
  assert.equal(barely.ending, 'alive');
  assert.match(present(barely).victoryText, /没查完/);

  let short = until('short', { ...quiet, goodReputation: 100 }, state => state.boss.active);
  for (const option of ['posts', 'logs', 'config']) {
    if (short.ap === 0) short = applyAction(short, { type: 'sleep' });
    short = applyAction(short, { type: 'boss', option });
  }
  if (short.ap === 0) short = applyAction(short, { type: 'sleep' });
  short = applyAction(short, { type: 'review', target: 'boss' });
  short = untilAlive(short);
  assert.equal(short.phase, 'won');
  assert.equal(short.ending, 'alive');
  assert.match(present(short).victoryText, /口碑还没到 100/);
});

test('react waits until week 4 and colleagues say different things', () => {
  const first = createGame('react', quiet);
  assert.equal(present(first).skills.find(skill => skill.id === 'react').canStudy, false);
  const later = until('react', quiet, state => state.week === 4 && state.day === 1);
  assert.equal(present(later).skills.find(skill => skill.id === 'react').canStudy, true);
  const mod = present(later).colleagues.find(person => person.id === 'mod');
  assert.match(mod.lines.join(''), /登录有点卡/);

  const view = present(createGame('talk'));
  const lines = view.colleagues.map(person => person.lines.join('|'));
  assert.equal(new Set(lines).size, 3);
  assert.deepEqual(view.colleagues.map(person => person.name), ['催上线的创始人', '版主', '管事的创始人']);
  const tomorrow = until('talk', quiet, state => state.day === 2);
  for (const person of view.colleagues) {
    const next = present(tomorrow).colleagues.find(item => item.id === person.id);
    assert.notEqual(person.lines.join('|'), next.lines.join('|'), person.id);
  }
  const talked = applyAction(first, { type: 'talk', person: 'boss' });
  assert.equal(talked.ap, first.ap);
  assert.equal(talked.dialogue.person, 'boss');
});

test('overnight and a won dota match use the hefei stamina numbers', () => {
  const fresh = createGame('night', quiet);
  const night = applyAction(fresh, { type: 'overnight' });
  assert.equal(night.ap, fresh.ap + CONFIG.overnightAp);
  assert.equal(night.stamina, fresh.stamina - CONFIG.overnightStaminaCost);
  const won = applyAction(night, { type: 'dota', won: true });
  assert.equal(won.stamina, night.stamina + CONFIG.dotaWinStamina);
  const lost = applyAction(night, { type: 'dota', won: false });
  assert.equal(lost.stamina, night.stamina);
});

test('the recorded lines win, lose, and show both boss paths', () => {
  const win = play('n0', 'planned');
  assert.equal(win.state.phase, 'won');
  assert.equal(win.state.ending, 'learned');
  assert.equal(win.state.learned.react, true);
  const loss = play('n0', 'greedy');
  assert.equal(loss.state.phase, 'lost');
  assert.equal(loss.state.talks, 2);
  const demo = play('n0', 'demo');
  assert.equal(demo.state.phase, 'won');
  const options = demo.actions.filter(action => action.type === 'boss').map(action => action.option);
  assert.deepEqual(options.slice(0, 4), ['monitor', 'rollback', 'posts', 'config']);
  let state = createGame('n0');
  for (const action of demo.actions) {
    state = applyAction(state, action);
    if (action.type === 'pm-yes') break;
  }
  assert.equal(state.lastShip.from, 30);
  assert.equal(state.lastShip.to, 45);
});

test('three strategies over 240 fixed seeds land in range', () => {
  const report = runReport();
  assert.deepEqual(rateProblems(report), []);
  for (const id of ['greedy', 'planned', 'random']) {
    assert.equal(report[id].games, 240);
    assert.equal(report[id].clears, saved[id].clears);
    assert.equal(report[id].goodEndings, saved[id].goodEndings);
    assert.equal(report[id].method, saved[id].method);
  }
});

function untilAlive(state) {
  let guard = 0;
  while (state.phase === 'play' && guard < 200) {
    state = applyAction(state, state.ap > 0 ? { type: 'rest' } : { type: 'sleep' });
    guard += 1;
  }
  return state;
}
