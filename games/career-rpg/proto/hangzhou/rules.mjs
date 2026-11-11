import { hashSeed, rngInt, rngNext } from '../rng.mjs';
import {
  BOSS_TICKETS,
  CONFIG,
  DAY_NAMES,
  ENDINGS,
  FIELD_IDS,
  FIELDS,
  LINES,
  SIMILAR,
  SKILL_IDS,
  STUDY_IDS,
  fieldById,
  lineById,
} from './config.mjs';

export { CONFIG, DAY_NAMES, ENDINGS, FIELD_IDS, FIELDS, LINES, SIMILAR, SKILL_IDS };

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function weekLine(week, config = CONFIG) {
  return config.weekLines[week - 1];
}

export function debtSurcharge(debt, config = CONFIG) {
  return Math.floor(Math.max(0, debt) / config.debtStep);
}

export function moduleCovers(modules, learned, field) {
  if (modules.includes(field)) return true;
  if (learned.webpack && modules.some(id => SIMILAR[id] === field)) return true;
  return false;
}

function blankProgress() {
  return Object.fromEntries(FIELD_IDS.map(id => [id, 0]));
}

function blankStats() {
  return {
    completed: 0,
    onTime: 0,
    lateCount: 0,
    hardCompletes: 0,
    moduleCompletes: 0,
    deliveryGained: 0,
    deliveryLost: 0,
    overnights: 0,
    rests: 0,
    studies: 0,
    extracts: 0,
  };
}

function withLog(state, line) {
  return { ...state, log: [line, ...state.log].slice(0, 10) };
}

function ticketName(line, field) {
  return `${lineById(line).name} · ${fieldById(field).example}`;
}

export function coversTicket(state, ticket) {
  if (ticket.boss) return bossFieldCovered(state, ticket.field);
  return moduleCovers(state.modules, state.learned, ticket.field);
}

export function bossFieldCovered(state, field) {
  if (state.placed.includes(field)) return true;
  if (state.learned.webpack && state.placed.some(id => SIMILAR[id] === field)) return true;
  return false;
}

export function ticketBase(state, ticket) {
  return coversTicket(state, ticket) ? state.config.moduleAp : ticket.difficulty;
}

export function ticketCost(state, ticket) {
  return ticketBase(state, ticket) + debtSurcharge(state.debt, state.config);
}

export function extractAp(state) {
  return state.learned.patterns ? state.config.extractDiscount : state.config.extractCost;
}

function makeScheduledTicket(rng, config) {
  const line = rngInt(rng, 0, LINES.length - 1);
  const field = rngInt(line.state, 0, FIELDS.length - 1);
  const difficulty = rngInt(field.state, 0, config.difficultyTable.length - 1);
  const due = rngInt(difficulty.state, config.deadlineMin, config.deadlineMax);
  return {
    rng: due.state,
    spec: {
      line: LINES[line.value].id,
      field: FIELDS[field.value].id,
      difficulty: config.difficultyTable[difficulty.value],
      dueIn: due.value,
    },
  };
}

function buildSchedule(rng, config) {
  const weeks = [];
  for (let week = 1; week <= 3; week += 1) {
    const days = [];
    for (let day = 1; day <= config.daysPerWeek; day += 1) {
      const countRoll = rngNext(rng);
      rng = countRoll.state;
      const count = countRoll.value < config.spawnTwoChance ? 2 : 1;
      const tickets = [];
      for (let i = 0; i < count; i += 1) {
        const made = makeScheduledTicket(rng, config);
        rng = made.rng;
        tickets.push(made.spec);
      }
      days.push(tickets);
    }
    weeks.push(days);
  }
  return { rng, weeks };
}

export function nextWeekFields(state) {
  if (state.week >= state.config.weeks) return [];
  if (state.week === 3) return BOSS_TICKETS.map(ticket => ticket.field);
  return state.schedule[state.week].flat().map(ticket => ticket.field);
}

function instantiate(state, spec, boss) {
  const ticket = {
    id: state.nextId,
    line: spec.line,
    field: spec.field,
    title: ticketName(spec.line, spec.field),
    difficulty: spec.difficulty,
    dueIn: spec.dueIn,
    progress: 0,
    late: false,
    boss: Boolean(boss),
  };
  return {
    state: { ...state, nextId: state.nextId + 1 },
    ticket,
  };
}

