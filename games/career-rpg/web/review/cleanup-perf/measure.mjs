// Load time and INP for the Hefei chapter entry.
// Same script, same flags, and the same gestures for baseline and after.
//
// Load time (ms): performance.now() when window.careerPrototype is assigned.
// The setter is installed before navigation. The clock starts at the document
// time origin, which is the navigation start of
// /games/career-rpg/web/?chapter=hefei. The sample counts only when #loading
// is gone, #manual is enabled, the stage canvas has a non-zero buffer,
// #game-title is non-empty, and snapshot().state is neither "loading" nor "error".
// That is the moment the title and the player can take a key.
//
// INP (ms): Chrome Event Timing. PerformanceObserver observes type "event".
// durationThreshold is 0 when the browser accepts it, otherwise 16.
// A scored interaction is an entry with interactionId > 0 whose startTime
// falls in that gesture's window (from just before keydown until 250ms after keyup).
// Gesture duration is the max entry.duration in the window.
// Run INP is the max gesture duration. The reported INP is the median run INP.
//
// Scored gestures, in order, on a fresh profile (empty storage), cache disabled:
//   walk-right, walk-left, walk-down, walk-up: 80ms taps, #stage focused, explore
//   walk-hold-right: 400ms hold
//   handbook-m: M opens the handbook
//   dialogue-e: E on the boss opens dialogue
//   skill-e: E collects the ready Linux skill
// Story confirms and travel holds needed to reach the boss and the skill are not
// scored. Every interactionId in the run is still stored as sessionMaxMs.

import {spawn} from 'node:child_process';
import {mkdtemp, writeFile, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createReadStream} from 'node:fs';
import {execSync} from 'node:child_process';

const label = process.argv.find((arg, i) => process.argv[i - 1] === '--label') || 'baseline';
const runs = Number(process.argv.find((arg, i) => process.argv[i - 1] === '--runs') || 5);
if (!/^[a-z0-9-]+$/.test(label) || !(runs >= 1)) throw new Error('usage: measure.mjs --label baseline|after --runs 5');

const repo = path.resolve(import.meta.dirname, '../../../../..');
const outDir = path.join(repo, 'games/career-rpg/web/review/cleanup-perf');
await mkdir(outDir, {recursive: true});

