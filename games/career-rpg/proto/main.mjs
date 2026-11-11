import { castRaze, createMatch, LAST_HITS, MATCH_TICKS, RAZES, THREAT_POS, tickMatch, TICK_MS } from './dota.mjs';
import { CONFIG, SCRIPT, applyAction, createGame, present } from './rules.mjs';
import { frameIndex, resolveSprite } from './walk-sprites.mjs';
import { WALK_GRID, facingOf, findPath, resolveClick } from './walk.mjs';

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
let toldNight = '';
let toldWeek = 0;
const walker = {
  x: WALK_GRID.start.x,
  y: WALK_GRID.start.y,
  facing: 'up',
  pose: 'seated',
  frame: 0,
  path: [],
  action: null,
  arrivePose: 'seated',
  arriveFacing: 'up',
  loop: false,
  last: 0,
  walkMs: 0,
};
let walkSprites = null;

function resetWalker() {
  walker.x = WALK_GRID.start.x;
  walker.y = WALK_GRID.start.y;
  walker.facing = 'up';
  walker.pose = 'seated';
  walker.frame = 0;
  walker.path = [];
  walker.action = null;
  walker.arrivePose = 'seated';
  walker.arriveFacing = 'up';
  walker.walkMs = 0;
}

function walkerElement() {
  if (walker.pose === 'seated') {
    const seat = WALK_GRID.seat;
    return el('img', {
      id: 'walker',
      class: 'walker seated',
      alt: '',
      src: './art/player-seated.png',
      style: `left:${(seat.x / 384) * 100}%;top:${(seat.y / 216) * 100}%;width:${(seat.w / 384) * 100}%;height:${(seat.h / 216) * 100}%`,
    });
  }
  const pose = resolveSprite(walkSprites, walker.facing);
  const index = walker.path.length ? frameIndex(pose, walker.walkMs) : 0;
  const frame = pose.frames[index];
  const left = walker.x - pose.anchor.x;
  const top = walker.y - pose.anchor.y;
  const box = [
    `left:${(left / 384) * 100}%`,
    `top:${(top / 216) * 100}%`,
    `width:${(frame.w / 384) * 100}%`,
    `height:${(frame.h / 216) * 100}%`,
    pose.mirror ? 'transform:scaleX(-1)' : '',
  ].filter(Boolean).join(';');
  const imgStyle = [
    'position:absolute',
    `width:${(pose.imageSize.w / frame.w) * 100}%`,
    `height:${(pose.imageSize.h / frame.h) * 100}%`,
    `left:${(-frame.x / frame.w) * 100}%`,
    `top:${(-frame.y / frame.h) * 100}%`,
  ].join(';');
  return el('span', { id: 'walker', class: 'walker', style: box }, [
    el('img', { alt: '', src: pose.image, style: imgStyle }),
  ]);
}

function paintWalker() {
  const current = document.querySelector('#walker');
  if (!current) return;
  current.replaceWith(walkerElement());
  const spot = document.querySelector('[data-spot="player"]');
  if (!spot) return;
  const box = walker.pose === 'seated'
    ? [63, 134, 88, 163]
    : [walker.x - 10, walker.y - 44, walker.x + 10, walker.y - 16];
  spot.style.cssText = spotStyle(box);
}

function arriveWalker() {
  walker.pose = walker.arrivePose;
  walker.frame = 0;
  if (walker.arriveFacing) walker.facing = walker.arriveFacing;
  if (walker.pose === 'seated') {
    walker.x = WALK_GRID.start.x;
    walker.y = WALK_GRID.start.y;
    walker.facing = 'up';
  }
  const action = walker.action;
  walker.action = null;
  if (!action) {
    paintWalker();
    return;
  }
  if (action.type === 'talk') {
    openPerson(action.person);
    return;
  }
  if (action.type === 'study' && present(state).shelf.canStudy) act({ type: 'study', skill: present(state).shelf.id });
  else paintWalker();
}

function walkLoop(now) {
  if (!walker.path.length) {
    walker.loop = false;
    arriveWalker();
    return;
  }
  const dt = walker.last ? Math.min(0.05, (now - walker.last) / 1000) : 0.016;
  walker.last = now;
  walker.walkMs += dt * 1000;
  let left = 56 * dt;
  while (left > 0 && walker.path.length) {
    const next = walker.path[0];
    const dx = next.x - walker.x;
    const dy = next.y - walker.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.4) {
      walker.path.shift();
      continue;
    }
    walker.facing = facingOf(dx, dy);
    const step = Math.min(left, dist);
    walker.x += (dx / dist) * step;
    walker.y += (dy / dist) * step;
    left -= step;
  }
  walker.pose = 'stand';
  paintWalker();
  if (!walker.path.length) {
    walker.loop = false;
    arriveWalker();
    return;
  }
  requestAnimationFrame(walkLoop);
}

