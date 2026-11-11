import {
  BACKEND_TICKETS,
  CONFIG,
  DAY_NAMES,
  ENDINGS,
  EVENT_TICKETS,
  PAGE_TITLES,
  SKILL_IDS,
} from './config.mjs';
import { hashSeed, rngInt, rngNext } from './rng.mjs';

export { CONFIG, DAY_NAMES, ENDINGS };

const KIND_LABEL = {
  api: '接口',
  data: '导数据',
  schema: '改表',
  log: '服务器',
  cron: '定时任务',
  page: '页面',
  disk: '服务器事件',
  rollback: '回滚事件',
  demo: '演示事件',
  filedb: '主线',
};

const EVENT_KINDS = new Set(['disk', 'rollback', 'demo']);
const SERVER_KINDS = new Set(['log', 'cron', 'disk']);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function weekLine(week, config = CONFIG) {
  if (config.weekLines) return config.weekLines[week - 1];
  if (week === config.weeks && config.weekLineFinal != null) return config.weekLineFinal;
  return config.weekLineBase + (week - 1) * config.weekLineStep;
}

export function goodFavor(config = CONFIG) {
  return config.goodFavor;
}

export function clearedEnding(favor, fileDbDone, config = CONFIG) {
  if (fileDbDone && favor >= goodFavor(config)) return 'remembered';
  return 'barely';
}

export const PERSON_IDS = Object.freeze(['boss', 'lunch', 'neighbor', 'party']);

const PEOPLE = Object.freeze({
  boss: Object.freeze({ name: '老板', nightOnly: false }),
  lunch: Object.freeze({ name: '饭搭子', nightOnly: false }),
  neighbor: Object.freeze({ name: '隔壁工位老哥', nightOnly: false }),
  party: Object.freeze({ name: '开黑队友', nightOnly: true }),
});

const INTERVIEW = Object.freeze([
  Object.freeze({ name: '面试', speaker: 'narrator', text: '原本录用的人嫌工资低，没来。' }),
  Object.freeze({ name: '老板', speaker: 'boss', text: '你能力不行，来了也干不了活。' }),
  Object.freeze({ name: '我', speaker: 'player', text: '我不要工资，让我来试试就行。' }),
  Object.freeze({ name: '老板', speaker: 'boss', text: '行，那你想试试我也不拦你，反正不要工资，到时候你自己也会受不了就走。' }),
  Object.freeze({ name: '', speaker: 'narrator', text: '就这样留下了。' }),
]);

const BOSS_DAILY = Object.freeze([
  '接口的错码写清楚。写完跟我说一声。',
  '导库别放在中午。人少的时候再动。',
  '日志看完再重启。别一上来就重来。',
  '改表先跟我说。改完把脚本留着。',
  '演示前把数对上。别到时候当场错。',
  '能今天收的就今天收。别攒着。',
  '单子下来先看期限。急的先做。',
  '服务器那边有动静，优先看。',
  '页面也要顾。别只盯着库。',
  '有卡住的，早点开口。别闷头熬。',
]);

const LUNCH_LINES = Object.freeze([
  '好饿，去吃面吗？想吃牛肉面。',
  '好饿，去吃面吗？来碗辣的。',
  '好饿，去吃面吗？熬到现在，得吃点热的。',
  '好饿，去吃面吗？清汤也行，走吧。',
  '好饿，去吃面吗？我请。',
  '好饿，去吃面吗？对面那家，很快。',
  '好饿，去吃面吗？坐太久了，去活动一下。',
  '好饿，去吃面吗？加个蛋，我的习惯。',
  '好饿，去吃面吗？番茄的也有。',
  '好饿，去吃面吗？吃完再赶单。',
]);

const NEIGHBOR_LINES = Object.freeze([
  '周一啊。咖啡凉了还在喝。',
  '你那单看着挺急。我先说一声。',
  '熬过星期三就是星期五。再撑两天。',
  '星期四了，反倒安静一点。',
  '周五下午了。还能做一张是一张。',
  '隔壁这风对着吹。忍一下。',
  '中午那面馆人好多。',
  '群里又在催。先别慌。',
  '抽屉里有饼干。饿了你拿。',
  '敲一天了。耳朵都热。',
]);

