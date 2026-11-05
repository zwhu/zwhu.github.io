// Headless self-check for the Hefei skill slots on current main. Not part of verify.py.
import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync, createReadStream} from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const OUT = path.join(ROOT, 'games/career-rpg/web/review/hefei-skills-main');
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
const pageURL = `http://127.0.0.1:${port}/games/career-rpg/web/?chapter=hefei`;
const chrome = spawn('google-chrome-stable', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader-webgl',
  '--autoplay-policy=no-user-gesture-required', '--lang=zh-CN', '--disable-translate', '--window-size=1280,900',
  '--remote-debugging-port=9342', pageURL,
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
      const tabs = JSON.parse(await httpGet('http://127.0.0.1:9342/json'));
      const page = tabs.find(tab => tab.type === 'page' && tab.url.includes('chapter=hefei'));
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
  if (message.result?.exceptionDetails) throw new Error(JSON.stringify(message.result.exceptionDetails).slice(0, 500));
  return message.result?.result?.value;
}
const SNAP = `(() => {
  if (!window.careerPrototype) return null;
  const s = careerPrototype.snapshot();
  const dialog = document.querySelector('#system-dialog');
  const pause = document.querySelector('#pause-menu');
  const convo = document.querySelector('#conversation');
  const journey = document.querySelector('#journey-map');
  const root = pause.open ? pause : dialog.open ? dialog : journey && !journey.hidden ? journey : convo.hidden ? null : convo;
  const buttons = root ? [...root.querySelectorAll('.choices button, #journey-choices button')].map(button => ({text: button.textContent, focused: document.activeElement === button})) : [];
  const slots = [...document.querySelectorAll('#skill-slots figure')].map(figure => figure.innerText.replace(/\\s+/g, ' ').trim());
  const images = [...document.querySelectorAll('#skill-slots img, #skill-award-icon')].map(img => img.currentSrc || img.src);
  return {position: s.position, state: s.state, active: s.active, chapter: s.chapter.state, skills: s.chapter.skills || null, flags: s.chapter.flags, speaker: document.querySelector('#speaker')?.textContent || '', dialogue: document.querySelector('#dialogue')?.innerText || '', hidden: convo.hidden, journey: journey ? !journey.hidden : false, slogan: document.querySelector('#journey-slogan')?.textContent || '', title: document.querySelector('#game-title')?.textContent || '', buttons, slots, images, focus: document.activeElement && (document.activeElement.id || document.activeElement.textContent)};
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
    const blob = `${last.title}\n${last.dialogue}\n${last.slogan}\n${last.speaker}`;
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
  for (let i = 0; i < 140; i++) {
    const view = await snap();
    if (view.state === 'paused') { await tap('Escape'); await sleep(120); continue; }
    if (view.state !== 'explore') throw new Error('walk interrupted ' + JSON.stringify({state: view.state, speaker: view.speaker, dialogue: view.dialogue.slice(0, 120)}));
    const dx = tx - view.position.x, dy = ty - view.position.y;
    if (Math.hypot(dx, dy) <= 8) return view;
    const key = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp');
    const before = view.position;
    await hold(key, 120);
    const after = (await snap()).position;
    if (Math.hypot(after.x - before.x, after.y - before.y) < 1) {
      const other = key.startsWith('ArrowL') || key.startsWith('ArrowR') ? (dy > 0 ? 'ArrowDown' : 'ArrowUp') : (dx > 0 ? 'ArrowRight' : 'ArrowLeft');
      await hold(other, 160);
    }
  }
  throw new Error('stuck ' + tx + ',' + ty + ' ' + JSON.stringify((await snap()).position));
}
async function route(points) { for (const point of points) await walkTo(point.x, point.y); }
async function focusObject(id) {
  for (let i = 0; i < 6; i++) {
    const view = await snap();
    if (view.active === id) return view;
    await tap('q');
    await sleep(80);
  }
  throw new Error('cannot focus ' + id + ' ' + JSON.stringify(await snap()));
}
try {
  await connect();
  let view = await waitText('原本录用的人嫌工资低');
  if (view.title !== '像素前端') throw new Error('title ' + view.title);
  await dismiss();
  await tap('m');
  view = await waitText('???');
  if (view.slots.length !== 4 || view.slots.some(slot => slot !== '???')) throw new Error('opening slots ' + JSON.stringify(view.slots));
  if (view.images.length) throw new Error('opening manual showed an icon ' + JSON.stringify(view.images));
  await shot('SKILL-01-SKILL-02-opening-manual.png');
  await dismiss();
  await route([{x: 270, y: 196}, {x: 270, y: 128}, {x: 310, y: 128}]);
  await focusObject('boss');
  await tap('e');
  await press('听老板说');
  await waitText('你能力不行');
  await press('我不要工资');
  await waitText('我不要工资，让我来试试就行');
  await dismiss();
  await focusObject('boss');
  await tap('e');
  await press('继续听');
  await waitText('行，那你想试试我也不拦你');
  await press('继续');
  await waitText('第一次用 Linux');
  await dismiss();
  await route([{x: 270, y: 128}, {x: 270, y: 192}, {x: 75, y: 192}]);
  await focusObject('my-pc');
  await tap('e');
  await press('接任务');
  await waitText('我在自己的工位坐下');
  await press('接任务');
  await waitText('白天');
  await dismiss();
  await walkTo(147, 192);
  await focusObject('linux-screen');
  await tap('e');
  await press('记下来');
  await waitText('这一屏是 Linux');
  await press('记下来');
  await waitText('白天 1/2');
  await dismiss();
  view = await snap();
  if (view.skills?.linux !== 'ready') throw new Error('linux not ready ' + JSON.stringify(view.skills));
  const glints = await evaluate(`(() => { const c = document.querySelector('#skill-glints'); if (!c) return 0; const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++; return n; })()`);
  if (glints < 8) throw new Error('linux glint pixels ' + glints);
  await shot('SKILL-03-linux-glint.png');
  const locked = view.position;
  await tap('e');
  view = await waitText('获得技能：精通 Linux 系统重装');
  await shot('SKILL-04-award-linux.png');
  await hold('ArrowRight', 280);
  const during = await snap();
  if (during.state === 'explore' || Math.hypot(during.position.x - locked.x, during.position.y - locked.y) > 2) throw new Error('award did not lock ' + JSON.stringify(during));
  const audio = await evaluate('JSON.stringify(window.careerSkillAudio ? careerSkillAudio() : [])');
  writeFileSync(path.join(OUT, 'audio-log.json'), audio);
  const events = JSON.parse(audio);
  const freqs = events.filter(event => event.kind === 'oscillator-start').map(event => event.frequency);
  if (freqs.join(',') !== '660,880,1320') throw new Error('ding ' + audio);
  await press('OK');
  view = await snap();
  if (view.state !== 'explore' || view.skills.linux !== 'got') throw new Error('after ok ' + JSON.stringify(view));
  await tap('m');
  view = await waitText('精通 Linux 系统重装');
  if (!view.slots.some(slot => slot.includes('精通 Linux 系统重装')) || view.slots.filter(slot => slot === '???').length !== 3) throw new Error('manual after pickup ' + JSON.stringify(view.slots));
  await shot('SKILL-05-manual-linux.png');
  await dismiss();
  await send('Page.reload', {ignoreCache: true});
  ws = null; seq = 0; pending = new Map();
  await sleep(400);
  await connect();
  await waitText('第一次用 Linux');
  await dismiss();
  await tap('m');
  view = await waitText('精通 Linux 系统重装');
  if (!view.slots.some(slot => slot.includes('精通 Linux 系统重装'))) throw new Error('refresh lost skill ' + JSON.stringify(view.slots));
  await shot('SKILL-06-manual-after-refresh.png');
  await dismiss();
  await walkTo(111, 180);
  await focusObject('jquery-book');
  await tap('e');
  await press('记下来');
  await waitText('锋利的 jQuery');
  await press('记下来');
  await waitText('天黑了');
  await press('继续');
  await sleep(2600);
  await waitText('天黑以后');
  await dismiss();
  await route([{x: 111, y: 192}, {x: 240, y: 192}, {x: 240, y: 180}]);
  await focusObject('java-book');
  await tap('e');
  await press('记下来');
  await waitText('这一本是 Java');
  await press('记下来');
  await waitText('深夜 1/2');
  await dismiss();
  await route([{x: 240, y: 192}, {x: 215, y: 192}]);
  await focusObject('db-screen');
  await tap('e');
  await press('记下来');
  await waitText('数据库和 NoSQL');
  await press('记下来');
  await waitText('日夜颠倒地学新东西');
  await press('继续');
  await sleep(80);
  await tap('Enter');
  await waitText('入职两个月');
  await dismiss();
  await route([{x: 270, y: 192}, {x: 270, y: 128}, {x: 310, y: 128}]);
  await focusObject('boss');
  await tap('e');
  await press('听老板说');
  await waitText('努力工作的人一定会被看到的');
  await press('收起');
  view = await waitText('合肥 · 本章完成');
  if (Object.values(view.skills).some(status => status !== 'got')) throw new Error('complete skills ' + JSON.stringify(view.skills));
  await tap('Escape');
  await tap('m');
  view = await waitText('问 SQL 你 No 不 No');
  for (const name of ['精通 Linux 系统重装', '熟练使用 jQuery 切西瓜', '细品 Java', '问 SQL 你 No 不 No']) {
    if (!view.slots.some(slot => slot.includes(name))) throw new Error('missing autofill ' + name + ' ' + JSON.stringify(view.slots));
  }
  if (view.slots.length !== 4) throw new Error('hefei manual length ' + JSON.stringify(view.slots));
  await shot('SKILL-07-manual-complete.png');
  await press('从办公室重玩');
  await press('确认重新开始');
  await waitText('原本录用的人嫌工资低');
  await dismiss();
  await tap('m');
  view = await waitText('???');
  if (view.slots.length !== 4 || view.slots.some(slot => slot !== '???')) throw new Error('replay slots ' + JSON.stringify(view.slots));
  await shot('SKILL-06-manual-after-replay.png');
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
