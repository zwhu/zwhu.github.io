// 用真实 Chrome 把败局、胜局和四个技能的数字变化录下来。
// node games/career-rpg/proto/tests/capture.mjs
import { spawn } from 'node:child_process';
import { createReadStream, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WIN_ACTIONS, WIN_SEED } from '../line.mjs';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const OUT = path.join(ROOT, 'games/career-rpg/proto/review');
const PROTO = '/games/career-rpg/proto/index.html';
mkdirSync(OUT, { recursive: true });
mkdirSync(path.join(OUT, 'skills'), { recursive: true });

const mime = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(ROOT, '.' + (url.endsWith('/') ? url + 'index.html' : url));
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
  const stream = createReadStream(file);
  stream.on('error', () => { res.writeHead(404); res.end(); });
  stream.on('open', () => {
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    stream.pipe(res);
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}${PROTO}`;

const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
  '--lang=zh-CN', '--disable-translate', '--remote-debugging-port=0', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
const devtools = await new Promise((resolve, reject) => {
  let log = '';
  const timer = setTimeout(() => reject(new Error('chrome timeout ' + log.slice(-500))), 20000);
  chrome.stderr.on('data', chunk => {
    log += chunk;
    const match = log.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);
    if (match) { clearTimeout(timer); resolve(Number(match[1])); }
  });
  chrome.on('exit', code => { clearTimeout(timer); reject(new Error('chrome exit ' + code)); });
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const httpGet = url => new Promise((resolve, reject) => http.get(url, res => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => resolve(data));
}).on('error', reject));

let ws;
let seq = 0;
const pending = new Map();
const errors = [];
function send(method, params = {}, timeout = 20000) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('cdp timeout ' + method)); }, timeout);
    pending.set(id, message => { clearTimeout(timer); resolve(message); });
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
        if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
        if (message.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(message.params.exceptionDetails).slice(0, 500));
        if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
          errors.push(message.params.args.map(arg => arg.value || arg.description || '').join(' '));
        }
      });
      await send('Runtime.enable');
      await send('Page.enable');
      return;
    } catch { await sleep(200); }
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
    if (await evaluate('!!window.hefei')) return;
  }
  throw new Error('page did not boot ' + seed);
}
function selector(action) {
  if (action.type === 'work') return `[data-action="work"][data-id="${action.ticketId}"]`;
  if (action.type === 'study') return `[data-action="study"][data-skill="${action.skill}"]`;
  return `[data-action="${action.type}"]`;
}
async function click(action) {
  const found = await evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector(action))});
    if (!node) return false;
    node.scrollIntoView({ block: 'center' });
    node.click();
    return true;
  })()`);
  if (!found) throw new Error('missing button ' + JSON.stringify(action));
  if (action.type === 'overnight') {
    await sleep(40);
    await evaluate(`document.querySelector('[data-dota="skip"]')?.click()`);
    await sleep(40);
    await evaluate(`document.querySelector('[data-dota="back"]')?.click()`);
  }
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

const framesRoot = path.join(tmpdir(), 'hefei-proto-frames');
rmSync(framesRoot, { recursive: true, force: true });
mkdirSync(framesRoot);