function spawnMorning(state) {
  const config = state.config;
  if (state.week === config.bossWeek && state.day === config.bossDay && !state.bossOn) {
    let next = { ...state, bossOn: true };
    const tickets = [];
    for (const spec of BOSS_TICKETS) {
      const dueIn = config.daysPerWeek - config.bossDay + 1;
      const made = instantiate(next, { ...spec, dueIn }, true);
      next = made.state;
      tickets.push(made.ticket);
    }
    return withLog({ ...next, tickets: tickets.concat(next.tickets) }, '五条业务线同时砸下五张大单，期限周五。白板打开了。');
  }
  if (state.week >= config.bossWeek) return state;
  const specs = state.schedule[state.week - 1][state.day - 1];
  let next = state;
  const tickets = [];
  for (const spec of specs) {
    const made = instantiate(next, spec, false);
    next = made.state;
    tickets.push(made.ticket);
  }
  const names = tickets.map(ticket => ticket.title).join('、');
  return withLog({ ...next, tickets: tickets.concat(next.tickets) }, `早上新到 ${tickets.length} 张：${names}。`);
}

export function createGame(seed, config = CONFIG) {
  const text = String(seed || 'hangzhou').slice(0, 64) || 'hangzhou';
  const built = buildSchedule(hashSeed(text), config);
  const state = {
    seed: text,
    rng: built.rng,
    schedule: built.weeks,
    week: 1,
    day: 1,
    phase: 'play',
    ap: config.dailyAp,
    stamina: config.staminaStart,
    delivery: config.deliveryStart,
    debt: 0,
    complaints: 0,
    night: false,
    overnightUsed: false,
    dotaPending: false,
    skills: { biz: 0, patterns: 0, webpack: 0, babel: 0 },
    learned: { biz: false, patterns: false, webpack: false, babel: false, architecture: false },
    modules: [],
    extractProgress: blankProgress(),
    placed: [],
    bossOn: false,
    bossOnTime: 0,
    tickets: [],
    nextId: 1,
    log: [`第 1 周周一。交付 ${config.deliveryStart}，本周线 ${weekLine(1, config)}，技术债 0。`],
    stats: blankStats(),
    failReason: '',
    ending: '',
    config,
  };
  return spawnMorning(state);
}

function shiftDelivery(state, delta) {
  const before = state.delivery;
  const delivery = clamp(before + delta, state.config.deliveryMin, state.config.deliveryMax);
  const applied = delivery - before;
  const stats = { ...state.stats };
  if (applied > 0) stats.deliveryGained += applied;
  if (applied < 0) stats.deliveryLost += -applied;
  return { delivery, stats, applied };
}

function finishTicket(state, ticketId) {
  const ticket = state.tickets.find(item => item.id === ticketId);
  const covered = coversTicket(state, ticket);
  const onTime = !ticket.late;
  const reward = onTime ? state.config.onTimeReward : 0;
  const shifted = shiftDelivery(state, reward);
  const debt = covered ? state.debt : Math.min(state.config.debtMax, state.debt + state.config.debtPerHard);
  const stats = {
    ...shifted.stats,
    completed: state.stats.completed + 1,
    onTime: state.stats.onTime + (onTime ? 1 : 0),
    hardCompletes: state.stats.hardCompletes + (covered ? 0 : 1),
    moduleCompletes: state.stats.moduleCompletes + (covered ? 1 : 0),
  };
  let next = {
    ...state,
    delivery: shifted.delivery,
    debt,
    stats,
    bossOnTime: state.bossOnTime + (ticket.boss && onTime ? 1 : 0),
    tickets: state.tickets.filter(item => item.id !== ticketId),
  };
  const how = covered ? '用模块做完' : '硬写做完';
  const point = onTime ? `交付 +${shifted.applied}` : '延期了，交付不加';
  const debtNote = covered ? '技术债不加' : `技术债 +${state.config.debtPerHard}，现在 ${debt}`;
  next = withLog(next, `${ticket.title} ${how}，${point}，${debtNote}`);
  const before = debtSurcharge(state.debt, state.config);
  const after = debtSurcharge(next.debt, next.config);
  if (after > before) {
    next = withLog(next, `技术债 ${next.debt}，每 25 点多 1 个行动点，现在所有单子 +${after}`);
  }
  return next;
}

function sweepReady(state) {
  let next = state;
  let guard = 0;
  while (guard < 12) {
    const ready = next.tickets.find(ticket => ticket.progress > 0 && ticket.progress >= ticketCost(next, ticket));
    if (!ready) break;
    next = finishTicket(next, ready.id);
    guard += 1;
  }
  return next;
}

