// 三种固定打法。同一套种子 h0–h239，Dota 小游戏在模拟里按没打过结算。
import { hashSeed, rngInt } from '../rng.mjs';
import {
  BOSS_TICKETS,
  FIELD_IDS,
  SIMILAR,
  STUDY_IDS,
} from './config.mjs';
import {
  applyAction,
  bossFieldCovered,
  createGame,
  extractAp,
  moduleCovers,
  nextWeekFields,
  ticketCost,
} from './rules.mjs';

const BOSS_FIELDS = BOSS_TICKETS.map(ticket => ticket.field);

function canStudy(state, skillId) {
  const spec = state.config.skills[skillId];
  if (!spec || spec.granted || state.phase !== 'play' || state.ap <= 0) return false;
  if (state.learned[skillId]) return false;
  if (state.week < spec.minWeek) return false;
  if (spec.nightOnly && !state.night) return false;
  return true;
}

function leftOf(state, ticket) {
  return Math.max(0, ticketCost(state, ticket) - ticket.progress);
}

function budget(state, dueIn) {
  const today = state.night ? 0 : state.ap;
  return today + state.config.dailyAp * Math.max(0, dueIn - 1);
}

function slackOf(state, ticket) {
  return budget(state, ticket.dueIn) - leftOf(state, ticket);
}

function liveTickets(state) {
  return state.tickets.filter(ticket => !ticket.late && leftOf(state, ticket) > 0);
}

function minFeasibleSlack(state) {
  const feasible = liveTickets(state).filter(ticket => slackOf(state, ticket) >= 0);
  if (!feasible.length) return Infinity;
  return Math.min(...feasible.map(ticket => slackOf(state, ticket)));
}

function workTightest(state) {
  const feasible = liveTickets(state).filter(ticket => slackOf(state, ticket) >= 0);
  if (!feasible.length) return null;
  feasible.sort((a, b) => slackOf(state, a) - slackOf(state, b) || leftOf(state, a) - leftOf(state, b) || a.id - b.id);
  return feasible[0];
}

function coverageGain(state, field) {
  const gain = [field];
  if (state.learned.webpack) gain.push(SIMILAR[field]);
  return gain.filter(id => !moduleCovers(state.modules, state.learned, id));
}

function forecastSet(state) {
  if (!state.learned.biz || state.week >= 4) return new Set();
  return new Set(nextWeekFields(state));
}

function bestExtractField(state) {
  const forecast = forecastSet(state);
  let best = '';
  let bestScore = 0;
  for (const field of FIELD_IDS) {
    if (state.modules.includes(field)) continue;
    const gain = coverageGain(state, field);
    let score = 0;
    for (const id of gain) {
      if (BOSS_FIELDS.includes(id)) score += 3;
      if (forecast.has(id)) score += 2;
    }
    if (state.extractProgress[field] > 0) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = field;
    }
  }
  return bestScore > 0 ? best : '';
}

function studyChoice(state) {
  if (!state.learned.biz && canStudy(state, 'biz')) return 'biz';
  if (!state.learned.webpack && canStudy(state, 'webpack')) return 'webpack';
  const remaining = FIELD_IDS.filter(field => !moduleCovers(state.modules, state.learned, field)).length;
  if (!state.learned.patterns && remaining >= 3 && canStudy(state, 'patterns')) return 'patterns';
  if (!state.learned.babel && state.debt >= 16 && canStudy(state, 'babel')) return 'babel';
  return '';
}

function placeAction(state) {
  if (!state.bossOn) return null;
  for (const field of state.modules) {
    if (state.placed.includes(field)) continue;
    const covers = [field];
    if (state.learned.webpack) covers.push(SIMILAR[field]);
    const helps = covers.some(id => state.tickets.some(ticket => ticket.boss && ticket.field === id && !bossFieldCovered(state, id)));
    if (helps) return { type: 'place', field };
  }
  return null;
}