const mime = {'.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.mp4': 'video/mp4'};
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(repo, '.' + (url.endsWith('/') ? url + 'index.html' : url));
  if (!file.startsWith(repo + path.sep)) { res.writeHead(403); res.end(); return; }
  const stream = createReadStream(file);
  stream.on('error', () => { res.writeHead(404); res.end(); });
  stream.on('open', () => { res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'}); stream.pipe(res); });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const pageURL = `http://127.0.0.1:${server.address().port}/games/career-rpg/web/?chapter=hefei`;

const probe = `(() => {
  const bucket = window.__careerPerf = {events: [], longTasks: [], paints: [], prototypeAt: 0, readyState: '', title: '', heading: '', observerError: ''};
  const stamp = () => {
    const loading = document.querySelector('#loading');
    const manual = document.querySelector('#manual');
    const canvas = document.querySelector('#stage canvas');
    const title = document.querySelector('#game-title');
    let snap = null;
    try { snap = window.careerPrototype && window.careerPrototype.snapshot && window.careerPrototype.snapshot(); } catch (e) { bucket.snapError = String(e); }
    if (loading || !manual || manual.disabled || !canvas || !(canvas.width > 0) || !title || !title.textContent || !snap || snap.state === 'loading' || snap.state === 'error') return false;
    bucket.prototypeAt = performance.now();
    bucket.readyState = snap.state;
    bucket.title = title.textContent;
    bucket.heading = document.querySelector('#chapter-heading')?.textContent || '';
    bucket.chapter = snap.chapter && snap.chapter.state;
    return true;
  };
  let current;
  Object.defineProperty(window, 'careerPrototype', {
    configurable: true,
    enumerable: true,
    get() { return current; },
    set(value) { current = value; if (!bucket.prototypeAt) stamp(); },
  });
  const armObserver = (threshold) => {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        bucket.events.push({
          name: entry.name,
          startTime: entry.startTime,
          duration: entry.duration,
          processingStart: entry.processingStart,
          processingEnd: entry.processingEnd,
          interactionId: entry.interactionId || 0,
          label: bucket.label || '',
        });
      }
    }).observe({type: 'event', buffered: true, durationThreshold: threshold});
    bucket.durationThreshold = threshold;
  };
  try { armObserver(0); } catch (error) {
    try { armObserver(16); } catch (again) { bucket.observerError = String(again); }
  }
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) bucket.longTasks.push({start: entry.startTime, duration: entry.duration, name: entry.name});
    }).observe({type: 'longtask', buffered: true});
  } catch (error) { bucket.longTaskError = String(error); }
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) bucket.paints.push({name: entry.name, startTime: entry.startTime});
    }).observe({type: 'paint', buffered: true});
  } catch {}
})();`;

const SNAP = `(() => {
  const s = window.careerPrototype && careerPrototype.snapshot();
  if (!s) return null;
  const dialog = document.querySelector('#system-dialog');
  const pause = document.querySelector('#pause-menu');
  const convo = document.querySelector('#conversation');
  const root = pause.open ? pause : dialog.open ? dialog : convo.hidden ? null : convo;
  const buttons = root ? [...root.querySelectorAll('.choices button')].map(button => ({text: button.textContent, focused: document.activeElement === button})) : [];
  return {position: s.position, state: s.state, active: s.active, chapter: s.chapter.state, skills: s.chapter.skills || null, focus: document.activeElement && (document.activeElement.id || document.activeElement.textContent || ''), speaker: document.querySelector('#speaker')?.textContent || '', dialogue: document.querySelector('#dialogue')?.textContent || '', hidden: convo.hidden, buttons, title: document.querySelector('#game-title')?.textContent || ''};
})()`;

const CODES = {Enter: 13, e: 69, m: 77, q: 81, ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40, Escape: 27};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

function chromeArgs(profile) {
  return [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader',
    '--hide-scrollbars', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run',
    '--disable-background-networking', '--disable-extensions', '--disable-sync',
    '--autoplay-policy=no-user-gesture-required', '--lang=zh-CN', '--disable-translate',
    '--window-size=1280,900', 'about:blank',
  ];
}

async function launch() {
  const profile = await mkdtemp(path.join(tmpdir(), 'career-perf-'));
  const chrome = spawn('google-chrome-stable', chromeArgs(profile), {stdio: ['ignore', 'ignore', 'pipe']});
  let log = '';
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { chrome.kill(); reject(new Error('Chrome startup timeout ' + log.slice(-800))); }, 20000);
    chrome.stderr.on('data', chunk => {
      log += chunk;
      const match = log.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    });
    chrome.on('error', error => { clearTimeout(timer); reject(error); });
    chrome.on('exit', code => { clearTimeout(timer); reject(new Error('Chrome exit ' + code + ' ' + log.slice(-800))); });
  });
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {method: 'PUT'})).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, {once: true}); ws.addEventListener('error', reject, {once: true}); });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id;
    const timer = setTimeout(() => { pending.delete(n); reject(new Error('CDP timeout ' + method)); }, 20000);
    pending.set(n, {resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); }});
    ws.send(JSON.stringify({id: n, method, params}));
  });
  const run = async expression => {
    const result = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluate failed');
    return result.result.value;
  };
  return {chrome, ws, send, run, profile};
}

async function gesture(session, key, holdMs, name) {
  const code = key.length === 1 ? 'Key' + key.toUpperCase() : key;
  const vk = CODES[key] || 0;
  const before = await session.run('performance.now()');
  await session.run(`window.__careerPerf.label = ${JSON.stringify(name)}`);
  const down = {type: 'keyDown', key, code, windowsVirtualKeyCode: vk};
  if (key.length === 1) { down.text = key; down.unmodifiedText = key; }
  await session.send('Input.dispatchKeyEvent', down);
  await sleep(holdMs);
  await session.send('Input.dispatchKeyEvent', {type: 'keyUp', key, code, windowsVirtualKeyCode: vk});
  await sleep(250);
  const after = await session.run('performance.now()');
  const hits = await session.run(`window.__careerPerf.events.filter(entry => entry.interactionId && entry.startTime >= ${before} && entry.startTime <= ${after})`);
  const duration = hits.length ? Math.max(...hits.map(entry => entry.duration)) : null;
  return {name, key, holdMs, duration, events: hits};
}

async function snap(session) {
  const started = Date.now();
  while (Date.now() - started < 20000) {
    const value = await session.run(SNAP);
    if (value) return value;
    await sleep(40);
  }
  throw new Error('game not ready ' + JSON.stringify(await session.run('({text: document.body.innerText.slice(0, 400), perf: window.__careerPerf})')));
}

