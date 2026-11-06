// Headless playthrough of the Hangzhou chapter and the Nanjing→Hangzhou bridge.
import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync, createReadStream, rmSync} from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import {blocked} from '../world.mjs';
import {HANGZHOU} from '../scene-config.mjs';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const OUT = path.join(ROOT, 'games/career-rpg/web/review/hangzhou-selfcheck');
mkdirSync(OUT, {recursive: true});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const mime = {'.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp'};
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
const pageURL = `http://127.0.0.1:${port}/games/career-rpg/web/`;
const profile = path.join(os.tmpdir(), 'hangzhou-selfcheck-chrome');
rmSync(profile, {recursive: true, force: true});
const chrome = spawn('google-chrome-stable', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader-webgl',
  '--autoplay-policy=no-user-gesture-required', '--lang=zh-CN', '--disable-translate', '--window-size=1280,900',
  `--user-data-dir=${profile}`, '--remote-debugging-port=9344', pageURL,
], {stdio: 'ignore'});
const httpGet = url => new Promise((resolve, reject) => http.get(url, res => { let d = ''; res.on('data', c => { d += c; }); res.on('end', () => resolve(d)); }).on('error', reject));
let ws, seq = 0, pending = new Map();
function send(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({id, method, params}));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('cdp timeout ' + method)); }, 20000);
    pending.set(id, message => { clearTimeout(timer); resolve(message); });
  });
}
async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const tabs = JSON.parse(await httpGet('http://127.0.0.1:9344/json'));
      const page = tabs.find(tab => tab.type === 'page' && tab.url.includes('/games/career-rpg/web'));
      if (!page) { await sleep(200); continue; }
      ws = new WebSocket(page.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, {once: true}); ws.addEventListener('error', () => reject(new Error('ws')), {once: true}); });
      ws.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); } });
      await send('Runtime.enable');
      await send('Page.enable');
      return;
    } catch { await sleep(200); }
  }
  throw new Error('chrome not ready');
}
async function evaluate(expression) {
  const message = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
  if (message.error) return null;
  if (message.result?.exceptionDetails) {
    const text = JSON.stringify(message.result.exceptionDetails);
    if (text.includes('context') || text.includes('destroyed')) return null;
    throw new Error(text.slice(0, 500));
  }
  return message.result?.result?.value;
}
const SNAP = `(() => {
  if (!window.careerPrototype) return null;
  const s = careerPrototype.snapshot();
  const dialog = document.querySelector('#system-dialog');
  const pause = document.querySelector('#pause-menu');
  const convo = document.querySelector('#conversation');
  const journey = document.querySelector('#journey-map');
  const root = pause.open ? pause : dialog.open ? dialog : !journey.hidden ? journey : convo.hidden ? null : convo;
  const buttons = root ? [...root.querySelectorAll('.choices button, #journey-choices button')].map(button => ({text: button.textContent || button.getAttribute('aria-label') || '', id: button.id, caret: button.classList.contains('continue-caret'), focused: document.activeElement === button})) : [];
  const slots = [...document.querySelectorAll('#skill-slots figure')].map(figure => figure.textContent.replace(/\\s+/g, ' ').trim());
  return {position: s.position, state: s.state, active: s.active, chapter: s.chapter.state, skills: s.chapter.skills || null, speaker: document.querySelector('#speaker')?.textContent || '', dialogue: document.querySelector('#dialogue')?.textContent || '', hidden: convo.hidden, journey: !journey.hidden, slogan: document.querySelector('#journey-slogan')?.textContent || '', title: document.querySelector('#game-title')?.textContent || '', buttons, slots, copy: document.querySelector('#journey-copy')?.textContent || ''};
})()`;
async function snap() {
  const started = Date.now();
  while (Date.now() - started < 20000) {
    const value = await evaluate(SNAP);
    if (value) return value;
    await sleep(150);
  }
  throw new Error('game not ready');
}
const CODES = {Enter: 13, e: 69, m: 77, q: 81, ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40, Escape: 27};
async function tap(key) {
  const code = key.length === 1 ? 'Key' + key.toUpperCase() : key;
  await send('Input.dispatchKeyEvent', {type: 'keyDown', key, code, windowsVirtualKeyCode: CODES[key] || 0, text: key.length === 1 ? key : undefined});
  await send('Input.dispatchKeyEvent', {type: 'keyUp', key, code, windowsVirtualKeyCode: CODES[key] || 0});
}
async function hold(key, ms) {
  const code = key.length === 1 ? 'Key' + key.toUpperCase() : key;
  await send('Input.dispatchKeyEvent', {type: 'keyDown', key, code, windowsVirtualKeyCode: CODES[key] || 0});
  await sleep(ms);
  await send('Input.dispatchKeyEvent', {type: 'keyUp', key, code, windowsVirtualKeyCode: CODES[key] || 0});
}
async function assertImages() {
  await evaluate(`Promise.all([...document.images].map(img => img.complete ? null : new Promise(resolve => { img.addEventListener('load', resolve, {once:true}); img.addEventListener('error', resolve, {once:true}); })))`);
  const bad = await evaluate(`(() => [...document.images].filter(img => {
    if (!img.getClientRects().length) return false;
    const style = getComputedStyle(img);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    return !img.complete || img.naturalWidth <= 0;
  }).map(img => img.currentSrc || img.src || img.alt))()`);
  if (bad.length) throw new Error('visible image failed to load ' + JSON.stringify(bad));
}
async function shot(name) {
  await assertImages();
  const message = await send('Page.captureScreenshot', {format: 'png'});
  writeFileSync(path.join(OUT, name), Buffer.from(message.result.data, 'base64'));
}
async function waitText(part) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < 8000) {
    last = await snap();
    const blob = `${last.title}\n${last.dialogue}\n${last.slogan}\n${last.copy}\n${last.speaker}\n${(last.slots || []).join('\n')}`;
    if (blob.includes(part) || last.buttons.some(button => button.text.includes(part))) return last;
    await sleep(80);
  }
  throw new Error('timeout ' + part + ' ' + JSON.stringify(last));
}
async function press(label) {
  for (let i = 0; i < 8; i++) {
    const view = await snap();
    const focused = view.buttons.find(button => button.focused);
    if (focused && focused.text.includes(label)) break;
    if (!view.buttons.some(button => button.text.includes(label))) throw new Error('no button ' + label + ' ' + JSON.stringify(view.buttons) + view.dialogue);
    await tap('ArrowRight');
    await sleep(60);
  }
  await sleep(220);
  await tap('Enter');
  await sleep(350);
}
async function dismiss() {
  const view = await snap();
  if (view.hidden && !view.journey && view.state === 'explore') return view;
  if (view.buttons.some(button => button.caret || button.id === 'close-dialogue')) {
    for (let i = 0; i < 8; i++) {
      const cur = await snap();
      const focused = cur.buttons.find(button => button.focused);
      if (focused && (focused.caret || focused.id === 'close-dialogue')) break;
      await tap('ArrowRight');
      await sleep(60);
    }
    await sleep(220);
    await tap('Enter');
    await sleep(350);
    return snap();
  }
  await press(view.buttons.some(button => button.text === '返回') ? '返回' : '继续');
  return snap();
}
function routeTo(from, tx, ty) {
  const start = [Math.round(from.x), Math.round(from.y)];
  const key = (x, y) => `${x},${y}`;
  const prev = new Map();
  const q = [start];
  const seen = new Set([key(...start)]);
  let found = null, head = 0;
  while (head < q.length) {
    const [x, y] = q[head++];
    if (Math.hypot(x - tx, y - ty) <= 8) { found = [x, y]; break; }
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const id = key(nx, ny);
      if (seen.has(id) || blocked(nx, ny, HANGZHOU)) continue;
      seen.add(id); prev.set(id, [x, y]); q.push([nx, ny]);
    }
  }
  if (!found) throw new Error('no path ' + tx + ',' + ty);
  const path = [found];
  let cur = key(...found);
  while (prev.has(cur)) { const point = prev.get(cur); path.push(point); cur = key(...point); }
  path.reverse();
  const corners = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1], b = path[i], c = path[i + 1];
    if (b[0] - a[0] !== c[0] - b[0] || b[1] - a[1] !== c[1] - b[1]) corners.push(b);
  }
  corners.push(path.at(-1));
  return corners;
}
async function stepTo(tx, ty) {
  let last = Infinity;
  for (let i = 0; i < 50; i++) {
    const view = await snap();
    if (view.state !== 'explore') throw new Error('walk interrupted ' + JSON.stringify({state: view.state, speaker: view.speaker, dialogue: view.dialogue.slice(0, 80)}));
    const dx = tx - view.position.x, dy = ty - view.position.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 4) return view;
    if (dist > last + 6) throw new Error('diverged ' + tx + ',' + ty);
    last = dist;
    const horizontal = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    const vertical = dy > 0 ? 'ArrowDown' : 'ArrowUp';
    const preferH = Math.abs(dx) >= Math.abs(dy);
    const open = key => {
      const nx = view.position.x + (key === 'ArrowRight' ? 3 : key === 'ArrowLeft' ? -3 : 0);
      const ny = view.position.y + (key === 'ArrowDown' ? 3 : key === 'ArrowUp' ? -3 : 0);
      return !blocked(Math.round(nx), Math.round(ny), HANGZHOU);
    };
    const key = open(preferH ? horizontal : vertical) ? (preferH ? horizontal : vertical) : open(preferH ? vertical : horizontal) ? (preferH ? vertical : horizontal) : (preferH ? horizontal : vertical);
    const before = view.position;
    await hold(key, 45);
    const after = (await snap()).position;
    if (Math.hypot(after.x - before.x, after.y - before.y) < 0.4) await hold(key.startsWith('ArrowL') || key.startsWith('ArrowR') ? vertical : horizontal, 70);
  }
  throw new Error('stuck ' + tx + ',' + ty + ' ' + JSON.stringify((await snap()).position));
}
async function walkTo(tx, ty) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const here = await snap();
      if (Math.hypot(here.position.x - tx, here.position.y - ty) <= 8) return here;
      for (const [x, y] of routeTo(here.position, tx, ty)) await stepTo(x, y);
      return snap();
    } catch (error) {
      if (attempt === 4 || !/stuck|diverged|no path/.test(String(error.message))) throw error;
    }
  }
  throw new Error('stuck ' + tx + ',' + ty);
}
async function focusObject(id) {
  for (let i = 0; i < 6; i++) {
    const view = await snap();
    if (view.active === id) return view;
    await tap('q');
    await sleep(80);
  }
  throw new Error('cannot focus ' + id + ' ' + JSON.stringify(await snap()));
}
async function use(id, first, second) {
  await focusObject(id);
  await tap('e');
  await sleep(200);
  if (first) await press(first);
  if (second) await press(second);
}
const NAMES = ['读懂商品发布这摊业务', '精读 23 种设计模式', '吃透 Webpack 插件机制', '吃透 Babel 插件机制', '一套表单架构，撑起五条业务线'];
async function pickup(name, glintFile, awardFile, extra = []) {
  await evaluate('window.scrollTo(0,0)');
  await shot(glintFile);
  await tap('e');
  const award = await waitText('获得技能：' + name);
  if (award.state === 'explore') throw new Error('award did not open ' + name);
  await evaluate('window.scrollTo(0,0)');
  await shot(awardFile);
  for (const file of extra) await shot(file);
  const locked = award.position;
  await hold('ArrowRight', 280);
  const during = await snap();
  if (during.state === 'explore' || Math.hypot(during.position.x - locked.x, during.position.y - locked.y) > 2) throw new Error('award did not lock ' + name);
  await press('OK');
  const after = await snap();
  if (after.state !== 'explore') throw new Error('after ok ' + name + ' ' + after.state);
}
async function openManual(part) {
  await tap('m');
  return waitText(part);
}
async function readAt(id, x, y, title, label) {
  await walkTo(x, y);
  await use(id, title, label);
}
async function play(take) {
  await dismiss();
  if (take) {
    const empty = await openManual('???');
    if (empty.slots.length !== 5 || empty.slots.some(slot => slot !== '???')) throw new Error('opening slots ' + JSON.stringify(empty.slots));
    await shot('HZ-SKILL-01-manual-empty.png');
    await dismiss();
  }
  await readAt('check-in', 46, 108, '报到', '记下');
  await dismiss();
  await readAt('publish', 180, 120, '看这摊业务', '记下');
  await press('夜深了');
  await dismiss();
  if (take) {
    await walkTo(180, 120);
    await pickup(NAMES[0], 'HZ-SKILL-01-glint.png', 'HZ-SKILL-01-award.png');
    const audio = await evaluate('JSON.stringify(window.careerSkillAudio ? careerSkillAudio() : [])');
    writeFileSync(path.join(OUT, 'audio-log.json'), audio);
    const notes = JSON.parse(audio).filter(event => event.kind === 'oscillator-start').map(event => event.frequency);
    if (notes[0] !== 660 || notes[1] !== 880 || notes[2] !== 1320) throw new Error('ding ' + audio);
    const manual = await openManual(NAMES[0]);
    if (!manual.slots.some(slot => slot.includes(NAMES[0])) || manual.slots.filter(slot => slot === '???').length !== 4) throw new Error('manual publish ' + JSON.stringify(manual.slots));
    await shot('HZ-SKILL-01-manual.png');
    await dismiss();
  }
  await readAt('patterns-book', 46, 168, '翻开设计模式', '记下');
  await press('去看插件');
  await dismiss();
  if (take) {
    await walkTo(46, 168);
    await pickup(NAMES[1], 'HZ-SKILL-02-glint.png', 'HZ-SKILL-02-award.png');
    await openManual(NAMES[1]);
    await shot('HZ-SKILL-02-manual.png');
    await dismiss();
  }
  await readAt('webpack-screen', 78, 190, '看 Webpack', '记下');
  await dismiss();
  await readAt('webpack-screen', 78, 190, '看 Babel', '记下');
  await press('去看需求单');
  await dismiss();
  if (take) {
    await walkTo(78, 190);
    await pickup(NAMES[2], 'HZ-SKILL-03-glint.png', 'HZ-SKILL-03-award.png');
    await openManual(NAMES[2]);
    await shot('HZ-SKILL-03-manual.png');
    await dismiss();
    await walkTo(78, 190);
    await pickup(NAMES[3], 'HZ-SKILL-04-glint.png', 'HZ-SKILL-04-award.png');
    await openManual(NAMES[3]);
    await shot('HZ-SKILL-04-manual.png');
    await dismiss();
  }
  if ((await evaluate('careerPrototype.snapshot().boardLit')) !== false) throw new Error('whiteboard lit before the five sheets');
  const sheets = [[123, 112, 'line-1', '看第一条'], [276, 118, 'line-2', '看第二条'], [112, 178, 'line-3', '看第三条'], [160, 178, 'line-4', '看第四条'], [230, 178, 'line-5', '看第五条']];
  for (const [x, y, id, title] of sheets) {
    await readAt(id, x, y, title, '记下');
    await dismiss();
  }
  await walkTo(304, 148);
  if ((await evaluate('careerPrototype.snapshot().boardLit')) !== true) throw new Error('whiteboard did not light');
  if (take) await shot('HZ-STORY-01-lights.png');
  await use('whiteboard', '回到白板', '五条线亮了');
  await dismiss();
  if (take) {
    await walkTo(304, 148);
    await pickup(NAMES[4], 'HZ-SKILL-05-glint.png', 'HZ-SKILL-05-award.png', ['HZ-STORY-01-award.png']);
    await openManual(NAMES[4]);
    await shot('HZ-SKILL-05-manual.png');
    await dismiss();
  }
  await walkTo(192, 196);
  await use('exit', '这一章先到这里', '收起');
  await waitText('杭州 · 本章完成');
  await dismiss();
  const done = await openManual(NAMES[4]);
  for (const name of NAMES) if (!done.slots.some(slot => slot.includes(name))) throw new Error('manual missing ' + name + ' ' + JSON.stringify(done.slots));
  if (done.slots.some(slot => /fibjs|jQuery|React/.test(slot))) throw new Error('other chapter in handbook ' + JSON.stringify(done.slots));
  await shot(take ? 'HZ-SKILL-05-manual-complete.png' : 'HZ-SKILL-autogrant.png');
  await dismiss();
}
try {
  await connect();
  const save = JSON.stringify({schema: 1, chapter: 'nanjing-first-release', state: 'complete', flags: ['report_read', 'incident_started', 'incident_seen', 'feedback_reviewed', 'recheck_visited', 'impact_confirmed', 'outage_over', 'comfort_read', 'test_reviewed', 'comment_reviewed', 'manual_entry_written', 'journey_opened', 'react_noticed', 'journey_finished']});
  await send('Page.addScriptToEvaluateOnNewDocument', {source: `localStorage.setItem('career-rpg:nanjing:v1', ${JSON.stringify(save)});`});
  await send('Page.reload', {ignoreCache: true});
  let view = await waitText('南京 · 本章完成');
  if (view.slogan !== '像素前端' || view.title !== '像素前端') throw new Error('journey title ' + view.slogan + ' ' + view.title);
  await evaluate('window.scrollTo(0,0)');
  await press('从南京走到杭州');
  const started = Date.now();
  let startShot = false, midShot = false;
  while (Date.now() - started < 8000) {
    const journey = await evaluate('careerJourney()');
    if (!journey) { await sleep(80); continue; }
    if (!startShot && journey.route === 'nanjing-hangzhou' && journey.progress > 0.01 && journey.progress < 0.2 && journey.hangzhouUnlocked === false) { await shot('HZ-BRIDGE-01-start.png'); startShot = true; }
    if (!midShot && journey.progress > 0.4 && journey.progress < 0.7) { await shot('HZ-BRIDGE-01-mid.png'); midShot = true; }
    if (journey.arrived) break;
    await sleep(80);
  }
  view = await snap();
  const arrived = await evaluate('careerJourney()');
  if (!view.journey || view.slogan !== '像素前端') throw new Error('journey title ' + JSON.stringify(view));
  if (!arrived.arrived || arrived.route !== 'nanjing-hangzhou' || arrived.hangzhouUnlocked !== true) throw new Error('bridge ' + JSON.stringify(arrived));
  if (!view.copy.includes('商品发布这一摊')) throw new Error('bridge copy ' + view.copy);
  if (!startShot || !midShot) throw new Error('missed bridge frames ' + JSON.stringify(arrived));
  await shot('HZ-BRIDGE-01-arrive.png');
  await press('走到杭州');
  await waitText('南京 · 本章完成');

  await send('Page.navigate', {url: pageURL + '?chapter=hangzhou'});
  await waitText('报到');
  const titled = await snap();
  const pageTitle = await evaluate('document.title');
  if (titled.title !== '像素前端' || pageTitle !== '像素前端') throw new Error('title ' + titled.title + ' ' + pageTitle);
  await evaluate('window.scrollTo(0,0)');
  await shot('HZ-TITLE-01.png');
  await play(true);
  const audio = JSON.parse(await evaluate('JSON.stringify(careerSkillAudio())'));
  const notes = audio.filter(event => event.kind === 'oscillator-start').map(event => event.frequency);
  if (notes.length !== 15 || notes.some((note, index) => note !== [660, 880, 1320][index % 3])) throw new Error('ding set ' + JSON.stringify(notes));
  writeFileSync(path.join(OUT, 'audio-log.json'), JSON.stringify(audio));

  await tap('m');
  await waitText('从办公室重玩');
  await press('从办公室重玩');
  await press('确认重新开始');
  await waitText('报到');
  await play(false);
  console.log('SELF_CHECK_OK');
} catch (error) {
  try { await shot('failure.png'); } catch {}
  console.error('SELF_CHECK_FAIL', error);
  process.exitCode = 1;
} finally {
  chrome.kill('SIGTERM');
  server.close();
  setTimeout(() => process.exit(process.exitCode || 0), 300);
}