function week4Extract(state) {
  if (state.night || state.ap <= 0) return null;
  const field = bestExtractField(state);
  if (!field) return null;
  const price = extractAp(state) - state.extractProgress[field];
  const gain = new Set(coverageGain(state, field));
  const surcharge = Math.floor(state.debt / state.config.debtStep);
  let save = 0;
  let need = price;
  for (const ticket of state.tickets) {
    if (!ticket.boss || ticket.late) continue;
    if (gain.has(ticket.field) && !bossFieldCovered(state, ticket.field)) {
      const now = leftOf(state, ticket);
      const after = Math.max(0, state.config.moduleAp + surcharge - ticket.progress);
      save += now - after;
      need += after;
    } else {
      need += leftOf(state, ticket);
    }
  }
  const cap = state.ap + state.config.dailyAp * (state.config.daysPerWeek - state.day);
  if (save > price && need <= cap) return { type: 'extract', field };
  return null;
}

function week4(state) {
  const placed = placeAction(state);
  if (placed) return placed;
  if (state.ap === 0) return { type: 'sleep' };
  if (state.night) {
    const skill = studyChoice(state);
    if (skill) return { type: 'study', skill };
    return { type: 'rest' };
  }
  const extracting = week4Extract(state);
  if (extracting) return extracting;
  const bosses = state.tickets.filter(ticket => ticket.boss && !ticket.late && leftOf(state, ticket) > 0);
  if (bosses.length) {
    bosses.sort((a, b) => leftOf(state, a) - leftOf(state, b) || a.id - b.id);
    return { type: 'work', ticketId: bosses[0].id };
  }
  const other = workTightest(state);
  if (other) return { type: 'work', ticketId: other.id };
  return { type: 'rest' };
}

export function greedyAction(state) {
  if (state.phase !== 'play') return null;
  if (state.dotaPending) return { type: 'dota', won: false };
  if (state.ap === 0) return { type: 'sleep' };
  if (state.night) return { type: 'rest' };
  const open = state.tickets.filter(ticket => !ticket.late);
  if (!open.length) return { type: 'rest' };
  open.sort((a, b) => a.dueIn - b.dueIn || b.difficulty - a.difficulty || a.id - b.id);
  return { type: 'work', ticketId: open[0].id };
}

export function plannedAction(state) {
  if (state.phase !== 'play') return null;
  if (state.dotaPending) return { type: 'dota', won: false };
  if (state.week >= 4 || state.bossOn) return week4(state);
  if (state.ap === 0) {
    const canNight = !state.overnightUsed && !state.night && state.stamina >= 6;
    const wantNight = canNight && (
      (state.debt >= 24 && !state.learned.babel)
      || (!state.learned.patterns && state.modules.length < 3 && state.week <= 2)
    );
    if (wantNight) return { type: 'overnight' };
    return { type: 'sleep' };
  }
  if (state.night) {
    const skill = studyChoice(state);
    if (skill) return { type: 'study', skill };
    return { type: 'rest' };
  }
  if (minFeasibleSlack(state) >= 1) {
    const skill = studyChoice(state);
    if (skill) return { type: 'study', skill };
    const field = bestExtractField(state);
    if (field) return { type: 'extract', field };
  }
  if (state.stamina <= 2 && minFeasibleSlack(state) >= 2) return { type: 'rest' };
  const ticket = workTightest(state);
  if (ticket) return { type: 'work', ticketId: ticket.id };
  const skill = studyChoice(state);
  if (skill) return { type: 'study', skill };
  const field = bestExtractField(state);
  if (field) return { type: 'extract', field };
  return { type: 'rest' };
}

export function legalActions(state) {
  if (state.phase !== 'play') return [];
  if (state.dotaPending) return [{ type: 'dota', won: false }, { type: 'dota', won: true }];
  const actions = [];
  if (state.ap > 0 && !state.night) {
    for (const ticket of state.tickets) actions.push({ type: 'work', ticketId: ticket.id });
    for (const field of FIELD_IDS) {
      if (!state.modules.includes(field)) actions.push({ type: 'extract', field });
    }
  }
  if (state.ap > 0) {
    for (const skill of STUDY_IDS) {
      if (canStudy(state, skill)) actions.push({ type: 'study', skill });
    }
    actions.push({ type: 'rest' });
  }
  if (state.bossOn) {
    for (const field of state.modules) {
      if (!state.placed.includes(field)) actions.push({ type: 'place', field });
    }
  }
  if (!state.overnightUsed && !state.night) actions.push({ type: 'overnight' });
  if (state.ap === 0) actions.push({ type: 'sleep' });
  return actions;
}

