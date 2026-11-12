// 从当前页面截白天、夜里和四向走路。node games/career-rpg/proto/hangzhou/tests/review-room.mjs
import { spawn } from 'node:child_process';
import { createReadStream, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../../../..');
const OUT = path.join(ROOT, 'games/career-rpg/proto/hangzhou/review');
const STILLS = path.join(OUT, 'stills');
const PAGE = '/games/career-rpg/proto/hangzhou/index.html';
mkdirSync(STILLS, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.json': 'application/json',
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
const origin = `http://127.0.0.1:${server.address().port}${PAGE}?seed=hangzhou`;

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
async function metrics(width, height) {
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width < 500,
  });
  await evaluate('window.dispatchEvent(new Event("resize"))');
  await sleep(40);
}
async function shot(file) {
  const box = await evaluate(`(() => {
    const rect = document.querySelector('.stage').getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  })()`);
  const message = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { ...box, scale: 1 },
    captureBeyondViewport: true,
  });
  writeFileSync(file, Buffer.from(message.result.data, 'base64'));
}
async function encode(dir, file) {
  await new Promise((resolve, reject) => {
    const encoder = spawn('ffmpeg', [
      '-y', '-framerate', '10', '-i', path.join(dir, '%04d.png'),
      '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', file,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    encoder.stderr.on('data', chunk => { err += chunk; });
    encoder.on('exit', code => (code === 0 ? resolve() : reject(new Error(err.slice(-800)))));
  });
}

const framesRoot = path.join(tmpdir(), 'hangzhou-room-review');
rmSync(framesRoot, { recursive: true, force: true });
mkdirSync(framesRoot);

try {
  await connect();
  await send('Page.navigate', { url: origin });
  for (let i = 0; i < 50; i += 1) {
    await sleep(80);
    if (await evaluate('!!window.hangzhou')) break;
    if (i === 49) throw new Error('page did not boot');
  }
  await evaluate(`(() => {
    window.requestAnimationFrame = () => 0;
    return true;
  })()`);
  await evaluate(`Promise.all([...document.images].map(img => img.decode().catch(() => {})))`);
  await sleep(80);

  const layout = `(() => {
    const stage = document.querySelector('.stage');
    const hud = document.querySelector('.hud');
    const field = document.querySelector('.playfield');
    const hudBox = hud.getBoundingClientRect();
    const fieldBox = field.getBoundingClientRect();
    const scene = document.querySelector('.scene');
    const walker = document.querySelector('#walker');
    const small = [];
    for (const node of stage.querySelectorAll('*')) {
      const text = [...node.childNodes].filter(item => item.nodeType === 3).map(item => item.textContent.trim()).join('');
      if (!text) continue;
      const size = parseFloat(getComputedStyle(node).fontSize);
      const box = node.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;
      if (size < 13) small.push({ text: text.slice(0, 24), size, cls: node.className });
    }
    const bg = getComputedStyle(hud).backgroundColor;
    return {
      when: document.querySelector('#when').textContent,
      banners: document.querySelectorAll('.scene-notes > *').length,
      panel: !!document.querySelector('.scene-panel, #talk'),
      hudOpaque: bg === 'rgb(249, 248, 241)',
      hudAbove: hudBox.bottom <= fieldBox.top + 0.6,
      scale: fieldBox.width / 640,
      sceneFilter: getComputedStyle(scene).imageRendering,
      walkerFilter: getComputedStyle(walker).imageRendering,
      small,
      foot: window.hangzhou.foot(),
    };
  })()`;

  await metrics(1280, 900);
  const desktop = await evaluate(layout);
  if (desktop.panel) throw new Error('day desktop opened a panel');
  if (desktop.banners > 1) throw new Error(`day banners ${desktop.banners}`);
  if (!desktop.hudOpaque || !desktop.hudAbove) throw new Error(`hud ${JSON.stringify(desktop)}`);
  if (Math.abs(desktop.scale - 2) > 0.02) throw new Error(`desktop scale ${desktop.scale}`);
  if (desktop.sceneFilter !== 'pixelated' || desktop.walkerFilter !== 'pixelated') throw new Error('image rendering');
  await shot(path.join(STILLS, 'ui-day-1280.png'));

  await metrics(390, 844);
  const narrow = await evaluate(layout);
  if (narrow.panel) throw new Error('390 opened a panel');
  if (narrow.banners > 1) throw new Error(`390 banners ${narrow.banners}`);
  if (!narrow.hudOpaque || !narrow.hudAbove) throw new Error(`390 hud ${JSON.stringify(narrow)}`);
  if (narrow.small.length) throw new Error(`390 font ${JSON.stringify(narrow.small)}`);
  if (Math.abs(narrow.scale - 1) > 0.02) throw new Error(`390 scale ${narrow.scale}`);
  const phoneProbe = `(() => {
    const scroll = document.querySelector('.stage-scroll');
    const field = document.querySelector('.playfield');
    const dock = document.querySelector('.scene-actions');
    const view = scroll.getBoundingClientRect();
    const fieldBox = field.getBoundingClientRect();
    const scale = fieldBox.width / 640;
    const foot = window.hangzhou.foot();
    const player = {
      left: fieldBox.left + (foot.x - 28) * scale,
      top: fieldBox.top + (foot.y - 52) * scale,
      right: fieldBox.left + (foot.x + 28) * scale,
      bottom: fieldBox.top + (foot.y + 4) * scale,
    };
    const dockBox = dock.getBoundingClientRect();
    const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const inside = box => box.left >= view.left - 1 && box.right <= view.right + 1 && box.top >= view.top - 1 && box.bottom <= view.bottom + 1
      && box.bottom <= window.innerHeight + 1 && box.top >= -1;
    const spot = id => {
      const node = document.querySelector('[data-spot="' + id + '"]');
      if (!node) return null;
      const box = node.getBoundingClientRect();
      const cx = (box.left + box.right) / 2;
      const cy = (box.top + box.bottom) / 2;
      return { id, visible: cx >= view.left && cx <= view.right && cy >= view.top && cy <= view.bottom };
    };
    const buttons = [...dock.querySelectorAll('button')].map(node => {
      const box = node.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const target = document.elementFromPoint(x, y);
      return {
        text: node.textContent,
        inside: inside(box),
        tapped: target === node || node.contains(target),
      };
    });
    return {
      scale,
      buttons,
      coversPlayer: hit(player, dockBox),
      playerInside: player.left >= view.left - 1 && player.right <= view.right + 1 && player.top >= view.top - 1 && player.bottom <= view.bottom + 1,
      board: spot('board'),
      cooler: spot('cooler'),
      door: spot('door'),
      foot,
    };
  })()`;
  function assertPhone(probe, labels) {
    if (Math.abs(probe.scale - 1) > 0.02) throw new Error(`phone scale ${probe.scale}`);
    if (!probe.playerInside) throw new Error(`player clipped ${JSON.stringify(probe.foot)}`);
    if (probe.coversPlayer) throw new Error(`buttons cover player ${JSON.stringify(probe.foot)}`);
    for (const label of labels) {
      const button = probe.buttons.find(item => item.text === label);
      if (!button?.inside || !button.tapped) throw new Error(`button ${label} ${JSON.stringify(probe.buttons)}`);
    }
  }
  async function assertBanner(where) {
    const banner = await evaluate(`(() => {
      const node = document.querySelector('.scene-notes p');
      const notes = document.querySelector('.scene-notes');
      const stage = document.querySelector('.stage');
      if (!node || !notes || !stage) return { ok: false, reason: 'missing' };
      const box = node.getBoundingClientRect();
      const bar = notes.getBoundingClientRect();
      const frame = stage.getBoundingClientRect();
      const hud = document.querySelector('.hud').getBoundingClientRect();
      return {
        ok: bar.left <= frame.left + 1 && bar.right >= frame.right - 1
          && box.left >= frame.left - 1 && box.right <= frame.right + 1
          && bar.top >= hud.bottom - 1 && bar.top <= hud.bottom + 2
          && node.scrollWidth <= node.clientWidth + 2,
        text: node.textContent,
        topGap: bar.top - hud.bottom,
        left: box.left - frame.left,
        right: frame.right - box.right,
        scroll: node.scrollWidth,
        client: node.clientWidth,
      };
    })()`);
    if (!banner.ok) throw new Error(`banner ${where} ${JSON.stringify(banner)}`);
    return banner;
  }
  async function walkTo(x, y) {
    await evaluate(`window.hangzhou.clickScene(${x}, ${y})`);
    for (let i = 0; i < 400; i += 1) {
      const moving = await evaluate('window.hangzhou.walking()');
      if (!moving && i > 0) return await evaluate('window.hangzhou.foot()');
      if (moving) await evaluate('window.hangzhou.pump(40)');
    }
    throw new Error(`walk timeout ${x},${y}`);
  }
  assertPhone(await evaluate(phoneProbe), ['休息', '入夜']);
  await assertBanner('day-b1');
  await shot(path.join(STILLS, 'ui-day-390.png'));
  const dayStops = [[40, 108, 'day-left'], [336, 338, 'day-middle'], [546, 206, 'day-right']];
  for (const [x, y, name] of dayStops) {
    await walkTo(x, y);
    assertPhone(await evaluate(phoneProbe), ['休息', '入夜']);
    await assertBanner(name);
  }
  const atBoard = await evaluate(phoneProbe);
  if (!atBoard.board?.visible) throw new Error(`whiteboard off screen ${JSON.stringify(atBoard)}`);
  await shot(path.join(STILLS, 'ui-walk-whiteboard-390.png'));

  await metrics(1280, 900);
  await evaluate(`document.querySelector('[data-action="enter-night"]').click()`);
  await sleep(60);
  const night = await evaluate(layout);
  if (!night.when.includes('· 夜里')) throw new Error(night.when);
  if (night.banners > 1) throw new Error(`night banners ${night.banners}`);
  if (!night.foot.seated) throw new Error(`night foot ${JSON.stringify(night.foot)}`);
  await shot(path.join(STILLS, 'night-seated.png'));
  await shot(path.join(STILLS, 'ui-night-1280.png'));

  await metrics(390, 844);
  const nightNarrow = await evaluate(layout);
  if (!nightNarrow.when.includes('· 夜里')) throw new Error(nightNarrow.when);
  if (nightNarrow.small.length) throw new Error(`390 night font ${JSON.stringify(nightNarrow.small)}`);
  if (nightNarrow.banners > 1) throw new Error(`390 night banners ${nightNarrow.banners}`);
  if (Math.abs(nightNarrow.scale - 1) > 0.02) throw new Error(`390 night scale ${nightNarrow.scale}`);
  assertPhone(await evaluate(phoneProbe), ['休息', '打 Dota', '睡觉']);
  await assertBanner('night-b1');
  await shot(path.join(STILLS, 'ui-night-390.png'));
  await walkTo(40, 108);
  assertPhone(await evaluate(phoneProbe), ['休息', '打 Dota', '睡觉']);
  await assertBanner('night-left');
  await walkTo(546, 206);
  assertPhone(await evaluate(phoneProbe), ['休息', '打 Dota', '睡觉']);
  await assertBanner('night-right');
  await walkTo(336, 338);
  const atDoor = await evaluate(phoneProbe);
  assertPhone(atDoor, ['休息', '打 Dota', '睡觉']);
  await assertBanner('night-middle');
  if (!atDoor.door?.visible) throw new Error(`door off screen ${JSON.stringify(atDoor)}`);
  await shot(path.join(STILLS, 'night-at-door.png'));

  await send('Page.navigate', { url: origin });
  for (let i = 0; i < 50; i += 1) {
    await sleep(80);
    if (await evaluate('!!window.hangzhou && !window.hangzhou.present().night')) break;
    if (i === 49) throw new Error('day reload failed');
  }
  await evaluate('window.requestAnimationFrame = () => 0');
  await metrics(1280, 900);
  await evaluate(`document.querySelector('[data-action="enter-night"]').click()`);
  await sleep(40);

  async function grab(dir, index) {
    const file = path.join(dir, `${String(index).padStart(4, '0')}.png`);
    await shot(file);
    return index + 1;
  }
  async function hold(dir, index, copies) {
    const file = path.join(dir, `${String(index).padStart(4, '0')}.png`);
    await shot(file);
    let next = index + 1;
    const bytes = await import('node:fs').then(fs => fs.readFileSync(file));
    for (let copy = 1; copy < copies; copy += 1) {
      writeFileSync(path.join(dir, `${String(next).padStart(4, '0')}.png`), bytes);
      next += 1;
    }
    return next;
  }
  async function march(dir, index, x, y) {
    await evaluate(`window.hangzhou.clickScene(${x}, ${y})`);
    let next = index;
    const seen = new Set();
    for (let i = 0; i < 360; i += 1) {
      const state = await evaluate(`(() => {
        const foot = window.hangzhou.foot();
        return { moving: window.hangzhou.walking(), facing: window.hangzhou.facing(), x: Math.round(foot.x), y: Math.round(foot.y), seated: foot.seated };
      })()`);
      seen.add(state.facing);
      next = await grab(dir, next);
      if (!state.moving) return { index: next, seen, end: state };
      await evaluate('window.hangzhou.pump(40)');
    }
    throw new Error(`walk stuck ${x},${y}`);
  }

  const nightDir = path.join(framesRoot, 'night');
  mkdirSync(nightDir);
  let frame = await hold(nightDir, 0, 8);
  const toDoor = await march(nightDir, frame, 336, 338);
  frame = await hold(nightDir, toDoor.index, 10);
  const back = await march(nightDir, frame, 226, 247);
  frame = back.index;
  await evaluate('window.hangzhou.sitAtDesk()');
  const seatedAgain = await evaluate('window.hangzhou.foot()');
  if (!seatedAgain.seated) throw new Error(`not seated ${JSON.stringify(seatedAgain)}`);
  if (await evaluate('!!document.querySelector(".scene-panel, #dota")')) throw new Error('night sit opened a panel');
  frame = await hold(nightDir, frame, 12);
  await encode(nightDir, path.join(OUT, 'hangzhou-night.mp4'));

  await send('Page.navigate', { url: origin });
  for (let i = 0; i < 50; i += 1) {
    await sleep(80);
    if (await evaluate('!!window.hangzhou && !window.hangzhou.present().night')) break;
  }
  await evaluate('window.requestAnimationFrame = () => 0');
  await metrics(1280, 900);
  await evaluate(`Promise.all([...document.images].map(img => img.decode().catch(() => {})))`);

  const walkDir = path.join(framesRoot, 'walk');
  mkdirSync(walkDir);
  frame = await hold(walkDir, 0, 6);
  const legs = [
    [228, 320],
    [48, 320],
    [520, 320],
    [520, 150],
  ];
  const facings = [];
  for (const [x, y] of legs) {
    const leg = await march(walkDir, frame, x, y);
    frame = leg.index;
    facings.push([...leg.seen]);
    frame = await hold(walkDir, frame, 4);
  }
  const homeLeg = await march(walkDir, frame, 226, 247);
  frame = homeLeg.index;
  await evaluate('window.hangzhou.sitAtDesk()');
  frame = await hold(walkDir, frame, 12);
  const home = await evaluate('window.hangzhou.foot()');
  if (!home.seated) throw new Error(`walk end ${JSON.stringify(home)}`);
  const dirs = new Set(facings.flat());
  for (const dir of ['up', 'down', 'left', 'right']) {
    if (!dirs.has(dir)) throw new Error(`missing ${dir} ${JSON.stringify(facings)}`);
  }
  await encode(walkDir, path.join(OUT, 'walk-4dir.mp4'));
  await shot(path.join(STILLS, 'walk-4dir.png'));

  await metrics(390, 844);
  const phoneDir = path.join(framesRoot, 'walk-390');
  mkdirSync(phoneDir);
  frame = await hold(phoneDir, 0, 6);
  const phoneLegs = [
    [228, 320],
    [48, 320],
    [520, 320],
    [520, 150],
  ];
  const phoneFacings = [];
  for (const [x, y] of phoneLegs) {
    const leg = await march(phoneDir, frame, x, y);
    frame = leg.index;
    phoneFacings.push([...leg.seen]);
    frame = await hold(phoneDir, frame, 4);
  }
  const phoneHome = await march(phoneDir, frame, 226, 247);
  frame = phoneHome.index;
  await evaluate('window.hangzhou.sitAtDesk()');
  frame = await hold(phoneDir, frame, 12);
  const phoneSeat = await evaluate('window.hangzhou.foot()');
  if (!phoneSeat.seated) throw new Error(`390 walk end ${JSON.stringify(phoneSeat)}`);
  const phoneDirs = new Set(phoneFacings.flat());
  for (const dir of ['up', 'down', 'left', 'right']) {
    if (!phoneDirs.has(dir)) throw new Error(`390 missing ${dir} ${JSON.stringify(phoneFacings)}`);
  }
  await assertPhone(await evaluate(phoneProbe), ['休息', '入夜']);
  await assertBanner('walk-390-seated');
  await encode(phoneDir, path.join(OUT, 'walk-390.mp4'));

  console.log(JSON.stringify({
    desktopScale: desktop.scale,
    night: night.when,
    toDoor: toDoor.end,
    facings,
    frames: frame,
  }, null, 2));
} catch (error) {
  console.error('REVIEW_FAIL', error);
  process.exitCode = 1;
} finally {
  chrome.kill('SIGTERM');
  server.close();
}