async function waitText(session, part) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < 8000) {
    last = await snap(session);
    const blob = `${last.dialogue}\n${last.speaker}\n${last.buttons.map(button => button.text).join('\n')}`;
    if (blob.includes(part)) return last;
    await sleep(40);
  }
  throw new Error('timeout ' + part + ' ' + JSON.stringify(last));
}

async function press(session, labelText) {
  for (let i = 0; i < 8; i++) {
    const view = await snap(session);
    const focused = view.buttons.find(button => button.focused);
    if (focused && focused.text.includes(labelText)) break;
    if (!view.buttons.some(button => button.text.includes(labelText))) throw new Error('no button ' + labelText + ' ' + JSON.stringify(view.buttons) + view.dialogue.slice(0, 80));
    await session.send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39});
    await session.send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39});
    await sleep(40);
  }
  await session.send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r'});
  await session.send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13});
  await sleep(80);
}

async function dismiss(session) {
  const view = await snap(session);
  if (view.hidden && view.state === 'explore') return view;
  const labelText = view.buttons.some(button => button.text === '继续探索') ? '继续探索' : '返回';
  await press(session, labelText);
  return snap(session);
}

async function ensureExplore(session) {
  let view = await snap(session);
  if (view.state === 'paused') {
    await session.send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
    await session.send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
    await sleep(80);
    view = await snap(session);
  }
  if (view.focus !== 'stage') await session.run(`document.querySelector('#stage').focus()`);
  view = await snap(session);
  if (view.state !== 'explore' || view.focus !== 'stage') throw new Error('not exploring ' + JSON.stringify(view));
  return view;
}

async function walkTo(session, tx, ty) {
  for (let i = 0; i < 160; i++) {
    const view = await snap(session);
    if (view.state === 'paused') {
      await session.send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
      await session.send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
      await sleep(60);
      continue;
    }
    if (view.state !== 'explore') throw new Error('walk interrupted ' + JSON.stringify({state: view.state, speaker: view.speaker, dialogue: view.dialogue.slice(0, 100)}));
    if (view.focus !== 'stage') await session.run(`document.querySelector('#stage').focus()`);
    const dx = tx - view.position.x, dy = ty - view.position.y;
    if (Math.hypot(dx, dy) <= 8) return view;
    const key = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp');
    const before = view.position;
    const code = key;
    await session.send('Input.dispatchKeyEvent', {type: 'keyDown', key, code, windowsVirtualKeyCode: CODES[key]});
    await sleep(120);
    await session.send('Input.dispatchKeyEvent', {type: 'keyUp', key, code, windowsVirtualKeyCode: CODES[key]});
    const after = (await snap(session)).position;
    if (Math.hypot(after.x - before.x, after.y - before.y) < 1) {
      const other = key === 'ArrowLeft' || key === 'ArrowRight' ? (dy > 0 ? 'ArrowDown' : 'ArrowUp') : (dx > 0 ? 'ArrowRight' : 'ArrowLeft');
      await session.send('Input.dispatchKeyEvent', {type: 'keyDown', key: other, code: other, windowsVirtualKeyCode: CODES[other]});
      await sleep(160);
      await session.send('Input.dispatchKeyEvent', {type: 'keyUp', key: other, code: other, windowsVirtualKeyCode: CODES[other]});
    }
  }
  throw new Error('stuck ' + tx + ',' + ty + ' ' + JSON.stringify((await snap(session)).position));
}

async function focusObject(session, id) {
  for (let i = 0; i < 6; i++) {
    const view = await snap(session);
    if (view.active === id) return view;
    await session.send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'q', code: 'KeyQ', windowsVirtualKeyCode: 81, text: 'q', unmodifiedText: 'q'});
    await session.send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'q', code: 'KeyQ', windowsVirtualKeyCode: 81});
    await sleep(40);
  }
  throw new Error('cannot focus ' + id + ' ' + JSON.stringify(await snap(session)));
}

