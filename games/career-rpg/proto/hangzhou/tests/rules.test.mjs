import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BOSS_TICKETS, CONFIG, ENDINGS, FIELD_IDS, LINES } from '../config.mjs';
import { bossReviewActions, play } from '../sim.mjs';
import {
  applyAction,
  createGame,
  debtSurcharge,
  extractAp,
  moduleCovers,
  present,
  replay,
  snapshot,
  ticketCost,
  weekLine,
} from '../rules.mjs';

const rulesSource = readFileSync(new URL('../rules.mjs', import.meta.url), 'utf8');

function spend(state, action) {
  const next = applyAction(state, action);
  assert.notEqual(next, state);
  return next;
}

function finish(state, ticketId) {
  let next = state;
  let guard = 0;
  while (next.tickets.some(ticket => ticket.id === ticketId) && guard < 40) {
    next = next.ap > 0 ? spend(next, { type: 'work', ticketId }) : spend(next, { type: 'sleep' });
    guard += 1;
  }
  return next;
}

test('shared days and the Hangzhou numbers live in one config', () => {
  assert.equal(CONFIG.weeks, 4);
  assert.equal(CONFIG.daysPerWeek, 5);
  assert.equal(CONFIG.dailyAp, 3);
  assert.equal(CONFIG.staminaMax, 10);
  assert.equal(CONFIG.overnightStaminaCost, 3);
  assert.equal(CONFIG.debtPerHard, 8);
  assert.equal(CONFIG.debtStep, 25);
  assert.equal(CONFIG.moduleAp, 1);
  assert.equal(CONFIG.extractCost, 3);
  assert.equal(CONFIG.extractDiscount, 2);
  assert.equal(CONFIG.complaintLimit, 2);
  assert.equal(CONFIG.babelClear, 10);
  assert.equal(CONFIG.bossWeek, 4);
  assert.equal(CONFIG.bossDay, 1);
  assert.deepEqual(weekLine(1), 20);
  assert.deepEqual([weekLine(1), weekLine(2), weekLine(3), weekLine(4)], [20, 22, 24, 26]);
  assert.equal(BOSS_TICKETS.length, 5);
  for (const ticket of BOSS_TICKETS) assert.ok(ticket.difficulty >= 2 && ticket.difficulty <= 4);
  assert.equal(CONFIG.difficultyTable.every(cost => cost >= 2 && cost <= 4), true);
  assert.equal(rulesSource.includes('window'), false);
  assert.equal(rulesSource.includes('document'), false);
});

test('the same seed replays the same quarter', () => {
  const actions = [
    { type: 'rest' },
    { type: 'overnight' },
    { type: 'dota', won: false },
    { type: 'study', skill: 'biz' },
    { type: 'sleep' },
  ];
  assert.deepEqual(snapshot(replay('h7', actions)), snapshot(replay('h7', actions)));
  assert.deepEqual(snapshot(createGame('h7')), snapshot(createGame('h7')));
  const left = createGame('h0').tickets.map(ticket => `${ticket.line}/${ticket.field}/${ticket.difficulty}/${ticket.dueIn}`).join('|');
  const right = createGame('h1').tickets.map(ticket => `${ticket.line}/${ticket.field}/${ticket.difficulty}/${ticket.dueIn}`).join('|');
  assert.notEqual(left, right);
});

test('hardcoding adds 8 debt and a module costs 1 without debt', () => {
  let state = createGame('mod');
  const ticket = state.tickets[0];
  const other = state.tickets.find(item => item.field !== ticket.field) || state.tickets[0];
  state = finish(state, ticket.id);
  assert.equal(state.debt, 8);
  assert.equal(state.stats.hardCompletes, 1);
  while (!state.modules.includes(other.field)) {
    if (state.ap === 0) state = spend(state, { type: 'sleep' });
    else state = spend(state, { type: 'extract', field: other.field });
  }
  const covered = state.tickets.find(item => item.field === other.field);
  assert.ok(covered);
  const view = present(state);
  const card = view.tickets.find(item => item.id === covered.id);
  assert.equal(card.covered, true);
  assert.equal(card.base, 1);
  assert.equal(card.cost, 1);
  assert.equal(card.label, '模块 1 点');
  const debt = state.debt;
  state = finish(state, covered.id);
  assert.equal(state.debt, debt);
  assert.equal(state.stats.moduleCompletes, 1);
});

test('every 25 debt adds one action point to every ticket', () => {
  assert.equal(debtSurcharge(24), 0);
  assert.equal(debtSurcharge(25), 1);
  assert.equal(debtSurcharge(49), 1);
  assert.equal(debtSurcharge(50), 2);
  let state = createGame('debt');
  let guard = 0;
  while (state.debt < 25 && guard < 80) {
    const ticket = state.tickets.find(item => !item.late) || state.tickets[0];
    state = state.ap > 0 ? applyAction(state, { type: 'work', ticketId: ticket.id }) : applyAction(state, { type: 'sleep' });
    guard += 1;
  }
  assert.ok(state.debt >= 25);
  const view = present(state);
  assert.equal(view.surcharge, debtSurcharge(state.debt));
  for (const ticket of state.tickets) {
    const card = view.tickets.find(item => item.id === ticket.id);
    assert.equal(card.cost, ticketCost(state, ticket));
    assert.equal(card.surcharge, view.surcharge);
    assert.ok(card.label.includes(`技术债 ${view.surcharge}`));
  }
});

