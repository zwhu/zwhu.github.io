import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CONFIG, ENDINGS, SKILL_IDS } from '../config.mjs';
import { BARELY_ACTIONS, BARELY_SEED, LOSS_ACTIONS, LOSS_SEED, REMEMBERED_ACTIONS, REMEMBERED_SEED } from '../line.mjs';
import {
  applyAction,
  bossFavorLine,
  clearedEnding,
  coworkerLine,
  createGame,
  forecastTomorrow,
  present,
  SCRIPT,
  replay,
  snapshot,
  ticketPenalty,
  ticketWorkCost,
  workStep,
  weekLine,
} from '../rules.mjs';
import { ratesOnly, runStrategies } from '../sim.mjs';
import { learningSkills, sceneArrival } from '../scene-ui.mjs';
import { WALK_GRID, commitArrival, findPath, pointBlocked, resolveClick } from '../walk.mjs';
import { convertMeta, pngSize } from '../walk/build-sprites.mjs';
import { frameIndex, resolveSprite, spritePose } from '../walk-sprites.mjs';

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
  assert.equal(weekLine(4), 111);
  assert.equal(CONFIG.weekLineFinal, 111);
  assert.equal(CONFIG.favorMax, 200);
  assert.equal(CONFIG.fileDbReward, 50);
  assert.equal(CONFIG.goodFavor, 200);
  assert.equal(CONFIG.noodleStamina, 3);
  assert.equal(CONFIG.noodleStamina, CONFIG.restStamina + 1);
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
  assert.equal(CONFIG.overnightName, '打 Dota');
  assert.equal(state.log[0], '打 Dota，行动点 +1，体力 7');
  assert.deepEqual(snapshot(fresh), before);
  let drained = null;
  for (let n = 0; n < 30 && !drained; n += 1) {
    let probe = createGame(`burn${n}`);
    const tired = [];
    let rested = false;
    for (let day = 0; day < 4 && !rested; day += 1) {
      probe = applyAction(probe, { type: 'overnight' });
      while (probe.ap > 0 && !rested) {
        const skill = ['java', 'linux', 'git', 'database'].find(id => !probe.learned[id]);
        const studied = skill ? applyAction(probe, { type: 'study', skill }) : probe;
        if (studied !== probe) probe = studied;
        else {
          const ticket = probe.tickets.find(item => !item.mainline);
          const worked = ticket ? applyAction(probe, { type: 'work', ticketId: ticket.id }) : probe;
          if (worked === probe) rested = true;
          else probe = worked;
        }
      }
      tired.push(probe.stamina);
      if (!rested) probe = applyAction(probe, { type: 'sleep' });
    }
    if (!rested && tired[3] === 0 && probe.ap === 1) drained = tired;
  }
  assert.deepEqual(drained, [7, 4, 1, 0]);
});

