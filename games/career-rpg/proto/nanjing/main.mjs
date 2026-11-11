import { castRaze, createMatch, LAST_HITS, MATCH_TICKS, RAZES, THREAT_POS, tickMatch, TICK_MS } from '../dota.mjs';
import { CONFIG, applyAction, createGame, present } from './rules.mjs';
import { bindWalk, clickGround, drawScene, hotspots, loadArt, sceneMode, startWalk } from './scene.mjs';

// 学习卡上的短字是界面里已有的效果句。悬停展开的原文取自 README 的技能条。
const SKILL_SOURCE = {
  fibjs: 'fibjs / Node.js 全栈：前后台各类单子少 1 点。',
  ci: '集成测试（CI/CD）：给单子补测试，上线事故概率减半。',
  release: '敬畏上线（灰度、观测、回滚）：解锁灰度上线和一键回滚，Boss 关排查少一半选项。',
  react: 'React / Webpack（章末钩子）：第 4 周起才能学，学会后结局多一句引出下一章「去阿里」。',
  failure: '从失败中学习：只能在事故复盘后获得；之后同类事故不再发生。',
};

const app = document.querySelector('#app');

function readSeed() {
  const value = new URLSearchParams(location.search).get('seed');
  return value ? value.slice(0, 64) : 'nanjing';
}

let state = createGame(readSeed());
let dota = null;
let dotaTick = 0;
let dotaResult = 0;
let deskPage = null;
let doorChoice = false;

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

function playDota() {
  if (dota || !state.dotaPending) return;
  deskPage = null;
  doorChoice = false;
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
  deskPage = null;
  doorChoice = false;
  state = createGame(next);
  render();
}

function seedBar(view) {
  const form = el('form', { id: 'seed-form' }, [
    el('label', { for: 'seed-input' }, ['种子']),
    el('input', { id: 'seed-input', name: 'seed', value: view.seed, autocomplete: 'off', maxlength: '64' }),
    el('button', { type: 'submit' }, ['开局']),
  ]);
  form.addEventListener('submit', event => {
    event.preventDefault();
    start(form.seed.value);
  });
  return form;
}

