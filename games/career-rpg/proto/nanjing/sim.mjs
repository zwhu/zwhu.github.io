// 三种打法。数字只从规则里读，不在这里改概率。
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashSeed, rngInt } from '../rng.mjs';
import {
  applyAction,
  bossChoices,
  canStudy,
  createGame,
  pmOffer,
  present,
  weekTarget,
} from './rules.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const GREEDY_METHOD = '每个行动点只做最急的事：首页登不上时按排查选项从上到下试，试过的不重复；否则事故先定位再修复；然后做期限最短的单，做完立刻单张上线。不补测试，不灰度，不攒批，不学习，不熬夜，不答应催上线的创始人，不复盘。没单可做才休息。';
export const PLANNED_METHOD = '先学 fibjs / Node.js 和集成测试，第 2 周学敬畏上线。难单自己补测试再上，当天到期的直接上。不急的单攒到两张一起上，学会灰度后上线走灰度。事故先定位再修复，只剩 1 点且会回滚时才回滚普通事故。Boss 先回滚止血，再看老用户的帖子、改配置，然后复盘。日活过线后学 React / Webpack。';
export const RANDOM_METHOD = '每个行动点在当前合法操作里均匀随机，包括干活、补测试、上线、一起上、学习、休息、熬夜、事故、Boss 排查和复盘。随机数由种子单独引出。熬夜之后记一场没打过的 Dota，体力不返还。';

function dueTickets(state) {
  return state.tickets.slice().sort((a, b) => a.dueIn - b.dueIn || Number(b.status === 'ready') - Number(a.status === 'ready') || a.id - b.id);
}

function chooseGreedy(state) {
  if (state.phase !== 'play' || state.ap <= 0) return { type: 'sleep' };
  if (state.boss.active && !state.boss.resolved) {
    const choices = bossChoices(state);
    const next = choices.find(choice => !state.boss.tried.includes(choice.id)) || choices[0];
    return { type: 'boss', option: next.id };
  }
  const incident = state.incidents.find(item => item.stage !== 'resolved');
  if (incident) {
    if (incident.stage === 'open') return { type: 'locate', incidentId: incident.id };
    return { type: 'fix', incidentId: incident.id };
  }
  const ticket = dueTickets(state)[0];
  if (!ticket) return { type: 'rest' };
  if (ticket.status === 'ready') return { type: 'ship', ticketIds: [ticket.id], canary: false };
  return { type: 'work', ticketId: ticket.id };
}

function shouldTest(state, ticket) {
  if (ticket.tested) return false;
  if (ticket.dueIn <= 1) return false;
  if (ticket.difficulty >= 3) return true;
  if (state.learned.ci && ticket.difficulty >= 2) return true;
  if (state.reputation < 40 && ticket.difficulty >= 2) return true;
  return false;
}

function shipOne(state, ticket) {
  return {
    type: 'ship',
    ticketIds: [ticket.id],
    canary: Boolean(state.learned.release && state.reputation < 55),
  };
}

function workTarget(state) {
  const tickets = dueTickets(state);
  const urgent = tickets.find(ticket => ticket.dueIn <= 1) || tickets[0];
  if (!urgent) return null;
  if (urgent.status === 'build') return { type: 'work', ticketId: urgent.id };
  if (shouldTest(state, urgent) && state.ap > 1) return { type: 'test', ticketId: urgent.id };
  return shipOne(state, urgent);
}

function behind(state) {
  return state.dau + 16 < weekTarget(state) || state.reputation < 36;
}

