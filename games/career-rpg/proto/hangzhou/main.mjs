import { castRaze, createMatch, LAST_HITS, MATCH_TICKS, RAZES, THREAT_POS, tickMatch, TICK_MS } from '../dota.mjs';
import { CONFIG, applyAction, createGame, present } from './rules.mjs';

const app = document.querySelector('#app');

function readSeed() {
  const value = new URLSearchParams(location.search).get('seed');
  return value ? value.slice(0, 64) : 'hangzhou';
}

let state = createGame(readSeed());
let talkWho = null;
let dota = null;
let dotaTick = 0;
let dotaResult = 0;

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

function openDota() {
  if (dota) return;
  const next = applyAction(state, { type: 'overnight' });
  if (next === state) return;
  state = next;
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
  const count = Math.max(total, filled);
  for (let i = 0; i < count; i += 1) wrap.append(el('i', { class: i < filled ? 'pip on' : 'pip' }));
  return wrap;
}

function act(action) {
  state = applyAction(state, action);
  render();
}

function start(seed) {
  const next = String(seed || '').trim().slice(0, 64) || 'hangzhou';
  const url = new URL(location.href);
  url.searchParams.set('seed', next);
  history.replaceState(null, '', url);
  clearDotaTimers();
  dota = null;
  talkWho = null;
  state = createGame(next);
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
      el('h1', {}, ['杭州 · 商品发布']),
      el('p', { class: 'when', id: 'when' }, [`第 ${view.week} 周 · ${view.dayName}`]),
    ]),
    form,
  ]);
}

function status(view) {
  const apMax = Math.max(view.ap, CONFIG.dailyAp);
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
      el('div', {}, ['交付']),
      el('strong', { id: 'delivery' }, [String(view.delivery)]),
      el('div', {}, ['本周线 ', el('strong', { id: 'line' }, [String(view.line)])]),
      el('div', { id: 'complaints' }, [`投诉 ${view.complaints}/${view.complaintLimit}`]),
    ]),
    el('article', {}, [
      el('div', {}, ['技术债']),
      el('strong', { id: 'debt', 'data-surcharge': view.surcharge }, [String(view.debt)]),
      el('div', { id: 'surcharge', class: view.surcharge ? 'surcharge' : '' }, [
        view.surcharge ? `所有单子 +${view.surcharge} 点` : '未满 25，不加价',
      ]),
    ]),
  ]);
}

function peopleRow(view) {
  return el('section', { class: 'people', id: 'people' }, view.colleagues.map(person => {
    const button = el('button', {
      type: 'button',
      'data-colleague': person.who,
      'data-talked': person.talked ? '1' : '0',
    }, [el('i', { class: `person ${person.who}` }), person.name]);
    button.addEventListener('click', () => {
      talkWho = person.who;
      render();
    });
    return button;
  }));
}