function goTo(hit) {
  if (!hit || hit.kind === 'none' || !hit.target) return false;
  const path = findPath(walker, hit.target);
  if (!path) return false;
  walker.path = path;
  walker.action = hit.action;
  walker.arrivePose = hit.target.pose || 'stand';
  walker.arriveFacing = hit.target.facing || null;
  walker.walkMs = 0;
  walker.pose = path.length ? 'stand' : walker.arrivePose;
  paintWalker();
  if (!path.length) {
    arriveWalker();
    return true;
  }
  if (!walker.loop) {
    walker.loop = true;
    walker.last = 0;
    requestAnimationFrame(walkLoop);
  }
  return true;
}

function scenePoint(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WALK_GRID.scene.width,
    y: ((event.clientY - rect.top) / rect.height) * WALK_GRID.scene.height,
  };
}

function onSceneClick(event) {
  if (dota || state.phase !== 'play') return;
  if (event.target.closest('.dialogue, .week-chip, button, a')) return;
  const view = present(state);
  goTo(resolveClick(scenePoint(event), { night: view.night, canStudy: view.shelf.canStudy }));
}

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
  const before = state;
  state = applyAction(state, action);
  if (action && action.type === 'sleep') {
    dialogue = null;
    toldNight = '';
    if (state.phase === 'play' && state.day === 1 && state.interviewed) {
      openNarration([SCRIPT.weekOpen[state.week - 1]]);
      return;
    }
  }
  if (action && action.type === 'night' && state.night && !before.night) {
    const key = `${state.week}-${state.day}`;
    if (toldNight !== key) {
      toldNight = key;
      const lines = [SCRIPT.nightFalls];
      if (toldWeek !== state.week) {
        toldWeek = state.week;
        lines.push(SCRIPT.daysPass);
      }
      openNarration(lines);
      return;
    }
  }
  if (action && action.type === 'study' && before.overnightUsed && toldWeek !== state.week && state.phase === 'play') {
    toldWeek = state.week;
    openNarration([SCRIPT.daysPass]);
    return;
  }
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
  toldNight = '';
  toldWeek = 0;
  resetWalker();
  state = createGame(next);
  render();
}

function sentence(line) {
  const mark = line.indexOf('：');
  return mark === -1 ? line : line.slice(mark + 1);
}

function lineBox(line) {
  return {
    person: line.id,
    name: line.name,
    text: line.text,
    choices: line.choices,
    forecast: line.forecast,
    speaker: line.speaker,
    narrator: line.narrator,
    advance: line.interview ? 'interview' : '',
    queue: [],
  };
}

function openNarration(lines) {
  const pending = lines.filter(Boolean);
  const text = pending.shift();
  if (!text) {
    render();
    return;
  }
  dialogue = {
    person: '',
    name: '',
    text,
    choices: [],
    forecast: null,
    speaker: 'narrator',
    narrator: true,
    advance: pending.length ? 'queue' : '',
    queue: pending,
  };
  render();
}

function openPerson(id) {
  const line = present(state).coworkers.find(item => item.id === id);
  if (!line || !line.visible) return;
  if (!line.commit || line.talked) {
    dialogue = lineBox(line);
    render();
    return;
  }
  const next = applyAction(state, { type: 'talk', person: id });
  if (next === state) return;
  state = next;
  dialogue = {
    person: id,
    name: line.name,
    text: state.say || sentence(state.log[0]),
    choices: [],
    forecast: line.forecast,
    speaker: line.speaker,
    narrator: false,
    advance: '',
    queue: [],
  };
  render();
}

function chooseLine(choice) {
  if (!dialogue) return;
  const person = dialogue.person;
  const name = dialogue.name;
  const speaker = dialogue.speaker;
  const pending = state.dotaPending;
  const next = applyAction(state, { type: 'talk', person, choice });
  if (next === state) return;
  state = next;
  if (!pending && state.dotaPending) {
    dialogue = {
      person: 'party',
      name: '开黑队友',
      text: '开了。',
      choices: [],
      forecast: null,
      speaker: 'party',
      narrator: false,
      advance: 'dota',
      queue: [],
    };
    render();
    return;
  }
  dialogue = {
    person,
    name,
    text: state.say || sentence(state.log[0]),
    choices: [],
    forecast: null,
    speaker,
    narrator: false,
    advance: '',
    queue: [],
  };
  render();
}

