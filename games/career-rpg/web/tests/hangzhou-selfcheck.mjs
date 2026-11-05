// Headless playthrough of the Hangzhou chapter and the Nanjing→Hangzhou bridge.
import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync, createReadStream, rmSync} from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';

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
  const buttons = root ? [...root.querySelectorAll('.choices button, #journey-choices button')].map(button => ({text: button.textContent, focused: document.activeElement === button})) : [];
  const slots = [...document.querySelectorAll('#skill-slots figure')].map(figure => figure.innerText.replace(/\\s+/g, ' ').trim());
  return {position: s.position, state: s.state, active: s.active, chapter: s.chapter.state, skills: s.chapter.skills || null, speaker: document.querySelector('#speaker')?.textContent || '', dialogue: document.querySelector('#dialogue')?.innerText || '', hidden: convo.hidden, journey: !journey.hidden, slogan: document.querySelector('#journey-slogan')?.textContent || '', title: document.querySelector('#game-title')?.textContent || '', buttons, slots, copy: document.querySelector('#journey-copy')?.innerText || ''};
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
    const blob = `${last.title}\n${last.dialogue}\n${last.slogan}\n${last.copy}\n${last.speaker}`;
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
  await press(view.buttons.some(button => button.text === '继续探索') ? '继续探索' : '返回');
  return snap();
}
async function walkTo(tx, ty) {
  for (let i = 0; i < 180; i++) {
    const view = await snap();
    if (view.state !== 'explore') throw new Error('walk interrupted ' + JSON.stringify({state: view.state, speaker: view.speaker, dialogue: view.dialogue.slice(0, 80)}));
    const dx = tx - view.position.x, dy = ty - view.position.y;
    if (Math.hypot(dx, dy) <= 8) return view;
    const key = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp');
    const before = view.position;
    await hold(key, 140);
    const after = (await snap()).position;
    if (Math.hypot(after.x - before.x, after.y - before.y) < 1) {
      const other = key.startsWith('ArrowL') || key.startsWith('ArrowR') ? (dy > 0 ? 'ArrowDown' : 'ArrowUp') : (dx > 0 ? 'ArrowRight' : 'ArrowLeft');
      await hold(other, 180);
    }
  }
  throw new Error('stuck ' + tx + ',' + ty + ' ' + JSON.stringify((await snap()).position));
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
  await shot(glintFile);
  await tap('e');
  const award = await waitText('获得技能：' + name);
  if (award.state === 'explore') throw new Error('award did not open ' + name);
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
  await readAt('check-in', 48, 128, '报到', '记下');
  await dismiss();
  await readAt('publish', 120, 128, '看这摊业务', '记下');
  await press('夜深了');
  await dismiss();
  if (take) {
    await walkTo(120, 128);
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
  await readAt('patterns-book', 192, 124, '翻开设计模式', '记下');
  await press('去看插件');
  await dismiss();
  if (take) {
    await walkTo(192, 124);
    await pickup(NAMES[1], 'HZ-SKILL-02-glint.png', 'HZ-SKILL-02-award.png');
    await openManual(NAMES[1]);
    await shot('HZ-SKILL-02-manual.png');
    await dismiss();
  }
  await readAt('webpack-screen', 270, 124, '看 Webpack', '记下');
  await dismiss();
  if (take) {
    await walkTo(270, 124);
    await pickup(NAMES[2], 'HZ-SKILL-03-glint.png', 'HZ-SKILL-03-award.png');
    await openManual(NAMES[2]);
    await shot('HZ-SKILL-03-manual.png');
    await dismiss();
  }
  await readAt('babel-screen', 336, 128, '看 Babel', '记下');
  await press('去看需求单');
  await dismiss();
  if (take) {
    await walkTo(336, 128);
    await pickup(NAMES[3], 'HZ-SKILL-04-glint.png', 'HZ-SKILL-04-award.png');
    await openManual(NAMES[3]);
    await shot('HZ-SKILL-04-manual.png');
    await dismiss();
  }
  const dark = await evaluate(`(() => { const c = document.querySelector('#skill-glints').getContext('2d').getImageData(348, 128, 1, 1).data; return [c[0], c[1], c[2], c[3]]; })()`);
  if (dark[3] !== 0) throw new Error('whiteboard already lit ' + JSON.stringify(dark));
  const sheets = [[40, 172, 'line-1', '看第一条'], [104, 172, 'line-2', '看第二条'], [168, 172, 'line-3', '看第三条'], [232, 172, 'line-4', '看第四条'], [296, 172, 'line-5', '看第五条']];
  for (const [x, y, id, title] of sheets) {
    await readAt(id, x, y, title, '记下');
    await dismiss();
  }
  await walkTo(348, 164);
  const lit = await evaluate(`(() => { const c = document.querySelector('#skill-glints').getContext('2d').getImageData(348, 128, 1, 1).data; return [c[0], c[1], c[2], c[3]]; })()`);
  if (!(lit[0] > 200 && lit[1] > 180 && lit[2] < 160 && lit[3] === 255)) throw new Error('whiteboard did not light ' + JSON.stringify(lit));
  if (take) await shot('HZ-STORY-01-lights.png');
  await use('whiteboard', '回到白板', '五条线亮了');
  await dismiss();
  if (take) {
    await walkTo(348, 164);
    await pickup(NAMES[4], 'HZ-SKILL-05-glint.png', 'HZ-SKILL-05-award.png', ['HZ-STORY-01-award.png']);
    await openManual(NAMES[4]);
    await shot('HZ-SKILL-05-manual.png');
    await dismiss();
  }
  await walkTo(200, 198);
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
  if (view.slogan && view.slogan !== '欢迎你游戏我的职业前半生') throw new Error('slogan ' + view.slogan);
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
  if (!view.journey || view.slogan !== '欢迎你游戏我的职业前半生') throw new Error('journey slogan ' + JSON.stringify(view));
  if (!arrived.arrived || arrived.route !== 'nanjing-hangzhou' || arrived.hangzhouUnlocked !== true) throw new Error('bridge ' + JSON.stringify(arrived));
  if (!view.copy.includes('商品发布这一摊')) throw new Error('bridge copy ' + view.copy);
  if (!startShot || !midShot) throw new Error('missed bridge frames ' + JSON.stringify(arrived));
  await shot('HZ-BRIDGE-01-arrive.png');
  await press('走到杭州');
  await waitText('南京 · 本章完成');

  await send('Page.navigate', {url: pageURL + '?chapter=hangzhou'});
  await waitText('报到');
  if ((await snap()).title !== '欢迎你游戏我的职业前半生') throw new Error('title ' + (await snap()).title);
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