const PARTY_LINES = Object.freeze([
  '还没走？来打一把 Dota。',
  '就一把 Dota。影魔，我辅助。',
  '今晚人齐，就差你。来打 Dota？',
  '排上了。来不来打 Dota？',
  '打完早睡。来一把 Dota？',
  '我开好了。就缺个影魔，打 Dota。',
  '今天单多？打一把 Dota，换换脑子。',
  '网上等你。来打 Dota？',
  '一把 Dota 就走。不拖拉。',
  '周五晚上了，不打 Dota 可惜。',
]);

const GATE_LINES = Object.freeze({
  lunch: '你是来面试的吧？先去找老板，他在茶桌那边。',
  neighbor: '招人的事别问我，先去找老板。',
  party: '先去找老板。晚上再说。',
});

export const SCRIPT = Object.freeze({
  nightFalls: '白天的活告一段落。天黑了，我还没走。',
  daysPass: '日夜颠倒地学新东西，拼命把活干好，争取能留下来。',
  weekOpen: Object.freeze([
    '试用的第一周。桌上已经有单了。',
    '第二周。大单压过来，小单也没停。',
    '过半了。夜里灯还开着。',
    '最后一周。能不能留下，就看这几天。',
  ]),
});

export function bossFavorLine(favor, line) {
  if (favor >= line + 10) return `好感 ${favor}，比本周线 ${line} 高出一截。`;
  if (favor >= line) return `好感 ${favor}，刚过本周线 ${line}。`;
  return `好感 ${favor}，没到本周线 ${line}。`;
}

export function isEvent(ticket) {
  return EVENT_KINDS.has(ticket.kind);
}

export function isServerTicket(ticket) {
  return SERVER_KINDS.has(ticket.kind) || isEvent(ticket);
}

export function ticketWorkCost(ticket, learned, config = CONFIG) {
  if (ticket.mainline) return config.fileDbCost;
  if (isServerTicket(ticket) && learned.linux) return config.linuxServerCost;
  if ((ticket.kind === 'data' || ticket.kind === 'schema') && learned.database) {
    return Math.max(1, ticket.difficulty - config.skillDiscount);
  }
  if (ticket.kind === 'api' && learned.java) return Math.max(1, ticket.difficulty - config.skillDiscount);
  if (ticket.kind === 'page' && learned.jquery) return Math.max(1, ticket.difficulty - config.skillDiscount);
  return ticket.difficulty;
}

export function workStep(ticket, learned, config = CONFIG) {
  if (ticket.mainline && learned.java) return 1 + config.fileDbJavaBonus;
  return 1;
}

export function ticketReward(ticket, config = CONFIG) {
  if (ticket.mainline) return config.fileDbReward;
  if (isEvent(ticket)) return config.eventFavorComplete;
  return config.favorPerDifficulty * ticket.difficulty;
}

export function ticketPenalty(ticket, learned, config = CONFIG) {
  if (!isEvent(ticket)) return config.favorLate;
  return learned.git ? config.eventFavorFailWithGit : config.eventFavorFail;
}

function blankStats() {
  return { completed: 0, lateCount: 0, favorGained: 0, favorLost: 0, overnights: 0, rests: 0, studies: 0 };
}

function withLog(state, line) {
  return { ...state, say: '', log: [line, ...state.log].slice(0, 8) };
}