test('winning dota refunds 2 stamina and losing refunds none', () => {
  const fresh = createGame('dota-pay');
  assert.equal(applyAction(fresh, { type: 'dota', won: true }), fresh);
  let state = applyAction(fresh, { type: 'overnight' });
  assert.equal(state.ap, 4);
  assert.equal(state.stamina, 7);
  assert.equal(state.dotaPending, true);
  const lost = applyAction(state, { type: 'dota', won: false });
  assert.equal(lost.stamina, 7);
  assert.equal(lost.ap, 4);
  assert.equal(lost.dotaPending, false);
  assert.equal(lost.log[0], 'Dota 没打过，体力不返还');
  assert.equal(applyAction(lost, { type: 'dota', won: true }), lost);
  const won = applyAction(state, { type: 'dota', won: true });
  assert.equal(won.stamina, 9);
  assert.equal(won.ap, 4);
  assert.equal(present(won).stamina, 9);
  assert.equal(won.log[0], 'Dota 打赢了，体力 +2，现在 9');
  assert.equal(CONFIG.dotaWinStamina, 2);
  const capped = applyAction({ ...state, stamina: 9 }, { type: 'dota', won: true });
  assert.equal(capped.stamina, 10);
  assert.equal(capped.log[0], 'Dota 打赢了，体力 +1，现在 10');
  const full = applyAction({ ...state, stamina: 10 }, { type: 'dota', won: true });
  assert.equal(full.stamina, 10);
  assert.equal(full.log[0], 'Dota 打赢了，体力已经满了');
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

test('Linux cuts a server or incident ticket to 1 point', () => {
  let state = createGame('s1');
  const server = present(state).tickets.find(ticket => ['log', 'cron', 'disk', 'rollback', 'demo'].includes(ticket.kind) && ticket.cost > 1);
  assert.ok(server);
  const before = server.cost;
  state = applyAction(state, { type: 'study', skill: 'linux' });
  state = applyAction(state, { type: 'study', skill: 'linux' });
  const after = present(state).tickets.find(ticket => ticket.id === server.id);
  assert.equal(state.learned.linux, true);
  assert.equal(after.cost, 1);
  assert.ok(after.cost < before);
  assert.equal(after.costNote, 'Linux');
  assert.equal(ticketWorkCost({ kind: 'log', difficulty: 3 }, { linux: false }), 3);
  assert.equal(ticketWorkCost({ kind: 'disk', difficulty: 3 }, { linux: true }), 1);
  assert.equal(ticketWorkCost({ kind: 'demo', difficulty: 3 }, { linux: true }), 1);
});

test('Git cuts an event penalty from 18 to 8', () => {
  let state = createGame('s3');
  const event = present(state).tickets.find(ticket => ['disk', 'rollback', 'demo'].includes(ticket.kind));
  assert.ok(event);
  assert.equal(state.tickets.length, 1);
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
  assert.equal(present(blocked).shelf.blocked, '第 2 周开放');
  assert.deepEqual(SKILL_IDS.includes('jquery'), false);

  const page = { kind: 'page', difficulty: 3 };
  assert.equal(ticketWorkCost(page, { jquery: false }), 3);
  assert.equal(ticketWorkCost(page, { jquery: true }), 2);
  assert.equal(ticketWorkCost({ kind: 'page', difficulty: 1 }, { jquery: true }), 1);
});

test('Java is night-only and the file database stays shut until 数据库', () => {
  let state = createGame('hefei');
  assert.equal(applyAction(state, { type: 'study', skill: 'java' }), state);
  assert.equal(present(state).skills.find(skill => skill.id === 'java').blocked, '只能夜里学');
  assert.equal(ticketWorkCost({ kind: 'api', difficulty: 3 }, { java: false }), 3);
  assert.equal(ticketWorkCost({ kind: 'api', difficulty: 3 }, { java: true }), 2);
  assert.equal(workStep({ mainline: true }, { java: false }), 1);
  assert.equal(workStep({ mainline: true }, { java: true }), 2);
  let guard = 0;
  while (state.phase === 'play' && !(state.week === 2 && state.day === 1) && guard < 400) {
    const due = state.tickets.find(ticket => !ticket.mainline && ticket.dueIn <= 1);
    const action = state.ap === 0 ? { type: 'sleep' } : (due ? { type: 'work', ticketId: due.id } : { type: 'rest' });
    state = applyAction(state, action);
    guard += 1;
  }
  const file = present(state).tickets.find(ticket => ticket.mainline);
  assert.equal(file.title, '写一个文件数据库');
  assert.equal(file.locked, true);
  assert.equal(file.reward, 50);
  assert.equal(applyAction(state, { type: 'work', ticketId: file.id }), state);
  while (!state.learned.database) {
    state = applyAction(state, state.ap > 0 ? { type: 'study', skill: 'database' } : { type: 'sleep' });
  }
  if (state.ap === 0) state = applyAction(state, { type: 'sleep' });
  state = applyAction(state, { type: 'work', ticketId: file.id });
  assert.equal(present(state).tickets.find(ticket => ticket.mainline).progress, 1);
  while (!state.learned.java && state.phase === 'play') {
    if (state.ap === 0) state = applyAction(state, { type: 'sleep' });
    else if (!state.overnightUsed) state = applyAction(state, { type: 'overnight' });
    else state = applyAction(state, { type: 'study', skill: 'java' });
  }
  if (state.ap === 0) state = applyAction(state, { type: 'sleep' });
  const progress = present(state).tickets.find(ticket => ticket.mainline).progress;
  state = applyAction(state, { type: 'work', ticketId: file.id });
  assert.equal(present(state).tickets.find(ticket => ticket.mainline).progress, progress + 2);
  assert.equal(state.tickets.some(ticket => ticket.kind === 'fullstack'), false);
});

test('illegal actions leave the state untouched', () => {
  const state = createGame('freeze');
  assert.equal(applyAction(state, { type: 'sleep' }), state);
  assert.equal(applyAction(state, { type: 'work', ticketId: 999 }), state);
  assert.equal(applyAction(state, { type: 'study', skill: 'nope' }), state);
  const done = restOnly('freeze');
  assert.equal(applyAction(done.state, { type: 'rest' }), done.state);
});

test('the good ending needs both the file database and the remember line', () => {
  assert.equal(clearedEnding(CONFIG.goodFavor, true), 'remembered');
  assert.equal(clearedEnding(CONFIG.goodFavor - 1, true), 'barely');
  assert.equal(clearedEnding(CONFIG.goodFavor, false), 'barely');
  assert.ok(CONFIG.goodFavor > weekLine(4));
});

test('the two cleared endings replace the probation reminder', () => {
  assert.equal(ENDINGS.remembered.title, '留下来，还被老板记住了');
  assert.equal(ENDINGS.barely.title, '勉强留下来');
  const bodies = [
    ENDINGS.remembered.title,
    ENDINGS.remembered.text,
    ENDINGS.barely.title,
    ENDINGS.barely.text,
    ENDINGS.barely.fileDbDone,
    ENDINGS.lost.text,
  ].join('');
  assert.equal(bodies.includes('争取'), false);
  assert.match(SCRIPT.daysPass, /争取能留下来/);
  assert.equal(bodies.includes(SCRIPT.daysPass), false);
});

function interviewed(seed) {
  let state = createGame(seed);
  let guard = 0;
  while (!state.interviewed && guard < 8) {
    state = applyAction(state, { type: 'talk', person: 'boss' });
    guard += 1;
  }
  return state;
}

test('the opening interview is five lines and the first nameplate is 面试', () => {
  let state = createGame('intro');
  const lines = [];
  const names = [];
  while (!state.interviewed) {
    const line = coworkerLine(state, 'boss');
    lines.push(line.text);
    names.push(line.name);
    const next = applyAction(state, { type: 'talk', person: 'boss' });
    assert.equal(next.ap, state.ap);
    assert.equal(next.interviewed, lines.length === 5);
    state = next;
  }
  assert.deepEqual(names, ['面试', '老板', '我', '老板', '']);
  assert.deepEqual(lines, [
    '原本录用的人嫌工资低，没来。',
    '你能力不行，来了也干不了活。',
    '我不要工资，让我来试试就行。',
    '行，那你想试试我也不拦你，反正不要工资，到时候你自己也会受不了就走。',
    '就这样留下了。',
  ]);
  assert.equal(coworkerLine(createGame('intro'), 'boss').narrator, true);
  assert.equal(coworkerLine(state, 'boss').text, '今天说过了。');
});

test('at night only the teammate can be clicked', () => {
  const day = interviewed('night-click');
  assert.equal(coworkerLine(day, 'boss').clickable, true);
  assert.equal(coworkerLine(day, 'lunch').clickable, true);
  assert.equal(coworkerLine(day, 'neighbor').clickable, true);
  assert.equal(coworkerLine(day, 'party').clickable, false);
  const night = applyAction(day, { type: 'night' });
  assert.equal(coworkerLine(night, 'boss').clickable, false);
  assert.equal(coworkerLine(night, 'lunch').clickable, false);
  assert.equal(coworkerLine(night, 'neighbor').clickable, false);
  assert.equal(coworkerLine(night, 'party').clickable, true);
  assert.equal(night.ap, day.ap);
  assert.equal(night.favor, day.favor);
});

test('before the interview everyone only sends you to the boss', () => {
  const night = applyAction(createGame('gate'), { type: 'night' });
  assert.equal(night.interviewed, false);
  for (const person of ['lunch', 'neighbor', 'party']) {
    const line = coworkerLine(night, person);
    assert.equal(line.visible, true);
    assert.match(line.text, /先去找老板/);
    assert.equal(line.choices.length, 0);
    assert.equal(applyAction(night, { type: 'talk', person, choice: 'accept' }), night);
  }
  assert.equal(night.ap, CONFIG.dailyAp);
  assert.equal(night.stamina, CONFIG.staminaStart);
  assert.equal(night.dotaPending, false);
  let hired = night;
  while (!hired.interviewed) hired = applyAction(hired, { type: 'talk', person: 'boss' });
  assert.equal(hired.interviewed, true);
  assert.equal(hired.night, true);
  assert.match(coworkerLine(hired, 'lunch').text, /好饿，去吃面吗？/);
  assert.doesNotMatch(coworkerLine(hired, 'lunch').text, /找老板/);
  assert.match(coworkerLine(hired, 'neighbor').text, /明天会来/);
  assert.match(coworkerLine(hired, 'party').text, /Dota/);
});

test('each coworker can be talked to once a day, and the next day is a different line', () => {
  let state = interviewed('once');
  const first = coworkerLine(state, 'lunch').text;
  const talked = applyAction(state, { type: 'talk', person: 'neighbor' });
  assert.notEqual(talked, state);
  assert.equal(applyAction(talked, { type: 'talk', person: 'neighbor' }), talked);
  assert.equal(coworkerLine(talked, 'neighbor').text, '今天说过了。');
  while (state.ap > 0) state = applyAction(state, { type: 'rest' });
  state = applyAction(state, { type: 'sleep' });
  assert.equal(state.talked.neighbor, false);
  assert.notEqual(coworkerLine(state, 'lunch').text, first);
  assert.match(coworkerLine(state, 'lunch').text, /好饿，去吃面吗？/);
  const again = applyAction(state, { type: 'talk', person: 'neighbor' });
  assert.notEqual(again.log[0], talked.log[0]);
});

test('noodles cost 1 AP and restore 3 stamina, one more than resting', () => {
  let state = applyAction(interviewed('noodles'), { type: 'overnight' });
  assert.equal(state.stamina, 7);
  assert.equal(state.ap, 4);
  const declined = applyAction(state, { type: 'talk', person: 'lunch', choice: 'decline' });
  assert.equal(declined.ap, 4);
  assert.equal(declined.stamina, 7);
  let fresh = applyAction(interviewed('noodles-yes'), { type: 'overnight' });
  fresh = applyAction(fresh, { type: 'talk', person: 'lunch', choice: 'accept' });
  assert.equal(fresh.ap, 3);
  assert.equal(fresh.stamina, 10);
  assert.equal(fresh.stamina - 7, CONFIG.restStamina + 1);
  assert.match(fresh.log[0], /体力 \+3，现在 10/);
  assert.equal(fresh.say, '走，就对面那家。');
  assert.equal(applyAction(fresh, { type: 'talk', person: 'lunch', choice: 'accept' }), fresh);
  let dry = interviewed('noodles-dry');
  while (dry.ap > 0) dry = applyAction(dry, { type: 'rest' });
  assert.equal(applyAction(dry, { type: 'talk', person: 'lunch', choice: 'accept' }), dry);
});

test('the neighbor names the ticket that arrives the next morning and teaches nothing', () => {
  const seen = new Set();
  for (const seed of ['hefei', 'nanjing', 's1', 'forecast-seed']) seen.add(JSON.stringify(forecastTomorrow(createGame(seed))));
  assert.ok(seen.size > 1);

  let state = interviewed('forecast-seed');
  const forecast = forecastTomorrow(state);
  assert.deepEqual(forecastTomorrow(applyAction(state, { type: 'rest' })), forecast);
  const said = applyAction(state, { type: 'talk', person: 'neighbor' });
  assert.equal(said.learned.linux, false);
  assert.equal(said.learned.database, false);
  assert.equal(said.skills.java, 0);
  assert.match(said.log[0], /明天会来「/);
  assert.ok(said.log[0].includes(forecast.title));
  assert.ok(said.log[0].includes(`${forecast.difficulty} 点`));
  assert.ok(said.log[0].includes(`期限 ${forecast.dueIn} 天`));
  assert.doesNotMatch(said.log[0], /学会/);
  const before = new Set(said.tickets.map(ticket => ticket.id));
  let spent = said;
  while (spent.ap > 0) spent = applyAction(spent, { type: 'rest' });
  const morning = applyAction(spent, { type: 'sleep' });
  const arrived = morning.tickets.find(ticket => !before.has(ticket.id)
    && ticket.kind === forecast.kind
    && ticket.title === forecast.title
    && ticket.difficulty === forecast.difficulty
    && ticket.dueIn === forecast.dueIn);
  assert.ok(arrived);
  assert.deepEqual(forecastTomorrow(createGame('forecast-seed')), forecast);
});

test('friday lines change with favor, and the teammate only plays Dota at night', () => {
  assert.notEqual(bossFavorLine(50, 30), bossFavorLine(35, 30));
  assert.notEqual(bossFavorLine(35, 30), bossFavorLine(10, 30));
  assert.match(bossFavorLine(50, 30), /高出一截/);
  assert.match(bossFavorLine(35, 30), /刚过/);
  assert.match(bossFavorLine(10, 30), /没到/);
  const fired = restOnly('favor-line').state;
  assert.match(fired.log[0], /没到本周线 30/);
  assert.equal(fired.settlementLine, fired.log[0]);

  const day = interviewed('party-day');
  assert.equal(coworkerLine(day, 'party').visible, false);
  assert.equal(applyAction(day, { type: 'talk', person: 'party', choice: 'accept' }), day);
  const night = applyAction(day, { type: 'night' });
  const declined = applyAction(night, { type: 'talk', person: 'party', choice: 'decline' });
  assert.equal(declined.ap, night.ap);
  assert.equal(declined.stamina, night.stamina);
  assert.equal(declined.dotaPending, false);
  assert.equal(declined.overnightUsed, false);
  const accepted = applyAction(night, { type: 'talk', person: 'party', choice: 'accept' });
  assert.equal(accepted.ap, night.ap + 1);
  assert.equal(accepted.stamina, night.stamina - 3);
  assert.equal(accepted.dotaPending, true);
  assert.equal(applyAction(accepted, { type: 'talk', person: 'party', choice: 'accept' }), accepted);
});

test('week 2 Monday the boss assigns the file database', () => {
  let state = interviewed('assign');
  let guard = 0;
  while (state.phase === 'play' && !(state.week === 2 && state.day === 1) && guard < 400) {
    const due = state.tickets.find(ticket => !ticket.mainline && ticket.dueIn <= 1);
    state = applyAction(state, state.ap === 0 ? { type: 'sleep' } : (due ? { type: 'work', ticketId: due.id } : { type: 'rest' }));
    guard += 1;
  }
  assert.match(coworkerLine(state, 'boss').text, /写一个文件数据库/);
  const told = applyAction(state, { type: 'talk', person: 'boss' });
  assert.match(told.log[0], /写一个文件数据库/);
  assert.equal(told.ap, state.ap);
});

test('three fixed strategies stay inside the tuned rates', () => {
  const report = ratesOnly(runStrategies());
  const saved = JSON.parse(readFileSync(new URL('../review/strategies.json', import.meta.url), 'utf8'));
  assert.equal(saved.seedCount, 240);
  assert.equal(report.seeds, 240);
  for (const name of ['greedy', 'planned', 'random']) {
    assert.equal(report[name].won, saved.strategies[name].won);
    assert.equal(report[name].remembered, saved.strategies[name].remembered);
    assert.equal(report[name].barely, saved.strategies[name].barely);
  }
  assert.ok(report.greedy.passRate >= 0.55 && report.greedy.passRate <= 0.65);
  assert.ok(report.greedy.goodEndingRate <= 0.05);
  assert.ok(report.greedy.won === 0 || report.greedy.barely / report.greedy.won >= 0.9);
  assert.ok(report.planned.passRate >= report.greedy.passRate);
  assert.ok(report.planned.goodEndingRate >= 0.45);
  assert.ok(report.random.passRate <= 0.18);
  assert.ok(report.random.goodEndingRate <= 0.03);
});

test('fixed lines reproduce a firing, a bare survival, and a remembered win', () => {
  const lost = replay(LOSS_SEED, LOSS_ACTIONS);
  assert.equal(lost.phase, 'lost');
  assert.equal(lost.week, 1);
  assert.equal(lost.day, 5);
  assert.match(lost.failReason, /第 1 周周五/);
  assert.match(lost.failReason, /低于本周线 30/);

  const remembered = replay(REMEMBERED_SEED, REMEMBERED_ACTIONS);
  assert.equal(remembered.phase, 'won');
  assert.equal(remembered.ending, 'remembered');
  assert.equal(remembered.fileDbDone, true);
  assert.ok(remembered.favor >= CONFIG.goodFavor);
  assert.equal(present(remembered).victoryTitle, '留下来，还被老板记住了');
  assert.deepEqual(snapshot(replay(REMEMBERED_SEED, REMEMBERED_ACTIONS)), snapshot(remembered));

  const barely = replay(BARELY_SEED, BARELY_ACTIONS);
  assert.equal(barely.phase, 'won');
  assert.equal(barely.ending, 'barely');
  assert.equal(barely.fileDbDone, false);
  assert.equal(clearedEnding(barely.favor, false), 'barely');
  assert.match(present(barely).victoryText, /还没写完/);
  assert.equal(present(barely).victoryTitle, '勉强留下来');
  assert.ok(barely.favor >= weekLine(4));
});

test('each clickable target has a path that stays off obstacles', () => {
  const start = WALK_GRID.start;
  assert.equal(pointBlocked(start.x, start.y), false);
  for (const id of ['boss', 'lunch', 'neighbor', 'computer', 'shelf', 'party', 'water', 'door']) {
    const target = WALK_GRID.targets[id];
    assert.equal(pointBlocked(target.x, target.y), false, id);
    const path = findPath(start, target);
    assert.ok(path, id);
    for (const point of path) assert.equal(pointBlocked(point.x, point.y), false, id);
    const end = path.length ? path[path.length - 1] : start;
    assert.ok(Math.abs(end.x - target.x) < WALK_GRID.cell, id);
    assert.ok(Math.abs(end.y - target.y) < WALK_GRID.cell, id);
  }
  const midway = findPath(start, WALK_GRID.targets.neighbor)[8];
  const retarget = findPath(midway, WALK_GRID.targets.boss);
  assert.ok(retarget);
  for (const point of retarget) assert.equal(pointBlocked(point.x, point.y), false);
});

test('clicking empty floor does not change the game, including ap and stamina', () => {
  const game = createGame('hefei');
  const before = snapshot(game);
  const hit = resolveClick({ x: 100, y: 194 }, { night: false, canStudy: true });
  assert.equal(hit.kind, 'walk');
  assert.equal(hit.action, null);
  const path = findPath(WALK_GRID.start, hit.target);
  assert.ok(path);
  for (const point of path) assert.equal(pointBlocked(point.x, point.y), false);
  const after = commitArrival(game, hit, applyAction);
  assert.equal(after, game);
  assert.equal(after.ap, before.ap);
  assert.equal(after.stamina, before.stamina);
  assert.deepEqual(snapshot(after), before);
});

test('scene clicks use the same actions as the buttons', () => {
  const day = { night: false, canStudy: false };
  assert.deepEqual(resolveClick({ x: 326, y: 100 }, day).action, { type: 'talk', person: 'boss' });
  assert.deepEqual(resolveClick({ x: 266, y: 160 }, day).action, { type: 'talk', person: 'lunch' });
  assert.deepEqual(resolveClick({ x: 147, y: 150 }, day).action, { type: 'talk', person: 'neighbor' });
  assert.deepEqual(resolveClick({ x: 75, y: 132 }, day).action, { type: 'computer' });
  assert.deepEqual(resolveClick({ x: 20, y: 40 }, day).action, { type: 'shelf' });
  assert.deepEqual(resolveClick({ x: 178, y: 70 }, day).action, { type: 'water' });
  assert.deepEqual(resolveClick({ x: 190, y: 190 }, day).action, { type: 'door' });
  assert.deepEqual(sceneArrival('computer', { interviewed: false }), { prompt: '先去找老板。' });
  assert.deepEqual(sceneArrival('shelf', { interviewed: false }), { prompt: '先去找老板。' });
  assert.deepEqual(sceneArrival('shelf', { interviewed: true, canStudy: true }), { action: { type: 'study', skill: 'jquery' } });
  assert.deepEqual(learningSkills([{ id: 'linux' }, { id: 'jquery' }]).map(item => item.id), ['linux']);
  assert.equal(resolveClick({ x: 326, y: 100 }, { night: true, canStudy: true }).kind, 'none');
  assert.deepEqual(resolveClick({ x: 106, y: 180 }, { night: true, canStudy: false }).action, { type: 'talk', person: 'party' });
  const game = createGame('hefei');
  const walked = commitArrival(game, resolveClick({ x: 24, y: 140 }, day), applyAction);
  assert.equal(walked.ap, game.ap);
  assert.equal(walked.stamina, game.stamina);
  const mainSource = readFileSync(new URL('../main.mjs', import.meta.url), 'utf8');
  assert.match(mainSource, /openPerson\(action\.person\)/);
  assert.match(mainSource, /act\(\{ type: 'study', skill: present\(state\)\.shelf\.id \}\)/);
  const actionCss = readFileSync(new URL('../style.css', import.meta.url), 'utf8').match(/\.actions\s*\{[^}]*\}/)[0];
  assert.equal(/position:\s*(?:sticky|fixed)/.test(actionCss), false);
});

test('walk sprites come from the generated sheet and match the designer meta', () => {
  const sheet = JSON.parse(readFileSync(new URL('../walk/walk.sprites.json', import.meta.url), 'utf8'));
  const meta = JSON.parse(readFileSync(new URL('../walk/meta.json', import.meta.url), 'utf8'));
  const image = 'player-walk-hefei.png';
  const imageSize = pngSize(fileURLToPath(new URL(`../walk/${image}`, import.meta.url)));
  assert.deepEqual(sheet, convertMeta(meta, { image, imageSize }));
  for (const facing of meta.rows) {
    const sprite = resolveSprite(sheet, facing);
    assert.equal(sprite.frames.length, meta.cycles.walk6.length, facing);
    assert.equal(sprite.mirror, false, facing);
    assert.deepEqual([sprite.anchor.x, sprite.anchor.y], meta.foot_anchor);
    assert.equal(sprite.frameMs, meta.frame_ms.walk6);
    assert.deepEqual([sprite.idle.x, sprite.idle.y, sprite.idle.w, sprite.idle.h], meta.frames[facing].idle.rect);
    assert.equal(sprite.image, `./walk/${image}`);
  }
  const mainSource = readFileSync(new URL('../main.mjs', import.meta.url), 'utf8');
  const loaderSource = readFileSync(new URL('../walk-sprites.mjs', import.meta.url), 'utf8');
  assert.equal(mainSource.includes('meta.json'), false);
  assert.equal(loaderSource.includes('meta.json'), false);
  assert.match(mainSource, /walk\.sprites\.json/);
  const check = spawnSync(process.execPath, ['games/career-rpg/proto/walk/build-sprites.mjs', '--check'], {
    cwd: fileURLToPath(new URL('../../../..', import.meta.url)),
  });
  assert.equal(check.status, 0, check.stderr?.toString());
});

test('a missing walk direction falls back without mirroring', () => {
  const sheet = JSON.parse(readFileSync(new URL('../walk/walk.sprites.json', import.meta.url), 'utf8'));
  delete sheet.directions.left;
  const sprite = resolveSprite(sheet, 'left');
  assert.deepEqual(sprite.frames, resolveSprite(sheet, 'down').frames);
  assert.equal(sprite.mirror, false);
  assert.equal(resolveSprite({}, 'up').frames.length, 1);
});

test('each facing reads its own sheet row, and walking is not the stand frame', () => {
  const sheet = JSON.parse(readFileSync(new URL('../walk/walk.sprites.json', import.meta.url), 'utf8'));
  const meta = JSON.parse(readFileSync(new URL('../walk/meta.json', import.meta.url), 'utf8'));
  const cellH = meta.cell[1];
  for (const facing of ['up', 'down', 'left', 'right']) {
    const row = meta.rows.indexOf(facing);
    const sprite = resolveSprite(sheet, facing);
    const walk = sprite.frames.map(frame => `(${frame.x},${frame.y},${frame.w},${frame.h})`).join(' ');
    console.log(`${facing} row ${row} y=${row * cellH} idle=(${sprite.idle.x},${sprite.idle.y},${sprite.idle.w},${sprite.idle.h}) walk=${walk}`);
    assert.equal(sprite.idle.y, row * cellH, facing);
    assert.equal(sprite.frames.length, meta.cycles.walk6.length, facing);
    for (const [index, name] of meta.cycles.walk6.entries()) {
      const rect = meta.frames[facing][name].rect;
      assert.deepEqual([sprite.frames[index].x, sprite.frames[index].y, sprite.frames[index].w, sprite.frames[index].h], rect, `${facing} ${name}`);
      assert.notEqual(sprite.frames[index].x, sprite.idle.x, `${facing} ${name} is the stand cell`);
    }
  }
  assert.equal(meta.rows[0], 'down');
  assert.equal(meta.rows[1], 'up');
  assert.notEqual(resolveSprite(sheet, 'up').idle.y, resolveSprite(sheet, 'left').idle.y);
  assert.notEqual(resolveSprite(sheet, 'down').idle.y, resolveSprite(sheet, 'up').idle.y);
  const moving = spritePose(sheet, { facing: 'down', moving: true, seated: false, elapsedMs: sheet.frameMs });
  const stopped = spritePose(sheet, { facing: 'down', moving: false, seated: false, elapsedMs: sheet.frameMs });
  const seated = spritePose(sheet, { facing: 'down', moving: false, seated: true, elapsedMs: 0 });
  assert.equal(moving.kind, 'walk');
  assert.notEqual(moving.frame.x, stopped.frame.x);
  assert.deepEqual(stopped.frame, resolveSprite(sheet, 'down').idle);
  assert.equal(seated.kind, 'seated');
  const mainSource = readFileSync(new URL('../main.mjs', import.meta.url), 'utf8');
  assert.match(mainSource, /player-seated\.png/);
});

test('walking changes frames, stopping shows the stand pose, and sitting leaves the walk sheet', () => {
  const sheet = JSON.parse(readFileSync(new URL('../walk/walk.sprites.json', import.meta.url), 'utf8'));
  const started = spritePose(sheet, { facing: 'left', moving: true, seated: false, elapsedMs: 0 });
  const stepped = spritePose(sheet, { facing: 'left', moving: true, seated: false, elapsedMs: sheet.frameMs });
  const stopped = spritePose(sheet, { facing: 'left', moving: false, seated: false, elapsedMs: sheet.frameMs });
  const seated = spritePose(sheet, { facing: 'left', moving: false, seated: true, elapsedMs: 0 });
  assert.equal(started.kind, 'walk');
  assert.notEqual(started.frame.x, stepped.frame.x);
  assert.equal(stopped.kind, 'stand');
  assert.deepEqual(stopped.frame, resolveSprite(sheet, 'left').idle);
  assert.equal(seated.kind, 'seated');
  assert.equal(seated.frame, undefined);
});

test('walk frames advance when a direction has more than one frame', () => {
  const sheet = JSON.parse(readFileSync(new URL('./fixtures/walk-two-frames.json', import.meta.url), 'utf8'));
  const sprite = resolveSprite(sheet, 'down');
  assert.equal(sprite.frames.length, 2);
  assert.equal(frameIndex(sprite, 0), 0);
  assert.equal(frameIndex(sprite, 99), 0);
  assert.equal(frameIndex(sprite, 100), 1);
  assert.equal(frameIndex(sprite, 200), 0);
});
