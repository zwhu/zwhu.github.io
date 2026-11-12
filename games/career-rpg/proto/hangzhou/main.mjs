import { castRaze, createMatch, LAST_HITS, MATCH_TICKS, RAZES, THREAT_POS, tickMatch, TICK_MS } from '../dota.mjs';
import { NAV } from './nav.mjs';
import { CONFIG, applyAction, createGame, present } from './rules.mjs';
import { cellCenter, effectFor, findPath, nearestWalkable, sceneFile, visibleSpots } from './walk.mjs';
import { sceneLayout } from './scene-scale.mjs';
import { clipFor, resolveSprites } from './walk-sprites.mjs';

const app = document.querySelector('#app');

// 短字是画面上的缩写。悬停展开的原文来自 proto/hangzhou/README.md 技能一节。
const SKILL_COPY = Object.freeze({
  biz: Object.freeze({
    short: '读懂业务',
    brief: '下周字段，提前显示',
    full: '读懂商品发布这摊业务：开局就能学，学会后需求单显示下一周会来的字段类型，方便提前抽模块。',
  }),
  patterns: Object.freeze({
    short: '设计模式',
    brief: '抽模块，3 点变 2 点',
    full: '精读 23 种设计模式：抽模块从 3 点变 2 点。',
  }),
  webpack: Object.freeze({
    short: 'Webpack',
    brief: '模块覆盖相近字段',
    full: '吃透 Webpack 插件机制：模块能做成插件，一个模块可以覆盖两种相近的字段类型。',
  }),
  babel: Object.freeze({
    short: 'Babel',
    brief: '每周一清债 10 点',
    full: '吃透 Babel 插件机制：每周一自动清掉 10 点技术债。',
  }),
  architecture: Object.freeze({
    short: '一套表单架构',
    brief: '撑起五条业务线',
    full: '一套表单架构，撑起五条业务线：只能在 Boss 关通关后获得，是本章的高潮。',
  }),
});

const SCENE = Object.freeze({ w: 384, h: 216 });
const WALK_SPEED = 140;

const sitImage = new Image();
sitImage.src = './art/player-sit.png';

let sprites = null;
const spriteImages = new Map();
let foot = { x: NAV.seat.stand[0], y: NAV.seat.stand[1] };
let seated = true;
let facing = 'down';
let walkElapsed = 0;
let route = [];
let routeIndex = 0;
let pending = null;
let sawBoss = false;
let sawNight = false;
let walkerLoop = 0;
let walkerStamp = 0;

function readSeed() {
  const value = new URLSearchParams(location.search).get('seed');
  return value ? value.slice(0, 64) : 'hangzhou';
}

let state = createGame(readSeed());
let talkWho = null;
let panel = null;
let toastText = '';
let toastUntil = 0;
let toastTimer = 0;
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

