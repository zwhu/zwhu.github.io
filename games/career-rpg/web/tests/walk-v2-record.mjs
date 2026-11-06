// In-game footage of the player-walk-v2 cycle. Real page, real keyboard, no sprite demo.
// node games/career-rpg/web/tests/walk-v2-record.mjs
import {spawn} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync, createReadStream, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import http from 'node:http';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const OUT = path.join(ROOT, 'games/career-rpg/web/review/walk-v2');
const STILLS = path.join(OUT, 'stills');
const FRAMES = path.join(tmpdir(), 'career-walk-v2-frames');
mkdirSync(STILLS, {recursive: true});
rmSync(FRAMES, {recursive: true, force: true});
mkdirSync(FRAMES, {recursive: true});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const mime = {'.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp'};
const CODES = {ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40, Enter: 13, e: 69};
const NAMES = ['idle', 'walk-01', 'walk-02', 'walk-03', 'walk-04', 'walk-05', 'walk-06'];

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(ROOT, '.' + (url.endsWith('/') ? url + 'index.html' : url));
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
  const stream = createReadStream(file);
  stream.on('error', () => { res.writeHead(404); res.end(); });
  stream.on('open', () => { res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'}); stream.pipe(res); });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const origin = `http://127.0.0.1:${port}/games/career-rpg/web/`;
const chrome = spawn('google-chrome-stable', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader-webgl',
  '--autoplay-policy=no-user-gesture-required', '--lang=zh-CN', '--disable-translate', '--hide-scrollbars',
  '--remote-debugging-port=0', 'about:blank',
], {stdio: ['ignore', 'ignore', 'pipe']});
const devtools = await new Promise((resolve, reject) => {
  let log = '';
  const timer = setTimeout(() => reject(new Error('chrome timeout ' + log.slice(-400))), 20000);
  chrome.stderr.on('data', chunk => {
    log += chunk;
    const match = log.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);
    if (match) { clearTimeout(timer); resolve(Number(match[1])); }
  });
  chrome.on('exit', code => { clearTimeout(timer); reject(new Error('chrome exit ' + code)); });
});
const httpGet = url => new Promise((resolve, reject) => http.get(url, res => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => resolve(data));
}).on('error', reject));
let ws, seq = 0;
const pending = new Map();
function send(method, params = {}, timeout = 30000) {
  const id = ++seq;
  ws.send(JSON.stringify({id, method, params}));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('cdp timeout ' + method)); }, timeout);
    pending.set(id, message => { clearTimeout(timer); resolve(message); });
  });
}
async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const tabs = JSON.parse(await httpGet(`http://127.0.0.1:${devtools}/json`));
      const page = tabs.find(tab => tab.type === 'page');
      ws = new WebSocket(page.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve, {once: true});
        ws.addEventListener('error', () => reject(new Error('ws')), {once: true});
      });
      ws.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
      });
      await send('Runtime.enable');
      await send('Page.enable');
      return;
    } catch { await sleep(200); }
  }
  throw new Error('chrome not ready');
}
async function evaluate(expression) {
  const message = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
  if (message.result?.exceptionDetails) throw new Error(JSON.stringify(message.result.exceptionDetails).slice(0, 800));
  return message.result?.result?.value;
}
const state = () => evaluate('window.careerPrototype ? careerPrototype.snapshot() : null');
async function key(type, name) {
  await send('Input.dispatchKeyEvent', {type, key: name, code: name, windowsVirtualKeyCode: CODES[name] || 0});
}
async function shot(file, clip) {
  const message = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false, ...(clip ? {clip} : {})});
  const buffer = Buffer.from(message.result.data, 'base64');
  if (file) writeFileSync(file, buffer);
  return buffer;
}
function columnOf(frame) { return frame % 7; }
function cyclesOf(columns) {
  const changes = columns.filter((col, i) => i === 0 || col !== columns[i - 1]);
  for (let i = 1; i < changes.length; i++) {
    const expect = changes[i - 1] === 6 ? 1 : changes[i - 1] + 1;
    if (changes[i] !== expect) return {cycles: 0, broken: true, at: changes[i], expect, changes};
  }
  return {cycles: changes.filter(col => col === 6).length, broken: false, changes};
}

