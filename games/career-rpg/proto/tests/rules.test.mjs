import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CONFIG, VICTORY_TEXT } from '../config.mjs';
import { WIN_ACTIONS, WIN_SEED } from '../line.mjs';
import {
  applyAction,
  createGame,
  present,
  replay,
  snapshot,
  ticketPenalty,
  ticketReward,
  ticketWorkCost,
  weekLine,
} from '../rules.mjs';

const rulesSource = readFileSync(new URL('../rules.mjs', import.meta.url), 'utf8');

function restOnly(seed, config = CONFIG) {
  const actions = [];
  let state = createGame(seed, config);
  let guard = 0;
  while (state.phase === 'play' && guard < 800) {
    const action = state.ap > 0 ? { type: 'rest' } : { type: 'sleep' };
    actions.push(action);
    const next = applyAction(state, action);
    assert.notEqual(next, state);
    state = next;
    guard += 1;
  }
  assert.ok(guard < 800, 'game did not end');
  return { state, actions };
}

function fingerprint(seed) {
  return createGame(seed).tickets.map(ticket => [ticket.kind, ticket.title, ticket.difficulty, ticket.dueIn].join('/')).join('|');
}

test('documented starting numbers live in one config', () => {
  assert.equal(CONFIG.weeks, 4);
  assert.equal(CONFIG.daysPerWeek, 5);
  assert.equal(CONFIG.dailyAp, 3);
  assert.equal(CONFIG.exhaustedAp, 1);
  assert.equal(CONFIG.staminaMax, 10);
  assert.equal(CONFIG.staminaStart, 10);
  assert.equal(CONFIG.overnightAp, 1);
  assert.equal(CONFIG.overnightStaminaCost, 3);
  assert.equal(CONFIG.restStamina, 2);
  assert.equal(CONFIG.favorStart, 40);
  assert.equal(weekLine(1), 30);
  assert.equal(weekLine(2), 40);
  assert.equal(weekLine(3), 50);
  assert.equal(weekLine(4), 60);
  for (const skill of Object.values(CONFIG.skills)) assert.ok(skill.cost >= 2 && skill.cost <= 4);
  assert.equal(rulesSource.includes('document'), false);
  assert.equal(rulesSource.includes('window'), false);
});

test('same seed and actions reproduce the same game', () => {
  const first = restOnly('same-seed');
  const second = restOnly('same-seed');
  assert.deepEqual(first.actions, second.actions);
  assert.deepEqual(snapshot(first.state), snapshot(second.state));
  const mixed = [
    { type: 'rest' },
    { type: 'overnight' },
    { type: 'rest' },
    { type: 'rest' },
    { type: 'rest' },
    { type: 'sleep' },
  ];
  assert.deepEqual(snapshot(replay('mix', mixed)), snapshot(replay('mix', mixed)));
});

test('a different seed deals different tickets', () => {
  const left = fingerprint('hefei');
  const right = fingerprint('nanjing');
  assert.notEqual(left, right);
  assert.ok(createGame('hefei').tickets.length >= 1);
  assert.ok(createGame('hefei').tickets.length <= 2);
});

test('resting through week 1 is a firing on Friday', () => {
  for (const seed of ['hefei', '1', '2', 'alpha', 'beta', 'nanjing', 'rest']) {
    const { state } = restOnly(seed);
    assert.equal(state.phase, 'lost', seed);
    assert.equal(state.week, 1, seed);
    assert.equal(state.day, 5, seed);
    assert.ok(state.favor < 30, `${seed} favor ${state.favor}`);
    assert.match(state.failReason, /第 1 周周五/);
    assert.match(state.failReason, /低于本周线 30/);
    assert.ok(state.stats.lateCount >= 2, seed);
  }
});

test('overnight adds one point, costs 3 stamina, and empty stamina leaves 1 point', () => {
  const fresh = createGame('stamina');
  const before = snapshot(fresh);
  let state = applyAction(fresh, { type: 'overnight' });
  assert.equal(state.ap, 4);
  assert.equal(state.stamina, 7);
  assert.deepEqual(snapshot(fresh), before);
  const tired = [];
  let probe = createGame('burn');
  for (let day = 0; day < 4; day += 1) {
    probe = applyAction(probe, { type: 'overnight' });
    while (probe.ap > 0) {
      const studied = applyAction(probe, { type: 'study', skill: 'java' });
      if (studied !== probe) probe = studied;
      else if (probe.tickets.length) probe = applyAction(probe, { type: 'work', ticketId: probe.tickets[0].id });
      else probe = applyAction(probe, { type: 'rest' });
    }
    tired.push(probe.stamina);
    probe = applyAction(probe, { type: 'sleep' });
  }
  assert.deepEqual(tired, [7, 4, 1, 0]);
  assert.equal(probe.ap, 1);
  assert.equal(probe.stamina, 0);
});

test('rest restores 2 stamina and does not pass 10', () => {
  let state = createGame('rest-cap');
  state = applyAction(state, { type: 'overnight' });
  assert.equal(state.stamina, 7);
  state = applyAction(state, { type: 'rest' });
  assert.equal(state.stamina, 9);
  state = applyAction(state, { type: 'rest' });
  assert.equal(state.stamina, 10);
  state = applyAction(state, { type: 'rest' });
  assert.equal(state.stamina, 10);
});

