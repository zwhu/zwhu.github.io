// 真实 Chrome：点同事走到并弹出对话，再点空地走过去。
// node games/career-rpg/proto/tests/record-move.mjs
import { spawn } from 'node:child_process';
import { createReadStream, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const OUT = path.join(ROOT, 'games/career-rpg/proto/review');
const STILLS = path.join(OUT, 'stills');
const PROTO = '/games/career-rpg/proto/index.html';
mkdirSync(STILLS, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
};
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
  '--lang=zh-CN', '--disable-translate', '--remote-debugging-port=0',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  `--user-data-dir=${path.join(tmpdir(), 'hefei-move-chrome')}`,
  'about:blank',
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
        if (message.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(message.params.exceptionDetails).slice(0, 400));
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
  const message = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(file, Buffer.from(message.result.data, 'base64'));
}
async function goto() {
  await send('Page.navigate', { url: `${origin}?seed=hefei` });
  for (let i = 0; i < 50; i += 1) {
    await sleep(80);
    if (await evaluate('!!window.hefei')) return;
  }
  throw new Error('page did not boot');
}
async function officeRect() {
  return evaluate(`(() => {
    document.querySelector('#office').scrollIntoView({ block: 'start' });
    const rect = document.querySelector('#office').getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  })()`);
}
async function clickScene(x, y) {
  const rect = await evaluate(`(() => {
    const stage = document.querySelector('#stage').getBoundingClientRect();
    return { left: stage.left, top: stage.top, width: stage.width, height: stage.height };
  })()`);
  const point = {
    x: rect.left + (x / 640) * rect.width,
    y: rect.top + (y / 360) * rect.height,
  };
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}
async function stateOf() {
  return evaluate(`(() => {
    const view = window.hefei.present();
    const walker = window.hefei.walker();
    return {
      ap: view.ap,
      stamina: view.stamina,
      moving: walker.moving,
      pose: walker.pose,
      x: Math.round(walker.x),
      y: Math.round(walker.y),
      facing: walker.facing,
      name: document.querySelector('#nameplate')?.textContent || '',
      text: document.querySelector('#dialogue-text')?.textContent || '',
      src: document.querySelector('#walker')?.getAttribute('src') || '',
    };
  })()`);
}

const framesDir = path.join(tmpdir(), 'hefei-move-frames');
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir);

try {
  await connect();
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await goto();
  const before = await stateOf();
  if (before.pose !== 'seated' || before.ap == null) throw new Error('start ' + JSON.stringify(before));
  let index = 0;
  const save = async () => {
    await shot(path.join(framesDir, String(index).padStart(4, '0') + '.png'));
    index += 1;
  };
  await save();
  await clickScene(180, 200);
  let moved = null;
  let arrived = null;
  for (let i = 0; i < 40; i += 1) {
    await sleep(100);
    const now = await stateOf();
    await save();
    if (!moved && now.moving) moved = now;
    if (now.name === '隔壁工位老哥' && now.text.includes('先去找老板')) {
      arrived = now;
      break;
    }
  }
  if (!moved) throw new Error('walker did not move ' + JSON.stringify(await stateOf()));
  if (!arrived) throw new Error('dialogue missing ' + JSON.stringify(await stateOf()));
  if (arrived.ap !== before.ap || arrived.stamina !== before.stamina) {
    throw new Error('walk spent ap or stamina ' + JSON.stringify({ before, arrived }));
  }
  writeFileSync(path.join(STILLS, 'click-move-desktop.png'), (await import('node:fs')).readFileSync(path.join(framesDir, String(Math.max(0, index - 6)).padStart(4, '0') + '.png')));
  for (let i = 0; i < 8; i += 1) await save();
  await evaluate(`document.querySelector('[data-dialogue="close"]')?.click()`);
  await sleep(50);
  const afterTalk = await stateOf();
  await clickScene(24, 140);
  let walked = null;
  for (let i = 0; i < 50; i += 1) {
    await sleep(100);
    const now = await stateOf();
    await save();
    if (now.moving) walked = now;
    if (walked && !now.moving && !now.text) break;
  }
  const floor = await stateOf();
  if (!walked) throw new Error('empty floor did not walk ' + JSON.stringify(floor));
  if (floor.ap !== afterTalk.ap || floor.stamina !== afterTalk.stamina || floor.text) {
    throw new Error('empty floor changed the game ' + JSON.stringify({ afterTalk, floor }));
  }
  for (let i = 0; i < 6; i += 1) await save();
  const video = path.join(OUT, 'click-to-move.mp4');
  await new Promise((resolve, reject) => {
    const encoder = spawn('ffmpeg', [
      '-y', '-framerate', '10', '-i', path.join(framesDir, '%04d.png'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', video,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    encoder.stderr.on('data', chunk => { err += chunk; });
    encoder.on('exit', code => (code === 0 ? resolve() : reject(new Error(err.slice(-600)))));
  });

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await goto();
  await clickScene(180, 200);
  let phone = null;
  for (let i = 0; i < 40; i += 1) {
    await sleep(100);
    phone = await stateOf();
    if (phone.moving && phone.x >= 120) break;
  }
  if (!phone || phone.x < 120) throw new Error('phone walk ' + JSON.stringify(phone));
  await shot(path.join(STILLS, 'click-move-390.png'));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({
    video: path.relative(ROOT, video),
    frames: index,
    before,
    moved,
    arrived,
    floor,
    phone,
  }, null, 2));
} catch (error) {
  console.error('MOVE_FAIL', error);
  process.exitCode = 1;
} finally {
  chrome.kill('SIGTERM');
  server.close();
}