function startDotaMatch() {
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

function openDota() {
  if (dota) return;
  const next = applyAction(state, { type: 'overnight' });
  if (next !== state) state = next;
  startDotaMatch();
}

function enterNight() {
  const view = present(state);
  panel = null;
  if (!view.night && view.canOvernight) {
    state = applyAction(state, { type: 'overnight' });
    render();
    return;
  }
  if (view.canSleep) act({ type: 'sleep' });
  else render();
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
  panel = null;
  toastText = '';
  toastUntil = 0;
  state = createGame(next);
  render();
}

function seedForm(view) {
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

function hud(view) {
  const item = (label, node) => el('span', { class: 'hud-item' }, [label, ' ', node]);
  return el('div', { class: 'hud' }, [
    el('span', { class: 'when', id: 'when' }, [`第 ${view.week} 周 · ${view.dayName}${view.night ? ' · 夜里' : ''}`]),
    item('行动点', el('strong', { id: 'ap' }, [String(view.ap)])),
    item('体力', el('strong', { id: 'stamina' }, [String(view.stamina)])),
    item('交付', el('strong', { id: 'delivery' }, [String(view.delivery)])),
    item('本周线', el('strong', { id: 'line' }, [String(view.line)])),
    item('投诉', el('strong', { id: 'complaints' }, [`${view.complaints}/${view.complaintLimit}`])),
    item('技术债', el('strong', { id: 'debt', 'data-surcharge': view.surcharge }, [String(view.debt)])),
  ]);
}

function named(who) {
  return who === 'plus' || who === 'sister';
}

function actorBox(box) {
  return [
    `left:${(box[0] / SCENE.w) * 100}%`,
    `top:${(box[1] / SCENE.h) * 100}%`,
    `width:${(box[2] / SCENE.w) * 100}%`,
    `height:${(box[3] / SCENE.h) * 100}%`,
  ].join(';');
}

function spotHit(spot, boss) {
  return boss ? spot.boss : spot.day;
}

function faceToward(dx, dy) {
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
}

function aimFacing(points) {
  let x = foot.x;
  let y = foot.y;
  for (const point of points) {
    const dx = point[0] - x;
    const dy = point[1] - y;
    if (Math.hypot(dx, dy) < 0.5) continue;
    facing = faceToward(dx, dy);
    return;
  }
}

function beginWalk(spot) {
  const goal = spot.at;
  const start = nearestWalkable(NAV, foot.x, foot.y);
  const end = nearestWalkable(NAV, goal[0], goal[1]);
  const cells = findPath(NAV, start, end);
  if (!cells) return;
  route = cells.map(cell => cellCenter(NAV, cell));
  routeIndex = 0;
  pending = effectFor(spot, { night: present(state).night, dotaPending: state.dotaPending });
  seated = false;
  walkElapsed = 0;
  aimFacing(route);
  const here = route[0];
  if (route.length === 1 && Math.hypot(foot.x - here[0], foot.y - here[1]) < 6) {
    arrive();
    return;
  }
  if (!walkerLoop) walkerLoop = requestAnimationFrame(stepWalker);
}

function arrive() {
  route = [];
  routeIndex = 0;
  walkElapsed = 0;
  const effect = pending;
  pending = null;
  if (!effect) {
    drawWalker();
    return;
  }
  if (effect.type === 'open') {
    talkWho = effect.who;
    render();
    return;
  }
  if (effect.type === 'rest') {
    act({ type: 'rest' });
    return;
  }
  if (effect.type === 'door') {
    enterNight();
    return;
  }
  if (effect.type === 'dota') {
    foot.x = NAV.seat.stand[0];
    foot.y = NAV.seat.stand[1];
    seated = true;
    facing = 'up';
    startDotaMatch();
    return;
  }
  if (effect.sit) {
    foot.x = NAV.seat.stand[0];
    foot.y = NAV.seat.stand[1];
    seated = true;
    facing = 'up';
  }
  if (effect.type === 'show') panel = effect.id === 'whiteboard' ? 'whiteboard' : (effect.tab || 'tickets');
  render();
}

function stepWalker(now) {
  const dt = Math.min(0.25, walkerStamp ? (now - walkerStamp) / 1000 : 0);
  walkerStamp = now;
  if (route.length) {
    const target = route[routeIndex];
    const dx = target[0] - foot.x;
    const dy = target[1] - foot.y;
    const distance = Math.hypot(dx, dy);
    const step = WALK_SPEED * dt;
    if (distance <= step || distance < 0.4) {
      foot.x = target[0];
      foot.y = target[1];
      routeIndex += 1;
      if (routeIndex >= route.length) arrive();
    } else {
      foot.x += (dx / distance) * step;
      foot.y += (dy / distance) * step;
      facing = faceToward(dx, dy);
      walkElapsed += dt * 1000;
    }
  }
  drawWalker();
  if (route.length) walkerLoop = requestAnimationFrame(stepWalker);
  else {
    walkerLoop = 0;
    walkerStamp = 0;
  }
}

function drawWalker() {
  const canvas = document.querySelector('#walker');
  if (!canvas || !sitImage.complete || !sprites) return;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, SCENE.w, SCENE.h);
  const view = present(state);
  const moving = route.length > 0;
  const clip = clipFor(sprites, facing, { seated, moving, elapsedMs: walkElapsed });
  if (clip.pose === 'sit') {
    // Boss 周人站在白板前，不画工位坐姿。夜里和白天用同一张坐姿。
    if (view.bossOn) return;
    const sheet = spriteImages.get('walk-sheet.png');
    if (!sheet?.complete || !NAV.seat.sitFrame) return;
    const [sx, sy, sw, sh] = NAV.seat.sitFrame;
    const [dx, dy] = NAV.seat.sit;
    const [dw, dh] = NAV.seat.sitSize;
    // 背面站姿的头到红衣躯干。腿不画，椅背就不会把肩膀和手臂全挡住。
    ctx.drawImage(sheet, sx, sy, sw, sh, dx, dy, dw, dh);
    return;
  }
  const spec = clip.spec;
  if (!spec?.frames?.[clip.index]) return;
  const image = spriteImages.get(spec.file);
  if (!image?.complete || !clip.rect) return;
  const rect = clip.rect;
  const [ax, ay] = spec.anchor;
  ctx.save();
  if (spec.mirror) {
    ctx.translate(Math.round(foot.x), 0);
    ctx.scale(-1, 1);
    ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, -ax, Math.round(foot.y - ay), rect.w, rect.h);
  } else {
    ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, Math.round(foot.x - ax), Math.round(foot.y - ay), rect.w, rect.h);
  }
  ctx.restore();
}