function makeTicket(roll, rng, id, config) {
  if (roll < config.eventChance) {
    const pick = rngInt(rng, 0, EVENT_TICKETS.length - 1);
    const spec = EVENT_TICKETS[pick.value];
    return {
      rng: pick.state,
      ticket: {
        id,
        kind: spec.kind,
        title: spec.title,
        difficulty: config.eventDifficulty,
        dueIn: config.eventDeadline,
        progress: 0,
        late: false,
        mainline: false,
      },
    };
  }
  if (roll < config.eventChance + config.pageChance) {
    const difficultyRoll = rngInt(rng, 0, config.difficultyTable.length - 1);
    const due = rngInt(difficultyRoll.state, config.deadlineMin, config.deadlineMax);
    const title = rngInt(due.state, 0, PAGE_TITLES.length - 1);
    return {
      rng: title.state,
      ticket: {
        id,
        kind: 'page',
        title: PAGE_TITLES[title.value],
        difficulty: config.difficultyTable[difficultyRoll.value],
        dueIn: due.value,
        progress: 0,
        late: false,
        mainline: false,
      },
    };
  }
  const pick = rngInt(rng, 0, BACKEND_TICKETS.length - 1);
  const spec = BACKEND_TICKETS[pick.value];
  const difficultyRoll = rngInt(pick.state, 0, config.difficultyTable.length - 1);
  const due = rngInt(difficultyRoll.state, config.deadlineMin, config.deadlineMax);
  return {
    rng: due.state,
    ticket: {
      id,
      kind: spec.kind,
      title: spec.title,
      difficulty: config.difficultyTable[difficultyRoll.value],
      dueIn: due.value,
      progress: 0,
      late: false,
      mainline: false,
    },
  };
}

function fileDbDueIn(state) {
  const config = state.config;
  return (config.weeks - state.week) * config.daysPerWeek + (config.daysPerWeek - state.day) + 1;
}

function fileDbTicket(state, id) {
  return {
    id,
    kind: 'filedb',
    title: state.config.fileDbTitle,
    difficulty: state.config.fileDbCost,
    dueIn: fileDbDueIn(state),
    progress: 0,
    late: false,
    mainline: true,
  };
}

function takeMorning(state) {
  const config = state.config;
  let rng = state.rng;
  const count = rngInt(rng, config.spawnMin, config.spawnMax);
  rng = count.state;
  const spawned = [];
  let nextId = state.nextId;
  for (let i = 0; i < count.value; i += 1) {
    const kindRoll = rngNext(rng);
    const made = makeTicket(kindRoll.value, kindRoll.state, nextId, config);
    rng = made.rng;
    nextId += 1;
    spawned.push(made.ticket);
  }
  let fileDb = null;
  if (state.week === config.fileDbWeek && state.day === 1 && !state.fileDbAssigned) {
    fileDb = fileDbTicket(state, nextId);
    nextId += 1;
  }
  return { rng, nextId, count: count.value, spawned, fileDb };
}

function spawnMorning(state) {
  const rolled = takeMorning(state);
  let tickets = state.tickets.concat(rolled.spawned);
  let note = `早上新到 ${rolled.count} 张单。`;
  let fileDbAssigned = state.fileDbAssigned;
  if (rolled.fileDb) {
    tickets = [rolled.fileDb].concat(tickets);
    fileDbAssigned = true;
    note = `${note}老板派下「${state.config.fileDbTitle}」，第 ${state.config.weeks} 周周五前。`;
  }
  return withLog({
    ...state,
    rng: rolled.rng,
    nextId: rolled.nextId,
    fileDbAssigned,
    tickets,
  }, note);
}

function nextMorningState(state) {
  const config = state.config;
  if (state.week >= config.weeks && state.day >= config.daysPerWeek) return null;
  if (state.day >= config.daysPerWeek) return { ...state, week: state.week + 1, day: 1 };
  return { ...state, day: state.day + 1 };
}

export function forecastTomorrow(state) {
  const morning = nextMorningState(state);
  if (!morning) return null;
  const rolled = takeMorning(morning);
  const ticket = rolled.spawned[0];
  if (!ticket) return null;
  return {
    kind: ticket.kind,
    title: ticket.title,
    difficulty: ticket.difficulty,
    dueIn: ticket.dueIn,
  };
}

function freshTalked() {
  return { boss: false, lunch: false, neighbor: false, party: false };
}

