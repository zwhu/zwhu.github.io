import { castRaze, createMatch, LAST_HITS, MATCH_TICKS, RAZES, THREAT_POS, tickMatch, TICK_MS } from './dota.mjs';
import { CONFIG, applyAction, createGame, present } from './rules.mjs';

const app = document.querySelector('#app');

function readSeed() {
  const value = new URLSearchParams(location.search).get('seed');
  return value ? value.slice(0, 64) : 'hefei';
}

let state = createGame(readSeed());
let dota = null;
let dotaTick = 0;
let dotaResult = 0;
let dialogue = null;

function clearDotaTimers() {
  if (dotaTick) clearInterval(dotaTick);
  if (dotaResult) clearTimeout(dotaResult);
  dotaTick = 0;
  dotaResult = 0;
}

function closeDota() {
  clearDotaTimers();
  dota = null;
  render();
}

function showDotaResult() {
  if (!dota || dota.mode === 'result') return;
  if (dotaTick) clearInterval(dotaTick);
  dotaTick = 0;
  state = applyAction(state, { type: 'dota', won: dota.match.won === true });
  dota = { ...dota, mode: 'result' };
  render();
  dotaResult = setTimeout(closeDota, 1800);
}

function startDota() {
  if (dota || !state.dotaPending) return;
  dota = { match: createMatch(state.seed, state.rng), mode: 'play' };
  render();
  dotaTick = setInterval(() => {
    if (!dota || dota.mode !== 'play') return;
    const match = tickMatch(dota.match);
    dota = { ...dota, match };
    if (match.over) showDotaResult();
    else render();
  }, TICK_MS);
}

function abandonDota() {
  if (!dota || dota.mode !== 'play') return;
  dota = { ...dota, match: { ...dota.match, over: true, won: false } };
  showDotaResult();
}

function pressRaze(id) {
  if (!dota || dota.mode !== 'play') return;
  const match = castRaze(dota.match, id);
  dota = { ...dota, match };
  if (match.over) showDotaResult();
  else render();
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (key === 'class') node.className = value;
    else if (value != null) node.setAttribute(key, String(value));
  }
  for (const child of children || []) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}

function pips(filled, total) {
  const wrap = el('span', { class: 'pips', 'aria-hidden': 'true' });
  for (let i = 0; i < total; i += 1) wrap.append(el('i', { class: i < filled ? 'pip on' : 'pip' }));
  return wrap;
}

function act(action) {
  state = applyAction(state, action);
  if (action && action.type === 'sleep') dialogue = null;
  render();
}

function start(seed) {
  const next = String(seed || '').trim().slice(0, 64) || 'hefei';
  const url = new URL(location.href);
  url.searchParams.set('seed', next);
  history.replaceState(null, '', url);
  clearDotaTimers();
  dota = null;
  dialogue = null;
  state = createGame(next);
  render();
}

function sentence(line) {
  const mark = line.indexOf('：');
  return mark === -1 ? line : line.slice(mark + 1);
}

function openPerson(id) {
  const line = present(state).coworkers.find(item => item.id === id);
  if (!line || !line.visible) return;
  if (!line.commit || line.talked) {
    dialogue = { person: id, name: line.name, text: line.text, choices: line.choices, forecast: line.forecast };
    render();
    return;
  }
  const next = applyAction(state, { type: 'talk', person: id });
  if (next === state) return;
  state = next;
  dialogue = { person: id, name: line.name, text: sentence(state.log[0]), choices: [], forecast: line.forecast };
  render();
}

function chooseLine(choice) {
  if (!dialogue) return;
  const person = dialogue.person;
  const name = dialogue.name;
  const pending = state.dotaPending;
  const next = applyAction(state, { type: 'talk', person, choice });
  if (next === state) return;
  state = next;
  if (!pending && state.dotaPending) {
    dialogue = null;
    startDota();
    return;
  }
  dialogue = { person, name, text: sentence(state.log[0]), choices: [], forecast: null };
  render();
}

function header(view) {
  const form = el('form', { id: 'seed-form' }, [
    el('label', { for: 'seed-input' }, ['种子']),
    el('input', { id: 'seed-input', name: 'seed', value: view.seed, autocomplete: 'off', maxlength: '64' }),
    el('button', { type: 'submit' }, ['开局']),
  ]);
  form.addEventListener('submit', event => {
    event.preventDefault();
    start(form.seed.value);
  });
  return el('header', {}, [
    el('div', {}, [
      el('h1', {}, ['合肥试用期']),
      el('p', { class: 'when', id: 'when' }, [`第 ${view.week} 周 · ${view.dayName}`]),
    ]),
    form,
  ]);
}