function loadWalkSprites() {
  const dataUrl = new URL('./walk/walk.sprites.json', import.meta.url);
  return fetch(dataUrl).then(response => response.json()).then(data => {
    sprites = resolveSprites(data);
    const files = [...new Set(Object.values(sprites.directions).map(item => item.file))];
    return Promise.all(files.map(file => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => { spriteImages.set(file, image); resolve(); };
      image.onerror = () => reject(new Error(file));
      image.src = new URL(`./walk/${file}`, import.meta.url).href;
    })));
  }).then(() => drawWalker());
}

function placeForBoss() {
  const view = present(state);
  if (view.night && !sawNight) {
    sawNight = true;
    foot.x = 82;
    foot.y = 177;
    seated = true;
    facing = 'up';
    route = [];
    pending = null;
  }
  if (!view.night) sawNight = false;
  if (view.night) return;
  if (view.bossOn && !sawBoss) {
    sawBoss = true;
    const cell = nearestWalkable(NAV, NAV.bossStand[0], NAV.bossStand[1]);
    const [x, y] = cellCenter(NAV, cell);
    foot.x = x;
    foot.y = y;
    seated = false;
    facing = 'down';
    route = [];
    pending = null;
  }
  if (!view.bossOn) sawBoss = false;
}

function scenePoint(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * SCENE.w,
    y: ((event.clientY - rect.top) / rect.height) * SCENE.h,
  };
}

function continueMark(onContinue) {
  const button = el('button', { type: 'button', class: 'caret', 'data-continue': '1' }, ['▼']);
  button.addEventListener('click', onContinue);
  return button;
}

function talkBox(name, lines, buttons, onContinue) {
  const box = el('div', { class: 'talkbox', id: 'talk' }, [
    ...lines,
    el('div', { class: 'talk-actions' }, buttons),
    continueMark(onContinue),
  ]);
  const kids = [];
  if (name) kids.push(el('div', { class: 'nameplate', id: 'nameplate' }, [name]));
  kids.push(box);
  return el('div', { class: 'talk-anchor' }, kids);
}

function office(view, talk) {
  const boss = view.bossOn;
  const actors = visibleSpots(NAV.spots, { night: view.night }).map(spot => {
    const person = spot.who ? view.colleagues.find(item => item.who === spot.who) : null;
    const speaking = spot.who && talkWho === spot.who;
    const attrs = {
      type: 'button',
      class: speaking ? 'actor speaking' : 'actor',
      style: actorBox(spotHit(spot, boss)),
      'data-spot': spot.id,
    };
    if (spot.who) {
      attrs['data-colleague'] = spot.who;
      attrs['data-talked'] = person?.talked ? '1' : '0';
      attrs['aria-label'] = named(spot.who) ? person.name : '……';
    } else {
      attrs['aria-label'] = { computer: '电脑', shelf: '书架', board: '白板', cooler: '饮水机', door: '门口' }[spot.kind];
    }
    const button = el('button', attrs, spot.who ? [
      view.crowd ? '' : el('span', { class: 'bubble', 'aria-hidden': 'true' }, ['…']),
      el('i', { class: 'arrow', 'aria-hidden': 'true' }),
    ] : []);
    button.addEventListener('click', event => {
      event.stopPropagation();
      beginWalk(spot);
    });
    return button;
  });
  const scene = view.night ? 'night' : (boss ? 'boss' : 'day');
  const picture = el('img', {
    class: 'scene',
    src: `./art/${sceneFile({ night: view.night, boss })}`,
    width: String(SCENE.w),
    height: String(SCENE.h),
    alt: '',
    draggable: 'false',
  });
  picture.addEventListener('click', event => {
    const point = scenePoint(event);
    beginWalk({ kind: 'ground', at: [point.x, point.y] });
  });
  const ui = el('div', { class: 'scene-ui' }, [sceneNotes(view)]);
  if (view.phase !== 'play') ui.append(ending(view));
  else if (panel === 'whiteboard') ui.append(boardPanel(view));
  else if (panel === 'tickets' || panel === 'skills') ui.append(deskPanel(view));
  const layers = [
    picture,
    el('canvas', { id: 'walker', width: String(SCENE.w), height: String(SCENE.h) }),
    ...actors,
    ui,
  ];
  if (view.phase === 'play') {
    layers.push(sceneActions(view));
    if (talk) layers.push(talk);
    if (dota) layers.push(dotaOverlay());
  }
  return el('section', {
    class: 'stage',
    id: 'office',
    'data-scene': scene,
    'data-night': view.night ? '1' : '0',
  }, [
    hud(view),
    el('div', { class: 'playfield' }, layers),
  ]);
}

