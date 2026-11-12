// 从当前页面截白天/夜里，并录四向走路和场景内点击。
// node games/career-rpg/proto/nanjing/tests/record-room.mjs
import { spawn } from 'node:child_process';
import { createReadStream, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const OUT = path.join(ROOT, 'games/career-rpg/proto/nanjing/review');
const STILLS = path.join(OUT, 'stills');
const PAGE = '/games/career-rpg/proto/nanjing/index.html';
mkdirSync(STILLS, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
};
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
async function shot(file) {
  await evaluate('window.scrollTo(0, 0)');
  const message = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(file, Buffer.from(message.result.data, 'base64'));
}
async function metrics(width) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: width < 500 ? 844 : 1000,
    deviceScaleFactor: 1,
    mobile: width < 500,
  });
  await send('Page.navigate', { url: `${origin}?seed=room` });
  for (let i = 0; i < 50; i += 1) {
    await sleep(80);
    if (await evaluate('!!window.nanjing?.ready')) break;
    if (i === 49) throw new Error('page did not boot');
  }
  await evaluate('window.nanjing.act({ type: "close" })');
  return evaluate(`(() => {
    const stage = document.querySelector('#stage');
    const bar = document.querySelector('.topbar');
    const canvas = document.querySelector('#scene');
    const ribbons = document.querySelectorAll('.ribbon, .topbar .ribbon');
    const stageBox = stage.getBoundingClientRect();
    const barBox = bar.getBoundingClientRect();
    const texts = [];
    for (const node of document.querySelectorAll('body *')) {
      const direct = [...node.childNodes].some(item => item.nodeType === 3 && item.textContent.trim());
      if (!direct) continue;
      const box = node.getBoundingClientRect();
      if (box.width < 1 || box.height < 1 || box.bottom < 0 || box.top > window.innerHeight) continue;
      const size = parseFloat(getComputedStyle(node).fontSize);
      texts.push({ text: node.textContent.trim().slice(0, 40), size, top: Math.round(box.top) });
    }
    const bg = getComputedStyle(bar).backgroundColor;
    return {
      when: document.querySelector('#when')?.textContent || '',
      desk: !!document.querySelector('#desk'),
      ribbons: document.querySelectorAll('.ribbon').length,
      canvas: [canvas.width, canvas.height],
      stage: [Math.round(stageBox.width), Math.round(stageBox.height)],
      bar: [Math.round(barBox.width), Math.round(barBox.height), Math.round(barBox.bottom), Math.round(stageBox.top)],
      bg,
      image: getComputedStyle(canvas).imageRendering,
      texts,
      ribbonText: [...ribbons].map(node => node.textContent.trim().slice(0, 80)),
    };
  })()`);
}

const framesRoot = path.join(tmpdir(), 'nanjing-room-frames');
rmSync(framesRoot, { recursive: true, force: true });
mkdirSync(framesRoot);

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

async function boot(width, night) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: width < 500 ? 844 : 1000,
    deviceScaleFactor: 1,
    mobile: width < 500,
  });
  await send('Page.navigate', { url: `${origin}?seed=room` });
  for (let i = 0; i < 50; i += 1) {
    await sleep(80);
    if (await evaluate('!!window.nanjing?.ready')) break;
    if (i === 49) throw new Error('page did not boot');
  }
  if (night) {
    await evaluate('window.nanjing.act({ type: "overnight" })');
    await sleep(3200);
  }
}

const layoutProbe = `(() => {
  const scroll = document.querySelector('.stage-scroll');
  const stage = document.querySelector('#stage');
  const dock = document.querySelector('.dock');
  const view = scroll.getBoundingClientRect();
  const stageBox = stage.getBoundingClientRect();
  const scale = stageBox.width / 640;
  const foot = window.nanjing.walker().foot;
  const player = {
    left: stageBox.left + (foot.x - 28) * scale,
    top: stageBox.top + (foot.y - 54) * scale,
    right: stageBox.left + (foot.x + 28) * scale,
    bottom: stageBox.top + (foot.y + 2) * scale,
  };
  const dockBox = dock.getBoundingClientRect();
  const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const inside = box => box.left >= -1 && box.top >= -1 && box.right <= window.innerWidth + 1 && box.bottom <= window.innerHeight + 1
    && box.left >= view.left - 1 && box.right <= view.right + 1 && box.top >= view.top - 1 && box.bottom <= view.bottom + 1;
  const spot = id => {
    const node = document.querySelector('[data-target="' + id + '"]');
    if (!node) return null;
    const box = node.getBoundingClientRect();
    const cx = (box.left + box.right) / 2;
    const cy = (box.top + box.bottom) / 2;
    return { id, visible: cx >= view.left && cx <= view.right && cy >= view.top && cy <= view.bottom };
  };
  return {
    buttons: [...dock.querySelectorAll('button')].map(node => ({ text: node.textContent, inside: inside(node.getBoundingClientRect()) })),
    coversPlayer: hit(player, dockBox),
    playerInside: player.left >= view.left - 1 && player.right <= view.right + 1 && player.top >= view.top - 1 && player.bottom <= view.bottom + 1,
    board: spot('board'),
    boss: spot('boss'),
    foot,
  };
})()`;