function choosePlanned(state, demo) {
  if (state.phase !== 'play' || state.ap <= 0) return { type: 'sleep' };

  if (demo && state.stats.pmAccepts === 0) {
    const offer = pmOffer(state);
    if (offer && !state.talked.pm) return { type: 'talk', person: 'pm' };
    if (offer && state.dialogue?.person === 'pm') return { type: 'pm-yes' };
  }
  if (demo && state.week === 4 && state.day === 1 && !state.talked.mod) return { type: 'talk', person: 'mod' };

  if (state.boss.active && !state.boss.resolved) {
    if (demo && !state.talked.boss) return { type: 'talk', person: 'boss' };
    const choices = bossChoices(state);
    if (demo && state.boss.stage === 0 && !state.boss.tried.includes('monitor') && choices.some(choice => choice.id === 'monitor')) {
      return { type: 'boss', option: 'monitor' };
    }
    if (state.boss.bleed && state.learned.release && !state.boss.tried.includes('rollback')) {
      return { type: 'boss', option: 'rollback' };
    }
    const posts = choices.find(choice => choice.id === 'posts' && choice.correct);
    if (posts) return { type: 'boss', option: 'posts' };
    const correct = choices.find(choice => choice.correct);
    if (correct) return { type: 'boss', option: correct.id };
    const next = choices.find(choice => !state.boss.tried.includes(choice.id)) || choices[0];
    return { type: 'boss', option: next.id };
  }
  if (state.boss.resolved && !state.boss.reviewed) return { type: 'review', target: 'boss' };

  const incident = state.incidents.find(item => item.stage !== 'resolved');
  if (incident) {
    if (incident.stage === 'open') {
      if (state.learned.release && state.ap === 1) return { type: 'rollback', incidentId: incident.id };
      return { type: 'locate', incidentId: incident.id };
    }
    return { type: 'fix', incidentId: incident.id };
  }

  if (!state.learned.fibjs && canStudy(state, 'fibjs')) return { type: 'study', skill: 'fibjs' };
  if (state.tickets.some(ticket => ticket.dueIn <= 1)) return workTarget(state);
  if (!state.learned.ci && canStudy(state, 'ci')) return { type: 'study', skill: 'ci' };
  if (!state.learned.release && state.week >= 2 && canStudy(state, 'release')) return { type: 'study', skill: 'release' };
  if (state.week >= 4 && state.boss.reviewed && state.dau >= weekTarget(state) && state.reputation >= 30 && canStudy(state, 'react')) {
    return { type: 'study', skill: 'react' };
  }

  const ready = state.tickets.filter(ticket => ticket.status === 'ready').sort((a, b) => a.dueIn - b.dueIn || a.id - b.id);
  const build = dueTickets(state).find(ticket => ticket.status === 'build');
  const waiting = ready.find(ticket => shouldTest(state, ticket) && state.ap > 1);
  if (waiting) return { type: 'test', ticketId: waiting.id };
  if (ready.length >= 2 && ready.every(ticket => ticket.tested || !shouldTest(state, ticket))) {
    return {
      type: 'ship',
      ticketIds: ready.map(ticket => ticket.id),
      canary: Boolean(state.learned.release),
    };
  }
  // 不急的单先攒着，凑两张再一起上。日活或口碑已经紧了就单张上。
  if (ready.length === 1 && ready[0].dueIn > 1 && build && !behind(state)) return { type: 'work', ticketId: build.id };
  if (ready.length) return shipOne(state, ready[0]);
  if (build) return { type: 'work', ticketId: build.id };

  const pending = state.incidents.find(item => item.stage === 'resolved' && !item.reviewed);
  if (pending && state.dau >= weekTarget(state)) return { type: 'review', target: pending.id };
  return { type: 'rest' };
}

function legalActions(state) {
  const actions = [];
  for (const ticket of state.tickets) {
    if (ticket.status === 'build') actions.push({ type: 'work', ticketId: ticket.id });
    if (ticket.status === 'ready' && !ticket.tested) actions.push({ type: 'test', ticketId: ticket.id });
    if (ticket.status === 'ready') actions.push({ type: 'ship', ticketIds: [ticket.id], canary: false });
    if (ticket.status === 'ready' && state.learned.release) actions.push({ type: 'ship', ticketIds: [ticket.id], canary: true });
  }
  const ready = state.tickets.filter(ticket => ticket.status === 'ready');
  if (ready.length >= 2) {
    actions.push({ type: 'ship', ticketIds: ready.map(ticket => ticket.id), canary: false });
    if (state.learned.release) actions.push({ type: 'ship', ticketIds: ready.map(ticket => ticket.id), canary: true });
  }
  for (const skill of ['fibjs', 'ci', 'release', 'react']) {
    if (canStudy(state, skill)) actions.push({ type: 'study', skill });
  }
  actions.push({ type: 'rest' });
  if (!state.overnightUsed) actions.push({ type: 'overnight' });
  for (const incident of state.incidents) {
    if (incident.stage === 'open') actions.push({ type: 'locate', incidentId: incident.id });
    if (incident.stage === 'located') actions.push({ type: 'fix', incidentId: incident.id });
    if (incident.stage !== 'resolved' && state.learned.release) actions.push({ type: 'rollback', incidentId: incident.id });
    if (incident.stage === 'resolved' && !incident.reviewed) actions.push({ type: 'review', target: incident.id });
  }
  if (state.boss.active && !state.boss.resolved) {
    for (const choice of bossChoices(state)) actions.push({ type: 'boss', option: choice.id });
  }
  if (state.boss.resolved && !state.boss.reviewed) actions.push({ type: 'review', target: 'boss' });
  const offer = pmOffer(state);
  if (offer && !state.talked.pm) actions.push({ type: 'talk', person: 'pm' });
  if (offer && (state.dialogue?.person === 'pm' || !state.talked.pm)) actions.push({ type: 'pm-yes' });
  return actions;
}