test('night can study and cannot touch a ticket or a module', () => {
  let state = spend(createGame('night'), { type: 'overnight' });
  assert.equal(state.night, true);
  assert.equal(state.ap, CONFIG.dailyAp + CONFIG.overnightAp);
  assert.equal(state.stamina, CONFIG.staminaStart - CONFIG.overnightStaminaCost);
  const ticketId = state.tickets[0].id;
  const field = state.tickets[0].field;
  assert.equal(applyAction(state, { type: 'work', ticketId }), state);
  assert.equal(applyAction(state, { type: 'extract', field }), state);
  state = spend(state, { type: 'dota', won: true });
  assert.equal(state.stamina, CONFIG.staminaStart - CONFIG.overnightStaminaCost + CONFIG.dotaWinStamina);
  state = spend(state, { type: 'study', skill: 'babel' });
  assert.equal(state.skills.babel, 1);
  assert.equal(present(state).nightLock, '夜里只能学技能，不能做需求单');
});

function studyUntil(state, skill) {
  let next = state;
  let guard = 0;
  while (!next.learned[skill] && guard < 30) {
    next = next.ap > 0 ? spend(next, { type: 'study', skill }) : spend(next, { type: 'sleep' });
    guard += 1;
  }
  assert.equal(next.learned[skill], true);
  return next;
}

test('design patterns, webpack, babel and the business forecast do what they say', () => {
  let state = createGame('skills');
  assert.equal(present(state).forecast, null);
  assert.equal(extractAp(state), 3);
  state = studyUntil(state, 'biz');
  assert.ok(present(state).forecastText.includes('、') || present(state).forecastText.length > 0);
  if (state.ap === 0) state = spend(state, { type: 'sleep' });
  state = spend(state, { type: 'extract', field: 'sku' });
  assert.equal(state.extractProgress.sku, 1);
  state = studyUntil(state, 'patterns');
  assert.equal(extractAp(state), 2);
  assert.equal(moduleCovers(['sku'], { ...state.learned, webpack: false }, 'link'), false);
  state = studyUntil(state, 'webpack');
  while (!state.modules.includes('sku')) {
    state = state.ap > 0 ? spend(state, { type: 'extract', field: 'sku' }) : spend(state, { type: 'sleep' });
  }
  assert.equal(moduleCovers(state.modules, state.learned, 'link'), true);
  const linked = state.tickets.find(ticket => ticket.field === 'link');
  if (linked) assert.equal(present(state).tickets.find(ticket => ticket.id === linked.id).base, 1);

  state = createGame('babel-week');
  state = studyUntil(state, 'babel');
  state = finish(state, state.tickets[0].id);
  assert.equal(state.debt, CONFIG.debtPerHard);
  while (!(state.week === 2 && state.day === 1)) {
    if (state.ap > 0) state = applyAction(state, { type: 'rest' });
    else state = spend(state, { type: 'sleep' });
  }
  assert.equal(state.debt, 0);
  assert.match(state.log.join('\n'), /Babel 清掉技术债 8/);
});

test('boss week opens on Monday and two complaints end the run', () => {
  const easy = { ...CONFIG, weekLineBase: 0, weekLineStep: 0 };
  let state = createGame('boss', easy);
  while (state.week < 4) state = applyAction(state, state.ap > 0 ? { type: 'rest' } : { type: 'sleep' });
  assert.equal(state.day, 1);
  assert.equal(state.bossOn, true);
  const bosses = state.tickets.filter(ticket => ticket.boss);
  assert.equal(bosses.length, 5);
  assert.deepEqual(bosses.map(ticket => ticket.field).sort(), [...FIELD_IDS].sort());
  assert.ok(bosses.every(ticket => ticket.dueIn === 5));
  assert.equal(present(state).whiteboard.length, 5);

  state = createGame('loss');
  while (state.phase === 'play') state = applyAction(state, state.ap > 0 ? { type: 'rest' } : { type: 'sleep' });
  assert.equal(state.phase, 'lost');
  assert.equal(state.complaints, 2);
  assert.match(state.failReason, /被业务方投诉两次/);
  assert.equal(ENDINGS.architecture.title, '一套架构，撑起五条业务线');
  assert.equal(ENDINGS.debt.title, '需求做完了，债也欠下了');
  assert.equal(LINES.map(line => line.name).join(','), '淘宝,天猫,闲鱼,飞猪,盒马');
});

test('the two wins and the boss debt step are reachable', () => {
  const win = play('planned', 'h1').state;
  assert.equal(win.phase, 'won');
  assert.equal(win.ending, 'architecture');
  assert.equal(win.learned.architecture, true);
  assert.equal(win.bossOnTime, 5);
  const debt = play('greedy', 'h1').state;
  assert.equal(debt.phase, 'won');
  assert.equal(debt.ending, 'debt');
  assert.equal(debt.bossOnTime < 5, true);

  const actions = bossReviewActions('h1');
  const before = present(replay('h1', actions.slice(0, -1)));
  const after = present(replay('h1', actions));
  assert.equal(before.bossOn, true);
  assert.equal(before.surcharge, 0);
  assert.equal(before.whiteboard.some(slot => slot.label === '模块 1 点'), true);
  assert.equal(before.whiteboard.some(slot => slot.label === '硬写 4 点'), true);
  assert.equal(after.surcharge, before.surcharge + 1);
  assert.equal(after.debt, before.debt + CONFIG.debtPerHard);
  assert.match(after.log[0], /所有单子 \+1/);
  assert.equal(after.whiteboard.some(slot => slot.label.includes('技术债 1')), true);
});