function canStudy(state, skillId) {
  const spec = state.config.skills[skillId];
  if (!spec || spec.granted || state.phase !== 'play' || state.ap <= 0) return false;
  if (state.learned[skillId]) return false;
  if (state.week < spec.minWeek) return false;
  if (spec.nightOnly && !state.night) return false;
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
  next = withLog(next, `${spec.name} 学成：${spec.effect}`);
  if (skillId === 'patterns') {
    for (const field of FIELD_IDS) {
      if (next.modules.includes(field)) continue;
      if (next.extractProgress[field] >= extractAp(next)) next = gainModule(next, field);
    }
  }
  return sweepReady(next);
}

function work(state, ticketId) {
  if (state.phase !== 'play' || state.night || state.ap <= 0) return state;
  const ticket = state.tickets.find(item => item.id === ticketId);
  if (!ticket) return state;
  const cost = ticketCost(state, ticket);
  const progress = Math.min(cost, ticket.progress + 1);
  const tickets = state.tickets.map(item => (item.id === ticketId ? { ...item, progress } : item));
  const next = { ...state, ap: state.ap - 1, tickets };
  if (progress < cost) {
    const mode = coversTicket(state, ticket) ? '模块' : '硬写';
    return withLog(next, `${ticket.title} ${mode} ${progress}/${cost}`);
  }
  return finishTicket(next, ticketId);
}

function gainModule(state, field) {
  if (state.modules.includes(field)) return state;
  const modules = state.modules.concat(field);
  const name = fieldById(field).name;
  let next = withLog({
    ...state,
    modules,
    extractProgress: { ...state.extractProgress, [field]: 0 },
    stats: { ...state.stats, extracts: state.stats.extracts + 1 },
  }, state.learned.webpack
    ? `${name} 模块抽出来了，Webpack 同时覆盖${fieldById(SIMILAR[field]).name}`
    : `${name} 模块抽出来了`);
  return sweepReady(next);
}

function extract(state, field) {
  if (state.phase !== 'play' || state.night || state.ap <= 0) return state;
  if (!FIELD_IDS.includes(field) || state.modules.includes(field)) return state;
  const cost = extractAp(state);
  const progress = Math.min(cost, state.extractProgress[field] + 1);
  let next = {
    ...state,
    ap: state.ap - 1,
    extractProgress: { ...state.extractProgress, [field]: progress },
  };
  if (progress < cost) return withLog(next, `抽${fieldById(field).name}模块 ${progress}/${cost}`);
  return gainModule(next, field);
}

function place(state, field) {
  if (state.phase !== 'play' || !state.bossOn) return state;
  if (!state.modules.includes(field) || state.placed.includes(field)) return state;
  const placed = state.placed.concat(field);
  const name = fieldById(field).name;
  const extra = state.learned.webpack ? `，相近的${fieldById(SIMILAR[field]).name}一起接上` : '';
  return sweepReady(withLog({ ...state, placed }, `${name}模块拼上白板${extra}`));
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
  if (state.phase !== 'play' || state.overnightUsed || state.night) return state;
  const stamina = Math.max(0, state.stamina - state.config.overnightStaminaCost);
  return withLog({
    ...state,
    ap: state.ap + state.config.overnightAp,
    stamina,
    night: true,
    overnightUsed: true,
    dotaPending: true,
    stats: { ...state.stats, overnights: state.stats.overnights + 1 },
  }, `${state.config.overnightName}，行动点 +${state.config.overnightAp}，体力 ${stamina}。夜里只能学技能`);
}

function dotaResult(state, won) {
  if (state.phase !== 'play' || !state.dotaPending) return state;
  if (!won) return withLog({ ...state, dotaPending: false }, 'Dota 没打过，体力不返还');
  const stamina = Math.min(state.config.staminaMax, state.stamina + state.config.dotaWinStamina);
  const gained = stamina - state.stamina;
  const note = gained > 0 ? `Dota 打赢了，体力 +${gained}，现在 ${stamina}` : 'Dota 打赢了，体力已经满了';
  return withLog({ ...state, stamina, dotaPending: false }, note);
}