export function randomAction(state, rng) {
  const actions = legalActions(state);
  const roll = rngInt(rng, 0, actions.length - 1);
  return { state: roll.state, action: actions[roll.value] };
}

const CHOOSERS = {
  greedy: state => ({ action: greedyAction(state) }),
  planned: state => ({ action: plannedAction(state) }),
  random: null,
};

export function play(strategy, seed, config) {
  let state = createGame(seed, config);
  let rng = hashSeed(`${seed}:${strategy}`);
  const actions = [];
  let guard = 0;
  while (state.phase === 'play' && guard < 800) {
    let action;
    if (strategy === 'random') {
      const rolled = randomAction(state, rng);
      rng = rolled.state;
      action = rolled.action;
    } else {
      action = CHOOSERS[strategy](state).action;
    }
    const next = applyAction(state, action);
    if (next === state) throw new Error(`${strategy} ${seed} stuck on ${JSON.stringify(action)}`);
    actions.push(action);
    state = next;
    guard += 1;
  }
  if (state.phase === 'play') throw new Error(`${strategy} ${seed} did not finish`);
  return { state, actions };
}

export function summarize(strategy, games) {
  const clears = games.filter(game => game.state.phase === 'won').length;
  const goodEndings = games.filter(game => game.state.ending === 'architecture').length;
  const lossWeeks = {};
  for (const game of games) {
    if (game.state.phase !== 'lost') continue;
    const week = String(game.state.week);
    lossWeeks[week] = (lossWeeks[week] || 0) + 1;
  }
  return {
    clears,
    goodEndings,
    clearRate: clears / games.length,
    goodRate: goodEndings / games.length,
    lossWeeks,
  };
}

export const SEEDS = Array.from({ length: 240 }, (_, index) => `h${index}`);

export function runStrategy(strategy, seeds = SEEDS, config) {
  const games = seeds.map(seed => play(strategy, seed, config));
  return { games, ...summarize(strategy, games) };
}

const METHODS = {
  greedy: '每个行动点硬写期限最短的未延期单（期限相同则难度高的优先）。做不完也继续硬写。不抽模块，不学技能，不熬夜。夜里或没有未延期的单就休息。行动点用完就睡觉。',
  planned: '先保期限还来得及的单。有余量就先学业务和 Webpack，再抽能覆盖 Boss 字段、以及下一周字段的模块；设计模式要抽的种类不少于 3 种才学，技术债到 16 就学 Babel。模块抽完前，如果体力还够，收工后熬夜学技能（先还债，否则先把抽模块从 3 点降到 2 点）。第 4 周把模块拼上白板，按期做完五张大单；缺的字段只在省下的点数够付硬写时才补抽。模拟里熬夜后的 Dota 按没打过算。',
  random: '每个行动点在当前能点的按钮里均匀随机选一个，包括硬写、抽模块、学习、休息、熬夜和拼白板。行动点用完就睡觉。熬夜后的 Dota 输赢也随机。',
};

export function runReport(seeds = SEEDS, config) {
  const strategies = ['greedy', 'planned', 'random'].map(id => {
    const result = runStrategy(id, seeds, config);
    return {
      id,
      name: { greedy: '贪心', planned: '有规划', random: '随机' }[id],
      method: METHODS[id],
      games: seeds.length,
      clears: result.clears,
      goodEndings: result.goodEndings,
      clearRate: result.clearRate,
      goodRate: result.goodRate,
      lossWeeks: result.lossWeeks,
    };
  });
  return {
    seeds: `${seeds[0]}–${seeds[seeds.length - 1]}`,
    games: seeds.length,
    note: '过关率 = 撑过 4 周的局数 / 总局数。好结局率 = Boss 五张都按期交付的局数 / 总局数。',
    strategies,
  };
}