test('Linux cuts a server ticket from 3 points to 1', () => {
  let state = createGame('s29');
  assert.equal(state.tickets.some(ticket => ticket.kind === 'server'), true);
  const server = present(state).tickets.find(ticket => ticket.kind === 'server');
  assert.equal(server.cost, 3);
  state = applyAction(state, { type: 'study', skill: 'linux' });
  assert.equal(present(state).tickets.find(ticket => ticket.id === server.id).cost, 3);
  state = applyAction(state, { type: 'study', skill: 'linux' });
  const after = present(state).tickets.find(ticket => ticket.id === server.id);
  assert.equal(state.learned.linux, true);
  assert.equal(after.cost, 1);
  assert.equal(after.costNote, 'Linux');
  assert.equal(ticketWorkCost({ kind: 'server', difficulty: 3 }, { linux: false }), 3);
  assert.equal(ticketWorkCost({ kind: 'server', difficulty: 3 }, { linux: true }), 1);
});

test('Git cuts an event penalty from 18 to 8', () => {
  let state = createGame('s3');
  const event = present(state).tickets.find(ticket => ticket.kind === 'server' || ticket.kind === 'demo');
  assert.ok(event);
  assert.equal(event.penalty, 18);
  for (let i = 0; i < 3; i += 1) state = applyAction(state, { type: 'study', skill: 'git' });
  const after = present(state).tickets.find(ticket => ticket.id === event.id);
  assert.equal(state.learned.git, true);
  assert.equal(after.penalty, 8);
  assert.equal(after.penaltyNote, 'Git');
  while (state.ap > 0) state = applyAction(state, { type: 'rest' });
  const slept = applyAction(state, { type: 'sleep' });
  assert.equal(slept.stats.favorLost, 8);
  assert.ok(slept.log.some(line => line.includes('Git 回滚，好感 -8（否则 -18）')));
  assert.equal(ticketPenalty({ kind: 'demo' }, { git: false }), 18);
  assert.equal(ticketPenalty({ kind: 'demo' }, { git: true }), 8);
});

test('jQuery stays shut in week 1 and then saves a point on page tickets', () => {
  const blocked = createGame('jquery');
  const untouched = snapshot(blocked);
  assert.equal(applyAction(blocked, { type: 'study', skill: 'jquery' }), blocked);
  assert.deepEqual(snapshot(blocked), untouched);
  assert.equal(present(blocked).skills.find(skill => skill.id === 'jquery').blocked, '第 2 周开放');

  const page = { kind: 'page', difficulty: 3 };
  assert.equal(ticketWorkCost(page, { jquery: false }), 3);
  assert.equal(ticketWorkCost(page, { jquery: true }), 2);
  assert.equal(ticketWorkCost({ kind: 'page', difficulty: 1 }, { jquery: true }), 1);
});

test('Java can only be studied at night and unlocks a double-favor fullstack ticket', () => {
  let state = createGame('java');
  const before = snapshot(state);
  assert.equal(applyAction(state, { type: 'study', skill: 'java' }), state);
  assert.deepEqual(snapshot(state), before);
  assert.equal(present(state).skills.find(skill => skill.id === 'java').blocked, '只能夜里学');
  state = applyAction(state, { type: 'overnight' });
  for (let i = 0; i < 3; i += 1) state = applyAction(state, { type: 'study', skill: 'java' });
  assert.equal(state.learned.java, false);
  assert.equal(state.tickets.some(ticket => ticket.kind === 'fullstack'), false);
  state = applyAction(state, { type: 'study', skill: 'java' });
  assert.equal(state.learned.java, true);
  const fullstack = present(state).tickets.find(ticket => ticket.kind === 'fullstack');
  assert.ok(fullstack);
  assert.equal(fullstack.cost, 3);
  assert.equal(fullstack.reward, 18);
  const normal = ticketReward({ kind: 'page', difficulty: 3 });
  assert.equal(ticketReward({ kind: 'fullstack', difficulty: 3 }), normal * 2);
  assert.equal(normal, 9);
});

test('illegal actions leave the state untouched', () => {
  const state = createGame('freeze');
  assert.equal(applyAction(state, { type: 'sleep' }), state);
  assert.equal(applyAction(state, { type: 'work', ticketId: 999 }), state);
  assert.equal(applyAction(state, { type: 'study', skill: 'nope' }), state);
  const done = restOnly('freeze');
  assert.equal(applyAction(done.state, { type: 'rest' }), done.state);
});

test('victory line is the handoff sentence', () => {
  assert.equal(VICTORY_TEXT, '日夜颠倒地学新东西，拼命把活干好，争取能留下来。');
});

test('the fixed line survives four weeks and jQuery changes a live ticket', () => {
  const won = replay(WIN_SEED, WIN_ACTIONS);
  assert.equal(won.phase, 'won');
  assert.equal(won.week, 4);
  assert.equal(won.day, 5);
  assert.ok(won.favor >= weekLine(4));
  assert.deepEqual(won.learned, { linux: true, git: true, jquery: true, java: true });
  assert.deepEqual(snapshot(replay(WIN_SEED, WIN_ACTIONS)), snapshot(won));

  let state = createGame(WIN_SEED);
  let dropped = false;
  for (const action of WIN_ACTIONS) {
    const before = present(state);
    state = applyAction(state, action);
    if (action.type === 'study' && action.skill === 'jquery' && state.learned.jquery) {
      const page = before.tickets.find(ticket => ticket.kind === 'page' && ticket.difficulty >= 2);
      const after = present(state).tickets.find(ticket => ticket.id === page.id);
      assert.equal(after.cost, page.cost - 1);
      assert.equal(after.costNote, 'jQuery');
      dropped = true;
    }
  }
  assert.equal(dropped, true);
  assert.equal(state.phase, 'won');
});