function chooseRandom(state, rng) {
  if (state.phase !== 'play' || state.ap <= 0) return { action: { type: 'sleep' }, rng };
  const actions = legalActions(state);
  const pick = rngInt(rng, 0, actions.length - 1);
  return { action: actions[pick.value], rng: pick.state };
}

function applyStep(state, action) {
  const next = applyAction(state, action);
  if (next === state) return null;
  if (action.type !== 'overnight') return { state: next, actions: [action] };
  const after = applyAction(next, { type: 'dota', won: false });
  return { state: after, actions: [action, { type: 'dota', won: false }] };
}

export function play(seed, policy, config) {
  let state = createGame(seed, config);
  let rng = hashSeed(`${seed}:${policy}`);
  const actions = [];
  let guard = 0;
  while (state.phase === 'play' && guard < 600) {
    let action;
    if (policy === 'greedy') action = chooseGreedy(state);
    else if (policy === 'planned' || policy === 'demo') {
      action = choosePlanned(state, policy === 'demo');
    } else if (policy === 'random') {
      const picked = chooseRandom(state, rng);
      action = picked.action;
      rng = picked.rng;
    } else {
      throw new Error(`unknown policy ${policy}`);
    }
    const stepped = applyStep(state, action);
    if (!stepped) throw new Error(`noop ${policy} ${seed} ${JSON.stringify(action)} week ${state.week} day ${state.day} ap ${state.ap}`);
    actions.push(...stepped.actions);
    state = stepped.state;
    guard += 1;
  }
  if (state.phase === 'play') throw new Error(`unterminated ${policy} ${seed}`);
  return { state, actions, view: present(state) };
}

function summarize(name, method, rows) {
  const clears = rows.filter(row => row.phase === 'won').length;
  const goodEndings = rows.filter(row => row.ending === 'learned').length;
  const lossWeeks = {};
  for (const row of rows) {
    if (row.phase === 'won') continue;
    const week = String(row.week);
    lossWeeks[week] = (lossWeeks[week] || 0) + 1;
  }
  return {
    name,
    method,
    seeds: 'n0–n239',
    games: rows.length,
    clears,
    goodEndings,
    clearRate: Math.round((clears / rows.length) * 10000) / 10000,
    goodRate: Math.round((goodEndings / rows.length) * 10000) / 10000,
    lossWeeks,
  };
}

export function runReport(config) {
  const policies = [
    ['greedy', '贪心', GREEDY_METHOD],
    ['planned', '有规划', PLANNED_METHOD],
    ['random', '随机', RANDOM_METHOD],
  ];
  const report = {};
  for (const [id, name, method] of policies) {
    const rows = [];
    for (let i = 0; i < 240; i += 1) {
      const played = play(`n${i}`, id, config);
      rows.push({ phase: played.state.phase, ending: played.state.ending, week: played.state.week, talks: played.state.talks });
    }
    report[id] = summarize(name, method, rows);
  }
  return report;
}

export function rateProblems(report) {
  const problems = [];
  const greedy = report.greedy;
  const planned = report.planned;
  const random = report.random;
  if (greedy.clearRate < 0.4 || greedy.clearRate > 0.6) problems.push(`贪心过关率 ${greedy.clearRate}`);
  if (greedy.goodRate > 0.05) problems.push(`贪心好结局率 ${greedy.goodRate}`);
  if (planned.clearRate < 0.7 || planned.clearRate > 0.85) problems.push(`有规划过关率 ${planned.clearRate}`);
  if (planned.goodRate < 0.4 || planned.goodRate > 0.6) problems.push(`有规划好结局率 ${planned.goodRate}`);
  if (planned.clearRate < planned.goodRate + 0.15) problems.push(`有规划过关率没有明显高于好结局率 ${planned.clearRate} / ${planned.goodRate}`);
  if (planned.clearRate < greedy.clearRate) problems.push('有规划过关率低于贪心');
  if (random.clearRate > 0.15) problems.push(`随机过关率 ${random.clearRate}`);
  if (random.goodRate > 0.03) problems.push(`随机好结局率 ${random.goodRate}`);
  return problems;
}

function main() {
  const report = runReport();
  const file = path.join(HERE, 'review/strategies.json');
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  const problems = rateProblems(report);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