function talkBar(view) {
  if (view.crowd) {
    const close = el('button', { type: 'button', 'data-talk': 'crowd' }, ['先看白板']);
    close.addEventListener('click', () => {
      talkWho = null;
      act({ type: 'crowd' });
    });
    return el('aside', { class: 'talk', id: 'talk' }, [
      el('strong', {}, ['四个人围过来']),
      ...view.crowdLines.map(item => el('p', {}, [`${item.name}：${item.line}`])),
      close,
    ]);
  }
  if (!talkWho) return null;
  const person = view.colleagues.find(item => item.who === talkWho);
  if (!person) return null;
  const close = el('button', { type: 'button', 'data-talk': 'close' }, ['先这样']);
  close.addEventListener('click', () => {
    if (!person.talked) act({ type: 'talk', who: person.who });
    talkWho = null;
    render();
  });
  const buttons = [];
  if (!person.talked && person.canExtend) {
    for (const ticket of view.extendable) {
      const button = el('button', {
        type: 'button',
        'data-action': 'extend',
        'data-id': ticket.id,
      }, [`${ticket.title} · 剩 ${ticket.dueIn} 天 · 期限 +1`]);
      button.addEventListener('click', () => act({ type: 'extend', ticketId: ticket.id }));
      buttons.push(button);
    }
  }
  if (!person.talked && person.canTeach) {
    const button = el('button', { type: 'button', 'data-action': 'teach' }, ['教她 · 1 点 · 技术债 -4']);
    button.addEventListener('click', () => act({ type: 'teach' }));
    buttons.push(button);
  }
  if (!person.talked && person.canTea) {
    const button = el('button', { type: 'button', 'data-action': 'talk', 'data-who': 'tea' }, ['喝一杯 · 体力 +1']);
    button.addEventListener('click', () => act({ type: 'talk', who: 'tea' }));
    buttons.push(button);
  }
  if (!person.talked && person.who === 'neighbor' && person.chats < 3) {
    const button = el('button', { type: 'button', 'data-action': 'talk', 'data-who': 'neighbor' }, [`听一句 · ${person.chats}/3`]);
    button.addEventListener('click', () => act({ type: 'talk', who: 'neighbor' }));
    buttons.push(button);
  }
  buttons.push(close);
  return el('aside', { class: 'talk', id: 'talk' }, [
    el('strong', {}, [person.name]),
    el('p', { id: 'talk-line' }, [person.talked ? view.log[0] : person.line]),
    el('div', { class: 'actions' }, buttons),
  ]);
}

function debtBanner(view) {
  const text = view.surcharge
    ? `技术债 ${view.debt}，所有单子 +${view.surcharge} 点`
    : `技术债 ${view.debt}，满 25 后所有单子加价`;
  return el('p', { class: 'debt-banner', id: 'debt-banner', 'data-surcharge': view.surcharge }, [text]);
}

function whiteboard(view) {
  const slots = view.whiteboard.map(slot => el('article', {
    class: `slot ${slot.status === 'open' && slot.covered ? 'covered' : ''} ${slot.status === 'open' && !slot.covered ? 'hard' : ''} ${slot.status === 'done' ? 'done' : ''}`,
    'data-slot': slot.field,
    'data-cost': slot.cost,
    'data-surcharge': slot.surcharge,
    'data-status': slot.status,
    'data-label': slot.label,
  }, [
    el('strong', {}, [el('i', { class: `mark ${slot.field}` }), slot.lineName]),
    el('div', {}, [slot.example]),
    el('p', { class: 'label' }, [slot.status === 'open' && slot.surcharge > 0
      ? `${slot.covered ? '模块' : '硬写'} ${slot.base} + 技术债 ${slot.surcharge} = ${slot.cost} 点`
      : slot.label]),
    slot.status === 'open' ? el('div', {}, [`进度 ${slot.progress}/${slot.cost}`]) : '',
  ]));
  return el('section', { id: 'whiteboard' }, [
    el('h2', {}, ['白板']),
    debtBanner(view),
    el('div', { class: 'slots' }, slots),
  ]);
}

function ticketCard(ticket) {
  const due = ticket.late ? '已延期' : `剩 ${ticket.dueIn} 天`;
  const body = [
    el('div', { class: 'ticket-top' }, [
      el('strong', {}, [el('i', { class: `mark ${ticket.field}` }), ticket.title]),
      el('span', { class: ticket.late ? 'late' : '' }, [due]),
    ]),
    el('p', { class: 'meta' }, [`${ticket.lineName} · ${ticket.fieldName}${ticket.boss ? ' · 大单' : ''}`]),
    el('p', { class: 'nums' }, [
      el('span', { class: 'left' }, [ticket.label]),
      el('span', {}, [`进度 ${ticket.progress}/${ticket.cost}`]),
      el('span', { class: 'reward' }, [ticket.late ? '延期不加分' : `按期 +${ticket.reward}`]),
      el('span', { class: ticket.late ? 'late' : '' }, [`逾期 -${ticket.penalty}`]),
    ]),
  ];
  if (ticket.canWork) {
    const button = el('button', {
      type: 'button',
      'data-action': 'work',
      'data-id': ticket.id,
      'data-cost': ticket.cost,
    }, [`做 · 还差 ${ticket.left} 点`]);
    button.addEventListener('click', () => act({ type: 'work', ticketId: ticket.id }));
    body.push(button);
  } else if (ticket.left > 0) {
    body.push(el('p', { class: 'blocked' }, ['夜里只能学技能']));
  }
  return el('article', {
    class: ticket.boss ? 'card boss' : 'card',
    'data-ticket': ticket.id,
    'data-field': ticket.field,
    'data-cost': ticket.cost,
    'data-base': ticket.base,
    'data-surcharge': ticket.surcharge,
    'data-covered': ticket.covered ? '1' : '0',
    'data-boss': ticket.boss ? '1' : '0',
  }, body);
}