const runs = [];
try {
  await connect();
  await send('Emulation.setDeviceMetricsOverride', {width: 384, height: 216, deviceScaleFactor: 1, mobile: false});
  await send('Page.navigate', {url: origin});
  let ready = null;
  for (let i = 0; i < 80 && !ready; i++) { await sleep(150); ready = await state(); }
  if (!ready) throw new Error(await evaluate('document.body.innerText.slice(0, 400)'));
  await evaluate(`(() => {
    const css = document.createElement('style');
    css.textContent = 'html,body{margin:0;background:#e8dfc8;overflow:hidden}main{max-width:none;margin:0;padding:0}header,nav,.script-fallback,#save-status,.controls,.note,#chapter-summary{display:none!important}.game-shell{border:0;margin:0;background:#e8dfc8}#stage{width:384px;height:216px;aspect-ratio:auto;outline:none}';
    document.head.append(css);
  })()`);
  await sleep(250);
  await evaluate(`document.querySelector('#close-dialogue')?.click()`);
  await sleep(200);
  await evaluate(`document.querySelector('#stage').focus()`);
  const opened = await state();
  if (opened.state !== 'explore') throw new Error('not exploring ' + opened.state);
  const clip = await evaluate(`(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })()`);
  if (Math.round(clip.width) !== 384 || Math.round(clip.height) !== 216) throw new Error('stage ' + JSON.stringify(clip));
  const view = {x: Math.round(clip.x), y: Math.round(clip.y), width: 384, height: 216, scale: 1};

  async function seek(axis, target) {
    await evaluate(`document.querySelector('#stage').focus()`);
    let snap = await state();
    const initial = target - snap.position[axis];
    if (Math.abs(initial) > 3) {
      const name = axis === 'x' ? (initial > 0 ? 'ArrowRight' : 'ArrowLeft') : (initial > 0 ? 'ArrowDown' : 'ArrowUp');
      await key('keyDown', name);
      const started = Date.now();
      while (Date.now() - started < 8000) {
        await sleep(20);
        snap = await state();
        const delta = target - snap.position[axis];
        if (Math.abs(delta) <= 3 || Math.sign(delta) !== Math.sign(initial)) break;
      }
      await key('keyUp', name);
      await sleep(90);
    }
    for (let i = 0; i < 12; i++) {
      snap = await state();
      const delta = target - snap.position[axis];
      if (Math.abs(delta) <= 0.6 && !snap.moving && columnOf(snap.frames.player) === 0) return snap;
      const name = axis === 'x' ? (delta > 0 ? 'ArrowRight' : 'ArrowLeft') : (delta > 0 ? 'ArrowDown' : 'ArrowUp');
      await evaluate(`document.querySelector('#stage').focus()`);
      await key('keyDown', name);
      await sleep(20);
      await key('keyUp', name);
      await sleep(70);
    }
    throw new Error('seek ' + axis + ' ' + target + ' ' + JSON.stringify((await state()).position));
  }

  async function record(direction, name, done) {
    await evaluate(`document.querySelector('#stage').focus()`);
    const before = await state();
    if (columnOf(before.frames.player) !== 0) throw new Error(direction + ' did not start idle ' + before.frames.player);
    const idleBefore = await shot(path.join(STILLS, `${direction}-idle-before.png`), view);
    await key('keyDown', name);
    const samples = [];
    const started = Date.now();
    let guard = before.position;
    let primed = false;
    while (Date.now() - started < 12000) {
      const now = Date.now();
      const snap = await state();
      if (!primed) {
        if (!snap.moving) {
          if (Date.now() - started > 1000) throw new Error(direction + ' never started ' + JSON.stringify(snap.position));
          continue;
        }
        primed = true;
        guard = snap.position;
      }
      const lane = direction === 'left' || direction === 'right' ? Math.abs(snap.position.y - 155) : Math.abs(snap.position.x - 125);
      if (lane > 1.2) throw new Error(direction + ' left the lane ' + JSON.stringify(snap.position));
      const buffer = await shot(null, view);
      const file = path.join(FRAMES, `${direction}-${String(samples.length).padStart(4, '0')}.png`);
      writeFileSync(file, buffer);
      samples.push({
        t: now - started,
        file,
        frame: snap.frames.player,
        column: columnOf(snap.frames.player),
        walkTime: snap.walkTime,
        facing: snap.facing,
        moving: snap.moving,
        state: snap.state,
        position: snap.position,
        metrics: {width: snap.walkMetrics.width, height: snap.walkMetrics.height, offset: snap.walkMetrics.offset, x: snap.walkMetrics.x, y: snap.walkMetrics.y},
      });
      if (snap.state !== 'explore' || snap.facing !== direction || !snap.moving) throw new Error(direction + ' broke ' + JSON.stringify({state: snap.state, facing: snap.facing, moving: snap.moving, position: snap.position}));
      if (columnOf(snap.frames.player) === 0) throw new Error(direction + ' showed idle while walking at ' + snap.walkTime);
      const pose = [1, 2, 3, 4, 5, 6][Math.floor(snap.walkTime * 10) % 6];
      if (columnOf(snap.frames.player) !== pose) throw new Error(direction + ' frame ' + snap.frames.player + ' != walkTime ' + snap.walkTime);
      const moved = Math.hypot(snap.position.x - guard.x, snap.position.y - guard.y);
      if (samples.length > 8 && moved < 1) throw new Error(direction + ' stuck ' + JSON.stringify(snap.position));
      guard = snap.position;
      if (done(snap)) break;
    }
    await key('keyUp', name);
    await sleep(80);
    const after = await state();
    if (after.moving || columnOf(after.frames.player) !== 0) throw new Error(direction + ' did not stop on idle ' + JSON.stringify({moving: after.moving, frame: after.frames.player}));
    await shot(path.join(STILLS, `${direction}-idle-after.png`), view);
    if (!done(after) && !done({position: samples.at(-1).position})) throw new Error(direction + ' short ' + JSON.stringify(samples.at(-1).position));
    const columns = samples.map(sample => sample.column);
    const cycle = cyclesOf(columns);
    const cycles = samples.at(-1).walkTime * 10 / 6;
    if (cycles < 3) throw new Error(direction + ' only ' + cycles.toFixed(2) + ' cycles');
    for (const col of [1, 2, 3, 4, 5, 6]) if (!columns.includes(col)) throw new Error(direction + ' missed pose ' + col);
    const width = new Set(samples.map(sample => sample.metrics.width));
    const height = new Set(samples.map(sample => sample.metrics.height));
    const foot = new Set(samples.map(sample => Math.round((sample.metrics.y + sample.position.y) * 1000) / 1000));
    const side = new Set(samples.map(sample => Math.round((sample.metrics.x - sample.position.x) * 1000) / 1000));
    if (width.size !== 1 || height.size !== 1 || foot.size !== 1 || side.size !== 1) throw new Error(direction + ' bob or scale ' + JSON.stringify({width: [...width], height: [...height], foot: [...foot], side: [...side]}));
    const seconds = (samples.at(-1).t - samples[0].t) / 1000;
    const distance = Math.hypot(samples.at(-1).position.x - samples[0].position.x, samples.at(-1).position.y - samples[0].position.y);
    const speed = seconds > 0 ? distance / seconds : 0;
    if (speed < 50 || speed > 70) throw new Error(direction + ' speed ' + speed.toFixed(1));
    const seen = new Set();
    for (const sample of samples) {
      if (sample.column < 1 || sample.column > 6) continue;
      const cycleIndex = [...seen].filter(item => item.endsWith('-' + sample.column)).length;
      const token = `${cycleIndex}-${sample.column}`;
      if (cycleIndex >= 2 || seen.has(token)) continue;
      seen.add(token);
      writeFileSync(path.join(STILLS, `${direction}-c${cycleIndex}-${NAMES[sample.column]}.png`), readFileSync(sample.file));
    }
    const list = path.join(FRAMES, `${direction}.txt`);
    const lines = ['ffconcat version 1.0'];
    for (let i = 0; i < samples.length; i++) {
      const duration = i + 1 < samples.length ? Math.max(0.001, (samples[i + 1].t - samples[i].t) / 1000) : 0.05;
      lines.push(`file '${samples[i].file}'`, `duration ${duration.toFixed(4)}`);
    }
    lines.push(`file '${samples.at(-1).file}'`);
    writeFileSync(list, lines.join('\n') + '\n');
    const video = path.join(OUT, `${direction}.mp4`);
    await new Promise((resolve, reject) => {
      const encoder = spawn('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-fps_mode', 'vfr', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-movflags', '+faststart', video], {stdio: ['ignore', 'ignore', 'pipe']});
      let err = '';
      encoder.stderr.on('data', chunk => { err += chunk; });
      encoder.on('exit', code => code === 0 ? resolve() : reject(new Error(err.slice(-800))));
    });
    console.log(direction, 'frames', samples.length, 'cycles', cycles.toFixed(2), 'speed', speed.toFixed(1), 'still', idleBefore.length);
    runs.push({
      direction,
      frames: samples.length,
      cycles,
      sequence: cycle.changes.slice(0, 18),
      idleInCycle: false,
      speed,
      distance,
      seconds,
      scale: {width: samples[0].metrics.width, height: samples[0].metrics.height},
      foot: {meshPlusWorldY: [...foot][0], meshMinusWorldX: [...side][0]},
      video: path.relative(ROOT, video),
      start: samples[0].position,
      end: samples.at(-1).position,
    });
  }

  await seek('y', 155);
  await seek('x', 12);
  await record('right', 'ArrowRight', snap => snap.position.x >= 350);
  await record('left', 'ArrowLeft', snap => snap.position.x <= 16);
  await seek('x', 125);
  await seek('y', 74);
  await record('down', 'ArrowDown', snap => snap.position.y >= 196);
  await record('up', 'ArrowUp', snap => snap.position.y <= 78);
  await seek('y', 127);
  await seek('x', 82);
  await evaluate(`document.querySelector('#stage').focus()`);
  await key('keyDown', 'e');
  await key('keyUp', 'e');
  await sleep(400);
  const seated = await state();
  const posture = seated.actors.find(actor => actor.id === 'player').posture;
  if (posture !== 'seatedTyping' || !seated.sit) throw new Error('sit failed ' + JSON.stringify({posture, sit: seated.sit, position: seated.position}));
  if (Math.abs(seated.sit.height - 30) > 0.1) throw new Error('sit height ' + seated.sit.height);
  await shot(path.join(STILLS, 'sit-nanjing.png'), view);
  await evaluate(`document.querySelector('#conversation').hidden = true`);
  await shot(path.join(STILLS, 'sit-body.png'), view);
  await evaluate(`document.querySelector('#conversation').hidden = false`);
  await evaluate(`document.querySelector('#close-dialogue')?.click()`);
  await sleep(200);
  const stood = await state();
  if (stood.actors.find(actor => actor.id === 'player').posture !== 'standing') throw new Error('did not stand');
  if (columnOf(stood.frames.player) !== 0) throw new Error('stood on a walk frame ' + stood.frames.player);

  const summary = {
    result: 'passed',
    page: 'games/career-rpg/web/',
    chapter: 'nanjing',
    poseHz: 10,
    movementSpeed: 60,
    sequence: NAMES.slice(1),
    idleOnlyWhenStopped: true,
    runs,
    sit: {posture: 'seatedTyping', height: seated.sit.height, file: 'games/career-rpg/web/review/walk-v2/stills/sit-nanjing.png'},
  };
  writeFileSync(path.join(OUT, 'cadence.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log('WALK_V2_OK');
} finally {
  try { chrome.kill('SIGKILL'); } catch {}
  server.close();
  rmSync(FRAMES, {recursive: true, force: true});
}