function meter(view) {
  return el('div', { class: 'meter' }, [
    el('span', { id: 'when' }, [`第 ${view.week} 周 ${view.dayName}`]),
    el('span', {}, ['行动 ', el('strong', { id: 'ap' }, [String(view.ap)])]),
    el('span', {}, ['体力 ', el('strong', { id: 'stamina' }, [String(view.stamina)]), '/', String(view.staminaMax)]),
    el('span', {}, ['日活 ', el('strong', { id: 'dau' }, [String(view.dau)]), '/', el('strong', { id: 'dau-target' }, [String(view.dauTarget)])]),
    el('span', {}, [
      '口碑 ',
      el('strong', { id: 'rep' }, [String(view.reputation)]),
      ' 线 ',
      el('strong', { id: 'rep-line' }, [String(view.reputationLine)]),
      ' 好 ',
      el('strong', { id: 'good-line' }, [String(view.goodReputation)]),
    ]),
    el('span', {}, ['约谈 ', el('strong', { id: 'talks' }, [`${view.talks}/${view.talksToFail}`])]),
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
  return el('p', { class: 'ribbon', id: 'chance-banner', 'data-from': last ? last.from : '', 'data-to': last ? last.to : '' }, [text]);
}

function incidentRibbon(view) {
  const open = view.incidents.filter(item => item.stage !== 'resolved');
  if (!open.length) return null;
  const daily = open[0].daily;
  return el('p', { class: 'ribbon', id: 'incident-banner' }, [
    `事故还在：${open.map(item => item.title).join('、')}。每天口碑 -${daily}`,
  ]);
}

function spotStyle(spot) {
  return `left:${(spot.x / 384) * 100}%;top:${(spot.y / 216) * 100}%;width:${(spot.w / 384) * 100}%;height:${(spot.h / 216) * 100}%`;
}

function sceneStage(view) {
  const mode = sceneMode(view);
  const canvas = el('canvas', { id: 'scene', width: '384', height: '216' });
  canvas.addEventListener('click', event => {
    const box = canvas.getBoundingClientRect();
    const x = ((event.clientX - box.left) * canvas.width) / box.width;
    const y = ((event.clientY - box.top) * canvas.height) / box.height;
    clickGround(x, y, mode);
  });
  const stage = el('div', { class: 'stage', id: 'stage', 'data-scene': mode }, [canvas]);
  const here = new Set();
  for (const spot of hotspots(mode)) {
    if (spot.person) here.add(spot.person);
    const speaking = spot.person && view.dialogue?.person === spot.person;
    const attrs = {
      type: 'button',
      class: speaking ? 'hotspot speaking' : 'hotspot',
      'aria-label': spot.name,
      'data-target': spot.id,
      style: spotStyle(spot),
    };
    if (spot.person) attrs['data-person'] = spot.person;
    const button = el('button', attrs, spot.id === 'door' ? ['门'] : []);
    button.addEventListener('click', event => {
      event.stopPropagation();
      startWalk(spot.id, mode);
    });
    stage.append(button);
  }
  if (mode === 'boss') stage.append(el('p', { class: 'nag', id: 'boss-nag' }, ['好了没']));
  const talk = dialogue(view);
  if (talk) stage.append(talk);
  return { stage, here };
}

function offstage(view, here) {
  const missing = view.colleagues.filter(person => !here.has(person.id));
  if (!missing.length) return null;
  return el('div', { class: 'offstage', id: 'people' }, missing.map(person => {
    const button = el('button', { type: 'button', class: 'offstage-person', 'data-person': person.id }, [person.name]);
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
    el('p', { class: 'meta skill-short' }, [skill.effect]),
    el('p', { class: 'skill-full' }, [SKILL_SOURCE[skill.id]]),
  ];
  if (skill.blocked) body.push(el('p', { class: 'blocked' }, [skill.blocked]));
  if (skill.canStudy) {
    const button = el('button', { type: 'button', 'data-action': 'study', 'data-skill': skill.id }, ['学']);
    button.addEventListener('click', () => act({ type: 'study', skill: skill.id }));
    body.push(button);
  }
  return el('article', { class: 'card skill-card', 'data-skill': skill.id, 'data-learned': skill.learned ? '1' : '0' }, body);
}

function failureCard(skill) {
  return el('article', { class: 'card skill-card', 'data-skill': 'failure', 'data-learned': skill.learned ? '1' : '0' }, [
    el('div', { class: 'ticket-top' }, [
      el('strong', {}, [skill.name]),
      el('span', {}, [skill.learned ? '已学会' : '未获得']),
    ]),
    el('p', { class: 'meta skill-short' }, [skill.effect]),
    el('p', { class: 'skill-full' }, [SKILL_SOURCE.failure]),
    skill.blocked ? el('p', { class: 'blocked' }, [skill.blocked]) : '',
  ].filter(Boolean));
}

function batchActions(view) {
  if (!view.batch && !(view.boss.resolved && !view.boss.reviewed)) return null;
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
  return bar;
}

function useDoor() {
  const view = present(state);
  if (view.canOvernight && view.canSleep) {
    doorChoice = true;
    render();
    return;
  }
  doorChoice = false;
  if (view.canSleep) act({ type: 'sleep' });
  else if (view.canOvernight) act({ type: 'overnight' });
}

function dock(view) {
  const bar = el('div', { class: 'dock' });
  if (view.canRest) {
    const rest = el('button', { type: 'button', 'data-action': 'rest' }, ['休息']);
    rest.addEventListener('click', () => act({ type: 'rest' }));
    bar.append(rest);
  }
  if (view.canOvernight) {
    const night = el('button', { type: 'button', 'data-action': 'overnight' }, ['进入夜里']);
    night.addEventListener('click', () => {
      doorChoice = false;
      act({ type: 'overnight' });
    });
    bar.append(night);
  }
  if (state.dotaPending) {
    const play = el('button', { type: 'button', 'data-action': 'play-dota' }, ['打 Dota']);
    play.addEventListener('click', () => playDota());
    bar.append(play);
  }
  if (view.canSleep) {
    const sleep = el('button', { type: 'button', 'data-action': 'sleep' }, ['睡觉']);
    sleep.addEventListener('click', () => {
      doorChoice = false;
      act({ type: 'sleep' });
    });
    bar.append(sleep);
  }
  return bar;
}

function deskWindow(view) {
  if (!deskPage || view.dialogue) return null;
  const tickets = el('button', { type: 'button', 'data-desk': 'tickets' }, ['需求单']);
  const skills = el('button', { type: 'button', 'data-desk': 'skills' }, ['学习']);
  tickets.addEventListener('click', () => { deskPage = 'tickets'; render(); });
  skills.addEventListener('click', () => { deskPage = 'skills'; render(); });
  const close = el('button', { type: 'button', 'data-action': 'close-desk' }, ['关闭']);
  close.addEventListener('click', () => { deskPage = null; render(); });
  const pages = el('div', { class: 'desk-tabs' }, [tickets, skills, close]);
  const body = el('div', { class: deskPage === 'skills' ? 'stack' : 'stack', id: deskPage === 'skills' ? 'skills' : 'tickets' });
  if (deskPage === 'skills') {
    body.append(...view.skills.map(skillCard), failureCard(view.failureSkill));
  } else {
    const cards = view.incidents.map(incident => incidentCard(view, incident)).concat(view.tickets.map(ticket => ticketCard(view, ticket)));
    if (!cards.length) body.append(el('p', { class: 'meta' }, ['今天没有单。']));
    else body.append(...cards);
    const extra = batchActions(view);
    if (extra) body.append(extra);
  }
  const log = el('ol', { class: 'log', id: 'log' }, view.log.map(line => el('li', {}, [line])));
  return el('section', { class: 'desk', id: 'desk', 'data-page': deskPage }, [pages, body, log]);
}

function doorPrompt() {
  if (!doorChoice) return null;
  const night = el('button', { type: 'button', 'data-action': 'overnight' }, ['进入夜里']);
  night.addEventListener('click', () => { doorChoice = false; act({ type: 'overnight' }); });
  const sleep = el('button', { type: 'button', 'data-action': 'sleep' }, ['睡觉']);
  sleep.addEventListener('click', () => { doorChoice = false; act({ type: 'sleep' }); });
  const close = el('button', { type: 'button', 'data-action': 'close-door' }, ['先不走']);
  close.addEventListener('click', () => { doorChoice = false; render(); });
  return el('section', { class: 'desk door-prompt', id: 'door-prompt' }, [
    el('p', {}, ['门口']),
    el('div', { class: 'actions' }, [night, sleep, close]),
  ]);
}

function dialogue(view) {
  if (!view.dialogue) return null;
  const person = view.colleagues.find(item => item.id === view.dialogue.person);
  if (!person) return null;
  const choices = el('div', { class: 'choices' });
  if (person.id === 'pm' && view.pm) {
    const yes = el('button', { type: 'button', 'data-action': 'pm-yes' }, ['答应上线']);
    yes.addEventListener('click', () => act({ type: 'pm-yes' }));
    choices.append(yes);
  }
  const close = el('button', { type: 'button', 'data-action': 'close' }, ['先这样']);
  close.addEventListener('click', () => act({ type: 'close' }));
  choices.append(close);
  const caret = el('button', { type: 'button', class: 'caret', 'data-action': 'continue', 'aria-label': '继续' });
  caret.addEventListener('click', () => act({ type: 'close' }));
  return el('section', { class: 'talk', id: 'talk', 'data-person': person.id }, [
    el('p', { class: 'nameplate' }, [person.name]),
    el('div', { class: 'lines' }, person.lines.map(line => el('p', {}, [line]))),
    choices,
    caret,
  ]);
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
    el('p', { id: 'ending-text' }, [won ? view.victoryText : view.failReason]),
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

function paint() {
  const canvas = app.querySelector('#scene');
  const stage = app.querySelector('#stage');
  if (canvas && stage) drawScene(canvas, stage.dataset.scene);
}

function render() {
  const view = present(state);
  const { stage, here } = sceneStage(view);
  const top = el('div', { class: 'topbar' }, [meter(view), chanceBanner(view)]);
  const incidents = incidentRibbon(view);
  if (incidents) top.append(incidents);
  stage.append(top);
  if (view.phase === 'play') {
    const away = offstage(view, here);
    if (away) stage.append(away);
    const boss = bossCard(view);
    if (boss) stage.append(boss);
    const desk = deskWindow(view);
    if (desk) stage.append(desk);
    const prompt = doorPrompt();
    if (prompt) stage.append(prompt);
    stage.append(dock(view));
  } else {
    const done = ending(view);
    done.append(el('ol', { class: 'log', id: 'log' }, view.log.map(line => el('li', {}, [line]))));
    stage.append(done);
  }
  if (dota) stage.append(dotaOverlay());
  app.replaceChildren(el('div', { class: 'screen' }, [stage]), seedBar(view));
  paint();
}

window.addEventListener('keydown', event => {
  if (!dota || dota.mode !== 'play' || event.repeat) return;
  const raze = RAZES.find(item => item.key === event.key.toLowerCase());
  if (!raze) return;
  event.preventDefault();
  pressRaze(raze.id);
});

window.nanjing = {
  present() { return present(state); },
  act(action) { act(action); return present(state); },
  start,
  ready: false,
};

bindWalk({
  onArrive(effect) {
    if (!effect) return;
    if (effect.kind === 'talk') {
      deskPage = null;
      doorChoice = false;
      act({ type: 'talk', person: effect.person });
      return;
    }
    if (effect.kind === 'water') {
      act({ type: 'rest' });
      return;
    }
    if (effect.kind === 'door') {
      useDoor();
      return;
    }
    if (effect.kind === 'shelf') {
      deskPage = 'skills';
      doorChoice = false;
      render();
      return;
    }
    if (effect.kind === 'computer' || effect.kind === 'seat') {
      doorChoice = false;
      if (state.dotaPending) playDota();
      else {
        deskPage = 'tickets';
        render();
      }
    }
  },
  paint,
});

loadArt().then(() => {
  render();
  window.nanjing.ready = true;
}).catch(error => {
  console.error(error);
  render();
  window.nanjing.ready = true;
});