function continueDialogue() {
  if (!dialogue) return;
  if (dialogue.advance === 'dota') {
    dialogue = null;
    startDota();
    return;
  }
  if (dialogue.advance === 'interview') {
    const next = applyAction(state, { type: 'talk', person: 'boss' });
    if (next === state) return;
    state = next;
    if (!state.interviewed) {
      const line = present(state).coworkers.find(item => item.id === 'boss');
      dialogue = lineBox(line);
      render();
      return;
    }
    dialogue = null;
    if (state.phase === 'play' && state.week === 1 && state.day === 1) {
      openNarration([SCRIPT.weekOpen[0]]);
      return;
    }
    render();
    return;
  }
  if (dialogue.advance === 'queue' && dialogue.queue.length) {
    const text = dialogue.queue.shift();
    dialogue = { ...dialogue, text, advance: dialogue.queue.length ? 'queue' : '' };
    render();
    return;
  }
  dialogue = null;
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

const DAY_BOXES = {
  player: [63, 134, 88, 176],
  neighbor: [135, 134, 160, 176],
  lunch: [250, 136, 282, 178],
  boss: [310, 82, 342, 128],
};
// art/source/night-v2-boxes.json。夜里只有开黑队友能点，其余三人的框不放按钮。
const NIGHT_BOXES = {
  player: [62, 134, 87, 175],
  neighbor: [134, 134, 159, 175],
  lunch: [206, 134, 232, 175],
  boss: [320, 79, 339, 119],
  party: [98, 158, 115, 200],
};

function spotStyle(box) {
  const [x0, y0, x1, y1] = box;
  return `left:${(x0 / 384) * 100}%;top:${(y0 / 216) * 100}%;width:${((x1 - x0) / 384) * 100}%;height:${((y1 - y0) / 216) * 100}%`;
}

function hotspot(person, speaking, box) {
  return el('div', {
    class: speaking ? 'spot speaking' : 'spot',
    'data-spot': person.id,
    style: spotStyle(box),
  }, [
    el('i', { class: 'arrow', 'data-arrow': speaking ? person.id : '' }),
    el('i', { class: 'body' }),
  ]);
}

function office(view) {
  const speaker = dialogue && !dialogue.narrator ? dialogue.speaker : '';
  const boxes = view.night ? NIGHT_BOXES : DAY_BOXES;
  const spots = [];
  const playerBox = walker.pose === 'seated'
    ? boxes.player
    : [walker.x - 10, walker.y - 44, walker.x + 10, walker.y - 16];
  if (playerBox) {
    spots.push(el('div', {
      class: speaker === 'player' ? 'spot speaking' : 'spot',
      'data-spot': 'player',
      style: spotStyle(playerBox),
    }, [
      el('i', { class: 'arrow' }),
      el('i', { class: 'body' }),
    ]));
  }
  for (const person of view.coworkers) {
    if (!person.clickable) continue;
    const box = boxes[person.id];
    if (!box) continue;
    spots.push(hotspot(person, speaker === person.id, box));
  }
  const chip = el('p', { class: 'week-chip', id: 'scene-when' }, [
    `第 ${view.week} 周 · ${view.dayName}${view.night ? ' · 夜里' : ''}`,
  ]);
  const children = [
    el('img', {
      class: 'scene-img',
      alt: '',
      src: view.night ? './art/02-main-night-v2.png' : './art/01-main-day.png',
    }),
    walkerElement(),
    chip,
    el('div', { class: 'spots' }, spots),
  ];
  const box = dialogueBox(view);
  if (box) children.push(box);
  const officeNode = el('section', { class: view.night ? 'office night' : 'office', id: 'office' }, children);
  officeNode.addEventListener('click', onSceneClick);
  return officeNode;
}

function dialogueBox(view) {
  if (!dialogue) return null;
  const choices = dialogue.choices.map(choice => {
    const button = el('button', { type: 'button', 'data-choice': choice.id }, [choice.label]);
    if (choice.id === 'accept' && dialogue.person === 'lunch' && view.ap <= 0) button.disabled = true;
    button.addEventListener('click', () => chooseLine(choice.id));
    return button;
  });
  const advancing = dialogue.advance === 'interview' || dialogue.advance === 'queue' || dialogue.advance === 'dota';
  const caret = el('button', {
    type: 'button',
    class: 'caret',
    'data-caret': '1',
    'data-dialogue': advancing ? 'next' : 'close',
    'aria-label': '继续',
  }, ['▼']);
  caret.addEventListener('click', () => continueDialogue());
  const attrs = { class: 'dialogue', id: 'dialogue' };
  if (dialogue.narrator) attrs['data-narrator'] = '1';
  if (dialogue.forecast) {
    attrs['data-forecast-title'] = dialogue.forecast.title;
    attrs['data-forecast-kind'] = dialogue.forecast.kind;
    attrs['data-forecast-difficulty'] = dialogue.forecast.difficulty;
    attrs['data-forecast-due'] = dialogue.forecast.dueIn;
  }
  const head = dialogue.name ? [el('div', { class: 'nameplate', id: 'nameplate' }, [dialogue.name])] : [];
  return el('section', attrs, [
    ...head,
    el('p', { id: 'dialogue-text' }, [dialogue.text]),
    el('div', { class: 'dialogue-actions' }, choices),
    caret,
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

function endingCard(view) {
  if (view.phase === 'won' && view.ending === 'remembered') return './art/05-ending-remembered-notext.png';
  if (view.phase === 'won') return './art/04-ending-stay-notext.png';
  return './art/03-ending-quit-notext.png';
}

function ending(view) {
  const won = view.phase === 'won';
  const again = el('button', { type: 'button', 'data-action': 'restart' }, ['再来一局']);
  again.addEventListener('click', () => start(view.seed));
  const fresh = el('button', { type: 'button', 'data-action': 'new-seed' }, ['换个种子']);
  fresh.addEventListener('click', () => start(`h${Date.now().toString(36)}`));
  const stats = view.stats;
  const body = won ? view.victoryText : `${view.failReason}${view.failText}`;
  const rows = [
    ['周次', `第 ${view.week} 周 ${view.dayName}`],
    ['好感', String(view.favor)],
    ['本周线', String(view.line)],
    ['体力', String(view.stamina)],
    ['做完的单', String(stats.completed)],
    ['延期与事故', String(stats.lateCount)],
    ['学会', stats.skills.length ? stats.skills.join('、') : '无'],
    ['文件数据库', stats.fileDb],
  ];
  const card = el('div', { class: 'ending-card' }, [
    el('img', { src: endingCard(view), alt: '' }),
    el('div', { class: 'ending-header' }, [
      el('h2', { id: 'ending-title' }, [won ? view.victoryTitle : '被劝退']),
      el('p', { id: 'ending-text' }, [body]),
    ]),
    el('dl', { class: 'ending-stats' }, rows.flatMap(([name, value]) => [
      el('dt', {}, [name]),
      el('dd', name === '好感' ? { id: 'end-favor' } : {}, [value]),
    ])),
    again,
    fresh,
  ]);
  again.className = 'ending-retry';
  fresh.className = 'ending-reseed';
  return el('section', { class: 'ending', id: 'ending' }, [card]);
}

function dotaResultTitle(match) {
  if (match.won) return '补刀够了';
  if (match.hp <= 0) return '影魔倒下了';
  if (match.tick >= MATCH_TICKS) return '时间到了';
  return '这局没打完';
}

function dotaLane(match) {
  const sfClass = match.hurt ? 'cell sf hurt' : 'cell sf';
  const cells = [el('div', { class: sfClass, id: 'dota-hp', 'data-hp': match.hp }, [
    el('img', { class: 'sf-sprite', src: './art/sf.png', alt: '' }),
    el('span', {}, ['影魔']),
    String(match.hp),
  ])];
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
        el('p', { class: 'dota-who' }, ['影魔，三个影压']),
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

walkSprites = await fetch(new URL('./walk/walk.sprites.json', import.meta.url)).then(response => response.json());
render();

window.hefei = {
  present() { return present(state); },
  act(action) { act(action); return present(state); },
  start,
  walker() {
    return {
      x: walker.x,
      y: walker.y,
      pose: walker.pose,
      facing: walker.facing,
      moving: walker.path.length > 0,
    };
  },
  clickScene(x, y) {
    const view = present(state);
    return goTo(resolveClick({ x, y }, { night: view.night, canStudy: view.shelf.canStudy }));
  },
};