async function oneRun(index) {
  const session = await launch();
  try {
    await session.send('Runtime.enable');
    await session.send('Page.enable');
    await session.send('Network.enable');
    await session.send('Network.setCacheDisabled', {cacheDisabled: true});
    await session.send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});
    await session.send('Page.addScriptToEvaluateOnNewDocument', {source: probe});
    const navStarted = Date.now();
    await session.send('Page.navigate', {url: pageURL});
    const view = await snap(session);
    const perf = await session.run(`(() => {
      const bucket = window.__careerPerf;
      const nav = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource').map(entry => ({name: entry.name.split('/').slice(-2).join('/'), type: entry.initiatorType, start: entry.startTime, duration: entry.duration, transfer: entry.transferSize, decoded: entry.decodedBodySize}));
      const glCanvas = document.createElement('canvas');
      const gl = glCanvas.getContext('webgl');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return {
        loadTimeMs: bucket.prototypeAt,
        readyState: bucket.readyState,
        title: bucket.title,
        heading: bucket.heading,
        chapter: bucket.chapter,
        durationThreshold: bucket.durationThreshold,
        observerError: bucket.observerError || '',
        navigation: nav && {responseEnd: nav.responseEnd, domContentLoaded: nav.domContentLoadedEventEnd, loadEventEnd: nav.loadEventEnd, transferSize: nav.transferSize, type: nav.type},
        paints: bucket.paints,
        longTasks: bucket.longTasks,
        resources,
        webgl: gl ? {renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)} : null,
      };
    })()`);
    if (!(perf.loadTimeMs > 0)) throw new Error('load time missing ' + JSON.stringify(perf));
    if (view.title !== '像素前端') throw new Error('title ' + view.title);
    await waitText(session, '原本录用的人嫌工资低');
    await dismiss(session);
    await ensureExplore(session);
    const gestures = [];
    gestures.push(await gesture(session, 'ArrowRight', 80, 'walk-right'));
    gestures.push(await gesture(session, 'ArrowLeft', 80, 'walk-left'));
    gestures.push(await gesture(session, 'ArrowDown', 80, 'walk-down'));
    gestures.push(await gesture(session, 'ArrowUp', 80, 'walk-up'));
    gestures.push(await gesture(session, 'ArrowRight', 400, 'walk-hold-right'));
    await ensureExplore(session);
    gestures.push(await gesture(session, 'm', 30, 'handbook-m'));
    await waitText(session, '工作手册');
    await dismiss(session);
    await ensureExplore(session);
    for (const point of [{x: 270, y: 196}, {x: 270, y: 128}, {x: 310, y: 128}]) await walkTo(session, point.x, point.y);
    await focusObject(session, 'boss');
    gestures.push(await gesture(session, 'e', 30, 'dialogue-e'));
    await waitText(session, '听老板说');
    await press(session, '听老板说');
    await waitText(session, '你能力不行');
    await press(session, '我不要工资');
    await waitText(session, '我不要工资，让我来试试就行');
    await dismiss(session);
    await focusObject(session, 'boss');
    await session.send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69, text: 'e', unmodifiedText: 'e'});
    await session.send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69});
    await sleep(80);
    await press(session, '继续听');
    await waitText(session, '行，那你想试试我也不拦你');
    await press(session, '继续');
    await waitText(session, '第一次用 Linux');
    await dismiss(session);
    for (const point of [{x: 270, y: 128}, {x: 270, y: 192}, {x: 75, y: 192}]) await walkTo(session, point.x, point.y);
    await focusObject(session, 'my-pc');
    await session.send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69, text: 'e', unmodifiedText: 'e'});
    await session.send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69});
    await sleep(80);
    await press(session, '接任务');
    await waitText(session, '我在自己的工位坐下');
    await press(session, '接任务');
    await waitText(session, '白天');
    await dismiss(session);
    await walkTo(session, 147, 192);
    await focusObject(session, 'linux-screen');
    await session.send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69, text: 'e', unmodifiedText: 'e'});
    await session.send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69});
    await sleep(80);
    await press(session, '记下来');
    await waitText(session, '这一屏是 Linux');
    await press(session, '记下来');
    await waitText(session, '白天 1/2');
    await dismiss(session);
    const ready = await snap(session);
    if (ready.skills?.linux !== 'ready') throw new Error('linux not ready ' + JSON.stringify(ready.skills));
    await focusObject(session, 'linux-screen');
    gestures.push(await gesture(session, 'e', 30, 'skill-e'));
    await waitText(session, '获得技能：精通 Linux 系统重装');
    const scored = gestures.map(item => item.duration);
    if (scored.some(value => value == null)) throw new Error('missing event timing ' + JSON.stringify(gestures.map(item => ({name: item.name, duration: item.duration, events: item.events?.length || 0}))));
    const inpMs = Math.max(...scored);
    const sessionEvents = await session.run('window.__careerPerf.events.filter(entry => entry.interactionId)');
    const sessionMaxMs = sessionEvents.length ? Math.max(...sessionEvents.map(entry => entry.duration)) : null;
    return {
      index,
      wallMs: Date.now() - navStarted,
      loadTimeMs: perf.loadTimeMs,
      readyState: perf.readyState,
      title: perf.title,
      heading: perf.heading,
      chapter: perf.chapter,
      durationThreshold: perf.durationThreshold,
      navigation: perf.navigation,
      paints: perf.paints,
      longTasks: perf.longTasks,
      resources: perf.resources,
      webgl: perf.webgl,
      gestures: gestures.map(({name, key, holdMs, duration, events}) => ({name, key, holdMs, duration, eventCount: events.length, maxProcessing: events.length ? Math.max(...events.map(entry => entry.processingEnd - entry.processingStart)) : null})),
      inpMs,
      sessionMaxMs,
    };
  } finally {
    session.ws.close();
    session.chrome.kill('SIGTERM');
  }
}