function status(view) {
  const apMax = Math.max(view.ap, 3);
  return el('section', { class: 'status' }, [
    el('article', {}, [
      el('div', {}, ['行动点']),
      el('strong', { id: 'ap' }, [String(view.ap)]),
      document.createTextNode(' '),
      pips(view.ap, apMax),
    ]),
    el('article', {}, [
      el('div', {}, ['体力']),
      el('strong', { id: 'stamina' }, [String(view.stamina)]),
      document.createTextNode(' '),
      pips(view.stamina, view.staminaMax),
    ]),
    el('article', {}, [
      el('div', {}, ['老板好感']),
      el('strong', { id: 'favor' }, [String(view.favor)]),
      el('div', {}, ['本周线 ', el('strong', { id: 'line' }, [String(view.line)])]),
      el('div', {}, ['记住线 ', el('strong', { id: 'good-favor' }, [String(view.goodFavor)])]),
    ]),
  ]);
}

function ticketCard(ticket) {
  const due = ticket.dueLabel || (ticket.late ? '已延期' : `剩 ${ticket.dueIn} 天`);
  const costText = ticket.mainline
    ? `${ticket.cost} 点${ticket.costNote ? `（${ticket.costNote}）` : ''}`
    : (ticket.costNote ? `${ticket.cost} 点（${ticket.costNote}）` : `${ticket.cost} 点`);
  const penaltyText = ticket.mainline ? '不做完，结局不同' : (ticket.penaltyNote
    ? `-${ticket.penalty}（${ticket.penaltyNote}，否则 -${ticket.fullPenalty}）`
    : `-${ticket.penalty}`);
  const body = [
    el('div', { class: 'ticket-top' }, [
      el('strong', {}, [el('i', { class: `mark ${ticket.kind}` }), ticket.title]),
      el('span', { class: ticket.late ? 'late' : '' }, [due]),
    ]),
    el('p', { class: 'meta' }, [`${ticket.kindLabel} · ${costText}`]),
    el('p', { class: 'nums' }, [
      el('span', { class: 'left' }, [`进度 ${ticket.progress}/${ticket.cost}`]),
      el('span', { class: 'reward' }, [`做完 +${ticket.reward}`]),
      el('span', { class: ticket.late ? 'late' : '' }, [ticket.mainline ? penaltyText : `逾期 ${penaltyText}`]),
    ]),
  ];
  if (ticket.locked) {
    body.push(el('p', { class: 'blocked', 'data-locked': '1' }, ['先学数据库']));
  } else {
    const label = ticket.step > 1 ? `做 · 这次 +${ticket.step}，还差 ${ticket.left} 点` : `做 · 还差 ${ticket.left} 点`;
    const button = el('button', {
      type: 'button',
      'data-action': 'work',
      'data-id': ticket.id,
      'data-cost': ticket.cost,
      'data-penalty': ticket.penalty,
    }, [label]);
    button.addEventListener('click', () => act({ type: 'work', ticketId: ticket.id }));
    body.push(button);
  }
  return el('article', {
    class: ticket.mainline ? 'card mainline' : 'card',
    'data-kind': ticket.kind,
    'data-ticket': ticket.id,
    'data-cost': ticket.cost,
    'data-penalty': ticket.penalty,
    'data-reward': ticket.reward,
    'data-locked': ticket.locked ? '1' : '0',
  }, body);
}

function skillCard(skill) {
  const progress = skill.learned ? '已学会' : `${skill.progress}/${skill.cost}`;
  const body = [
    el('div', { class: 'ticket-top' }, [
      el('strong', {}, [skill.name]),
      el('span', { id: `skill-${skill.id}` }, [progress]),
    ]),
  ];
  if (skill.book) body.push(el('p', { class: 'meta' }, [`《${skill.book}》`]));
  body.push(el('p', { class: 'meta' }, [skill.effect]));
  if (skill.blocked) body.push(el('p', { class: 'blocked', id: `skill-${skill.id}-lock` }, [skill.blocked]));
  if (skill.canStudy) {
    const button = el('button', { type: 'button', 'data-action': 'study', 'data-skill': skill.id }, ['学']);
    button.addEventListener('click', () => act({ type: 'study', skill: skill.id }));
    body.push(button);
  }
  return el('article', { class: 'card', 'data-skill': skill.id, 'data-progress': skill.progress, 'data-learned': skill.learned ? '1' : '0' }, body);
}

