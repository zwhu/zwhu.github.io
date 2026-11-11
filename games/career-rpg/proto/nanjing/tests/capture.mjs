// 用无头 Chrome 真实点击，录一局输、一局赢、一场 Boss 排查。
// node games/career-rpg/proto/nanjing/tests/capture.mjs
import { spawn } from 'node:child_process';
import { createReadStream, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { play } from '../sim.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const OUT = path.join(ROOT, 'games/career-rpg/proto/nanjing/review');
const PAGE = '/games/career-rpg/proto/nanjing/index.html';
mkdirSync(OUT, { recursive: true });

const mime = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(ROOT, `.${url.endsWith('/') ? `${url}index.html` : url}`);
  if (!file.startsWith(`${ROOT}${path.sep}`)) {
    res.writeHead(403);
    res.end();
    return;
  }
  const stream = createReadStream(file);
  stream.on('error', () => { res.writeHead(404); res.end(); });
  stream.on('open', () => {
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
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
  const id = seq + 1;
  seq = id;
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
async function shot(file, target) {
  await evaluate(`(() => {
    const node = ${target ? `document.querySelector(${JSON.stringify(target)})` : 'null'};
    if (node) node.scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
  })()`);
  const message = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(file, Buffer.from(message.result.data, 'base64'));
}
async function visibleText() {
  return evaluate(`(() => {
    const nodes = [...document.querySelectorAll('#chance-banner, #boss-card, #boss-pressure, #talk, #log li, #ending-text, #rep')];
    return nodes.filter(node => {
      const box = node.getBoundingClientRect();
      return box.bottom > 0 && box.top < window.innerHeight && box.height > 0;
    }).map(node => node.innerText).join('\\n');
  })()`);
}
async function goto(seed) {
  await send('Page.navigate', { url: `${origin}?seed=${encodeURIComponent(seed)}` });
  for (let i = 0; i < 50; i += 1) {
    await sleep(80);
    if (await evaluate('!!window.nanjing')) return;
  }
  throw new Error(`page did not boot ${seed}`);
}
function selector(action) {
  if (action.type === 'work') return `[data-action="work"][data-id="${action.ticketId}"]`;
  if (action.type === 'test') return `[data-action="test"][data-id="${action.ticketId}"]`;
  if (action.type === 'study') return `[data-action="study"][data-skill="${action.skill}"]`;
  if (action.type === 'locate' || action.type === 'fix' || action.type === 'rollback') {
    return `[data-action="${action.type}"][data-id="${action.incidentId}"]`;
  }
  if (action.type === 'review') return `[data-action="review"][data-target="${action.target}"]`;
  if (action.type === 'boss') return `[data-action="boss"][data-option="${action.option}"]`;
  if (action.type === 'talk') return `[data-person="${action.person}"]`;
  if (action.type === 'qa-yes') return '[data-action="qa-yes"]';
  if (action.type === 'ship') {
    const canary = action.canary ? '1' : '0';
    if (action.ticketIds.length > 1) return `[data-action="ship-batch"][data-canary="${canary}"]`;
    return `[data-action="ship"][data-id="${action.ticketIds[0]}"][data-canary="${canary}"]`;
  }
  return `[data-action="${action.type}"]`;
}
async function click(action) {
  if (action.type === 'dota') {
    await evaluate(`document.querySelector('[data-dota="skip"]')?.click()`);
    await sleep(40);
    await evaluate(`document.querySelector('[data-dota="back"]')?.click()`);
    return;
  }
  const found = await evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector(action))});
    if (!node) return false;
    node.scrollIntoView({ block: 'center' });
    node.click();
    return true;
  })()`);
  if (!found) throw new Error(`missing button ${JSON.stringify(action)} :: ${await evaluate('document.body.innerText.slice(0, 400)')}`);
}
async function encode(framesDir, file, fps) {
  await new Promise((resolve, reject) => {
    const encoder = spawn('ffmpeg', [
      '-y', '-framerate', String(fps), '-i', path.join(framesDir, '%04d.png'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', file,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    encoder.stderr.on('data', chunk => { err += chunk; });
    encoder.on('exit', code => (code === 0 ? resolve() : reject(new Error(err.slice(-600)))));
  });
}

const framesRoot = path.join(tmpdir(), 'nanjing-proto-frames');
rmSync(framesRoot, { recursive: true, force: true });
mkdirSync(framesRoot);

function dwellFor(action) {
  if (action.type === 'pm-yes' || (action.type === 'talk' && action.person === 'pm')) return 6;
  if (action.type === 'boss' || action.type === 'talk') return 4;
  return 1;
}

try {
  await connect();
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  async function record(name, seed, actions, fps, focus) {
    const dir = path.join(framesRoot, name);
    mkdirSync(dir);
    await goto(seed);
    const opened = await evaluate('new URL(location.href).searchParams.get("seed")');
    if (opened !== seed) throw new Error(`seed ${opened}`);
    let index = 0;
    const texts = [];
    const onScreen = [];
    const save = async (times, target) => {
      for (let i = 0; i < times; i += 1) {
        await shot(path.join(dir, `${String(index).padStart(4, '0')}.png`), target);
        if (focus) onScreen.push(await visibleText());
        index += 1;
      }
    };
    await save(2);
    for (const action of actions) {
      const before = action.type === 'boss' ? await evaluate(`document.querySelector('#rep')?.textContent || ''`) : '';
      await click(action);
      await sleep(20);
      if (action.type === 'talk' || action.type === 'pm-yes' || action.type === 'boss') {
        const text = await evaluate('document.body.innerText');
        texts.push(before ? `${text}\nREP ${before} -> ${await evaluate(`document.querySelector('#rep')?.textContent || ''`)}` : text);
      }
      if (focus && action.type === 'boss') {
        if (await evaluate('!!document.querySelector("#boss-card")')) await save(4, '#boss-card');
        await save(8, '#log');
      } else if (focus && (action.type === 'pm-yes' || (action.type === 'talk' && action.person === 'pm'))) {
        await save(8);
      } else if (focus && action.type === 'talk' && action.person === 'boss') {
        await save(6, '#boss-card');
      } else {
        await save(dwellFor(action));
      }
    }
    await save(fps * 2, focus ? '#ending' : undefined);
    const file = path.join(OUT, `${name}.mp4`);
    await encode(dir, file, fps);
    const ending = await evaluate(`document.querySelector('#ending-text')?.textContent || ''`);
    const extra = await evaluate(`document.querySelector('#to-hangzhou')?.textContent || ''`);
    return { file: path.relative(ROOT, file), frames: index, ending, extra, texts, onScreen };
  }

  const modes = process.argv.slice(2);
  const want = name => modes.length === 0 || modes.includes(name);
  const report = {};
  if (want('loss')) {
    const loss = await record('nanjing-loss', 'n0', play('n0', 'greedy').actions, 5);
    if (!loss.ending.includes('约谈')) throw new Error(`loss ending ${loss.ending}`);
    report.loss = { file: loss.file, frames: loss.frames, ending: loss.ending, seed: 'n0' };
  }
  if (want('win')) {
    const win = await record('nanjing-win', 'n0', play('n0', 'planned').actions, 5);
    if (!win.ending.includes('扛住了，也学会了怎么扛') || !win.extra.includes('去杭州') || !win.extra.includes('去阿里')) {
      throw new Error(`win ending ${win.ending} ${win.extra}`);
    }
    report.win = { file: win.file, frames: win.frames, ending: win.ending, extra: win.extra, seed: 'n0' };
  }
  if (want('alive')) {
    const alive = await record('nanjing-alive', 'n1', play('n1', 'planned').actions, 5);
    if (!alive.ending.includes('论坛还活着，你也还在') || !alive.ending.includes('口碑还没到 34') || alive.ending.includes('扛住了')) {
      throw new Error(`alive ending ${alive.ending}`);
    }
    report.alive = { file: alive.file, frames: alive.frames, ending: alive.ending, seed: 'n1' };
  }
  if (want('boss')) {
    const boss = await record('nanjing-boss', 'n0', play('n0', 'demo').actions, 3, true);
    const blob = boss.texts.join('\n');
    const shown = boss.onScreen.join('\n');
    for (const phrase of ['产品经理', '30% 变成 45%', '30% → 45%', '首页登不上', '好了没', '对不上', '少走了一步']) {
      if (!blob.includes(phrase)) throw new Error(`boss video missed ${phrase}`);
      if (!shown.includes(phrase)) throw new Error(`boss video phrase off screen ${phrase}`);
    }
    const repChange = blob.match(/REP (\d+) -> (\d+)/);
    if (!repChange || Number(repChange[2]) >= Number(repChange[1])) throw new Error(`boss rep did not drop ${repChange}`);
    report.boss = { file: boss.file, frames: boss.frames, rep: repChange[0], seed: 'n0' };
  }
  if (errors.length) throw new Error(`console errors\n${errors.join('\n')}`);
  report.consoleErrors = errors;
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
