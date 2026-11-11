import { hashSeed, rngInt, rngNext } from '../rng.mjs';
import {
  BOSS_TAILS,
  CONFIG,
  DAY_NAMES,
  ENDINGS,
  KIND_LABEL,
  MOD_TAILS,
  PEOPLE,
  PM_TAILS,
  QA_TAILS,
  SKILL_IDS,
} from './config.mjs';

export { CONFIG, DAY_NAMES, ENDINGS, PEOPLE, SKILL_IDS };

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function formatPct(value) {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${text}%`;
}

export function weekTarget(state) {
  const targets = state.config.dauTargets;
  return targets[Math.min(state.week, targets.length) - 1];
}

function dayKey(state) {
  return state.week * 10 + state.day;
}

function dayIndex(state) {
  return (state.week - 1) * state.config.daysPerWeek + (state.day - 1);
}

function withLog(state, line) {
  if (!line) return state;
  return { ...state, log: [line, ...state.log].slice(0, 10) };
}

function blankStats() {
  return {
    shipped: 0,
    incidents: 0,
    lateCount: 0,
    studies: 0,
    rests: 0,
    overnights: 0,
    pmAccepts: 0,
    qaHelps: 0,
    reputationLost: 0,
    dauGained: 0,
  };
}

function blankBoss() {
  return { started: false, active: false, resolved: false, reviewed: false, stage: 0, bleed: false, tried: [] };
}

function blankTalked() {
  return { pm: false, qa: false, mod: false, boss: false };
}

export function buildCost(ticket, state) {
  if ((ticket.kind === 'front' || ticket.kind === 'back') && state.learned.fibjs) {
    return Math.max(1, ticket.difficulty - state.config.skillDiscount);
  }
  return ticket.difficulty;
}

export function shipChance(ticket, state, opts = {}) {
  const config = state.config;
  let chance = ticket.tested ? config.testedChance : config.baseChance;
  if (state.learned.ci && ticket.tested) chance /= 2;
  if (opts.rushed) chance += config.pmChanceAdd;
  return Math.min(config.chanceCap, chance);
}

export function shipDauParts(ticket, state, opts = {}) {
  const base = state.config.dauBase + ticket.difficulty * state.config.dauStep;
  const extra = opts.rushed ? Math.round(base * state.config.pmExtraRatio) : 0;
  return { base, extra, total: base + extra };
}

export function shipDamage(count, state, canary) {
  const raw = state.config.incidentRep * count;
  if (canary && state.learned.release) return Math.ceil(raw / 2);
  return raw;
}

function compareRoll(roll, chance) {
  return Math.floor(roll * 1000) < Math.round(chance * 10);
}

export function canStudy(state, skillId) {
  const spec = state.config.skills[skillId];
  if (!spec || state.phase !== 'play' || state.ap <= 0 || state.learned[skillId]) return false;
  return state.week >= spec.minWeek;
}

function byDue(a, b) {
  return a.dueIn - b.dueIn || a.id - b.id;
}

export function pmOffer(state) {
  if (state.phase !== 'play' || state.pmDay === dayKey(state)) return null;
  const ticket = state.tickets.filter(item => item.status === 'ready').sort(byDue)[0];
  if (!ticket) return null;
  const before = shipChance(ticket, state);
  const after = shipChance(ticket, state, { rushed: true });
  const parts = shipDauParts(ticket, state, { rushed: true });
  return { ticketId: ticket.id, title: ticket.title, before, after, extra: parts.extra, total: parts.total };
}

export function qaOffer(state) {
  if (state.phase !== 'play' || state.qaWeek === state.week) return null;
  const ticket = state.tickets
    .filter(item => item.status === 'ready' && !item.tested)
    .sort((a, b) => b.difficulty - a.difficulty || a.id - b.id)[0];
  if (!ticket) return null;
  const before = shipChance(ticket, state);
  const after = shipChance({ ...ticket, tested: true }, state);
  return { ticketId: ticket.id, title: ticket.title, before, after };
}

export function bossChoices(state) {
  if (!state.boss.active || state.boss.resolved) return [];
  const stage = state.boss.stage;
  const all = state.config.bossOptions;
  const wrong = all.filter(option => option.stage !== stage && !option.stopBleed);
  const hidden = new Set();
  if (state.learned.release) {
    const hideCount = Math.floor(wrong.length / 2);
    for (const option of wrong.slice(wrong.length - hideCount)) hidden.add(option.id);
  }
  return all.filter(option => !hidden.has(option.id)).map(option => ({
    id: option.id,
    label: option.label,
    correct: option.stage === stage && option.stage >= 0,
    stopBleed: Boolean(option.stopBleed),
  }));
}

function spendAp(state) {
  if (state.phase !== 'play' || state.ap <= 0) return null;
  let reputation = state.reputation;
  let stats = state.stats;
  let bleed = 0;
  if (state.boss.active && !state.boss.resolved && state.boss.bleed) {
    const before = reputation;
    reputation = clamp(reputation - state.config.bossRepPerAp, state.config.reputationMin, state.config.reputationMax);
    bleed = before - reputation;
    stats = { ...stats, reputationLost: stats.reputationLost + bleed };
  }
  return { ap: state.ap - 1, reputation, stats, bleed };
}

function makeTicket(rng, id, config) {
  const pick = rngInt(rng, 0, config.tickets.length - 1);
  const spec = config.tickets[pick.value];
  const difficulty = rngInt(pick.state, 0, config.difficultyTable.length - 1);
  const due = rngInt(difficulty.state, config.deadlineMin, config.deadlineMax);
  return {
    rng: due.state,
    ticket: {
      id,
      kind: spec.kind,
      title: spec.title,
      difficulty: config.difficultyTable[difficulty.value],
      dueIn: due.value,
      progress: 0,
      status: 'build',
      tested: false,
      testedBy: '',
      late: false,
    },
  };
}

function spawn(state) {
  const config = state.config;
  let rng = state.rng;
  const count = rngInt(rng, config.spawnMin, config.spawnMax);
  rng = count.state;
  const tickets = state.tickets.slice();
  let nextId = state.nextId;
  for (let i = 0; i < count.value; i += 1) {
    const made = makeTicket(rng, nextId, config);
    rng = made.rng;
    nextId += 1;
    tickets.push(made.ticket);
  }
  return withLog({ ...state, rng, nextId, tickets }, `早上新到 ${count.value} 张单。`);
}

function startBoss(state) {
  if (state.week !== 4 || state.day !== 2 || state.boss.started) return state;
  return withLog({
    ...state,
    boss: { started: true, active: true, resolved: false, reviewed: false, stage: 0, bleed: true, tried: [] },
  }, '首页登不上。口碑每个行动点 -5。');
}

function enterMorning(state) {
  const config = state.config;
  const exhausted = state.stamina <= 0;
  const ap = exhausted ? config.exhaustedAp : config.dailyAp;
  let next = {
    ...state,
    ap,
    overnightUsed: false,
    dotaPending: false,
    talked: blankTalked(),
    dialogue: null,
  };
  let note = `第 ${next.week} 周${DAY_NAMES[next.day]}，行动点 ${ap}${exhausted ? '（体力见底）' : ''}。`;
  if (next.reputation < config.reputationDropBelow && next.dau > 0) {
    const drop = Math.max(1, Math.round(next.dau * config.dauDropRate));
    next = { ...next, dau: Math.max(0, next.dau - drop) };
    note += `口碑低于 ${config.reputationDropBelow}，日活 -${drop}。`;
  }
  next = withLog(next, note);
  return startBoss(spawn(next));
}

export function createGame(seed, config = CONFIG) {
  const resolved = config === CONFIG ? CONFIG : { ...CONFIG, ...config };
  const text = String(seed || 'nanjing').slice(0, 64) || 'nanjing';
  const state = {
    seed: text,
    rng: hashSeed(text),
    week: 1,
    day: 1,
    phase: 'play',
    ap: resolved.dailyAp,
    stamina: resolved.staminaStart,
    overnightUsed: false,
    dotaPending: false,
    dau: 0,
    reputation: resolved.reputationStart,
    talks: 0,
    talkLog: [],
    skills: { fibjs: 0, ci: 0, release: 0, react: 0 },
    learned: { fibjs: false, ci: false, release: false, failure: false, react: false },
    immune: [],
    tickets: [],
    incidents: [],
    nextId: 1,
    boss: blankBoss(),
    talked: blankTalked(),
    dialogue: null,
    qaWeek: 0,
    pmDay: 0,
    lastShip: null,
    log: [`第 1 周周一。日活 0，目标 ${resolved.dauTargets[0]}。口碑 ${resolved.reputationStart}。`],
    stats: blankStats(),
    failReason: '',
    ending: '',
    config: resolved,
  };
  return spawn(state);
}

function sweepReady(state) {
  const tickets = state.tickets.map(ticket => {
    if (ticket.status !== 'build') return ticket;
    const cost = buildCost(ticket, state);
    if (ticket.progress < cost) return ticket;
    return { ...ticket, progress: cost, status: 'ready' };
  });
  return { ...state, tickets };
}

function work(state, ticketId) {
  const ticket = state.tickets.find(item => item.id === ticketId && item.status === 'build');
  if (!ticket) return state;
  const spent = spendAp(state);
  if (!spent) return state;
  const cost = buildCost(ticket, state);
  const progress = Math.min(cost, ticket.progress + 1);
  const done = progress >= cost;
  const tickets = state.tickets.map(item => (item.id === ticketId
    ? { ...item, progress, status: done ? 'ready' : 'build' }
    : item));
  const next = {
    ...state,
    ap: spent.ap,
    reputation: spent.reputation,
    stats: spent.stats,
    tickets,
    dialogue: null,
  };
  const bleed = spent.bleed ? `口碑 -${spent.bleed}。` : '';
  const note = done
    ? `${ticket.title}做完，待上线。事故概率 ${formatPct(shipChance(ticket, next))}。${bleed}`
    : `${ticket.title} ${progress}/${cost}。${bleed}`;
  return withLog(next, note);
}

function testTicket(state, ticketId, by) {
  const ticket = state.tickets.find(item => item.id === ticketId && item.status === 'ready' && !item.tested);
  if (!ticket) return state;
  const free = by === 'qa';
  if (free && state.qaWeek === state.week) return state;
  let ap = state.ap;
  let reputation = state.reputation;
  let stats = state.stats;
  let bleed = 0;
  if (!free) {
    const spent = spendAp(state);
    if (!spent) return state;
    ap = spent.ap;
    reputation = spent.reputation;
    stats = spent.stats;
    bleed = spent.bleed;
  } else {
    stats = { ...stats, qaHelps: stats.qaHelps + 1 };
  }
  const updated = { ...ticket, tested: true, testedBy: free ? 'qa' : 'self' };
  const before = shipChance(ticket, state);
  const after = shipChance(updated, state);
  const bleedNote = bleed ? `口碑 -${bleed}。` : '';
  const note = free
    ? `测试同事给「${ticket.title}」补了测试，省 1 点。事故概率 ${formatPct(before)} → ${formatPct(after)}。`
    : `「${ticket.title}」补了测试。事故概率 ${formatPct(before)} → ${formatPct(after)}。${bleedNote}`;
  return withLog({
    ...state,
    ap,
    reputation,
    stats,
    qaWeek: free ? state.week : state.qaWeek,
    dialogue: null,
    tickets: state.tickets.map(item => (item.id === ticketId ? updated : item)),
  }, note);
}

function ship(state, ticketIds, opts = {}) {
  if (state.phase !== 'play') return state;
  const ids = [...new Set(ticketIds || [])].sort((a, b) => a - b);
  const chosen = ids.map(id => state.tickets.find(item => item.id === id));
  if (!ids.length || chosen.some(item => !item || item.status !== 'ready')) return state;
  const free = Boolean(opts.free);
  let ap = state.ap;
  let reputation = state.reputation;
  let stats = state.stats;
  let bleed = 0;
  if (!free) {
    const spent = spendAp(state);
    if (!spent) return state;
    ap = spent.ap;
    reputation = spent.reputation;
    stats = spent.stats;
    bleed = spent.bleed;
  }
  const rushed = Boolean(opts.rushed);
  const canary = Boolean(opts.canary && state.learned.release);
  const before = chosen.map(ticket => shipChance(ticket, state));
  const chances = chosen.map(ticket => shipChance(ticket, state, { rushed }));
  const from = Math.max(...before);
  const chance = Math.max(...chances);
  const parts = chosen.map(ticket => shipDauParts(ticket, state, { rushed }));
  const dauGain = parts.reduce((sum, part) => sum + part.total, 0);
  const extra = parts.reduce((sum, part) => sum + part.extra, 0);
  let rng = state.rng;
  const roll = rngNext(rng);
  rng = roll.state;
  const types = state.immune.length
    ? state.config.incidents.filter(item => !state.immune.includes(item.id))
    : state.config.incidents;
  let incident = null;
  let incidentLoss = 0;
  let nextId = state.nextId;
  if (compareRoll(roll.value, chance) && types.length) {
    const pick = rngInt(rng, 0, types.length - 1);
    rng = pick.state;
    const spec = types[pick.value];
    incidentLoss = shipDamage(chosen.length, state, canary);
    const before = reputation;
    reputation = clamp(before - incidentLoss, state.config.reputationMin, state.config.reputationMax);
    incidentLoss = before - reputation;
    stats = { ...stats, incidents: stats.incidents + 1, reputationLost: stats.reputationLost + incidentLoss };
    incident = {
      id: nextId,
      type: spec.id,
      title: spec.title,
      stage: 'open',
      reviewed: false,
      count: chosen.length,
      dau: dauGain,
      daily: canary ? Math.ceil(state.config.incidentDaily / 2) : state.config.incidentDaily,
      canary,
      tickets: chosen.map((ticket, index) => ({
        id: ticket.id,
        kind: ticket.kind,
        title: ticket.title,
        difficulty: ticket.difficulty,
        tested: ticket.tested,
        testedBy: ticket.testedBy,
        dueIn: Math.max(1, ticket.dueIn),
        dau: parts[index].total,
      })),
    };
    nextId += 1;
  }
  stats = { ...stats, shipped: stats.shipped + chosen.length, dauGained: stats.dauGained + dauGain };
  const titles = chosen.map(ticket => ticket.title).join('、');
  const chanceText = rushed
    ? `事故概率 ${formatPct(from)} → ${formatPct(chance)}`
    : `事故概率 ${formatPct(chance)}`;
  let note = `${rushed ? '答应产品经理，' : ''}${titles}上线，${chanceText}，日活 +${dauGain}`;
  if (extra) note += `（催上线多 ${extra}）`;
  if (canary) note += '，灰度，出事损失减半';
  note += '。';
  if (incident) note += `炸了：${incident.title}，口碑 -${incidentLoss}。`;
  else note += '没炸。';
  if (bleed) note += `排查中，口碑另 -${bleed}。`;
  const idSet = new Set(ids);
  return withLog({
    ...state,
    rng,
    nextId,
    ap,
    reputation,
    stats,
    dau: state.dau + dauGain,
    dialogue: null,
    tickets: state.tickets.filter(item => !idSet.has(item.id)),
    incidents: incident ? state.incidents.concat(incident) : state.incidents,
    lastShip: {
      title: titles,
      from,
      to: chance,
      rushed,
      dau: dauGain,
      extra,
      canary,
      incident: incident ? incident.title : '',
      incidentLoss,
    },
  }, note);
}

function study(state, skillId) {
  if (!canStudy(state, skillId)) return state;
  const spent = spendAp(state);
  if (!spent) return state;
  const spec = state.config.skills[skillId];
  const progress = state.skills[skillId] + 1;
  const learnedNow = progress >= spec.cost;
  let next = {
    ...state,
    ap: spent.ap,
    reputation: spent.reputation,
    stats: { ...spent.stats, studies: spent.stats.studies + 1 },
    skills: { ...state.skills, [skillId]: Math.min(progress, spec.cost) },
    learned: learnedNow ? { ...state.learned, [skillId]: true } : state.learned,
    dialogue: null,
  };
  if (learnedNow && skillId === 'fibjs') next = sweepReady(next);
  const bleed = spent.bleed ? `口碑 -${spent.bleed}。` : '';
  const note = learnedNow ? `${spec.name}学成。${spec.effect}。${bleed}` : `${spec.name} ${progress}/${spec.cost}。${bleed}`;
  return withLog(next, note);
}

function rest(state) {
  const spent = spendAp(state);
  if (!spent) return state;
  const stamina = Math.min(state.config.staminaMax, state.stamina + state.config.restStamina);
  const bleed = spent.bleed ? `口碑 -${spent.bleed}。` : '';
  return withLog({
    ...state,
    ap: spent.ap,
    reputation: spent.reputation,
    stats: { ...spent.stats, rests: spent.stats.rests + 1 },
    stamina,
    dialogue: null,
  }, `休息，体力 ${stamina}。${bleed}`);
}

function overnight(state) {
  if (state.phase !== 'play' || state.overnightUsed) return state;
  const stamina = Math.max(0, state.stamina - state.config.overnightStaminaCost);
  return withLog({
    ...state,
    ap: state.ap + state.config.overnightAp,
    stamina,
    overnightUsed: true,
    dotaPending: true,
    stats: { ...state.stats, overnights: state.stats.overnights + 1 },
    dialogue: null,
  }, `${state.config.overnightName}，行动点 +${state.config.overnightAp}，体力 ${stamina}`);
}

function dotaResult(state, won) {
  if (state.phase !== 'play' || !state.dotaPending) return state;
  if (!won) return withLog({ ...state, dotaPending: false }, 'Dota 没打过，体力不返还');
  const stamina = Math.min(state.config.staminaMax, state.stamina + state.config.dotaWinStamina);
  const gained = stamina - state.stamina;
  const note = gained > 0 ? `Dota 打赢了，体力 +${gained}，现在 ${stamina}` : 'Dota 打赢了，体力已经满了';
  return withLog({ ...state, stamina, dotaPending: false }, note);
}

function locate(state, incidentId) {
  const incident = state.incidents.find(item => item.id === incidentId && item.stage === 'open');
  if (!incident) return state;
  const spent = spendAp(state);
  if (!spent) return state;
  const bleed = spent.bleed ? `口碑 -${spent.bleed}。` : '';
  return withLog({
    ...state,
    ap: spent.ap,
    reputation: spent.reputation,
    stats: spent.stats,
    dialogue: null,
    incidents: state.incidents.map(item => (item.id === incidentId ? { ...item, stage: 'located' } : item)),
  }, `${incident.title}定位到了。${bleed}`);
}

function fix(state, incidentId) {
  const incident = state.incidents.find(item => item.id === incidentId && item.stage === 'located');
  if (!incident) return state;
  const spent = spendAp(state);
  if (!spent) return state;
  const bleed = spent.bleed ? `口碑 -${spent.bleed}。` : '';
  return withLog({
    ...state,
    ap: spent.ap,
    reputation: spent.reputation,
    stats: spent.stats,
    dialogue: null,
    incidents: state.incidents.map(item => (item.id === incidentId ? { ...item, stage: 'resolved' } : item)),
  }, `${incident.title}修好了，功能还在。${bleed}`);
}

function rollbackIncident(state, incidentId) {
  if (!state.learned.release) return state;
  const incident = state.incidents.find(item => item.id === incidentId && item.stage !== 'resolved');
  if (!incident) return state;
  const spent = spendAp(state);
  if (!spent) return state;
  const restored = incident.tickets.map(ticket => ({
    id: ticket.id,
    kind: ticket.kind,
    title: ticket.title,
    difficulty: ticket.difficulty,
    dueIn: ticket.dueIn,
    progress: ticket.difficulty,
    status: 'ready',
    tested: ticket.tested,
    testedBy: ticket.testedBy,
    late: false,
  }));
  const bleed = spent.bleed ? `口碑 -${spent.bleed}。` : '';
  return withLog({
    ...state,
    ap: spent.ap,
    reputation: spent.reputation,
    stats: spent.stats,
    dau: Math.max(0, state.dau - incident.dau),
    dialogue: null,
    tickets: state.tickets.concat(restored),
    incidents: state.incidents.map(item => (item.id === incidentId ? { ...item, stage: 'resolved' } : item)),
  }, `${incident.title}回滚，日活 -${Math.min(state.dau, incident.dau)}。单子回到待上线。${bleed}`);
}

function review(state, target) {
  const spent = spendAp(state);
  if (!spent) return state;
  const bleed = spent.bleed ? `口碑 -${spent.bleed}。` : '';
  const base = {
    ...state,
    ap: spent.ap,
    reputation: spent.reputation,
    stats: spent.stats,
    learned: { ...state.learned, failure: true },
    dialogue: null,
  };
  if (target === 'boss') {
    if (!state.boss.resolved || state.boss.reviewed) return state;
    return withLog({
      ...base,
      boss: { ...state.boss, reviewed: true },
    }, `复盘写完了。从失败中学习。${bleed}`);
  }
  const incident = state.incidents.find(item => item.id === target && item.stage === 'resolved' && !item.reviewed);
  if (!incident) return state;
  const immune = state.immune.includes(incident.type) ? state.immune : state.immune.concat(incident.type);
  return withLog({
    ...base,
    immune,
    incidents: state.incidents.map(item => (item.id === target ? { ...item, reviewed: true } : item)),
  }, `复盘了${incident.title}。这类事故不再发生。${bleed}`);
}

const BOSS_RIGHT = {
  posts: '老用户写着登录卡，从昨天开始的。',
  logs: '日志里是数据库连接打满。',
  config: '连接池改好了，首页恢复。',
  askQa: '测试同事说：别看监控了，日志里是连接数，直接改配置。少走了一步。',
};

function chooseBoss(state, optionId) {
  const options = bossChoices(state);
  const choice = options.find(option => option.id === optionId);
  if (!choice) return state;
  const spent = spendAp(state);
  if (!spent) return state;
  const spec = state.config.bossOptions.find(option => option.id === optionId);
  let boss = { ...state.boss, tried: state.boss.tried.concat(optionId) };
  let note = '';
  if (spec.stopBleed && state.learned.release) {
    boss = { ...boss, bleed: false };
    note = spent.bleed
      ? `先回滚止血，口碑 -${spent.bleed}。之后不再按行动点掉，还得往下查。`
      : '先回滚止血。口碑不再按行动点掉，还得往下查。';
  }
  if (spec.stage === state.boss.stage && spec.stage >= 0) {
    const stage = Math.min(3, state.boss.stage + 1 + (spec.skip || 0));
    boss = { ...boss, stage, tried: [] };
    note = `${BOSS_RIGHT[spec.id] || spec.label} ${spent.bleed ? `口碑 -${spent.bleed}。` : ''}`;
    if (stage >= 3) {
      boss = { ...boss, stage: 3, resolved: true, active: false, bleed: false };
      note = `${note}首页登不上处理好了。`;
    }
  } else if (!note) {
    note = `${spec.label}，对不上。多花 1 个行动点。${spent.bleed ? `口碑 -${spent.bleed}。` : ''}`;
  }
  return withLog({
    ...state,
    ap: spent.ap,
    reputation: spent.reputation,
    stats: spent.stats,
    boss,
    dialogue: null,
  }, note.trim());
}

function talk(state, person) {
  if (state.phase !== 'play' || !PEOPLE.some(item => item.id === person)) return state;
  if (state.talked[person]) {
    if (state.dialogue?.person === person) return state;
    return { ...state, dialogue: { person } };
  }
  return {
    ...state,
    talked: { ...state.talked, [person]: true },
    dialogue: { person },
  };
}

function acceptPm(state) {
  const offer = pmOffer(state);
  if (!offer) return state;
  if (state.talked.pm && state.dialogue?.person !== 'pm') return state;
  const next = ship(state, [offer.ticketId], { rushed: true, free: true });
  if (next === state) return state;
  return {
    ...next,
    pmDay: dayKey(state),
    talked: { ...next.talked, pm: true },
    stats: { ...next.stats, pmAccepts: next.stats.pmAccepts + 1 },
    dialogue: null,
  };
}

function shiftReputation(state, loss) {
  const before = state.reputation;
  const reputation = clamp(before - loss, state.config.reputationMin, state.config.reputationMax);
  const applied = before - reputation;
  const stats = applied
    ? { ...state.stats, reputationLost: state.stats.reputationLost + applied }
    : state.stats;
  return { reputation, stats, applied };
}

function resolveNight(state) {
  let next = { ...state, tickets: [], incidents: state.incidents.slice() };
  const notes = [];
  for (const ticket of state.tickets) {
    const dueIn = ticket.dueIn - 1;
    if (dueIn > 0) {
      next.tickets.push({ ...ticket, dueIn });
      continue;
    }
    if (!ticket.late) {
      const shifted = shiftReputation(next, next.config.lateRep);
      next = { ...next, reputation: shifted.reputation, stats: { ...shifted.stats, lateCount: next.stats.lateCount + 1 } };
      notes.push(shifted.applied ? `${ticket.title}延期，口碑 -${shifted.applied}。` : `${ticket.title}延期。`);
      next.tickets.push({ ...ticket, dueIn: 0, late: true });
    } else {
      next.tickets.push(ticket);
    }
  }
  for (const incident of state.incidents) {
    if (incident.stage === 'resolved') continue;
    const shifted = shiftReputation(next, incident.daily);
    next = { ...next, reputation: shifted.reputation, stats: shifted.stats };
    if (shifted.applied) notes.push(`${incident.title}还没处理，口碑 -${shifted.applied}。`);
  }
  if (next.boss.active && !next.boss.resolved && next.boss.bleed) {
    const shifted = shiftReputation(next, next.config.bossNightRep);
    next = { ...next, reputation: shifted.reputation, stats: shifted.stats };
    if (shifted.applied) notes.push(`首页还登不上，口碑 -${shifted.applied}。`);
  }
  for (const note of notes) next = withLog(next, note);
  return next;
}

function talkFailText(item, line) {
  const bits = [];
  if (!item.dauOk) bits.push(`日活 ${item.dau}，目标 ${item.target}`);
  if (!item.repOk) bits.push(`口碑 ${item.reputation}，低于 ${line}`);
  return `第 ${item.week} 周周五，${bits.join('，')}，约谈。`;
}

function applyFriday(state) {
  const config = state.config;
  const target = weekTarget(state);
  const dauOk = state.dau >= target;
  const repOk = state.reputation >= config.reputationLine;
  let talks = state.talks;
  let talkLog = state.talkLog;
  let note = `第 ${state.week} 周周五，日活 ${state.dau}，口碑 ${state.reputation}，过线了。`;
  if (!dauOk || !repOk) {
    talks += 1;
    talkLog = talkLog.concat({ week: state.week, dau: state.dau, target, reputation: state.reputation, dauOk, repOk });
    note = `${talkFailText(talkLog[talkLog.length - 1], config.reputationLine)}第 ${talks} 次。`;
  }
  let next = withLog({ ...state, talks, talkLog }, note);
  if (talks >= config.talksToFail) {
    return {
      ...next,
      phase: 'lost',
      failReason: talkLog.map(item => talkFailText(item, config.reputationLine)).join(''),
    };
  }
  if (state.week >= config.weeks) return finishWin(next);
  return enterMorning({ ...next, week: state.week + 1, day: 1 });
}

function handledBoss(state) {
  return state.boss.resolved && state.boss.reviewed;
}

function finishWin(state) {
  const good = handledBoss(state) && state.reputation >= state.config.goodReputation;
  return { ...state, phase: 'won', ending: good ? 'learned' : 'alive' };
}

function sleep(state) {
  if (state.phase !== 'play' || state.ap > 0) return state;
  const next = resolveNight({ ...state, dotaPending: false, dialogue: null });
  if (next.day === next.config.daysPerWeek) return applyFriday(next);
  return enterMorning({ ...next, day: next.day + 1 });
}

export function applyAction(state, action) {
  if (!action || state.phase !== 'play') return state;
  if (action.type === 'work') return work(state, action.ticketId);
  if (action.type === 'test') return testTicket(state, action.ticketId, 'self');
  if (action.type === 'ship') return ship(state, action.ticketIds, { canary: action.canary === true });
  if (action.type === 'study') return study(state, action.skill);
  if (action.type === 'rest') return rest(state);
  if (action.type === 'overnight') return overnight(state);
  if (action.type === 'dota') return dotaResult(state, action.won === true);
  if (action.type === 'sleep') return sleep(state);
  if (action.type === 'locate') return locate(state, action.incidentId);
  if (action.type === 'fix') return fix(state, action.incidentId);
  if (action.type === 'rollback') return rollbackIncident(state, action.incidentId);
  if (action.type === 'review') return review(state, action.target);
  if (action.type === 'boss') return chooseBoss(state, action.option);
  if (action.type === 'talk') return talk(state, action.person);
  if (action.type === 'pm-yes') return acceptPm(state);
  if (action.type === 'qa-yes') return testTicket(state, action.ticketId, 'qa');
  if (action.type === 'close') return state.dialogue ? { ...state, dialogue: null } : state;
  return state;
}

export function replay(seed, actions, config = CONFIG) {
  let state = createGame(seed, config);
  for (const action of actions) state = applyAction(state, action);
  return state;
}

function colleagueScript(state, person) {
  const index = dayIndex(state);
  if (person === 'pm') {
    const offer = pmOffer(state);
    const tail = PM_TAILS[index % PM_TAILS.length];
    if (state.pmDay === dayKey(state)) return ['今天这张已经按你说的上了。', tail];
    if (offer) {
      return [
        `「${offer.title}」今天就上。事故概率 ${formatPct(offer.before)} 变成 ${formatPct(offer.after)}，日活多涨 ${offer.extra}。`,
        tail,
      ];
    }
    return ['做完就上，别压在本地。', tail];
  }
  if (person === 'qa') {
    const offer = qaOffer(state);
    const tail = QA_TAILS[index % QA_TAILS.length];
    if (offer) {
      return [
        `「${offer.title}」我可以补测试，省 1 个行动点。事故概率 ${formatPct(offer.before)} 到 ${formatPct(offer.after)}。`,
        tail,
      ];
    }
    if (state.qaWeek === state.week) return ['这周名额用过了。', tail];
    return ['这周我能帮一张待上线的单补测试。', tail];
  }
  if (person === 'mod') {
    if (state.week === 4 && state.day === 1) {
      return ['有人回帖说登录有点卡。', '首页出事前，一般都是这句。'];
    }
    const open = state.incidents.find(item => item.stage !== 'resolved');
    const omen = open
      ? state.config.incidents.find(item => item.id === open.type)?.omen
      : state.config.incidents[index % state.config.incidents.length].omen;
    return [`有人说${omen}。`, MOD_TAILS[index % MOD_TAILS.length]];
  }
  if (state.boss.active && !state.boss.resolved) {
    const second = ['我站你后面。', '首页还挂着。', '用户进不来。', '你倒是说句话。'][state.day - 2] || '我等着。';
    return ['好了没。', second];
  }
  if (state.day === state.config.daysPerWeek) {
    return ['今天对日活和口碑。', '过不了线就要约谈。'];
  }
  return [BOSS_TAILS[index % BOSS_TAILS.length], '我只看结果。'];
}

function skillStatus(state, skillId) {
  const spec = state.config.skills[skillId];
  let blocked = '';
  if (!state.learned[skillId] && state.week < spec.minWeek) blocked = `第 ${spec.minWeek} 周才能学`;
  return {
    id: skillId,
    name: spec.name,
    effect: spec.effect,
    cost: spec.cost,
    progress: state.skills[skillId],
    learned: state.learned[skillId],
    blocked,
    canStudy: canStudy(state, skillId),
  };
}

function presentTicket(state, ticket) {
  const cost = buildCost(ticket, state);
  const chance = shipChance(ticket, state);
  const testedChance = shipChance({ ...ticket, tested: true }, state);
  const rushedChance = shipChance(ticket, state, { rushed: true });
  const dau = shipDauParts(ticket, state).total;
  let costNote = '';
  if ((ticket.kind === 'front' || ticket.kind === 'back') && state.learned.fibjs && cost < ticket.difficulty) {
    costNote = 'fibjs / Node.js';
  }
  return {
    id: ticket.id,
    kind: ticket.kind,
    kindLabel: KIND_LABEL[ticket.kind] || ticket.kind,
    title: ticket.title,
    status: ticket.status,
    difficulty: ticket.difficulty,
    dueIn: ticket.dueIn,
    late: ticket.late,
    progress: ticket.progress,
    cost,
    left: Math.max(0, cost - ticket.progress),
    tested: ticket.tested,
    testedBy: ticket.testedBy,
    chance,
    chanceText: formatPct(chance),
    testedChance,
    testedChanceText: formatPct(testedChance),
    rushedChance,
    rushedChanceText: formatPct(rushedChance),
    damage: shipDamage(1, state, false),
    damageCanary: state.learned.release ? shipDamage(1, state, true) : 0,
    dau,
    costNote,
  };
}

export function present(state) {
  const config = state.config;
  const good = handledBoss(state) && state.reputation >= config.goodReputation;
  const ending = ENDINGS[state.ending];
  let victoryText = ending?.text || '';
  if (state.ending === 'alive' && !state.boss.resolved) victoryText = '四周撑过来了。首页那次没查完。';
  else if (state.ending === 'alive' && !state.boss.reviewed) victoryText = '四周撑过来了。复盘没写。';
  else if (state.ending === 'alive') victoryText = `四周撑过来了。复盘写了，口碑还没到 ${config.goodReputation}。`;
  const react = state.learned.react && state.phase === 'won';
  const ready = state.tickets.filter(ticket => ticket.status === 'ready');
  const batchChance = ready.length ? Math.max(...ready.map(ticket => shipChance(ticket, state))) : 0;
  return {
    seed: state.seed,
    week: state.week,
    day: state.day,
    dayName: DAY_NAMES[state.day],
    phase: state.phase,
    ap: state.ap,
    stamina: state.stamina,
    staminaMax: config.staminaMax,
    dau: state.dau,
    dauTarget: weekTarget(state),
    reputation: state.reputation,
    reputationLine: config.reputationLine,
    goodReputation: config.goodReputation,
    talks: state.talks,
    talksToFail: config.talksToFail,
    overnightUsed: state.overnightUsed,
    failReason: state.failReason,
    ending: state.ending,
    victoryTitle: ending?.title || '',
    victoryText,
    react,
    reactText: react ? '去杭州。下一章，去阿里。' : '',
    bossResolved: state.boss.resolved,
    bossReviewed: state.boss.reviewed,
    good,
    lastShip: state.lastShip,
    log: state.log,
    stats: state.stats,
    learned: { ...state.learned },
    immune: state.immune.slice(),
    canRest: state.phase === 'play' && state.ap > 0,
    canOvernight: state.phase === 'play' && !state.overnightUsed,
    canSleep: state.phase === 'play' && state.ap === 0,
    canCanary: state.learned.release,
    dialogue: state.dialogue ? { person: state.dialogue.person } : null,
    colleagues: PEOPLE.map(person => ({
      ...person,
      talked: state.talked[person.id],
      lines: colleagueScript(state, person.id),
    })),
    pm: pmOffer(state),
    qa: qaOffer(state),
    boss: {
      started: state.boss.started,
      active: state.boss.active,
      resolved: state.boss.resolved,
      reviewed: state.boss.reviewed,
      stage: state.boss.stage,
      bleed: state.boss.bleed && state.boss.active && !state.boss.resolved,
      perAp: config.bossRepPerAp,
      choices: bossChoices(state),
    },
    incidents: state.incidents.filter(item => !item.reviewed).map(item => ({
      id: item.id,
      title: item.title,
      stage: item.stage,
      daily: item.daily,
      count: item.count,
      canRollback: state.learned.release && item.stage !== 'resolved',
    })),
    tickets: state.tickets.map(ticket => presentTicket(state, ticket)).sort((a, b) => {
      if (a.status !== b.status) return a.status === 'ready' ? -1 : 1;
      return a.dueIn - b.dueIn || a.id - b.id;
    }),
    batch: ready.length >= 2 ? {
      ids: ready.map(ticket => ticket.id).sort((a, b) => a - b),
      chance: batchChance,
      chanceText: formatPct(batchChance),
      damage: shipDamage(ready.length, state, false),
      damageCanary: state.learned.release ? shipDamage(ready.length, state, true) : 0,
    } : null,
    skills: SKILL_IDS.map(id => skillStatus(state, id)),
    failureSkill: {
      id: 'failure',
      name: '从失败中学习',
      learned: state.learned.failure,
      effect: state.immune.length
        ? `不再发生：${state.immune.map(id => config.incidents.find(item => item.id === id)?.title || id).join('、')}`
        : '复盘过的事故不再发生',
      blocked: state.learned.failure ? '' : '事故复盘后获得',
      canStudy: false,
    },
  };
}

export function snapshot(state) {
  const { config, ...rest } = state;
  return rest;
}
