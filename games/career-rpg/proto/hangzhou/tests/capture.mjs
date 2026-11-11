// 用真实 Chrome 把败局、胜局和 Boss 白板录下来。
// node games/career-rpg/proto/hangzhou/tests/capture.mjs
import { spawn } from 'node:child_process';
import { copyFileSync, createReadStream, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bossReviewActions, play } from '../sim.mjs';
import { applyAction, createGame } from '../rules.mjs';

const ROOT = path.resolve(import.meta.dirname, '../../../../..');
const OUT = path.join(ROOT, 'games/career-rpg/proto/hangzhou/review');
const PAGE = '/games/career-rpg/proto/hangzhou/index.html';
mkdirSync(OUT, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
};
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(ROOT, '.' + (url.endsWith('/') ? `${url}index.html` : url));
  if (!file.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  const stream = createReadStream(file);
  stream.on('error', () => { res.writeHead(404); res.end(); });
  stream.on('open', () => {
    res.writeHead(200, {
      'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    stream.pipe(res);
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}${PAGE}`;

const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
  '--lang=zh-CN', '--disable-translate', '--remote-debugging-port=0', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
const devtools = await new Promise((resolve, reject) => {
  let log = '';
  const timer = setTimeout(() => reject(new Error(`chrome timeout ${log.slice(-500)}`)), 20000);
  chrome.stderr.on('data', chunk => {
    log += chunk;
    const match = log.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);
    if (match) {
      clearTimeout(timer);
      resolve(Number(match[1]));
    }
  });
  chrome.on('exit', code => {
    clearTimeout(timer);
    reject(new Error(`chrome exit ${code}`));
  });
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const httpGet = url => new Promise((resolve, reject) => {
  http.get(url, res => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => resolve(data));
  }).on('error', reject);
});

let ws;
let seq = 0;
const pending = new Map();
const errors = [];
function send(method, params = {}, timeout = 20000) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`cdp timeout ${method}`));
    }, timeout);
    pending.set(id, message => {
      clearTimeout(timer);
      resolve(message);
    });
  });
}
async function connect() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const tabs = JSON.parse(await httpGet(`http://127.0.0.1:${devtools}/json`));
      const page = tabs.find(tab => tab.type === 'page');
      ws = new WebSocket(page.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve, { once: true });
        ws.addEventListener('error', () => reject(new Error('ws')), { once: true });
      });
      ws.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.id && pending.has(message.id)) {
          pending.get(message.id)(message);
          pending.delete(message.id);
        }
        if (message.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(message.params.exceptionDetails).slice(0, 500));
        if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
          errors.push(message.params.args.map(arg => arg.value || arg.description || '').join(' '));
        }
      });
      await send('Runtime.enable');
      await send('Page.enable');
      return;
    } catch {
      await sleep(200);
    }
  }
  throw new Error('chrome not ready');
}
async function evaluate(expression) {
  const message = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (message.result?.exceptionDetails) throw new Error(JSON.stringify(message.result.exceptionDetails).slice(0, 800));
  return message.result?.result?.value;
}
async function shot(file) {
  await evaluate('window.scrollTo(0, 0)');
  const message = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(file, Buffer.from(message.result.data, 'base64'));
}
async function goto(seed) {
  await send('Page.navigate', { url: `${origin}?seed=${encodeURIComponent(seed)}` });
  for (let i = 0; i < 50; i += 1) {
    await sleep(80);
    if (await evaluate('!!window.hangzhou')) return;
  }
  throw new Error(`page did not boot ${seed}`);
}
function selector(action) {
  if (action.type === 'work') return `[data-action="work"][data-id="${action.ticketId}"]`;
  if (action.type === 'study') return `[data-action="study"][data-skill="${action.skill}"]`;
  if (action.type === 'extract') return `[data-action="extract"][data-field="${action.field}"]`;
  if (action.type === 'place') return `[data-action="place"][data-field="${action.field}"]`;
  if (action.type === 'open') return `[data-colleague="${action.who}"]`;
  if (action.type === 'talk') return `[data-action="talk"][data-who="${action.who}"]`;
  if (action.type === 'extend') return `[data-action="extend"][data-id="${action.ticketId}"]`;
  if (action.type === 'teach') return `[data-action="teach"]`;
  if (action.type === 'crowd') return `[data-talk="crowd"]`;
  return `[data-action="${action.type}"]`;
}
async function click(action) {
  if (action.type === 'dota') {
    const skipped = await evaluate(`(() => {
      const skip = document.querySelector('[data-dota="skip"]');
      if (!skip) return false;
      skip.click();
      return true;
    })()`);
    if (!skipped) throw new Error('missing dota skip');
    await sleep(40);
    const back = await evaluate(`(() => {
      const button = document.querySelector('[data-dota="back"]');
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (!back) throw new Error('missing dota back');
    return;
  }
  if (action.type === 'talk' || action.type === 'extend' || action.type === 'teach') {
    const ready = await evaluate(`!!document.querySelector(${JSON.stringify(selector(action))})`);
    if (!ready) {
      const who = action.type === 'extend' ? 'plus' : action.type === 'teach' ? 'sister' : action.who;
      await click({ type: 'open', who });
      await sleep(40);
    }
  }
  const found = await evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector(action))});
    if (!node) return false;
    node.scrollIntoView({ block: 'center' });
    node.click();
    return true;
  })()`);
  if (!found) throw new Error(`missing button ${JSON.stringify(action)}`);
}
async function encode(framesDir, file, fps) {
  await new Promise((resolve, reject) => {
    const encoder = spawn('ffmpeg', [
      '-y', '-framerate', String(fps), '-i', path.join(framesDir, '%04d.png'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', file,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    encoder.stderr.on('data', chunk => { err += chunk; });
    encoder.on('exit', code => (code === 0 ? resolve() : reject(new Error(err.slice(-600)))));
  });
}

function colleagueActions() {
  let state = createGame('talk');
  const actions = [];
  const push = (action) => {
    const next = applyAction(state, action);
    if (next === state) throw new Error(`colleague stuck ${JSON.stringify(action)} week ${state.week} day ${state.day}`);
    actions.push(action);
    state = next;
  };
  const open = (who) => actions.push({ type: 'open', who });
  const ticket = state.tickets[0];
  open('plus');
  push({ type: 'extend', ticketId: ticket.id, hold: 10 });
  open('neighbor');
  push({ type: 'talk', who: 'neighbor' });
  let guard = 0;
  while (state.tickets.some(item => item.id === ticket.id) && guard < 40) {
    guard += 1;
    if (state.ap > 0 && !state.night) push({ type: 'work', ticketId: ticket.id });
    else if (state.ap === 0) push({ type: 'sleep' });
    else push({ type: 'rest' });
  }
  guard = 0;
  while ((state.night || state.ap === 0) && guard < 20) {
    guard += 1;
    if (state.ap > 0) push({ type: 'rest' });
    else push({ type: 'sleep' });
  }
  open('sister');
  push({ type: 'teach', hold: 10 });
  guard = 0;
  while (state.week === 1 && state.day < 3 && guard < 30) {
    guard += 1;
    const key = state.week * 10 + state.day;
    if (state.talked.neighbor !== key) {
      open('neighbor');
      push({ type: 'talk', who: 'neighbor' });
    }
    if (state.ap > 0) push({ type: 'rest' });
    else push({ type: 'sleep' });
  }
  push({ type: 'overnight' });
  push({ type: 'dota', won: false });
  open('tea');
  push({ type: 'talk', who: 'tea', hold: 10 });
  open('neighbor');
  push({ type: 'talk', who: 'neighbor', hold: 12 });
  if (state.debt !== 4 || state.stamina !== 8 || !state.neighborCut || state.day !== 3) {
    throw new Error(`colleague demo debt ${state.debt} stamina ${state.stamina} cut ${state.neighborCut} day ${state.day}`);
  }
  return actions;
}

function lossActions() {
  let state = createGame('loss');
  const actions = [];
  while (state.phase === 'play') {
    const action = state.ap > 0 ? { type: 'rest' } : { type: 'sleep' };
    actions.push(action);
    state = applyAction(state, action);
  }
  return actions;
}

const framesRoot = path.join(tmpdir(), 'hangzhou-proto-frames');
rmSync(framesRoot, { recursive: true, force: true });
mkdirSync(framesRoot);

async function record(name, seed, actions, { fps = 4, tail = 0, tailCopies = 1, endHold = 4 } = {}) {
  const dir = path.join(framesRoot, name);
  mkdirSync(dir);
  await goto(seed);
  let index = 0;
  const save = async (copies = 1) => {
    const file = path.join(dir, `${String(index).padStart(4, '0')}.png`);
    await shot(file);
    index += 1;
    for (let copy = 1; copy < copies; copy += 1) {
      const target = path.join(dir, `${String(index).padStart(4, '0')}.png`);
      copyFileSync(file, target);
      index += 1;
    }
  };
  await save();
  for (let i = 0; i < actions.length; i += 1) {
    await click(actions[i]);
    const copies = actions[i].hold || (i >= actions.length - tail ? tailCopies : 1);
    await save(copies);
  }
  await save(endHold);
  const file = path.join(OUT, `${name}.mp4`);
  await encode(dir, file, fps);
  return { file: path.relative(ROOT, file), frames: index };
}

try {
  await connect();
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const want = name => process.argv.length <= 2 || process.argv.includes(name);
  const report = { origin, consoleErrors: errors };

  if (want('hangzhou-loss')) {
    report.loss = await record('hangzhou-loss', 'loss', lossActions(), { fps: 4, endHold: 6 });
    report.lossTitle = await evaluate('document.querySelector("#ending-title").textContent');
    report.lossText = await evaluate('document.querySelector("#ending-text").textContent');
    if (report.lossTitle !== '被业务方投诉') throw new Error(`loss title ${report.lossTitle}`);
    if (!report.lossText.includes('被业务方投诉两次')) throw new Error(`loss ${report.lossText}`);
    if (report.lossText.startsWith(`${report.lossTitle}。`)) throw new Error(`loss joined ${report.lossText}`);
  }
  if (want('hangzhou-win')) {
    report.win = await record('hangzhou-win', 'h3', play('planned', 'h3').actions, { fps: 4, endHold: 8 });
    report.winTitle = await evaluate('document.querySelector("#ending-title").textContent');
    report.winText = await evaluate('document.querySelector("#ending-text").textContent');
    if (report.winTitle !== '一套架构，撑起五条业务线') throw new Error(`win title ${report.winTitle}`);
    if (!report.winText.includes('五张大单都按期交付')) throw new Error(`win ${report.winText}`);
    if (report.winText.startsWith(`${report.winTitle}。`)) throw new Error(`win joined ${report.winText}`);
  }
  if (want('hangzhou-debt')) {
    report.debt = await record('hangzhou-debt', 'h1', play('greedy', 'h1').actions, { fps: 4, endHold: 8 });
    report.debtTitle = await evaluate('document.querySelector("#ending-title").textContent');
    report.debtText = await evaluate('document.querySelector("#ending-text").textContent');
    if (report.debtTitle !== '需求做完了，债也欠下了') throw new Error(`debt title ${report.debtTitle}`);
    if (!report.debtText.includes('四周撑过来了')) throw new Error(`debt ${report.debtText}`);
    if (report.debtText.startsWith(`${report.debtTitle}。`)) throw new Error(`debt joined ${report.debtText}`);
  }
  if (want('hangzhou-night')) {
    report.night = await record('hangzhou-night', 'night', [
      { type: 'overnight', hold: 2 },
      { type: 'dota', won: false, hold: 8 },
    ], { fps: 4, endHold: 8 });
    report.nightText = await evaluate('document.querySelector("#night-lock").textContent');
    report.nightScene = await evaluate(`(() => ({
      scene: document.querySelector('#office').getAttribute('data-scene'),
      night: document.querySelector('#office').getAttribute('data-night'),
    }))()`);
    if (report.nightText !== '夜里只能学技能，不能做需求单') throw new Error(report.nightText);
    if (report.nightScene.scene !== 'day' || report.nightScene.night !== '1') throw new Error(JSON.stringify(report.nightScene));
  }
  if (want('hangzhou-colleagues')) {
    report.colleagues = await record('hangzhou-colleagues', 'talk', colleagueActions(), { fps: 4, endHold: 8 });
    report.colleagueView = await evaluate(`(() => ({
      debt: document.querySelector('#debt').textContent,
      stamina: document.querySelector('#stamina').textContent,
      webpack: document.querySelector('#skill-webpack').textContent,
      talk: document.querySelector('#talk-line') ? document.querySelector('#talk-line').textContent : '',
    }))()`);
    if (report.colleagueView.debt !== '4') throw new Error(`debt ${report.colleagueView.debt}`);
    if (report.colleagueView.stamina !== '8') throw new Error(`stamina ${report.colleagueView.stamina}`);
    if (report.colleagueView.webpack !== '0/2') throw new Error(`webpack ${report.colleagueView.webpack}`);
    if (!report.colleagueView.talk.includes('只要 2 点')) throw new Error(report.colleagueView.talk);
  }
  if (want('hangzhou-boss')) {
    report.boss = await record('hangzhou-boss', 'h2', bossReviewActions('h2'), { fps: 4, tail: 2, tailCopies: 8, endHold: 12 });
    report.bossView = await evaluate(`(() => ({
      debt: document.querySelector('#debt').textContent,
      banner: document.querySelector('#debt-banner').textContent,
      slots: [...document.querySelectorAll('[data-slot]')].map(node => node.getAttribute('data-label')),
    }))()`);
    if (report.bossView.banner !== '技术债 32，所有单子 +1 点') throw new Error(`banner ${report.bossView.banner}`);
    if (!report.bossView.slots.some(label => label.includes('技术债 1'))) throw new Error(report.bossView.slots.join(' | '));
  }

  if (errors.length) throw new Error(`console errors\n${errors.join('\n')}`);
  writeFileSync(path.join(OUT, 'capture-log.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error('CAPTURE_FAIL', error);
  process.exitCode = 1;
} finally {
  chrome.kill('SIGTERM');
  server.close();
  rmSync(framesRoot, { recursive: true, force: true });
}