function assertDock(probe, labels) {
  if (!probe.playerInside) throw new Error(`player clipped ${JSON.stringify(probe.foot)}`);
  if (probe.coversPlayer) throw new Error(`dock covers player ${JSON.stringify(probe)}`);
  for (const label of labels) {
    const button = probe.buttons.find(item => item.text === label);
    if (!button?.inside) throw new Error(`missing ${label} ${JSON.stringify(probe.buttons)}`);
  }
}

function assertShot(info, { night, narrow }) {
  if (info.desk) throw new Error(`popup open ${JSON.stringify(info)}`);
  if (info.ribbons > 1) throw new Error(`banners ${info.ribbons} ${info.ribbonText.join(' | ')}`);
  if (info.canvas[0] !== 640 || info.canvas[1] !== 360) throw new Error(`canvas ${info.canvas}`);
  if (info.stage[0] % 640 !== 0 || info.stage[1] % 360 !== 0) throw new Error(`stage scale ${info.stage}`);
  if (info.bar[2] > info.bar[3] + 1) throw new Error(`top bar covers scene ${info.bar}`);
  if (!info.bg.startsWith('rgb(')) throw new Error(`top bar background ${info.bg}`);
  const nightText = info.when.includes('· 夜里');
  if (night !== nightText) throw new Error(`when ${info.when}`);
  const small = info.texts.filter(item => item.size < 13);
  if (narrow && small.length) throw new Error(`small text ${JSON.stringify(small)}`);
  if (errors.length) throw new Error(errors.join('\n'));
}

async function hold(dir, index, count) {
  for (let i = 0; i < count; i += 1) {
    await shot(path.join(dir, `${String(index.n).padStart(4, '0')}.png`));
    index.n += 1;
  }
}

async function walkTo(x, y) {
  await evaluate(`window.nanjing.click(${x}, ${y})`);
  let last = null;
  for (let i = 0; i < 120; i += 1) {
    last = await evaluate('window.nanjing.walker()');
    if (last && !last.moving && i > 1) return last;
    await sleep(100);
  }
  throw new Error(`walk timeout ${x},${y} ${JSON.stringify(last)}`);
}

async function travel(x, y, dir, index) {
  const seen = new Set();
  await evaluate(`window.nanjing.click(${x}, ${y})`);
  let last = null;
  for (let i = 0; i < 120; i += 1) {
    last = await evaluate('window.nanjing.walker()');
    if (last?.facing) seen.add(last.facing);
    await shot(path.join(dir, `${String(index.n).padStart(4, '0')}.png`));
    index.n += 1;
    if (last && !last.moving && i > 1) return { last, seen };
    await sleep(100);
  }
  throw new Error(`walk timeout ${x},${y} ${JSON.stringify(last)}`);
}

