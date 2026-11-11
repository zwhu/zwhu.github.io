import {
  CONFIG,
  DAY_NAMES,
  FULLSTACK_TITLES,
  PAGE_TITLES,
  SKILL_IDS,
  VICTORY_TEXT,
} from './config.mjs';
import { hashSeed, rngInt, rngNext } from './rng.mjs';

export { CONFIG, DAY_NAMES, VICTORY_TEXT };

const KIND_LABEL = {
  page: '页面',
  server: '服务器事件',
  demo: '演示事件',
  fullstack: '全栈',
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function weekLine(week, config = CONFIG) {
  return config.weekLineBase + (week - 1) * config.weekLineStep;
}

export function isEvent(ticket) {
  return ticket.kind === 'server' || ticket.kind === 'demo';
}

export function ticketWorkCost(ticket, learned, config = CONFIG) {
  if (ticket.kind === 'server') return learned.linux ? config.linuxServerCost : ticket.difficulty;
  if (ticket.kind === 'fullstack') return config.fullstackDifficulty;
  if (ticket.kind === 'page' && learned.jquery) {
    return Math.max(1, ticket.difficulty - config.jqueryPageDiscount);
  }
  return ticket.difficulty;
}

export function ticketReward(ticket, config = CONFIG) {
  if (isEvent(ticket)) return config.eventFavorComplete;
  const difficulty = ticket.kind === 'fullstack' ? config.fullstackDifficulty : ticket.difficulty;
  const base = config.favorPerDifficulty * difficulty;
  return ticket.kind === 'fullstack' ? base * config.fullstackFavorMultiplier : base;
}

export function ticketPenalty(ticket, learned, config = CONFIG) {
  if (!isEvent(ticket)) return config.favorLate;
  return learned.git ? config.eventFavorFailWithGit : config.eventFavorFail;
}

function blankStats() {
  return { completed: 0, lateCount: 0, favorGained: 0, favorLost: 0, overnights: 0, rests: 0, studies: 0 };
}

function withLog(state, line) {
  return { ...state, log: [line, ...state.log].slice(0, 8) };
}

function pickKind(roll, learned, config) {
  if (learned.java && roll < config.fullstackChance) return 'fullstack';
  const eventCut = (learned.java ? config.fullstackChance : 0) + config.eventChance;
  if (roll < eventCut) return 'event';
  return 'page';
}

function makeTicket(kind, rng, id, config) {
  if (kind === 'event') {
    const side = rngNext(rng);
    const server = side.value < 0.5;
    return {
      rng: side.state,
      ticket: {
        id,
        kind: server ? 'server' : 'demo',
        title: server ? '线上页面白屏' : '老板临时要演示',
        difficulty: config.eventDifficulty,
        dueIn: config.eventDeadline,
        progress: 0,
        late: false,
      },
    };
  }
  if (kind === 'fullstack') {
    const due = rngInt(rng, config.deadlineMin, config.deadlineMax);
    const title = rngInt(due.state, 0, FULLSTACK_TITLES.length - 1);
    return {
      rng: title.state,
      ticket: {
        id,
        kind: 'fullstack',
        title: FULLSTACK_TITLES[title.value],
        difficulty: config.fullstackDifficulty,
        dueIn: due.value,
        progress: 0,
        late: false,
      },
    };
  }
  const difficultyRoll = rngInt(rng, 0, config.difficultyTable.length - 1);
  const difficulty = { state: difficultyRoll.state, value: config.difficultyTable[difficultyRoll.value] };
  const due = rngInt(difficulty.state, config.deadlineMin, config.deadlineMax);
  const title = rngInt(due.state, 0, PAGE_TITLES.length - 1);
  return {
    rng: title.state,
    ticket: {
      id,
      kind: 'page',
      title: PAGE_TITLES[title.value],
      difficulty: difficulty.value,
      dueIn: due.value,
      progress: 0,
      late: false,
    },
  };
}

function spawnMorning(state) {
  const config = state.config;
  let rng = state.rng;
  const count = rngInt(rng, config.spawnMin, config.spawnMax);
  rng = count.state;
  const tickets = state.tickets.slice();
  let nextId = state.nextId;
  for (let i = 0; i < count.value; i += 1) {
    const kindRoll = rngNext(rng);
    const kind = pickKind(kindRoll.value, state.learned, config);
    const made = makeTicket(kind, kindRoll.state, nextId, config);
    rng = made.rng;
    nextId += 1;
    tickets.push(made.ticket);
  }
  return withLog(
    { ...state, rng, nextId, tickets },
    `早上新到 ${count.value} 张单。`,
  );
}

export function createGame(seed, config = CONFIG) {
  const text = String(seed || 'hefei').slice(0, 64) || 'hefei';
  const state = {
    seed: text,
    rng: hashSeed(text),
    week: 1,
    day: 1,
    phase: 'play',
    ap: config.dailyAp,
    stamina: config.staminaStart,
    favor: config.favorStart,
    overnightUsed: false,
    skills: { linux: 0, git: 0, jquery: 0, java: 0 },
    learned: { linux: false, git: false, jquery: false, java: false },
    tickets: [],
    nextId: 1,
    log: [`第 1 周周一。好感 ${config.favorStart}，本周线 ${weekLine(1, config)}。`],
    stats: blankStats(),
    failReason: '',
    config,
  };
  return spawnMorning(state);
}

function shiftFavor(state, delta) {
  const before = state.favor;
  const favor = clamp(before + delta, state.config.favorMin, state.config.favorMax);
  const applied = favor - before;
  const stats = { ...state.stats };
  if (applied > 0) stats.favorGained += applied;
  if (applied < 0) stats.favorLost += -applied;
  return { favor, stats, applied };
}

function completeTicket(state, ticketId, note) {
  const ticket = state.tickets.find(item => item.id === ticketId);
  const shifted = shiftFavor(state, ticketReward(ticket, state.config));
  const gain = shifted.applied > 0 ? `好感 +${shifted.applied}` : '好感已经满了';
  return withLog({
    ...state,
    favor: shifted.favor,
    stats: { ...shifted.stats, completed: state.stats.completed + 1 },
    tickets: state.tickets.filter(item => item.id !== ticketId),
  }, `${note}${gain}`);
}

function sweepLearned(state, skillId) {
  let next = state;
  const ready = [];
  for (const ticket of next.tickets) {
    const cost = ticketWorkCost(ticket, next.learned, next.config);
    if (ticket.progress >= cost) ready.push(ticket);
  }
  for (const ticket of ready) {
    const why = skillId === 'linux' ? 'Linux 生效，这张服务器单已经做完。' : 'jQuery 生效，这张页面单已经做完。';
    next = completeTicket(next, ticket.id, `${ticket.title}：${why}`);
  }
  return next;
}

function unlockFullstack(state) {
  const config = state.config;
  const made = makeTicket('fullstack', state.rng, state.nextId, config);
  return withLog({
    ...state,
    rng: made.rng,
    nextId: state.nextId + 1,
    tickets: state.tickets.concat(made.ticket),
  }, `${made.ticket.title}（全栈）解锁，做完 +${ticketReward(made.ticket, config)}。`);
}

function canStudy(state, skillId) {
  const spec = state.config.skills[skillId];
  if (!spec || state.phase !== 'play' || state.ap <= 0) return false;
  if (state.learned[skillId]) return false;
  if (state.week < spec.minWeek) return false;
  if (spec.nightOnly && !state.overnightUsed) return false;
  return true;
}

function study(state, skillId) {
  if (!canStudy(state, skillId)) return state;
  const spec = state.config.skills[skillId];
  const progress = state.skills[skillId] + 1;
  const learnedNow = progress >= spec.cost;
  let next = {
    ...state,
    ap: state.ap - 1,
    skills: { ...state.skills, [skillId]: Math.min(progress, spec.cost) },
    learned: learnedNow ? { ...state.learned, [skillId]: true } : state.learned,
    stats: { ...state.stats, studies: state.stats.studies + 1 },
  };
  if (!learnedNow) return withLog(next, `${spec.name} ${progress}/${spec.cost}`);
  next = withLog(next, `${spec.name} 学成，立刻生效：${spec.effect}`);
  if (skillId === 'linux' || skillId === 'jquery') next = sweepLearned(next, skillId);
  if (skillId === 'java') next = unlockFullstack(next);
  return next;
}

function work(state, ticketId) {
  if (state.phase !== 'play' || state.ap <= 0) return state;
  const ticket = state.tickets.find(item => item.id === ticketId);
  if (!ticket) return state;
  const cost = ticketWorkCost(ticket, state.learned, state.config);
  const progress = ticket.progress + 1;
  const tickets = state.tickets.map(item => (item.id === ticketId ? { ...item, progress } : item));
  const next = {
    ...state,
    ap: state.ap - 1,
    tickets,
  };
  if (progress < cost) return withLog(next, `${ticket.title} ${progress}/${cost}`);
  return completeTicket(next, ticketId, `${ticket.title} 做完，`);
}

function rest(state) {
  if (state.phase !== 'play' || state.ap <= 0) return state;
  const stamina = Math.min(state.config.staminaMax, state.stamina + state.config.restStamina);
  return withLog({
    ...state,
    ap: state.ap - 1,
    stamina,
    stats: { ...state.stats, rests: state.stats.rests + 1 },
  }, `休息，体力 ${stamina}`);
}

function overnight(state) {
  if (state.phase !== 'play' || state.overnightUsed) return state;
  const stamina = Math.max(0, state.stamina - state.config.overnightStaminaCost);
  return withLog({
    ...state,
    ap: state.ap + state.config.overnightAp,
    stamina,
    overnightUsed: true,
    stats: { ...state.stats, overnights: state.stats.overnights + 1 },
  }, `熬夜，行动点 +${state.config.overnightAp}，体力 ${stamina}`);
}

function resolveDeadlines(state) {
  const config = state.config;
  const kept = [];
  let next = state;
  for (const ticket of state.tickets) {
    if (!ticket.late) {
      const dueIn = ticket.dueIn - 1;
      if (dueIn > 0) {
        kept.push({ ...ticket, dueIn });
        continue;
      }
    }
    const loss = ticketPenalty(ticket, next.learned, config);
    const shifted = shiftFavor(next, -loss);
    const lost = -shifted.applied;
    next = { ...next, favor: shifted.favor, stats: { ...shifted.stats, lateCount: next.stats.lateCount + 1 } };
    const amount = lost > 0 ? `好感 -${lost}` : '好感已经是 0';
    if (isEvent(ticket)) {
      const full = config.eventFavorFail;
      const line = next.learned.git
        ? `${ticket.title} 没接住。Git 回滚，${amount}（否则 -${full}）。`
        : `${ticket.title} 没处理，${amount}。`;
      next = withLog(next, line);
    } else {
      kept.push({ ...ticket, dueIn: 0, late: true });
      next = withLog(next, `${ticket.title} 延期，${amount}，单子还在。`);
    }
  }
  return { ...next, tickets: kept };
}

function sleep(state) {
  if (state.phase !== 'play' || state.ap > 0) return state;
  let next = resolveDeadlines(state);
  if (next.day === next.config.daysPerWeek) {
    const line = weekLine(next.week, next.config);
    if (next.favor < line) {
      return {
        ...next,
        phase: 'lost',
        failReason: `第 ${next.week} 周周五，老板好感 ${next.favor}，低于本周线 ${line}，被劝退。`,
      };
    }
    if (next.week >= next.config.weeks) return { ...next, phase: 'won' };
    next = { ...next, week: next.week + 1, day: 1 };
  } else {
    next = { ...next, day: next.day + 1 };
  }
  const exhausted = next.stamina <= 0;
  const ap = exhausted ? next.config.exhaustedAp : next.config.dailyAp;
  next = withLog({
    ...next,
    ap,
    overnightUsed: false,
  }, `第 ${next.week} 周${DAY_NAMES[next.day]}，行动点 ${ap}${exhausted ? '（体力见底）' : ''}。`);
  return spawnMorning(next);
}

export function applyAction(state, action) {
  if (!action || state.phase !== 'play') return state;
  if (action.type === 'work') return work(state, action.ticketId);
  if (action.type === 'study') return study(state, action.skill);
  if (action.type === 'rest') return rest(state);
  if (action.type === 'overnight') return overnight(state);
  if (action.type === 'sleep') return sleep(state);
  return state;
}

export function replay(seed, actions, config = CONFIG) {
  let state = createGame(seed, config);
  for (const action of actions) state = applyAction(state, action);
  return state;
}

function skillStatus(state, skillId) {
  const spec = state.config.skills[skillId];
  let blocked = '';
  if (!state.learned[skillId] && state.week < spec.minWeek) blocked = `第 ${spec.minWeek} 周开放`;
  else if (!state.learned[skillId] && spec.nightOnly && !state.overnightUsed) blocked = '只能夜里学';
  return {
    id: skillId,
    name: spec.name,
    book: spec.book || '',
    effect: spec.effect,
    cost: spec.cost,
    progress: state.skills[skillId],
    learned: state.learned[skillId],
    blocked,
    canStudy: canStudy(state, skillId),
  };
}

export function present(state) {
  const learned = state.learned;
  const config = state.config;
  return {
    seed: state.seed,
    week: state.week,
    day: state.day,
    dayName: DAY_NAMES[state.day],
    phase: state.phase,
    ap: state.ap,
    stamina: state.stamina,
    staminaMax: config.staminaMax,
    favor: state.favor,
    line: weekLine(state.week, config),
    overnightUsed: state.overnightUsed,
    failReason: state.failReason,
    victoryText: VICTORY_TEXT,
    log: state.log,
    stats: {
      ...state.stats,
      skills: SKILL_IDS.filter(id => state.learned[id]).map(id => config.skills[id].name),
    },
    canRest: state.phase === 'play' && state.ap > 0,
    canOvernight: state.phase === 'play' && !state.overnightUsed,
    canSleep: state.phase === 'play' && state.ap === 0,
    tickets: state.tickets.map(ticket => {
      const cost = ticketWorkCost(ticket, learned, config);
      const penalty = ticketPenalty(ticket, learned, config);
      let costNote = '';
      if (ticket.kind === 'server' && learned.linux) costNote = 'Linux';
      if (ticket.kind === 'page' && learned.jquery && cost < ticket.difficulty) costNote = 'jQuery';
      return {
        id: ticket.id,
        kind: ticket.kind,
        kindLabel: KIND_LABEL[ticket.kind],
        title: ticket.title,
        difficulty: ticket.difficulty,
        dueIn: ticket.dueIn,
        late: ticket.late,
        progress: ticket.progress,
        cost,
        left: Math.max(0, cost - ticket.progress),
        reward: ticketReward(ticket, config),
        penalty,
        fullPenalty: isEvent(ticket) ? config.eventFavorFail : config.favorLate,
        costNote,
        penaltyNote: isEvent(ticket) && learned.git ? 'Git' : '',
      };
    }),
    skills: SKILL_IDS.map(id => skillStatus(state, id)),
  };
}

export function snapshot(state) {
  const { config, ...rest } = state;
  return rest;
}