function skillCard(skill) {
  const progress = skill.learned ? '已学会' : (skill.cost ? `${skill.progress}/${skill.cost}` : '未获得');
  const body = [
    el('div', { class: 'ticket-top' }, [
      el('strong', {}, [skill.name]),
      el('span', { id: `skill-${skill.id}` }, [progress]),
    ]),
    el('p', { class: 'meta' }, [skill.effect]),
  ];
  if (skill.blocked) body.push(el('p', { class: 'blocked', id: `skill-${skill.id}-lock` }, [skill.blocked]));
  if (skill.canStudy) {
    const button = el('button', { type: 'button', 'data-action': 'study', 'data-skill': skill.id }, ['学']);
    button.addEventListener('click', () => act({ type: 'study', skill: skill.id }));
    body.push(button);
  }
  return el('article', {
    class: 'card',
    'data-skill': skill.id,
    'data-progress': skill.progress,
    'data-learned': skill.learned ? '1' : '0',
  }, body);
}

function modulePanel(view) {
  const owned = view.modules.map(mod => {
    const body = [
      el('strong', {}, [el('i', { class: `mark ${mod.id}` }), `${mod.name} 模块`]),
      el('p', { class: 'meta' }, [view.skills.find(skill => skill.id === 'webpack')?.learned ? `也覆盖${mod.similar}` : `相近：${mod.similar}`]),
    ];
    if (mod.canPlace) {
      const button = el('button', { type: 'button', 'data-action': 'place', 'data-field': mod.id }, ['拼上白板']);
      button.addEventListener('click', () => act({ type: 'place', field: mod.id }));
      body.push(button);
    } else if (mod.placed) {
      body.push(el('p', { class: 'meta' }, ['已拼上白板']));
    }
    return el('article', { class: 'card', 'data-module': mod.id, 'data-placed': mod.placed ? '1' : '0' }, body);
  });
  const extracts = view.extract.map(item => {
    const body = [
      el('strong', {}, [`抽 ${item.name}`]),
      el('p', { class: 'meta' }, [`相近：${item.similar} · ${item.progress}/${item.cost}`]),
    ];
    if (item.canExtract) {
      const button = el('button', { type: 'button', 'data-action': 'extract', 'data-field': item.id }, [`抽 · 还差 ${item.cost - item.progress} 点`]);
      button.addEventListener('click', () => act({ type: 'extract', field: item.id }));
      body.push(button);
    }
    return el('article', { class: 'card', 'data-extract': item.id }, body);
  });
  return el('section', {}, [
    el('h2', {}, ['模块']),
    el('div', { class: 'stack', id: 'modules' }, owned.length ? owned : [el('p', { class: 'meta' }, ['还没有通用模块'])]),
    extracts.length ? el('div', { class: 'stack', id: 'extracts' }, extracts) : '',
    el('h2', { class: 'shelf-title' }, ['学习']),
    el('div', { class: 'stack', id: 'skills' }, view.skills.map(skillCard)),
  ]);
}