const sha = execSync('git rev-parse HEAD', {cwd: repo, encoding: 'utf8'}).trim();
const chromeVersion = execSync('google-chrome-stable --version', {encoding: 'utf8'}).trim();
const cpu = execSync(`awk -F: '/model name/ {print $2; exit}' /proc/cpuinfo`, {encoding: 'utf8'}).trim();
const results = [];
for (let i = 1; i <= runs; i++) {
  process.stderr.write(`run ${i}/${runs} ${label}\n`);
  const result = await oneRun(i);
  results.push(result);
  process.stderr.write(`  load ${result.loadTimeMs.toFixed(1)} ms  inp ${result.inpMs.toFixed(1)} ms  session ${result.sessionMaxMs?.toFixed(1)} ms\n`);
}

const summary = {
  label,
  measuredAt: new Date().toISOString(),
  git: sha,
  page: '/games/career-rpg/web/?chapter=hefei',
  machine: {chrome: chromeVersion, cpu, cores: Number(execSync('nproc', {encoding: 'utf8'})), platform: process.platform},
  browserFlags: chromeArgs('PROFILE').slice(0, -1),
  viewport: {width: 1280, height: 900, deviceScaleFactor: 1},
  cache: 'disabled',
  webgl: results[0]?.webgl || null,
  method: {
    loadTimeMs: 'performance.now() at the assignment of window.careerPrototype, installed with Object.defineProperty before Page.navigate. Counted only when #loading is absent, #manual is enabled, the stage canvas buffer width is > 0, #game-title is non-empty, and snapshot().state is not loading or error. timeOrigin is the navigation start of GET /games/career-rpg/web/?chapter=hefei on a fresh profile.',
    inpMs: 'Max PerformanceEventTiming.duration among scored gestures in a run. Observer type "event"; durationThreshold is recorded per run (0 if accepted). Entries must have interactionId > 0 and startTime inside the gesture window (performance.now() just before the trusted CDP keydown, through 250ms after keyup). Gestures: walk-right, walk-left, walk-down, walk-up (80ms taps), walk-hold-right (400ms), handbook-m, dialogue-e (boss), skill-e (collect Linux). Reported value is the median of run INPs.',
    aggregation: 'median across fresh-profile runs',
  },
  runs: results.length,
  loadTimeMs: {median: median(results.map(item => item.loadTimeMs)), min: Math.min(...results.map(item => item.loadTimeMs)), max: Math.max(...results.map(item => item.loadTimeMs)), samples: results.map(item => item.loadTimeMs)},
  inpMs: {median: median(results.map(item => item.inpMs)), min: Math.min(...results.map(item => item.inpMs)), max: Math.max(...results.map(item => item.inpMs)), samples: results.map(item => item.inpMs)},
  sessionMaxMs: {median: median(results.map(item => item.sessionMaxMs)), samples: results.map(item => item.sessionMaxMs)},
  gestureMedians: Object.fromEntries(['walk-right', 'walk-left', 'walk-down', 'walk-up', 'walk-hold-right', 'handbook-m', 'dialogue-e', 'skill-e'].map(name => [name, median(results.map(item => item.gestures.find(gesture => gesture.name === name).duration))])),
  results,
};

const file = path.join(outDir, `${label}.json`);
await writeFile(file, JSON.stringify(summary, null, 2) + '\n');
server.close();
console.log(JSON.stringify({file, loadTimeMs: summary.loadTimeMs, inpMs: summary.inpMs, sessionMaxMs: summary.sessionMaxMs, gestureMedians: summary.gestureMedians}, null, 2));