function talkBar(view) {
  if (view.crowd && !talkWho) {
    const close = el('button', { type: 'button', 'data-talk': 'crowd' }, ['先看白板']);
    const dismiss = () => {
      talkWho = null;
      act({ type: 'crowd' });
    };
    close.addEventListener('click', dismiss);
    return talkBox(
      '四个人围过来',
      view.crowdLines.map(item => el('p', {}, [named(item.who) ? `${item.name}：${item.line}` : item.line])),
      [close],
      dismiss,
    );
  }
  if (!talkWho) return null;
  const person = view.colleagues.find(item => item.who === talkWho);
  if (!person) return null;
  const dismiss = () => {
    if (!person.talked) act({ type: 'talk', who: person.who });
    talkWho = null;
    render();
  };
  const close = el('button', { type: 'button', 'data-talk': 'close' }, ['先这样']);
  close.addEventListener('click', dismiss);
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
  return talkBox(
    named(person.who) ? person.name : '',
    [el('p', { id: 'talk-line' }, [person.talked ? view.log[0] : person.line])],
    buttons,
    dismiss,
  );
}

function debtBanner(view) {
  const text = view.surcharge
    ? `技术债 ${view.debt}，所有单子 +${view.surcharge} 点`
    : `技术债 ${view.debt}，满 25 后所有单子加价`;
  return el('p', { class: 'debt-banner', id: 'debt-banner', 'data-surcharge': view.surcharge }, [text]);
}

function boardShort(slot) {
  if (slot.status === 'done') return '已按期交付';
  if (slot.status === 'late') return '已延期';
  return slot.covered ? '模块' : `硬写 ${slot.base}`;
}

function boardFull(slot) {
  const title = `${slot.lineName} · ${slot.example}`;
  if (slot.status === 'done') return `${title}。已按期交付。`;
  if (slot.status === 'late') return `${title}。已延期。延期不加分。`;
  const left = Math.max(0, slot.cost - slot.progress);
  return `${title}。${slot.label}。做 · 还差 ${left} 点。按期 +${CONFIG.onTimeReward}。`;
}