try {
  await connect();
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  await goto('s29');
  const linuxBefore = await evaluate('document.querySelector(\'[data-kind="server"]\').innerText');
  if (!linuxBefore.includes('3 点')) throw new Error('linux before ' + linuxBefore);
  await shot(path.join(OUT, 'skills/linux-before.png'));
  await click({ type: 'study', skill: 'linux' });
  await click({ type: 'study', skill: 'linux' });
  const linuxAfter = await evaluate('document.querySelector(\'[data-kind="server"]\').innerText');
  if (!linuxAfter.includes('1 点（Linux）')) throw new Error('linux after ' + linuxAfter);
  await shot(path.join(OUT, 'skills/linux-after.png'));

  await goto('s3');
  const gitBefore = await evaluate('document.querySelector(\'[data-kind="demo"]\').innerText');
  if (!gitBefore.includes('逾期 -18')) throw new Error('git before ' + gitBefore);
  await shot(path.join(OUT, 'skills/git-before.png'));
  for (let i = 0; i < 3; i += 1) await click({ type: 'study', skill: 'git' });
  const gitAfter = await evaluate('document.querySelector(\'[data-kind="demo"]\').innerText');
  if (!gitAfter.includes('逾期 -8（Git，否则 -18）')) throw new Error('git after ' + gitAfter);
  await shot(path.join(OUT, 'skills/git-after.png'));

  await goto('java');
  await click({ type: 'overnight' });
  for (let i = 0; i < 3; i += 1) await click({ type: 'study', skill: 'java' });
  const javaProgress = await evaluate('document.querySelector("#skill-java").textContent');
  const javaCard = await evaluate('!!document.querySelector(\'[data-kind="fullstack"]\')');
  if (javaProgress !== '3/4' || javaCard) throw new Error('java before ' + javaProgress + ' card=' + javaCard);
  await shot(path.join(OUT, 'skills/java-before.png'));
  await click({ type: 'study', skill: 'java' });
  const javaAfter = await evaluate('document.querySelector(\'[data-kind="fullstack"]\').innerText');
  if (!javaAfter.includes('做完 +18') || !javaAfter.includes('3 点')) throw new Error('java after ' + javaAfter);
  await shot(path.join(OUT, 'skills/java-after.png'));

  await goto(WIN_SEED);
  let jqueryShot = false;
  for (const action of WIN_ACTIONS) {
    if (action.type === 'study' && action.skill === 'jquery') {
      const progress = await evaluate('window.hefei.present().skills.find(skill => skill.id === "jquery").progress');
      if (progress === 2) {
        const ticket = await evaluate(`(() => {
          const card = [...document.querySelectorAll('[data-kind="page"]')].find(node => node.innerText.includes('3 点') && !node.innerText.includes('jQuery'));
          if (!card) return '';
          card.scrollIntoView({ block: 'center' });
          return card.innerText;
        })()`);
        if (!ticket.includes('3 点')) throw new Error('jquery before ' + ticket);
        await shot(path.join(OUT, 'skills/jquery-before.png'));
        await click(action);
        const after = await evaluate(`(() => {
          const card = document.querySelector('[data-kind="page"][data-cost="2"]');
          if (!card) return '';
          card.scrollIntoView({ block: 'center' });
          return card.innerText;
        })()`);
        if (!after.includes('2 点（jQuery）')) throw new Error('jquery after ' + after);
        await shot(path.join(OUT, 'skills/jquery-after.png'));
        jqueryShot = true;
        continue;
      }
    }
    await click(action);
  }
  if (!jqueryShot) throw new Error('jquery moment not found');
  const victory = await evaluate('document.querySelector("#ending-text").textContent');
  if (victory !== '日夜颠倒地学新东西，拼命把活干好，争取能留下来。') throw new Error('victory ' + victory);

  async function record(name, seed, actions, fps) {
    const dir = path.join(framesRoot, name);
    mkdirSync(dir);
    await goto(seed);
    let index = 0;
    const save = async () => {
      await shot(path.join(dir, String(index).padStart(4, '0') + '.png'));
      index += 1;
    };
    await save();
    for (const action of actions) {
      await click(action);
      await save();
    }
    for (let i = 0; i < fps; i += 1) await save();
    const file = path.join(OUT, name + '.mp4');
    await encode(dir, file, fps);
    return { file: path.relative(ROOT, file), frames: index };
  }

  const lossActions = [];
  await goto('hefei');
  let phase = 'play';
  while (phase === 'play') {
    const action = await evaluate('document.querySelector(\'[data-action="rest"]\') ? "rest" : "sleep"');
    lossActions.push({ type: action });
    await click({ type: action });
    phase = await evaluate('window.hefei.present().phase');
  }
  const loss = await record('loss', 'hefei', lossActions, 2);
  const lossText = await evaluate('document.querySelector("#ending-text").textContent');
  if (!lossText.includes('第 1 周周五') || !lossText.includes('被劝退')) throw new Error('loss ' + lossText);

  const win = await record('win', WIN_SEED, WIN_ACTIONS, 2);
  const winText = await evaluate('document.querySelector("#ending-text").textContent');
  if (winText !== victory) throw new Error('win video ended on ' + winText);

  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await goto('hefei');
  await shot(path.join(OUT, 'mobile-open.png'));
  await click({ type: 'rest' });
  await shot(path.join(OUT, 'mobile-after-rest.png'));

  if (errors.length) throw new Error('console errors\n' + errors.join('\n'));
  const report = {
    origin,
    loss,
    win,
    victory,
    lossText,
    skills: {
      linux: ['games/career-rpg/proto/review/skills/linux-before.png', 'games/career-rpg/proto/review/skills/linux-after.png'],
      git: ['games/career-rpg/proto/review/skills/git-before.png', 'games/career-rpg/proto/review/skills/git-after.png'],
      jquery: ['games/career-rpg/proto/review/skills/jquery-before.png', 'games/career-rpg/proto/review/skills/jquery-after.png'],
      java: ['games/career-rpg/proto/review/skills/java-before.png', 'games/career-rpg/proto/review/skills/java-after.png'],
    },
    consoleErrors: errors,
  };
  writeFileSync(path.join(OUT, 'capture-log.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error('CAPTURE_FAIL', error);
  process.exitCode = 1;
} finally {
  chrome.kill('SIGTERM');
  server.close();
  rmSync(framesRoot, { recursive: true, force: true });
}