function resolveDeadlines(state) {
  const kept = [];
  let next = state;
  for (const ticket of state.tickets) {
    if (ticket.late) {
      kept.push(ticket);
      continue;
    }
    const dueIn = ticket.dueIn - 1;
    if (dueIn > 0) {
      kept.push({ ...ticket, dueIn });
      continue;
    }
    const shifted = shiftDelivery(next, -next.config.latePenalty);
    const lost = -shifted.applied;
    next = {
      ...next,
      delivery: shifted.delivery,
      stats: { ...shifted.stats, lateCount: next.stats.lateCount + 1 },
    };
    const amount = lost > 0 ? `交付 -${lost}` : '交付已经是 0';
    next = withLog(next, `${ticket.title} 延期，${amount}，单子还在。`);
    kept.push({ ...ticket, dueIn: 0, late: true });
  }
  return { ...next, tickets: kept };
}

function applyBabel(state) {
  if (!state.learned.babel || state.debt <= 0) return state;
  const cleared = Math.min(state.config.babelClear, state.debt);
  const debt = state.debt - cleared;
  const before = debtSurcharge(state.debt, state.config);
  const after = debtSurcharge(debt, state.config);
  let next = withLog({ ...state, debt }, `周一，Babel 清掉技术债 ${cleared}，现在 ${debt}`);
  if (after < before) next = withLog(next, `技术债降下来，所有单子少 ${before - after} 个行动点`);
  return sweepReady(next);
}

function sleep(state) {
  if (state.phase !== 'play' || state.ap > 0) return state;
  let next = resolveDeadlines({ ...state, dotaPending: false, night: false });
  if (next.day === next.config.daysPerWeek) {
    const line = weekLine(next.week, next.config);
    if (next.delivery < line) {
      const complaints = next.complaints + 1;
      next = withLog({ ...next, complaints }, `第 ${next.week} 周周五，交付 ${next.delivery}，低于本周线 ${line}。被业务方投诉，第 ${complaints} 次。`);
      if (complaints >= next.config.complaintLimit) {
        return {
          ...next,
          phase: 'lost',
          failReason: `第 ${next.week} 周周五，交付 ${next.delivery}，低于本周线 ${line}。被业务方投诉两次，本局结束。`,
        };
      }
    } else {
      next = withLog(next, `第 ${next.week} 周周五，交付 ${next.delivery}，过了本周线 ${line}。`);
    }
    if (next.week >= next.config.weeks) {
      const good = next.bossOnTime >= BOSS_TICKETS.length;
      return {
        ...next,
        phase: 'won',
        ending: good ? 'architecture' : 'debt',
        learned: good ? { ...next.learned, architecture: true } : next.learned,
      };
    }
    next = { ...next, week: next.week + 1, day: 1 };
  } else {
    next = { ...next, day: next.day + 1 };
  }
  const exhausted = next.stamina <= 0;
  const ap = exhausted ? next.config.exhaustedAp : next.config.dailyAp;
  next = {
    ...next,
    ap,
    overnightUsed: false,
    night: false,
  };
  if (next.day === 1) next = applyBabel(next);
  next = withLog(next, `第 ${next.week} 周${DAY_NAMES[next.day]}，行动点 ${ap}${exhausted ? '（体力见底）' : ''}。`);
  return spawnMorning(next);
}

