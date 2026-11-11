// 三种固定打法。种子和动作都不读墙钟，方便把统计写进 review/。
import { CONFIG, SKILL_IDS } from './config.mjs';
import { rngInt, hashSeed } from './rng.mjs';
import { applyAction, createGame, ticketWorkCost } from './rules.mjs';

export const STRATEGY_SEEDS = Object.freeze(
  Array.from({ length: 240 }, (_, index) => `g${index}`),
);

function workable(state) {
  return state.tickets
    .filter(ticket => !(ticket.mainline && !state.learned.database))
    .slice()
    .sort((a, b) => a.dueIn - b.dueIn || a.id - b.id);
}

export function greedyAction(state) {
  if (state.phase !== 'play') return null;
  if (state.ap <= 0) return { type: 'sleep' };
  const ticket = workable(state)[0];
  if (ticket) return { type: 'work', ticketId: ticket.id };
  return { type: 'rest' };
}

function fileDbOpen(state) {
  const ticket = state.tickets.find(item => item.mainline);
  if (!ticket || !state.learned.database) return null;
  if (ticket.progress >= ticketWorkCost(ticket, state.learned, state.config)) return null;
  return ticket;
}

function dueToday(state) {
  return workable(state).find(ticket => !ticket.mainline && (ticket.dueIn <= 1 || ticket.late));
}

export function plannedAction(state) {
  if (state.phase !== 'play') return null;
  if (state.ap <= 0) return { type: 'sleep' };
  const fire = dueToday(state);
  if (!state.learned.database) {
    if (fire) return { type: 'work', ticketId: fire.id };
    const studied = applyAction(state, { type: 'study', skill: 'database' });
    if (studied !== state) return { type: 'study', skill: 'database' };
  }
  if (fire) return { type: 'work', ticketId: fire.id };
  const file = fileDbOpen(state);
  if (file) return { type: 'work', ticketId: file.id };
  return greedyAction(state);
}

function randomOptions(state) {
  if (state.ap <= 0) return [{ type: 'sleep' }];
  const options = [];
  for (const ticket of workable(state)) options.push({ type: 'work', ticketId: ticket.id });
  for (const skill of [...SKILL_IDS, 'jquery']) {
    if (applyAction(state, { type: 'study', skill }) !== state) options.push({ type: 'study', skill });
  }
  options.push({ type: 'rest' });
  if (!state.overnightUsed) options.push({ type: 'overnight' });
  return options;
}

function play(seed, choose, config) {
  let state = createGame(seed, config);
  let rng = hashSeed(`plan:${seed}`);
  let guard = 0;
  const fridays = [];
  while (state.phase === 'play' && guard < 800) {
    const picked = choose(state, rng);
    rng = picked.rng;
    const action = picked.action;
    if (!action) break;
    const week = state.week;
    const day = state.day;
    const next = applyAction(state, action);
    if (next === state) break;
    state = next;
    if (action.type === 'sleep' && day === config.daysPerWeek) fridays.push({ week, favor: state.favor, phase: state.phase });
    if (action.type === 'overnight' && state.dotaPending) {
      const flip = rngInt(rng, 0, 1);
      rng = flip.state;
      state = applyAction(state, { type: 'dota', won: flip.value === 1 });
    }
    guard += 1;
  }
  state.fridays = fridays;
  return state;
}

function chooseGreedy(state, rng) {
  return { action: greedyAction(state), rng };
}

function choosePlanned(state, rng) {
  return { action: plannedAction(state), rng };
}

function chooseRandom(state, rng) {
  const options = randomOptions(state);
  const pick = rngInt(rng, 0, options.length - 1);
  return { action: options[pick.value], rng: pick.state };
}

function summarize(name, choose, seeds, config) {
  const lossWeeks = {};
  let won = 0;
  let remembered = 0;
  let barely = 0;
  let lost = 0;
  const endings = [];
  for (const seed of seeds) {
    const state = play(seed, choose, config);
    const row = {
      seed,
      phase: state.phase,
      ending: state.ending || '',
      week: state.week,
      favor: state.favor,
      fileDbDone: state.fileDbDone,
      fridays: state.fridays,
    };
    endings.push(row);
    if (state.phase === 'won') {
      won += 1;
      if (state.ending === 'remembered') remembered += 1;
      else barely += 1;
    } else {
      lost += 1;
      const key = String(state.week);
      lossWeeks[key] = (lossWeeks[key] || 0) + 1;
    }
  }
  const total = seeds.length;
  return {
    name,
    seeds: total,
    won,
    lost,
    remembered,
    barely,
    passRate: won / total,
    goodEndingRate: remembered / total,
    lossWeeks,
    endings,
  };
}

export function runStrategies(config = CONFIG, seeds = STRATEGY_SEEDS) {
  return {
    seeds: seeds.length,
    seedList: seeds,
    greedy: summarize('greedy', chooseGreedy, seeds, config),
    planned: summarize('planned', choosePlanned, seeds, config),
    random: summarize('random', chooseRandom, seeds, config),
  };
}

export function ratesOnly(report) {
  const trim = item => ({
    won: item.won,
    lost: item.lost,
    remembered: item.remembered,
    barely: item.barely,
    passRate: item.passRate,
    goodEndingRate: item.goodEndingRate,
    lossWeeks: item.lossWeeks,
  });
  return {
    seeds: report.seeds,
    greedy: trim(report.greedy),
    planned: trim(report.planned),
    random: trim(report.random),
  };
}