function office(view) {
  const spots = view.coworkers.filter(person => person.visible).map(person => {
    const speaking = dialogue && dialogue.person === person.id;
    const button = el('button', { type: 'button', class: 'figure', 'data-person': person.id }, [
      el('i', { class: `body ${person.id}` }),
      el('span', {}, [person.name]),
    ]);
    button.addEventListener('click', () => openPerson(person.id));
    const prop = person.id === 'boss' ? 'table' : (person.id === 'party' ? 'door' : 'desk');
    return el('div', { class: speaking ? 'spot speaking' : 'spot', 'data-spot': person.id }, [
      el('i', { class: 'arrow', 'data-arrow': speaking ? person.id : '' }),
      button,
      el('i', { class: `prop ${prop}` }),
    ]);
  });
  return el('section', { class: view.night ? 'office night' : 'office', id: 'office' }, spots);
}

function dialogueBox(view) {
  if (!dialogue) return null;
  const choices = dialogue.choices.map(choice => {
    const button = el('button', { type: 'button', 'data-choice': choice.id }, [choice.label]);
    if (choice.id === 'accept' && dialogue.person === 'lunch' && view.ap <= 0) button.disabled = true;
    button.addEventListener('click', () => chooseLine(choice.id));
    return button;
  });
  const close = el('button', { type: 'button', 'data-dialogue': 'close' }, ['关上']);
  close.addEventListener('click', () => {
    dialogue = null;
    render();
  });
  const attrs = { class: 'dialogue', id: 'dialogue' };
  if (dialogue.forecast) {
    attrs['data-forecast-title'] = dialogue.forecast.title;
    attrs['data-forecast-kind'] = dialogue.forecast.kind;
    attrs['data-forecast-difficulty'] = dialogue.forecast.difficulty;
    attrs['data-forecast-due'] = dialogue.forecast.dueIn;
  }
  return el('section', attrs, [
    el('div', { class: 'nameplate', id: 'nameplate' }, [dialogue.name]),
    el('p', { id: 'dialogue-text' }, [dialogue.text]),
    el('div', { class: 'dialogue-actions' }, choices.concat(close)),
  ]);
}

function actionBar(view) {
  const bar = el('div', { class: 'actions' });
  if (view.canRest) {
    const rest = el('button', { type: 'button', 'data-action': 'rest' }, ['休息 +2 体力']);
    rest.addEventListener('click', () => act({ type: 'rest' }));
    bar.append(rest);
  }
  const time = el('button', { type: 'button', 'data-action': view.night ? 'day' : 'night' }, [view.night ? '回白天' : '入夜']);
  time.addEventListener('click', () => act({ type: view.night ? 'day' : 'night' }));
  bar.append(time);
  if (view.canSleep) {
    const sleep = el('button', { type: 'button', 'data-action': 'sleep' }, ['睡觉，进入下一天']);
    sleep.addEventListener('click', () => act({ type: 'sleep' }));
    bar.append(sleep);
  }
  return bar;
}

function ending(view) {
  const won = view.phase === 'won';
  const again = el('button', { type: 'button', 'data-action': 'restart' }, ['再来一局']);
  again.addEventListener('click', () => start(view.seed));
  const fresh = el('button', { type: 'button', 'data-action': 'new-seed' }, ['换个种子']);
  fresh.addEventListener('click', () => start(`h${Date.now().toString(36)}`));
  const stats = view.stats;
  return el('section', { class: 'ending', id: 'ending' }, [
    el('h2', {}, [won ? view.victoryTitle : '被劝退']),
    el('p', { id: 'ending-text' }, [won ? `${view.victoryTitle}。${view.victoryText}` : view.failReason]),
    ...(view.settlementLine ? [el('p', { id: 'settlement' }, [view.settlementLine])] : []),
    el('dl', {}, [
      el('dt', {}, ['周次']), el('dd', {}, [`第 ${view.week} 周 ${view.dayName}`]),
      el('dt', {}, ['好感']), el('dd', { id: 'end-favor' }, [String(view.favor)]),
      el('dt', {}, ['本周线']), el('dd', {}, [String(view.line)]),
      el('dt', {}, ['体力']), el('dd', {}, [String(view.stamina)]),
      el('dt', {}, ['做完的单']), el('dd', {}, [String(stats.completed)]),
      el('dt', {}, ['延期与事故']), el('dd', {}, [String(stats.lateCount)]),
      el('dt', {}, ['好感增加']), el('dd', {}, [String(stats.favorGained)]),
      el('dt', {}, ['好感减少']), el('dd', {}, [String(stats.favorLost)]),
      el('dt', {}, [CONFIG.overnightName]), el('dd', {}, [String(stats.overnights)]),
      el('dt', {}, ['学会']), el('dd', {}, [stats.skills.length ? stats.skills.join('、') : '无']),
      el('dt', {}, ['文件数据库']), el('dd', {}, [stats.fileDb]),
    ]),
    el('div', { class: 'actions' }, [again, fresh]),
  ]);
}

function dotaResultTitle(match) {
  if (match.won) return '补刀够了';
  if (match.hp <= 0) return '影魔倒下了';
  if (match.tick >= MATCH_TICKS) return '时间到了';
  return '这局没打完';
}

