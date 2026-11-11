import { castRaze, createMatch, LAST_HITS, MATCH_TICKS, RAZES, THREAT_POS, tickMatch, TICK_MS } from '../dota.mjs';
import { CONFIG, applyAction, createGame, present } from './rules.mjs';

const app = document.querySelector('#app');

function readSeed() {
  const value = new URLSearchParams(location.search).get('seed');
  return value ? value.slice(0, 64) : 'nanjing';
}

let state = createGame(readSeed());
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

function pct(value) {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${text}%`;
}

function pips(filled, total) {
  const wrap = el('span', { class: 'pips', 'aria-hidden': 'true' });
  for (let i = 0; i < total; i += 1) wrap.append(el('i', { class: i < filled ? 'pip on' : 'pip' }));
  return wrap;
}

function act(action) {
  state = applyAction(state, action);
  render();
}

function start(seed) {
  const next = String(seed || '').trim().slice(0, 64) || 'nanjing';
  const url = new URL(location.href);
  url.searchParams.set('seed', next);
  history.replaceState(null, '', url);
  clearDotaTimers();
  dota = null;
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
      el('h1', {}, ['南京上线']),
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
      el('div', {}, ['日活']),
      el('strong', { id: 'dau' }, [String(view.dau)]),
      el('div', {}, ['本周目标 ', el('strong', { id: 'dau-target' }, [String(view.dauTarget)])]),
    ]),
    el('article', {}, [
      el('div', {}, ['口碑']),
      el('strong', { id: 'rep' }, [String(view.reputation)]),
      el('div', {}, [
      '周五线 ',
      el('strong', { id: 'rep-line' }, [String(view.reputationLine)]),
      ' · 好结局 ',
      el('strong', { id: 'good-line' }, [String(view.goodReputation)]),
    ]),
    ]),
    el('article', {}, [
      el('div', {}, ['创始人约谈']),
      el('strong', { id: 'talks' }, [`${view.talks}/${view.talksToFail}`]),
    ]),
  ]);
}

function chanceBanner(view) {
  const last = view.lastShip;
  let text = '上线事故概率：还没上过线';
  if (last) {
    const change = last.from === last.to ? pct(last.to) : `${pct(last.from)} → ${pct(last.to)}`;
    text = `${last.title} · 事故概率 ${change} · 日活 +${last.dau}`;
    if (last.extra) text += `（催上线多 ${last.extra}）`;
    if (last.canary) text += ' · 灰度，损失减半';
    text += last.incident ? ` · 炸了：${last.incident}，口碑 -${last.incidentLoss}` : ' · 没炸';
  }
  return el('p', { class: 'banner', id: 'chance-banner', 'data-from': last ? last.from : '', 'data-to': last ? last.to : '' }, [text]);
}

function people(view) {
  return el('div', { class: 'people', id: 'people' }, view.colleagues.map(person => {
    const button = el('button', { type: 'button', class: `person ${person.id}`, 'data-person': person.id }, [
      el('i', { class: 'sq' }),
      person.name,
    ]);
    if (person.id === 'pm' && view.pm) button.append(el('span', { class: 'badge' }, ['催上线']));
    if (person.id === 'boss' && view.boss.active) button.append(el('span', { class: 'badge', id: 'boss-nag' }, ['好了没']));
    if (person.id === 'mod' && view.week === 4 && view.day === 1) button.append(el('span', { class: 'badge' }, ['登录卡']));
    button.addEventListener('click', () => act({ type: 'talk', person: person.id }));
    return button;
  }));
}

function bossCard(view) {
  const boss = view.boss;
  if (!boss.active) return null;
  const body = [
    el('h2', {}, ['首页登不上']),
    el('p', { id: 'boss-pressure' }, [
      boss.bleed ? `管事的创始人站在后面：好了没。口碑每个行动点 -${boss.perAp}，现在 ${view.reputation}。` : '血先止住了。管事的创始人还在后面：好了没。',
    ]),
  ];
  const buttons = boss.choices.map(choice => {
    const button = el('button', { type: 'button', 'data-action': 'boss', 'data-option': choice.id }, [choice.label]);
    button.addEventListener('click', () => act({ type: 'boss', option: choice.id }));
    return button;
  });
  body.push(el('div', { class: 'actions' }, buttons));
  return el('section', { class: 'boss-card', id: 'boss-card' }, body);
}

function incidentCard(view, incident) {
  const stageLabel = incident.stage === 'resolved' ? '已处理' : incident.stage === 'located' ? '已定位' : '未处理';
  const meta = incident.stage === 'resolved'
    ? '可以复盘。复盘后，这类事故不再发生。'
    : `每天口碑 -${incident.daily}${incident.count > 1 ? ` · ${incident.count} 张一起炸` : ''}`;
  const body = [
    el('div', { class: 'ticket-top' }, [
      el('strong', {}, [incident.title]),
      el('span', { class: incident.stage === 'resolved' ? '' : 'late' }, [stageLabel]),
    ]),
    el('p', { class: 'meta' }, [meta]),
  ];
  const actions = el('div', { class: 'actions' });
  if (incident.stage === 'open') {
    const locate = el('button', { type: 'button', 'data-action': 'locate', 'data-id': incident.id }, ['定位']);
    locate.addEventListener('click', () => act({ type: 'locate', incidentId: incident.id }));
    actions.append(locate);
  }
  if (incident.stage === 'located') {
    const fix = el('button', { type: 'button', 'data-action': 'fix', 'data-id': incident.id }, ['修复']);
    fix.addEventListener('click', () => act({ type: 'fix', incidentId: incident.id }));
    actions.append(fix);
  }
  if (incident.canRollback) {
    const back = el('button', { type: 'button', 'data-action': 'rollback', 'data-id': incident.id }, ['回滚止血']);
    back.addEventListener('click', () => act({ type: 'rollback', incidentId: incident.id }));
    actions.append(back);
  } else if (incident.stage !== 'resolved') {
    actions.append(el('p', { class: 'blocked' }, ['还不会回滚，只能定位再修复']));
  }
  if (incident.stage === 'resolved') {
    const review = el('button', { type: 'button', 'data-action': 'review', 'data-target': incident.id }, ['复盘']);
    review.addEventListener('click', () => act({ type: 'review', target: incident.id }));
    actions.append(review);
  }
  body.push(actions);
  return el('article', { class: 'card', 'data-incident': incident.id }, body);
}

function ticketCard(view, ticket) {
  const due = ticket.late ? '已延期' : `剩 ${ticket.dueIn} 天`;
  const costText = ticket.costNote ? `${ticket.cost} 点（${ticket.costNote}）` : `${ticket.cost} 点`;
  const body = [
    el('div', { class: 'ticket-top' }, [
      el('strong', {}, [el('i', { class: `mark ${ticket.kind}` }), ticket.title]),
      el('span', { class: ticket.late ? 'late' : '' }, [due]),
    ]),
    el('p', { class: 'meta' }, [`${ticket.kindLabel} · ${ticket.status === 'ready' ? '待上线' : '在做'} · ${costText}`]),
  ];
  if (ticket.status === 'build') {
    body.push(el('p', { class: 'nums' }, [el('span', { class: 'left' }, [`进度 ${ticket.progress}/${ticket.cost}`])]));
    const button = el('button', { type: 'button', 'data-action': 'work', 'data-id': ticket.id }, [`做 · 还差 ${ticket.left} 点`]);
    button.addEventListener('click', () => act({ type: 'work', ticketId: ticket.id }));
    body.push(button);
  } else {
    const tested = ticket.tested ? '已补测试 · ' : '';
    body.push(el('p', { class: 'nums' }, [
      el('span', { class: 'prob', 'data-chance': ticket.chance }, [`${tested}事故概率 ${ticket.chanceText}`]),
      el('span', {}, [`出事口碑 -${ticket.damage}${view.canCanary ? `，灰度 -${ticket.damageCanary}` : ''}`]),
      el('span', { class: 'reward' }, [`日活 +${ticket.dau}`]),
    ]));
    const actions = el('div', { class: 'actions' });
    if (!ticket.tested) {
      const test = el('button', { type: 'button', 'data-action': 'test', 'data-id': ticket.id }, [`补测试 · 事故概率 ${ticket.testedChanceText}`]);
      test.addEventListener('click', () => act({ type: 'test', ticketId: ticket.id }));
      actions.append(test);
    }
    const ship = el('button', {
      type: 'button',
      'data-action': 'ship',
      'data-id': ticket.id,
      'data-canary': '0',
    }, [`上线 · 事故概率 ${ticket.chanceText}`]);
    ship.addEventListener('click', () => act({ type: 'ship', ticketIds: [ticket.id], canary: false }));
    actions.append(ship);
    if (view.canCanary) {
      const soft = el('button', {
        type: 'button',
        'data-action': 'ship',
        'data-id': ticket.id,
        'data-canary': '1',
      }, [`灰度上线 · 事故概率 ${ticket.chanceText} · 损失 -${ticket.damageCanary}`]);
      soft.addEventListener('click', () => act({ type: 'ship', ticketIds: [ticket.id], canary: true }));
      actions.append(soft);
    }
    body.push(actions);
  }
  return el('article', { class: 'card', 'data-ticket': ticket.id, 'data-status': ticket.status }, body);
}

function skillCard(skill) {
  const progress = skill.learned ? '已学会' : (skill.canStudy || skill.progress ? `${skill.progress}/${skill.cost}` : '未学');
  const body = [
    el('div', { class: 'ticket-top' }, [
      el('strong', {}, [skill.name]),
      el('span', { id: `skill-${skill.id}` }, [skill.learned ? '已学会' : progress]),
    ]),
    el('p', { class: 'meta' }, [skill.effect]),
  ];
  if (skill.blocked) body.push(el('p', { class: 'blocked' }, [skill.blocked]));
  if (skill.canStudy) {
    const button = el('button', { type: 'button', 'data-action': 'study', 'data-skill': skill.id }, ['学']);
    button.addEventListener('click', () => act({ type: 'study', skill: skill.id }));
    body.push(button);
  }
  return el('article', { class: 'card', 'data-skill': skill.id, 'data-learned': skill.learned ? '1' : '0' }, body);
}

function failureCard(skill) {
  return el('article', { class: 'card', 'data-skill': 'failure', 'data-learned': skill.learned ? '1' : '0' }, [
    el('div', { class: 'ticket-top' }, [
      el('strong', {}, [skill.name]),
      el('span', {}, [skill.learned ? '已学会' : '未获得']),
    ]),
    el('p', { class: 'meta' }, [skill.effect]),
    skill.blocked ? el('p', { class: 'blocked' }, [skill.blocked]) : '',
  ].filter(Boolean));
}

function actionBar(view) {
  const bar = el('div', { class: 'actions' });
  if (view.batch) {
    const batch = el('button', {
      type: 'button',
      'data-action': 'ship-batch',
      'data-canary': '0',
    }, [`一起上线 ${view.batch.ids.length} 张 · 事故概率 ${view.batch.chanceText} · 出事一起炸，口碑 -${view.batch.damage}`]);
    batch.addEventListener('click', () => act({ type: 'ship', ticketIds: view.batch.ids, canary: false }));
    bar.append(batch);
    if (view.canCanary) {
      const soft = el('button', {
        type: 'button',
        'data-action': 'ship-batch',
        'data-canary': '1',
      }, [`一起灰度 ${view.batch.ids.length} 张 · 事故概率 ${view.batch.chanceText} · 损失 -${view.batch.damageCanary}`]);
      soft.addEventListener('click', () => act({ type: 'ship', ticketIds: view.batch.ids, canary: true }));
      bar.append(soft);
    }
  }
  if (view.boss.resolved && !view.boss.reviewed) {
    const review = el('button', { type: 'button', 'data-action': 'review', 'data-target': 'boss' }, ['复盘首页登不上']);
    review.addEventListener('click', () => act({ type: 'review', target: 'boss' }));
    bar.append(review);
  }
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

function dialogue(view) {
  if (!view.dialogue) return null;
  const person = view.colleagues.find(item => item.id === view.dialogue.person);
  if (!person) return null;
  const body = [
    el('p', { class: 'who' }, [person.name]),
    ...person.lines.map(line => el('p', {}, [line])),
  ];
  const choices = el('div', { class: 'actions' });
  if (person.id === 'pm' && view.pm) {
    const yes = el('button', { type: 'button', 'data-action': 'pm-yes' }, ['答应上线']);
    yes.addEventListener('click', () => act({ type: 'pm-yes' }));
    choices.append(yes);
  }
  const close = el('button', { type: 'button', 'data-action': 'close' }, ['先这样']);
  close.addEventListener('click', () => act({ type: 'close' }));
  choices.append(close);
  body.push(choices);
  return el('section', { class: 'talk', id: 'talk', 'data-person': person.id }, body);
}

function ending(view) {
  const won = view.phase === 'won';
  const again = el('button', { type: 'button', 'data-action': 'restart' }, ['再来一局']);
  again.addEventListener('click', () => start(view.seed));
  const fresh = el('button', { type: 'button', 'data-action': 'new-seed' }, ['换个种子']);
  fresh.addEventListener('click', () => start(`n${Date.now().toString(36)}`));
  const skills = view.skills.filter(skill => skill.learned).map(skill => skill.name);
  if (view.failureSkill.learned) skills.push(view.failureSkill.name);
  const blocks = [
    el('h2', {}, [won ? view.victoryTitle : '被创始人约谈两次']),
    el('p', { id: 'ending-text' }, [won ? `${view.victoryTitle}。${view.victoryText}` : view.failReason]),
  ];
  if (view.reactText) blocks.push(el('p', { id: 'to-hangzhou' }, [view.reactText]));
  blocks.push(el('dl', {}, [
    el('dt', {}, ['周次']), el('dd', {}, [`第 ${view.week} 周 ${view.dayName}`]),
    el('dt', {}, ['日活']), el('dd', {}, [`${view.dau} / 目标 ${view.dauTarget}`]),
    el('dt', {}, ['口碑']), el('dd', {}, [String(view.reputation)]),
    el('dt', {}, ['创始人约谈']), el('dd', {}, [`${view.talks}/${view.talksToFail}`]),
    el('dt', {}, ['上线']), el('dd', {}, [String(view.stats.shipped)]),
    el('dt', {}, ['事故']), el('dd', {}, [String(view.stats.incidents)]),
    el('dt', {}, ['延期']), el('dd', {}, [String(view.stats.lateCount)]),
    el('dt', {}, ['学会']), el('dd', {}, [skills.length ? skills.join('、') : '无']),
    el('dt', {}, ['首页']), el('dd', {}, [view.bossReviewed ? '查完并复盘' : (view.bossResolved ? '查完，没复盘' : '没查完')]),
  ]));
  blocks.push(el('div', { class: 'actions' }, [again, fresh]));
  return el('section', { class: 'ending', id: 'ending' }, blocks);
}

function dotaResultTitle(match) {
  if (match.won) return '补刀够了';
  if (match.hp <= 0) return '影魔倒下了';
  if (match.tick >= MATCH_TICKS) return '时间到了';
  return '这局没打完';
}

function dotaLane(match) {
  const cells = [el('div', { class: match.hurt ? 'cell sf hurt' : 'cell sf', id: 'dota-hp', 'data-hp': match.hp }, ['影魔', String(match.hp)])];
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
    const back = el('button', { type: 'button', 'data-dota': 'back' }, ['回到南京']);
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

function render() {
  const view = present(state);
  const parts = [header(view), status(view), chanceBanner(view)];
  if (view.phase === 'play') {
    const boss = bossCard(view);
    if (boss) parts.push(boss);
    parts.push(people(view));
    const tickets = view.incidents.map(incident => incidentCard(view, incident)).concat(view.tickets.map(ticket => ticketCard(view, ticket)));
    if (!tickets.length) tickets.push(el('p', { class: 'meta' }, ['今天没有单。']));
    parts.push(el('div', { class: 'board' }, [
      el('section', {}, [el('h2', {}, ['需求单']), el('div', { class: 'stack', id: 'tickets' }, tickets)]),
      el('section', {}, [
        el('h2', {}, ['学习']),
        el('div', { class: 'stack', id: 'skills' }, view.skills.map(skillCard).concat(failureCard(view.failureSkill))),
      ]),
    ]));
    parts.push(actionBar(view));
  } else {
    parts.push(ending(view));
  }
  parts.push(el('ol', { class: 'log', id: 'log' }, view.log.map(line => el('li', {}, [line]))));
  const talk = view.phase === 'play' ? dialogue(view) : null;
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

window.nanjing = {
  present() { return present(state); },
  act(action) { act(action); return present(state); },
  start,
};
