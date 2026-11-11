import { applyAction, createGame, present } from './rules.mjs';

const app = document.querySelector('#app');

function readSeed() {
  const value = new URLSearchParams(location.search).get('seed');
  return value ? value.slice(0, 64) : 'hefei';
}

let state = createGame(readSeed());

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
  render();
}

function start(seed) {
  const next = String(seed || '').trim().slice(0, 64) || 'hefei';
  const url = new URL(location.href);
  url.searchParams.set('seed', next);
  history.replaceState(null, '', url);
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
    ]),
  ]);
}

function ticketCard(ticket) {
  const due = ticket.late ? '已延期' : `剩 ${ticket.dueIn} 天`;
  const costText = ticket.costNote ? `${ticket.cost} 点（${ticket.costNote}）` : `${ticket.cost} 点`;
  const penaltyText = ticket.penaltyNote
    ? `-${ticket.penalty}（${ticket.penaltyNote}，否则 -${ticket.fullPenalty}）`
    : `-${ticket.penalty}`;
  const button = el('button', {
    type: 'button',
    'data-action': 'work',
    'data-id': ticket.id,
    'data-cost': ticket.cost,
    'data-penalty': ticket.penalty,
  }, [`做 · 还差 ${ticket.left} 点`]);
  button.addEventListener('click', () => act({ type: 'work', ticketId: ticket.id }));
  return el('article', {
    class: 'card',
    'data-kind': ticket.kind,
    'data-ticket': ticket.id,
    'data-cost': ticket.cost,
    'data-penalty': ticket.penalty,
    'data-reward': ticket.reward,
  }, [
    el('div', { class: 'ticket-top' }, [
      el('strong', {}, [el('i', { class: `mark ${ticket.kind}` }), ticket.title]),
      el('span', { class: ticket.late ? 'late' : '' }, [due]),
    ]),
    el('p', { class: 'meta' }, [`${ticket.kindLabel} · ${costText}`]),
    el('p', { class: 'nums' }, [
      el('span', { class: 'left' }, [`进度 ${ticket.progress}/${ticket.cost}`]),
      el('span', { class: 'reward' }, [`做完 +${ticket.reward}`]),
      el('span', { class: ticket.late ? 'late' : '' }, [`逾期 ${penaltyText}`]),
    ]),
    button,
  ]);
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

function actionBar(view) {
  const bar = el('div', { class: 'actions' });
  if (view.canRest) {
    const rest = el('button', { type: 'button', 'data-action': 'rest' }, ['休息 +2 体力']);
    rest.addEventListener('click', () => act({ type: 'rest' }));
    bar.append(rest);
  }
  if (view.canOvernight) {
    const night = el('button', { type: 'button', 'data-action': 'overnight' }, ['熬夜 +1 点 / -3 体力']);
    night.addEventListener('click', () => act({ type: 'overnight' }));
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
  return el('section', { class: 'ending', id: 'ending' }, [
    el('h2', {}, [won ? '留下来了' : '被劝退']),
    el('p', { id: 'ending-text' }, [won ? view.victoryText : view.failReason]),
    el('dl', {}, [
      el('dt', {}, ['周次']), el('dd', {}, [`第 ${view.week} 周 ${view.dayName}`]),
      el('dt', {}, ['好感']), el('dd', { id: 'end-favor' }, [String(view.favor)]),
      el('dt', {}, ['本周线']), el('dd', {}, [String(view.line)]),
      el('dt', {}, ['体力']), el('dd', {}, [String(view.stamina)]),
      el('dt', {}, ['做完的单']), el('dd', {}, [String(stats.completed)]),
      el('dt', {}, ['延期与事故']), el('dd', {}, [String(stats.lateCount)]),
      el('dt', {}, ['好感增加']), el('dd', {}, [String(stats.favorGained)]),
      el('dt', {}, ['好感减少']), el('dd', {}, [String(stats.favorLost)]),
      el('dt', {}, ['熬夜']), el('dd', {}, [String(stats.overnights)]),
      el('dt', {}, ['学会']), el('dd', {}, [stats.skills.length ? stats.skills.join('、') : '无']),
    ]),
    el('div', { class: 'actions' }, [again, fresh]),
  ]);
}

function logList(view) {
  return el('ol', { class: 'log' }, view.log.map(line => el('li', {}, [line])));
}

function render() {
  const view = present(state);
  const parts = [header(view), status(view)];
  if (view.phase === 'play') {
    parts.push(el('div', { class: 'board' }, [
      el('section', {}, [el('h2', {}, ['需求单']), el('div', { class: 'stack', id: 'tickets' }, view.tickets.map(ticketCard))]),
      el('section', {}, [el('h2', {}, ['学习']), el('div', { class: 'stack', id: 'skills' }, view.skills.map(skillCard))]),
    ]));
    parts.push(actionBar(view));
  } else {
    parts.push(ending(view));
  }
  parts.push(logList(view));
  app.replaceChildren(...parts);
}

render();

window.hefei = {
  present() { return present(state); },
  act(action) { act(action); return present(state); },
  start,
};