function dayIndex(state) {
  return (state.week - 1) * state.config.daysPerWeek + (state.day - 1);
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
    dotaPending: false,
    interviewed: false,
    interviewStep: 0,
    say: '',
    night: false,
    talked: freshTalked(),
    settlementLine: '',
    skills: { linux: 0, git: 0, database: 0, java: 0, jquery: 0 },
    learned: { linux: false, git: false, database: false, java: false, jquery: false },
    tickets: [],
    nextId: 1,
    fileDbAssigned: false,
    fileDbDone: false,
    log: [`第 1 周周一。好感 ${config.favorStart}，本周线 ${weekLine(1, config)}。`],
    stats: blankStats(),
    failReason: '',
    ending: '',
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

function sweepLearned(state) {
  let next = state;
  const ready = next.tickets.filter(ticket => !ticket.mainline && ticket.progress >= ticketWorkCost(ticket, next.learned, next.config));
  for (const ticket of ready) {
    next = completeTicket(next, ticket.id, `${ticket.title}：技能生效，这张已经做完。`);
  }
  return next;
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
  return sweepLearned(next);
}

function work(state, ticketId) {
  if (state.phase !== 'play' || state.ap <= 0) return state;
  const ticket = state.tickets.find(item => item.id === ticketId);
  if (!ticket) return state;
  if (ticket.mainline && !state.learned.database) return state;
  const cost = ticketWorkCost(ticket, state.learned, state.config);
  const step = workStep(ticket, state.learned, state.config);
  const progress = Math.min(cost, ticket.progress + step);
  const tickets = state.tickets.map(item => (item.id === ticketId ? { ...item, progress } : item));
  const next = {
    ...state,
    ap: state.ap - 1,
    tickets,
  };
  if (progress < cost) {
    const extra = step > 1 ? `+${step}，` : '';
    return withLog(next, `${ticket.title} ${extra}${progress}/${cost}`);
  }
  const done = completeTicket(next, ticketId, `${ticket.title} 做完，`);
  return ticket.mainline ? { ...done, fileDbDone: true } : done;
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
    dotaPending: true,
    stats: { ...state.stats, overnights: state.stats.overnights + 1 },
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

function markTalked(state, person, line) {
  return withLog({
    ...state,
    talked: { ...state.talked, [person]: true },
  }, line);
}

function bossText(state) {
  const config = state.config;
  if (state.week === config.fileDbWeek && state.day === 1) {
    return '这周有个大单：写一个文件数据库。先把数据库学会，才能开工。';
  }
  if (state.day === config.daysPerWeek) return bossFavorLine(state.favor, weekLine(state.week, config));
  return BOSS_DAILY[dayIndex(state) % BOSS_DAILY.length];
}

function lunchText(state) {
  return LUNCH_LINES[dayIndex(state) % LUNCH_LINES.length];
}

function neighborText(state) {
  const forecast = forecastTomorrow(state);
  const flavor = state.day === 3 ? NEIGHBOR_LINES[2] : NEIGHBOR_LINES[dayIndex(state) % NEIGHBOR_LINES.length];
  if (!forecast) return `${flavor}明天没有新单了。`;
  return `${flavor}明天会来「${forecast.title}」，${forecast.difficulty} 点，期限 ${forecast.dueIn} 天。`;
}

function partyText(state) {
  return PARTY_LINES[dayIndex(state) % PARTY_LINES.length];
}

function talkBoss(state) {
  if (!state.interviewed) {
    const line = INTERVIEW[state.interviewStep];
    if (!line) return state;
    const step = state.interviewStep + 1;
    const done = step >= INTERVIEW.length;
    const next = { ...state, interviewStep: step, interviewed: done };
    const who = line.name || '旁白';
    const logged = `${who}：${line.text}`;
    return done ? markTalked(next, 'boss', logged) : withLog(next, logged);
  }
  return markTalked(state, 'boss', `老板：${bossText(state)}`);
}

function talkLunch(state, choice) {
  if (choice !== 'accept' && choice !== 'decline') return state;
  if (choice === 'decline') return markTalked(state, 'lunch', '饭搭子：那我自己去。');
  if (state.ap <= 0) return state;
  const stamina = Math.min(state.config.staminaMax, state.stamina + state.config.noodleStamina);
  const gained = stamina - state.stamina;
  const note = gained > 0 ? `吃了面，体力 +${gained}，现在 ${stamina}` : '吃了面，体力已经满了';
  const spoken = gained > 0 ? '走，就对面那家。' : '吃完了。人倒是饱了。';
  return { ...markTalked({ ...state, ap: state.ap - 1, stamina }, 'lunch', `饭搭子：${note}`), say: spoken };
}

function talkNeighbor(state) {
  return markTalked(state, 'neighbor', `隔壁工位老哥：${neighborText(state)}`);
}

function talkParty(state, choice) {
  if (choice !== 'accept' && choice !== 'decline') return state;
  if (choice === 'decline') return markTalked(state, 'party', '开黑队友：那今晚不打。');
  if (state.overnightUsed) return markTalked(state, 'party', '开黑队友：今晚已经打过了。');
  const stayed = overnight(state);
  return {
    ...stayed,
    talked: { ...stayed.talked, party: true },
  };
}

function talk(state, action) {
  const person = action.person;
  if (!PEOPLE[person] || state.phase !== 'play' || state.talked[person]) return state;
  if (person === 'party' && !state.night) return state;
  if (person !== 'boss' && !state.interviewed) return state;
  if (person === 'boss') return talkBoss(state);
  if (person === 'lunch') return talkLunch(state, action.choice);
  if (person === 'neighbor') return talkNeighbor(state);
  return talkParty(state, action.choice);
}

function setNight(state, night) {
  if (state.phase !== 'play' || state.night === night) return state;
  return { ...state, night };
}

export function coworkerLine(state, person) {
  const spec = PEOPLE[person];
  if (!spec) return null;
  const visible = !spec.nightOnly || state.night;
  const base = {
    id: person,
    name: spec.name,
    speaker: person,
    narrator: false,
    interview: false,
    visible,
    clickable: visible && (spec.nightOnly ? state.night : !state.night),
    talked: Boolean(state.talked[person]),
    gate: false,
    commit: false,
    text: '',
    choices: [],
    forecast: null,
  };
  if (!visible) return base;
  if (person === 'boss' && !state.interviewed) {
    const line = INTERVIEW[state.interviewStep];
    if (!line) return base;
    return {
      ...base,
      name: line.name,
      speaker: line.speaker,
      narrator: line.speaker === 'narrator',
      interview: true,
      text: line.text,
    };
  }
  if (state.talked[person]) return { ...base, text: '今天说过了。' };
  if (person !== 'boss' && !state.interviewed) {
    return { ...base, gate: true, text: GATE_LINES[person] };
  }
  if (person === 'boss') return { ...base, commit: true, text: bossText(state) };
  if (person === 'neighbor') {
    return { ...base, commit: true, text: neighborText(state), forecast: forecastTomorrow(state) };
  }
  if (person === 'lunch') {
    return {
      ...base,
      text: lunchText(state),
      choices: [
        { id: 'accept', label: '去' },
        { id: 'decline', label: '下次' },
      ],
    };
  }
  return {
    ...base,
    text: partyText(state),
    choices: [
      { id: 'accept', label: '打' },
      { id: 'decline', label: '不打' },
    ],
  };
}

function resolveDeadlines(state) {
  const config = state.config;
  const kept = [];
  let next = state;
  for (const ticket of state.tickets) {
    if (ticket.mainline) {
      kept.push({ ...ticket, dueIn: Math.max(0, ticket.dueIn - 1) });
      continue;
    }
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
  let next = resolveDeadlines({ ...state, dotaPending: false });
  if (next.day === next.config.daysPerWeek) {
    const line = weekLine(next.week, next.config);
    const remark = `老板：${bossFavorLine(next.favor, line)}`;
    next = { ...withLog(next, remark), settlementLine: remark };
    if (next.favor < line) {
      return {
        ...next,
        phase: 'lost',
        failReason: `第 ${next.week} 周周五，老板好感 ${next.favor}，低于本周线 ${line}，被劝退。`,
      };
    }
    if (next.week >= next.config.weeks) {
      const ending = clearedEnding(next.favor, next.fileDbDone, next.config);
      return { ...next, phase: 'won', ending };
    }
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
    night: false,
    talked: freshTalked(),
  }, `第 ${next.week} 周${DAY_NAMES[next.day]}，行动点 ${ap}${exhausted ? '（体力见底）' : ''}。`);
  return spawnMorning(next);
}

export function applyAction(state, action) {
  if (!action || state.phase !== 'play') return state;
  if (action.type === 'work') return work(state, action.ticketId);
  if (action.type === 'study') return study(state, action.skill);
  if (action.type === 'rest') return rest(state);
  if (action.type === 'overnight') return overnight(state);
  if (action.type === 'dota') return dotaResult(state, action.won === true);
  if (action.type === 'sleep') return sleep(state);
  if (action.type === 'night') return setNight(state, true);
  if (action.type === 'day') return setNight(state, false);
  if (action.type === 'talk') return talk(state, action);
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

function victoryCopy(state) {
  const ending = ENDINGS[state.ending];
  if (!ending) return '';
  if (state.ending === 'barely' && state.fileDbDone) return ending.fileDbDone;
  return ending.text;
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
    failText: ENDINGS.lost.text,
    ending: state.ending,
    victoryTitle: ENDINGS[state.ending]?.title || '',
    victoryText: victoryCopy(state),
    goodFavor: goodFavor(config),
    fileDbDone: state.fileDbDone,
    interviewed: state.interviewed,
    night: state.night,
    settlementLine: state.settlementLine,
    log: state.log,
    stats: {
      ...state.stats,
      skills: SKILL_IDS.filter(id => state.learned[id]).map(id => config.skills[id].name),
      fileDb: state.fileDbDone ? '做完' : '没做完',
    },
    canRest: state.phase === 'play' && state.ap > 0,
    canOvernight: state.phase === 'play' && !state.overnightUsed,
    canSleep: state.phase === 'play' && state.ap === 0,
    tickets: state.tickets.map(ticket => {
      const cost = ticketWorkCost(ticket, learned, config);
      const step = workStep(ticket, learned, config);
      const penalty = ticket.mainline ? 0 : ticketPenalty(ticket, learned, config);
      let costNote = '';
      if (isServerTicket(ticket) && learned.linux && !ticket.mainline) costNote = 'Linux';
      if ((ticket.kind === 'data' || ticket.kind === 'schema') && learned.database && cost < ticket.difficulty) costNote = '数据库';
      if (ticket.kind === 'api' && learned.java && cost < ticket.difficulty) costNote = 'Java';
      if (ticket.kind === 'page' && learned.jquery && cost < ticket.difficulty) costNote = 'jQuery';
      if (ticket.mainline && learned.java) costNote = 'Java，这次 +2';
      return {
        id: ticket.id,
        kind: ticket.kind,
        kindLabel: KIND_LABEL[ticket.kind],
        title: ticket.title,
        mainline: Boolean(ticket.mainline),
        locked: Boolean(ticket.mainline && !learned.database),
        difficulty: ticket.difficulty,
        dueIn: ticket.dueIn,
        dueLabel: ticket.mainline ? `第 ${config.weeks} 周周五前` : '',
        late: ticket.late,
        progress: ticket.progress,
        cost,
        step,
        left: Math.max(0, cost - ticket.progress),
        reward: ticketReward(ticket, config),
        penalty,
        fullPenalty: isEvent(ticket) ? config.eventFavorFail : config.favorLate,
        costNote,
        penaltyNote: isEvent(ticket) && learned.git ? 'Git' : '',
      };
    }).sort((a, b) => Number(b.mainline) - Number(a.mainline)),
    skills: SKILL_IDS.map(id => skillStatus(state, id)),
    shelf: skillStatus(state, 'jquery'),
    coworkers: PERSON_IDS.map(id => coworkerLine(state, id)),
  };
}

export function snapshot(state) {
  const { config, ...rest } = state;
  return rest;
}