function actionBar(view) {
  const bar = el('div', { class: 'actions' });
  if (view.canRest) {
    const rest = el('button', { type: 'button', 'data-action': 'rest' }, [`休息 +${CONFIG.restStamina} 体力`]);
    rest.addEventListener('click', () => act({ type: 'rest' }));
    bar.append(rest);
  }
  if (view.canOvernight) {
    const night = el('button', { type: 'button', 'data-action': 'overnight' }, [`${CONFIG.overnightName} +${CONFIG.overnightAp} 点 / -${CONFIG.overnightStaminaCost} 体力，赢了 +${CONFIG.dotaWinStamina}`]);
    night.addEventListener('click', () => openDota());
    bar.append(night);
  }
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
  return el('section', { class: 'ending', id: 'ending', 'data-ending': view.ending || 'lost' }, [
    el('h2', {}, [won ? view.victoryTitle : '被业务方投诉']),
    el('p', { id: 'ending-text' }, [won ? `${view.victoryTitle}。${view.victoryText}` : view.failReason]),
    el('dl', {}, [
      el('dt', {}, ['周次']), el('dd', {}, [`第 ${view.week} 周 ${view.dayName}`]),
      el('dt', {}, ['交付']), el('dd', { id: 'end-delivery' }, [String(view.delivery)]),
      el('dt', {}, ['本周线']), el('dd', {}, [String(view.line)]),
      el('dt', {}, ['技术债']), el('dd', { id: 'end-debt' }, [String(view.debt)]),
      el('dt', {}, ['投诉']), el('dd', {}, [`${view.complaints}/${view.complaintLimit}`]),
      el('dt', {}, ['体力']), el('dd', {}, [String(view.stamina)]),
      el('dt', {}, ['做完的单']), el('dd', {}, [String(stats.completed)]),
      el('dt', {}, ['按期']), el('dd', {}, [String(stats.onTime)]),
      el('dt', {}, ['延期']), el('dd', {}, [String(stats.lateCount)]),
      el('dt', {}, ['硬写']), el('dd', {}, [String(stats.hardCompletes)]),
      el('dt', {}, ['用模块']), el('dd', {}, [String(stats.moduleCompletes)]),
      el('dt', {}, ['模块']), el('dd', {}, [stats.modules.length ? stats.modules.join('、') : '无']),
      el('dt', {}, ['学会']), el('dd', {}, [stats.skills.length ? stats.skills.join('、') : '无']),
      el('dt', {}, ['Boss 按期']), el('dd', {}, [`${stats.bossOnTime}/5`]),
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
    const back = el('button', { type: 'button', 'data-dota': 'back' }, ['回到当天']);
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
  return el('ol', { class: 'log', id: 'log' }, view.log.map(line => el('li', {}, [line])));
}

function render() {
  const view = present(state);
  const parts = [header(view), status(view)];
  if (view.phase === 'play') {
    parts.push(peopleRow(view));
    if (view.nightLock) parts.push(el('p', { class: 'night', id: 'night-lock' }, [view.nightLock]));
    if (view.forecast) parts.push(el('p', { class: 'forecast', id: 'forecast' }, [`下一周字段：${view.forecastText}`]));
    if (view.bossOn) parts.push(whiteboard(view));
    else parts.push(debtBanner(view));
    const tickets = view.tickets.length
      ? view.tickets.map(ticketCard)
      : [el('p', { class: 'meta' }, ['没有待做的单'])];
    parts.push(el('div', { class: 'board' }, [
      el('section', {}, [el('h2', {}, ['需求单']), el('div', { class: 'stack', id: 'tickets' }, tickets)]),
      modulePanel(view),
    ]));
    parts.push(actionBar(view));
  } else {
    parts.push(ending(view));
  }
  parts.push(logList(view));
  const talk = talkBar(view);
  if (talk) parts.push(talk);
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

window.hangzhou = {
  present() { return present(state); },
  act(action) {
    if (action?.type === 'overnight') openDota();
    else if (action?.type === 'dota') {
      if (dota?.mode === 'play') {
        dota = { ...dota, match: { ...dota.match, over: true, won: action.won === true } };
        showDotaResult();
      }
    } else act(action);
    return present(state);
  },
  start,
};