try {
  await connect();
  const dayDesktop = await metrics(1440);
  assertShot(dayDesktop, { night: false, narrow: false });
  await shot(path.join(STILLS, 'ui-day-desktop.png'));
  const dayNarrow = await metrics(390);
  assertShot(dayNarrow, { night: false, narrow: true });
  const dayDock = await evaluate(layoutProbe);
  assertDock(dayDock, ['休息', '进入夜里']);
  await shot(path.join(STILLS, 'ui-day-390.png'));
  await boot(1440, true);
  const nightDesktop = await evaluate(`(() => {
    const stage = document.querySelector('#stage');
    const bar = document.querySelector('.topbar');
    const stageBox = stage.getBoundingClientRect();
    const barBox = bar.getBoundingClientRect();
    return {
      when: document.querySelector('#when').textContent,
      desk: !!document.querySelector('#desk'),
      ribbons: document.querySelectorAll('.ribbon').length,
      canvas: [document.querySelector('#scene').width, document.querySelector('#scene').height],
      stage: [Math.round(stageBox.width), Math.round(stageBox.height)],
      bar: [Math.round(barBox.width), Math.round(barBox.height), Math.round(barBox.bottom), Math.round(stageBox.top)],
      bg: getComputedStyle(bar).backgroundColor,
      texts: [],
    };
  })()`);
  assertShot(nightDesktop, { night: true, narrow: false });
  await shot(path.join(STILLS, 'ui-night-desktop.png'));
  await boot(390, true);
  const nightNarrow = await evaluate(`(() => {
    const texts = [];
    for (const node of document.querySelectorAll('body *')) {
      const direct = [...node.childNodes].some(item => item.nodeType === 3 && item.textContent.trim());
      if (!direct) continue;
      const box = node.getBoundingClientRect();
      if (box.width < 1 || box.height < 1 || box.bottom < 0 || box.top > window.innerHeight) continue;
      texts.push({ text: node.textContent.trim().slice(0, 40), size: parseFloat(getComputedStyle(node).fontSize) });
    }
    const stage = document.querySelector('#stage');
    const bar = document.querySelector('.topbar');
    const stageBox = stage.getBoundingClientRect();
    const barBox = bar.getBoundingClientRect();
    return {
      when: document.querySelector('#when').textContent,
      desk: !!document.querySelector('#desk'),
      ribbons: document.querySelectorAll('.ribbon').length,
      canvas: [document.querySelector('#scene').width, document.querySelector('#scene').height],
      stage: [Math.round(stageBox.width), Math.round(stageBox.height)],
      bar: [Math.round(barBox.width), Math.round(barBox.height), Math.round(barBox.bottom), Math.round(stageBox.top)],
      bg: getComputedStyle(bar).backgroundColor,
      texts,
    };
  })()`);
  assertShot(nightNarrow, { night: true, narrow: true });
  const nightDock = await evaluate(layoutProbe);
  assertDock(nightDock, ['睡觉']);
  await shot(path.join(STILLS, 'ui-night-390.png'));
  await boot(390, false);
  await walkTo(560, 20);
  const atBoard = await evaluate(layoutProbe);
  assertDock(atBoard, ['休息', '进入夜里']);
  if (!atBoard.board?.visible) throw new Error(`whiteboard off screen ${JSON.stringify(atBoard.board)}`);
  if (!atBoard.boss?.visible) throw new Error(`boss off screen ${JSON.stringify(atBoard.boss)}`);
  await shot(path.join(STILLS, 'ui-walk-whiteboard-390.png'));
  console.log(JSON.stringify({ dayDesktop, dayNarrow, nightDesktop, nightNarrow }, null, 2));

  await boot(1440, false);
  const walkDir = path.join(framesRoot, 'walk');
  mkdirSync(walkDir);
  const index = { n: 0 };
  const facings = new Set();
  await hold(walkDir, index, 8);
  for (const point of [[142, 230], [48, 230], [420, 230], [420, 150]]) {
    const leg = await travel(point[0], point[1], walkDir, index);
    for (const facing of leg.seen) facings.add(facing);
  }
  const back = await travel(140, 62, walkDir, index);
  for (const facing of back.seen) facings.add(facing);
  const sat = await evaluate('window.nanjing.walker()');
  if (!sat.sitting) throw new Error(`did not sit ${JSON.stringify(sat)}`);
  await evaluate(`document.querySelector('[data-action="close-desk"]')?.click()`);
  await sleep(50);
  const closed = await evaluate('!document.querySelector("#desk") && window.nanjing.walker().sitting');
  if (!closed) throw new Error('desk stayed open after sitting');
  await hold(walkDir, index, 12);
  for (const facing of ['up', 'down', 'left', 'right']) {
    if (!facings.has(facing)) throw new Error(`missing facing ${facing} saw ${[...facings].join(',')}`);
  }
  await encode(walkDir, path.join(OUT, 'walk-4dir.mp4'), 10);

  await boot(1440, false);
  const sceneDir = path.join(framesRoot, 'scene');
  mkdirSync(sceneDir);
  const sceneIndex = { n: 0 };
  await hold(sceneDir, sceneIndex, 6);
  await travel(320, 190, sceneDir, sceneIndex);
  await travel(560, 30, sceneDir, sceneIndex);
  await travel(320, 340, sceneDir, sceneIndex);
  await hold(sceneDir, sceneIndex, 10);
  const afterDoor = await evaluate(`document.querySelector('#when').textContent`);
  if (!afterDoor.includes('· 夜里')) throw new Error(`door did not enter night ${afterDoor}`);
  await encode(sceneDir, path.join(OUT, 'in-scene.mp4'), 10);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ facings: [...facings], frames: index.n, sceneFrames: sceneIndex.n, afterDoor }));
} catch (error) {
  console.error('RECORD_FAIL', error);
  process.exitCode = 1;
} finally {
  chrome.kill('SIGTERM');
  server.close();
  rmSync(framesRoot, { recursive: true, force: true });
}