function dotaLane(match) {
  const sfClass = match.hurt ? 'cell sf hurt' : 'cell sf';
  const cells = [el('div', { class: sfClass, id: 'dota-hp', 'data-hp': match.hp }, ['影魔', String(match.hp)])];
  for (let pos = 1; pos <= 7; pos += 1) {
    const raze = RAZES.find(item => item.distance === pos);
    const hot = match.lastRaze && raze && raze.id === match.lastRaze;
    const creeps = match.creeps.filter(creep => creep.pos === pos);
    const face = pos <= THREAT_POS && creeps.length > 0;
    const body = creeps.map(creep => el('span', { class: 'creep-wrap', 'data-creep': creep.id, 'data-pos': String(pos) }, [
      el('i', { class: 'creep' }),
      creep.name,
    ]));
    if (raze) body.push(el('span', {}, [raze.name]));
    let cellClass = 'cell';
    if (hot) cellClass = 'cell hot';
    else if (face) cellClass = 'cell face';
    cells.push(el('div', { class: cellClass, 'data-cell': pos }, body));
  }
  return el('div', { class: 'lane' }, cells);
}

function dotaOverlay() {
  const match = dota.match;
  if (dota.mode === 'result') {
    const back = el('button', { type: 'button', 'data-dota': 'back' }, ['回到试用期']);
    back.addEventListener('click', () => closeDota());
    const detail = match.won
      ? `补刀 ${match.kills}，体力 +${CONFIG.dotaWinStamina}`
      : `补刀 ${match.kills}/${LAST_HITS}，体力不返还`;
    return el('div', { class: 'dota', id: 'dota' }, [
      el('div', { class: 'dota-panel', 'data-result': match.won ? 'win' : 'loss' }, [
        el('h2', {}, [dotaResultTitle(match)]),
        el('p', { id: 'dota-kills' }, [detail]),
        back,
      ]),
    ]);
  }
  const seconds = Math.max(0, Math.ceil((MATCH_TICKS - match.tick) * TICK_MS / 1000));
  const skip = el('button', { type: 'button', 'data-dota': 'skip' }, ['跳过']);
  skip.addEventListener('click', () => abandonDota());
  const buttons = RAZES.map(raze => {
    const button = el('button', {
      type: 'button',
      'data-dota': raze.id,
      'data-distance': raze.distance,
      disabled: match.cooldown > 0 ? '' : null,
    }, [raze.name]);
    button.addEventListener('click', () => pressRaze(raze.id));
    return button;
  });
  return el('div', { class: 'dota', id: 'dota' }, [
    el('div', { class: 'dota-panel' }, [
      el('div', { class: 'dota-top' }, [
        el('h2', {}, ['打 Dota']),
        el('div', {}, [
          el('strong', { id: 'dota-kills' }, [`补刀 ${match.kills}/${LAST_HITS}`]),
          el('div', {}, [`血 ${match.hp}`]),
          el('div', {}, [`还剩 ${seconds} 秒`]),
        ]),
        skip,
      ]),
      dotaLane(match),
      el('div', { class: 'actions' }, buttons),
    ]),
  ]);
}

function logList(view) {
  return el('ol', { class: 'log' }, view.log.map(line => el('li', {}, [line])));
}

function render() {
  const view = present(state);
  const parts = [header(view), status(view)];
  if (view.phase === 'play') {
    parts.push(office(view));
    parts.push(el('div', { class: 'board' }, [
      el('section', {}, [el('h2', {}, ['需求单']), el('div', { class: 'stack', id: 'tickets' }, view.tickets.map(ticketCard))]),
      el('section', {}, [
        el('h2', {}, ['学习']),
        el('div', { class: 'stack', id: 'skills' }, view.skills.map(skillCard)),
        el('h2', { class: 'shelf-title' }, ['书架']),
        el('div', { class: 'stack', id: 'shelf' }, [skillCard(view.shelf)]),
      ]),
    ]));
    parts.push(actionBar(view));
  } else {
    parts.push(ending(view));
  }
  parts.push(logList(view));
  if (dialogue) parts.push(el('div', { class: 'dialogue-spacer' }));
  const box = dialogueBox(view);
  if (box) parts.push(box);
  if (dota) parts.push(dotaOverlay());
  app.replaceChildren(...parts);
}

window.addEventListener('keydown', event => {
  if (!dota || dota.mode !== 'play' || event.repeat) return;
  const raze = RAZES.find(item => item.key === event.key.toLowerCase());
  if (!raze) return;
  event.preventDefault();
  pressRaze(raze.id);
});

render();

window.hefei = {
  present() { return present(state); },
  act(action) { act(action); return present(state); },
  start,
};