export function applyAction(state, action) {
  if (!action || state.phase !== 'play') return state;
  if (action.type === 'work') return work(state, action.ticketId);
  if (action.type === 'study') return study(state, action.skill);
  if (action.type === 'extract') return extract(state, action.field);
  if (action.type === 'place') return place(state, action.field);
  if (action.type === 'rest') return rest(state);
  if (action.type === 'overnight') return overnight(state);
  if (action.type === 'dota') return dotaResult(state, action.won === true);
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
  if (spec.granted) {
    return {
      id: skillId,
      name: spec.name,
      effect: spec.effect,
      cost: spec.cost,
      progress: state.learned.architecture ? 1 : 0,
      learned: state.learned.architecture,
      blocked: state.learned.architecture ? '' : 'Boss 关五张都按期交付后获得',
      canStudy: false,
    };
  }
  let blocked = '';
  if (!state.learned[skillId] && state.week < spec.minWeek) blocked = `第 ${spec.minWeek} 周开放`;
  else if (!state.learned[skillId] && spec.nightOnly && !state.night) blocked = '只能夜里学';
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

function costLabel(base, surcharge, covered) {
  const mode = covered ? '模块' : '硬写';
  if (surcharge <= 0) return `${mode} ${base} 点`;
  return `${mode} ${base} + 技术债 ${surcharge} = ${base + surcharge} 点`;
}

export function present(state) {
  const config = state.config;
  const surcharge = debtSurcharge(state.debt, config);
  const forecastFields = state.learned.biz ? nextWeekFields(state) : null;
  return {
    seed: state.seed,
    week: state.week,
    day: state.day,
    dayName: DAY_NAMES[state.day],
    phase: state.phase,
    ap: state.ap,
    stamina: state.stamina,
    staminaMax: config.staminaMax,
    delivery: state.delivery,
    line: weekLine(state.week, config),
    debt: state.debt,
    surcharge,
    complaints: state.complaints,
    complaintLimit: config.complaintLimit,
    night: state.night,
    overnightUsed: state.overnightUsed,
    bossOn: state.bossOn,
    bossOnTime: state.bossOnTime,
    failReason: state.failReason,
    ending: state.ending,
    victoryTitle: ENDINGS[state.ending]?.title || '',
    victoryText: ENDINGS[state.ending]?.text || '',
    log: state.log,
    forecast: forecastFields,
    forecastText: forecastFields
      ? (forecastFields.length ? forecastFields.map(id => fieldById(id).name).join('、') : '没有下一周了')
      : '',
    modules: state.modules.map(id => ({
      id,
      name: fieldById(id).name,
      similar: fieldById(SIMILAR[id]).name,
      similarId: SIMILAR[id],
      placed: state.placed.includes(id),
      canPlace: state.bossOn && !state.placed.includes(id),
    })),
    extract: FIELD_IDS.filter(id => !state.modules.includes(id)).map(id => ({
      id,
      name: fieldById(id).name,
      similar: fieldById(SIMILAR[id]).name,
      progress: state.extractProgress[id],
      cost: extractAp(state),
      canExtract: state.phase === 'play' && !state.night && state.ap > 0,
    })),
    whiteboard: state.bossOn ? BOSS_TICKETS.map(spec => {
      const covered = bossFieldCovered(state, spec.field);
      const base = covered ? config.moduleAp : spec.difficulty;
      const ticket = state.tickets.find(item => item.boss && item.line === spec.line && item.field === spec.field);
      let status = 'done';
      if (ticket?.late) status = 'late';
      else if (ticket) status = 'open';
      return {
        line: spec.line,
        lineName: lineById(spec.line).name,
        field: spec.field,
        fieldName: fieldById(spec.field).name,
        example: fieldById(spec.field).example,
        covered,
        base,
        surcharge,
        cost: base + surcharge,
        progress: ticket ? ticket.progress : base + surcharge,
        status,
        label: status === 'done' ? '已按期交付' : (status === 'late' ? '已延期' : costLabel(base, surcharge, covered)),
      };
    }) : [],
    stats: {
      ...state.stats,
      skills: SKILL_IDS.filter(id => state.learned[id]).map(id => config.skills[id].name),
      modules: state.modules.map(id => fieldById(id).name),
      debt: state.debt,
      complaints: state.complaints,
      bossOnTime: state.bossOnTime,
    },
    canRest: state.phase === 'play' && state.ap > 0,
    canOvernight: state.phase === 'play' && !state.overnightUsed && !state.night,
    canSleep: state.phase === 'play' && state.ap === 0,
    tickets: state.tickets.map(ticket => {
      const covered = coversTicket(state, ticket);
      const base = ticketBase(state, ticket);
      const cost = base + surcharge;
      return {
        id: ticket.id,
        line: ticket.line,
        lineName: lineById(ticket.line).name,
        field: ticket.field,
        fieldName: fieldById(ticket.field).name,
        example: fieldById(ticket.field).example,
        title: ticket.title,
        boss: ticket.boss,
        late: ticket.late,
        dueIn: ticket.dueIn,
        difficulty: ticket.difficulty,
        progress: ticket.progress,
        covered,
        base,
        surcharge,
        cost,
        left: Math.max(0, cost - ticket.progress),
        reward: ticket.late ? 0 : config.onTimeReward,
        penalty: config.latePenalty,
        label: costLabel(base, surcharge, covered),
        canWork: state.phase === 'play' && !state.night && state.ap > 0,
      };
    }).sort((a, b) => Number(b.boss) - Number(a.boss) || a.dueIn - b.dueIn || a.id - b.id),
    skills: SKILL_IDS.map(id => skillStatus(state, id)),
    nightLock: state.night ? '夜里只能学技能，不能做需求单' : '',
  };
}

export function snapshot(state) {
  const { config, ...rest } = state;
  return rest;
}

export { STUDY_IDS };