function boardPanel(view) {
  const slots = view.whiteboard.map(slot => el('article', {
    class: `slot expand ${slot.status === 'open' && slot.covered ? 'covered' : ''} ${slot.status === 'open' && !slot.covered ? 'hard' : ''} ${slot.status === 'done' ? 'done' : ''}`,
    'data-slot': slot.field,
    'data-cost': slot.cost,
    'data-surcharge': slot.surcharge,
    'data-status': slot.status,
    'data-label': slot.label,
    tabindex: '0',
  }, [
    el('strong', {}, [el('i', { class: `mark ${slot.field}` }), slot.lineName]),
    el('div', {}, [slot.example]),
    el('p', { class: 'label' }, [boardShort(slot)]),
    el('p', { class: 'full' }, [boardFull(slot)]),
    slot.status === 'open' ? el('div', {}, [`进度 ${slot.progress}/${slot.cost}`]) : '',
  ]));
  const close = el('button', { type: 'button', 'data-close': 'whiteboard' }, ['关闭']);
  close.addEventListener('click', () => { panel = null; render(); });
  return el('div', { class: 'scene-panel', id: 'whiteboard' }, [
    el('div', { class: 'panel-bar' }, [el('h2', {}, ['白板']), close]),
    el('div', { class: 'sheet slots' }, slots),
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
  const copy = SKILL_COPY[skill.id];
  const progress = skill.learned ? '已学会' : (skill.cost ? `${skill.progress}/${skill.cost}` : '未获得');
  const body = [
    el('div', { class: 'ticket-top' }, [
      el('strong', {}, [copy.short]),
      el('span', { id: `skill-${skill.id}` }, [progress]),
    ]),
    el('p', { class: 'meta' }, [copy.brief]),
    el('p', { class: 'full' }, [copy.full]),
  ];
  if (skill.blocked) body.push(el('p', { class: 'blocked', id: `skill-${skill.id}-lock` }, [skill.blocked]));
  if (skill.canStudy) {
    const button = el('button', { type: 'button', 'data-action': 'study', 'data-skill': skill.id }, ['学']);
    button.addEventListener('click', () => act({ type: 'study', skill: skill.id }));
    body.push(button);
  }
  return el('article', {
    class: 'card expand',
    'data-skill': skill.id,
    'data-progress': skill.progress,
    'data-learned': skill.learned ? '1' : '0',
    tabindex: '0',
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

function sceneNotes(view) {
  const notes = el('div', { class: 'scene-notes' });
  if (panel) return notes;
  const latest = view.log[0] || '';
  const now = Date.now();
  if (latest && latest !== toastText) {
    toastText = latest;
    toastUntil = now + 4000;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastTimer = 0;
      if (Date.now() >= toastUntil) render();
    }, 4100);
  }
  if (latest && now < toastUntil) {
    notes.append(el('p', { class: 'flash', id: 'log' }, [latest]));
    return notes;
  }
  if (view.nightLock) notes.append(el('p', { class: 'night', id: 'night-lock' }, [view.nightLock]));
  else if (view.forecast) notes.append(el('p', { class: 'forecast', id: 'forecast' }, [`下一周字段：${view.forecastText}`]));
  else notes.append(debtBanner(view));
  return notes;
}

function panelClose(id) {
  const close = el('button', { type: 'button', 'data-close': id }, ['关闭']);
  close.addEventListener('click', () => { panel = null; render(); });
  return close;
}

function deskPanel(view) {
  const tab = (id, label) => {
    const button = el('button', {
      type: 'button',
      'data-tab': id,
      'aria-pressed': panel === id ? 'true' : 'false',
    }, [label]);
    button.addEventListener('click', () => { panel = id; render(); });
    return button;
  };
  const tickets = view.tickets.length
    ? view.tickets.map(ticketCard)
    : [el('p', { class: 'meta' }, ['没有待做的单'])];
  const page = panel === 'skills'
    ? modulePanel(view)
    : el('div', { class: 'stack', id: 'tickets' }, tickets);
  return el('div', { class: 'scene-panel', id: 'desk' }, [
    el('div', { class: 'panel-bar' }, [tab('tickets', '需求单'), tab('skills', '学习'), panelClose('desk')]),
    el('div', { class: 'sheet' }, [page]),
  ]);
}

function sceneActions(view) {
  const bar = el('div', { class: 'scene-actions' });
  if (view.canRest) {
    const rest = el('button', { type: 'button', 'data-action': 'rest' }, ['休息']);
    rest.addEventListener('click', () => act({ type: 'rest' }));
    bar.append(rest);
  }
  if (view.canOvernight) {
    const night = el('button', { type: 'button', 'data-action': 'enter-night' }, ['入夜']);
    night.addEventListener('click', () => enterNight());
    bar.append(night);
  }
  if (view.night && state.dotaPending) {
    const play = el('button', { type: 'button', 'data-action': 'dota-play' }, ['打 Dota']);
    play.addEventListener('click', () => startDotaMatch());
    bar.append(play);
  }
  if (view.night || view.canSleep) {
    const sleep = el('button', { type: 'button', 'data-action': 'sleep' }, ['睡觉']);
    sleep.addEventListener('click', () => {
      panel = null;
      if (present(state).night) enterNight();
      else act({ type: 'sleep' });
    });
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
    el('h2', { id: 'ending-title' }, [won ? view.victoryTitle : '被业务方投诉']),
    el('p', { id: 'ending-text' }, [won ? view.victoryText : view.failReason]),
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

function applySceneScale() {
  const layout = sceneLayout(window.innerWidth, window.innerHeight);
  document.documentElement.style.setProperty('--scene-scale', String(layout.scale));
  return layout;
}

function render() {
  applySceneScale();
  placeForBoss();
  const view = present(state);
  const talk = view.phase === 'play' ? talkBar(view) : null;
  app.replaceChildren(office(view, talk), seedForm(view));
  drawWalker();
}

window.addEventListener('keydown', event => {
  if (!dota || dota.mode !== 'play' || event.repeat) return;
  const raze = RAZES.find(item => item.key === event.key.toLowerCase());
  if (!raze) return;
  event.preventDefault();
  pressRaze(raze.id);
});

window.addEventListener('resize', () => applySceneScale());
render();

sitImage.addEventListener('load', () => drawWalker());
loadWalkSprites();

window.hangzhou = {
  present() { return present(state); },
  walking() { return route.length > 0; },
  pump(ms = 50) {
    if (!route.length) return false;
    const now = performance.now();
    walkerStamp = now - ms;
    stepWalker(now);
    return route.length > 0;
  },
  facing() { return facing; },
  foot() { return { x: foot.x, y: foot.y, seated }; },
  clickScene(x, y) {
    beginWalk({ kind: 'ground', at: [x, y] });
  },
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
  scale() { return applySceneScale(); },
};