function coveredTicket(state) {
  const open = state.tickets.filter(ticket => !ticket.late && moduleCovers(state.modules, state.learned, ticket.field));
  open.sort((a, b) => a.dueIn - b.dueIn || a.id - b.id);
  return open[0] || null;
}

function nextExtractField(state) {
  const wanted = BOSS_FIELDS.filter(field => !moduleCovers(state.modules, state.learned, field));
  let best = '';
  let bestScore = -1;
  for (const field of FIELD_IDS) {
    if (state.modules.includes(field)) continue;
    const gain = [field];
    if (state.learned.webpack) gain.push(SIMILAR[field]);
    const score = gain.filter(id => wanted.includes(id)).length + (state.extractProgress[field] > 0 ? 0.5 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = field;
    }
  }
  return best;
}

export function bossReviewActions(seed = 'h0') {
  let state = createGame(seed);
  const actions = [];
  const push = (action) => {
    const next = applyAction(state, action);
    if (next === state) throw new Error(`boss review stuck ${JSON.stringify(action)} on ${seed}`);
    actions.push(action);
    state = next;
  };
  let guard = 0;
  while (state.phase === 'play' && state.week < 4 && guard < 800) {
    guard += 1;
    if (state.ap === 0) { push({ type: 'sleep' }); continue; }
    if (state.night) { push({ type: 'rest' }); continue; }
    const hard = state.stats.hardCompletes;
    const urgent = state.tickets.filter(ticket => !ticket.late && ticket.dueIn <= 1)
      .sort((a, b) => a.id - b.id)[0];
    if (urgent && (hard >= 3 || !moduleCovers(state.modules, state.learned, urgent.field))) {
      if (hard < 3 || moduleCovers(state.modules, state.learned, urgent.field)) {
        push({ type: 'work', ticketId: urgent.id });
        continue;
      }
    }
    if (hard < 3) {
      const ticket = state.tickets.filter(item => !item.late).sort((a, b) => a.dueIn - b.dueIn || a.id - b.id)[0];
      if (ticket) { push({ type: 'work', ticketId: ticket.id }); continue; }
    }
    const covered = coveredTicket(state);
    if (covered) { push({ type: 'work', ticketId: covered.id }); continue; }
    if (state.modules.length < 2) {
      const field = nextExtractField(state);
      if (field) { push({ type: 'extract', field }); continue; }
    }
    push({ type: 'rest' });
  }
  if (state.week !== 4 || state.day !== 1 || state.phase !== 'play') {
    throw new Error(`boss review did not reach week 4 on ${seed}`);
  }
  for (const field of state.modules) {
    const next = applyAction(state, { type: 'place', field });
    if (next === state) continue;
    actions.push({ type: 'place', field });
    state = next;
  }
  const open = state.tickets.find(ticket => ticket.boss && !bossFieldCovered(state, ticket.field) && !ticket.late);
  if (!open) throw new Error(`boss review has no uncovered ticket on ${seed}`);
  let safety = 0;
  let crossed = false;
  while (state.phase === 'play' && safety < 16) {
    const before = debtSurchargeOf(state);
    if (state.ap === 0) push({ type: 'sleep' });
    else push({ type: 'work', ticketId: open.id });
    if (debtSurchargeOf(state) > before) { crossed = true; break; }
    safety += 1;
  }
  if (!crossed) throw new Error(`boss review did not cross a debt step on ${seed}`);
  return actions;
}

function debtSurchargeOf(state) {
  return Math.floor(state.debt / state.config.debtStep);
}

function printReport(report) {
  for (const item of report.strategies) {
    console.log(`${item.name} 过关 ${item.clears}/${item.games} (${item.clearRate}) 好结局 ${item.goodEndings} (${item.goodRate}) 失败周次 ${JSON.stringify(item.lossWeeks)}`);
  }
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href || process.argv[1]?.endsWith('sim.mjs')) {
  const width = Number(process.argv[2] || 240);
  const seeds = SEEDS.slice(0, width);
  console.time('sim');
  const report = runReport(seeds);
  console.timeEnd('sim');
  printReport(report);
}
