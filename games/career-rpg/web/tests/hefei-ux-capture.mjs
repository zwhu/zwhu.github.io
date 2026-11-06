// Real Chrome pass of the Hefei chapter. Writes review/hefei-ux/.
import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync, createReadStream} from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const OUT = path.join(ROOT, 'games/career-rpg/web/review/hefei-ux');
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
  '--autoplay-policy=no-user-gesture-required', '--lang=zh-CN', '--disable-translate', '--window-size=1400,1100',
  '--remote-debugging-port=9358', pageURL,
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
      const tabs = JSON.parse(await httpGet('http://127.0.0.1:9358/json'));
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
  if (message.result?.exceptionDetails) throw new Error(JSON.stringify(message.result.exceptionDetails).slice(0, 800));
  return message.result?.result?.value;
}
const SNAP = `(() => {
  if (!window.careerPrototype) return null;
  const s = careerPrototype.snapshot();
  const convo = document.querySelector('#conversation');
  const stage = document.querySelector('#stage').getBoundingClientRect();
  const box = convo.getBoundingClientRect();
  const arrow = document.querySelector('#speaker-arrow');
  const ar = arrow.getBoundingClientRect();
  const buttons = [...document.querySelectorAll('#conversation .choices button, #system-dialog .choices button')].filter(button => button.getClientRects().length).map(button => ({text: button.textContent || button.getAttribute('aria-label') || '', id: button.id, caret: button.classList.contains('continue-caret'), focused: document.activeElement === button}));
  return {
    position: s.position, state: s.state, active: s.active, chapter: s.chapter.state, flags: s.chapter.flags, skills: s.chapter.skills || null,
    task: document.querySelector('#task')?.textContent || '',
    speaker: document.querySelector('#speaker')?.textContent || '',
    dialogue: document.querySelector('#dialogue')?.textContent || '',
    hidden: convo.hidden,
    docked: convo.classList.contains('docked'),
    narration: convo.classList.contains('narration'),
    bottom: !convo.hidden && box.bottom <= stage.bottom - stage.height * 0.01 && box.top > stage.top + stage.height * 0.45 && box.left > stage.left + 2 && box.right < stage.right - 2 && box.width > stage.width * 0.85 && box.width < stage.width * 0.99,
    buttons, reviewButton: buttons.some(button => button.text.includes('回看')),
    continueExplore: buttons.some(button => button.text.includes('继续探索')),
    hint: !!(document.querySelector('#reading-hint')?.textContent.includes('Shift+Tab') && document.querySelector('#reading-hint').getClientRects().length),
    pageReview: document.body.innerText.includes('回看'),
    arrowVisible: !arrow.hidden && ar.height > 0,
    arrowActor: arrow.dataset.actor || '',
  };
})()`;
async function snap() {
  const started = Date.now();
  while (Date.now() - started < 20000) {
    const value = await evaluate(SNAP);
    if (value) return value;
    await sleep(120);
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
async function shot(name) {
  await evaluate(`document.querySelector('.game-shell').scrollIntoView({block:'center',inline:'center'})`);
  await sleep(40);
  const box = await evaluate(`(() => { const r = document.querySelector('.game-shell').getBoundingClientRect(); return {x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.width, height: r.height}; })()`);
  const message = await send('Page.captureScreenshot', {format: 'png', clip: {...box, scale: 1}});
  writeFileSync(path.join(OUT, name), Buffer.from(message.result.data, 'base64'));
}
async function waitText(part) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < 8000) {
    last = await snap();
    const blob = `${last.dialogue}\n${last.task}\n${last.speaker}`;
    if (blob.includes(part)) return last;
    await sleep(40);
  }
  throw new Error('timeout ' + part + ' ' + JSON.stringify(last));
}
async function press(label) {
  for (let i = 0; i < 8; i++) {
    const view = await snap();
    const exact = view.buttons.find(button => button.text === label);
    const fuzzy = view.buttons.find(button => button.text.includes(label) && !(label === '继续' && button.text !== '继续'));
    const target = exact || fuzzy;
    if (!target) throw new Error('no button ' + label + ' ' + JSON.stringify(view.buttons) + view.dialogue);
    const focused = view.buttons.find(button => button.focused);
    if (focused && focused.text === target.text) break;
    await tap('ArrowRight');
    await sleep(50);
  }
  await sleep(200);
  await tap('Enter');
  await sleep(180);
}
async function dismiss() {
  const view = await snap();
  if (view.hidden && view.state === 'explore') return view;
  if (view.buttons.some(button => button.caret || button.id === 'close-dialogue')) {
    for (let i = 0; i < 8; i++) {
      const cur = await snap();
      const focused = cur.buttons.find(button => button.focused);
      if (focused && (focused.caret || focused.id === 'close-dialogue')) break;
      await tap('ArrowRight');
      await sleep(50);
    }
    await sleep(200);
    await tap('Enter');
    await sleep(180);
    return snap();
  }
  await press(view.buttons.some(button => button.text === '返回') ? '返回' : '继续');
  return snap();
}
async function waitExplore() {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < 10000) {
    last = await snap();
    if (last.state === 'explore' && last.hidden) return last;
    await sleep(40);
  }
  throw new Error('not exploring ' + JSON.stringify(last));
}
async function walkTo(tx, ty) {
  for (let i = 0; i < 160; i++) {
    const view = await snap();
    if (view.state === 'paused') { await tap('Escape'); await sleep(80); continue; }
    if (view.state !== 'explore') throw new Error('walk interrupted ' + JSON.stringify({state: view.state, speaker: view.speaker, dialogue: view.dialogue.slice(0, 80)}));
    const dx = tx - view.position.x, dy = ty - view.position.y;
    if (Math.hypot(dx, dy) <= 8) return view;
    const key = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp');
    const before = view.position;
    await hold(key, 100);
    const after = (await snap()).position;
    if (Math.hypot(after.x - before.x, after.y - before.y) < 1) {
      const other = key.startsWith('ArrowL') || key.startsWith('ArrowR') ? (dy > 0 ? 'ArrowDown' : 'ArrowUp') : (dx > 0 ? 'ArrowRight' : 'ArrowLeft');
      await hold(other, 140);
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
    await sleep(60);
  }
  throw new Error('cannot focus ' + id + ' ' + JSON.stringify(await snap()));
}
const steps = [];
async function record(id, file, expect = {}) {
  const view = await snap();
  if (expect.text && !`${view.dialogue}\n${view.task}`.includes(expect.text)) throw new Error(id + ' missing ' + expect.text + ' ' + JSON.stringify(view));
  if (expect.arrow === null && view.arrowVisible) throw new Error(id + ' narration has an arrow ' + view.arrowActor);
  if (expect.arrow && view.arrowActor !== expect.arrow) throw new Error(id + ' arrow ' + view.arrowActor);
  if (expect.bottom && !view.bottom) throw new Error(id + ' dialogue is not docked to the bottom');
  if (view.reviewButton) throw new Error(id + ' showed 回看 ' + JSON.stringify(view.buttons));
  if (view.continueExplore) throw new Error(id + ' showed 继续探索 ' + JSON.stringify(view.buttons));
  if (view.hint) throw new Error(id + ' showed the reading hint');
  await shot(file);
  const step = {id, file, dialogue: view.dialogue, speaker: view.speaker, task: view.task, buttons: view.buttons.map(button => button.text), reviewButton: view.reviewButton, pageReview: view.pageReview, bottom: view.bottom, docked: view.docked, narration: view.narration, arrowVisible: view.arrowVisible, arrowActor: view.arrowActor, state: view.state, chapter: view.chapter, position: view.position, active: view.active, flags: view.flags};
  steps.push(step);
  console.log(id, view.speaker, view.dialogue.slice(0, 42), view.task);
  return view;
}

try {
  await connect();
  const targets = await evaluate(`import('./chapters/hefei.mjs').then(mod => ({
    objects: Object.fromEntries(mod.HEFEI.objects.map(item => [item.id, {x: item.x, y: item.y, role: item.role || '', iconAt: item.iconAt || null}])),
    actors: Object.fromEntries(mod.HEFEI.actors.filter(item => item.interaction).map(item => [item.id, item.interaction])),
  }))`);
  await waitText('面试。原本录用的人嫌工资低，没来。');
  await record('interview-narration', '01-interview-narration.png', {text: '面试。原本录用的人嫌工资低，没来。', arrow: null, bottom: true});
  await dismiss();
  await walkTo(147, 192);
  await focusObject('colleague-b2');
  await tap('e');
  await waitText('你是来面试的吧');
  await record('colleague-near-interview', '02-colleague-near-interview.png', {text: '老板在右边茶桌等你', arrow: 'colleague-b2', bottom: true});
  await dismiss();
  await walkTo(215, 192);
  await focusObject('colleague-b3');
  await tap('e');
  await waitText('招人的事别问我');
  await record('colleague-far-interview', '03-colleague-far-interview.png', {text: '他在茶桌那边坐着', arrow: 'colleague-b3', bottom: true});
  await dismiss();
  await route([{x: 24, y: 196}, {x: 24, y: 90}]);
  await focusObject('jquery-book');
  await tap('e');
  await waitText('现在先去找老板面试');
  await record('shelf-interview', '04-shelf-interview.png', {text: '现在先去找老板面试', arrow: null, bottom: true});
  await dismiss();
  await route([{x: 24, y: 196}, {x: 270, y: 196}, {x: 270, y: 128}, {x: 310, y: 128}]);
  await focusObject('boss');
  await tap('e');
  await waitText('你能力不行');
  await record('boss-line', '05-boss-line.png', {text: '你能力不行，来了也干不了活。', arrow: 'boss', bottom: true});
  await press('我不要工资，让我来试试就行。');
  await waitText('我不要工资，让我来试试就行。');
  await record('player-line', '06-player-line.png', {text: '我不要工资，让我来试试就行。', arrow: 'player', bottom: true});
  await press('继续');
  await waitText('行，那你想试试我也不拦你');
  await record('boss-reply', '07-boss-reply.png', {text: '行，那你想试试我也不拦你', arrow: 'boss', bottom: true});
  await press('继续');
  await waitText('就这样留下了');
  await record('stayed', '08-stayed.png', {text: '就这样留下了', arrow: null, bottom: true});
  const day = await waitExplore();
  if (!day.task.includes('白天：去自己的工位开始干活')) throw new Error('day task ' + day.task);
  await record('day-taskbar', '09-day-taskbar.png', {text: '白天：去自己的工位开始干活'});
  await route([{x: 270, y: 128}, {x: 270, y: 192}, {x: 147, y: 192}]);
  await focusObject('colleague-b2');
  await tap('e');
  await waitText('好饿啊');
  await record('colleague-near-day', '10-colleague-near-day.png', {text: '好饿啊，搞完这点要不去吃面？', arrow: 'colleague-b2', bottom: true});
  await dismiss();
  await walkTo(215, 192);
  await focusObject('colleague-b3');
  await tap('e');
  await waitText('熬过星期三');
  await record('colleague-far-day', '11-colleague-far-day.png', {text: '没事，熬过星期三就是星期五。', arrow: 'colleague-b3', bottom: true});
  await dismiss();
  await walkTo(75, 192);
  await focusObject('my-pc');
  await tap('e');
  await waitText('我在自己的工位坐下');
  await record('take-task', '12-take-task.png', {text: '我在自己的工位坐下', arrow: 'player', bottom: true});
  await press('接任务');
  await waitExplore();
  await focusObject('linux-screen');
  await tap('e');
  await waitText('第一次用 Linux');
  await record('linux', '13-linux.png', {text: '第一次用 Linux 开发机，第一次用 Git。不会的就 Google。', arrow: 'player', bottom: true});
  await press('记下来');
  await waitExplore();
  await route([{x: 24, y: 192}, {x: 24, y: 90}]);
  await focusObject('jquery-book');
  await tap('e');
  await waitText('书架上夹着一本《锋利的 jQuery》');
  await record('jquery-found', '14-jquery-found.png', {text: '书架上夹着一本《锋利的 jQuery》。', arrow: null, bottom: true});
  await press('拿下来');
  await waitText('第一次写前端');
  await record('jquery-learn', '15-jquery-learn.png', {text: '第一次写前端，手边是《锋利的 jQuery》。还第一次写了 E2E 测试。', arrow: 'player', bottom: true});
  await press('记下来');
  await waitText('白天的活告一段落');
  await sleep(2000);
  await record('night-falls', '16-night-falls.png', {text: '白天的活告一段落。天黑了，我还没走。', arrow: null, bottom: true});
  await waitExplore();
  await route([{x: 24, y: 192}, {x: 75, y: 192}]);
  await focusObject('java-book');
  await tap('e');
  await waitText('晚上对着 Java');
  await record('java', '17-java.png', {text: '晚上对着 Java 往下啃。', arrow: 'player', bottom: true});
  await press('记下来');
  await waitExplore();
  await focusObject('db-screen');
  await tap('e');
  await waitText('再学数据库和 NoSQL');
  await record('db', '18-db.png', {text: '再学数据库和 NoSQL。', arrow: 'player', bottom: true});
  await press('记下来');
  await waitText('日夜颠倒地学新东西，拼命把活干好，争取能留下来');
  await sleep(700);
  await record('days-pass', '19-days-pass.png', {text: '日夜颠倒地学新东西，拼命把活干好，争取能留下来。', arrow: null, bottom: true});
  await waitText('入职两个月');
  await record('raise-narration', '20-raise-narration.png', {text: '入职两个月，加了两次薪。', arrow: null, bottom: true});
  await dismiss();
  await route([{x: 270, y: 192}, {x: 270, y: 128}, {x: 310, y: 128}]);
  await focusObject('boss');
  await tap('e');
  await waitText('努力工作的人一定会被看到的');
  await record('boss-raise', '21-boss-raise.png', {text: '努力工作的人一定会被看到的。', arrow: 'boss', bottom: true});
  const review = steps.filter(step => step.reviewButton || step.pageReview);
  const checks = {
    result: review.length ? 'failed' : 'passed',
    browser: 'Chrome headless 1400x1100 software WebGL',
    url: '/games/career-rpg/web/?chapter=hefei',
    noReviewButton: review.length === 0,
    dialogueDockedToBottom: steps.filter(step => step.state==='dialogue'||step.state==='transition').every(step => step.bottom),
    targets,
    steps,
  };
  writeFileSync(path.join(OUT, 'checks.json'), JSON.stringify(checks, null, 2) + '\n');
  console.log('CAPTURE_OK', steps.length);
} catch (error) {
  try { await shot('failure.png'); } catch {}
  writeFileSync(path.join(OUT, 'checks.json'), JSON.stringify({result: 'failed', error: String(error), steps}, null, 2) + '\n');
  console.error('CAPTURE_FAIL', error);
  process.exitCode = 1;
} finally {
  chrome.kill('SIGTERM');
  server.close();
  setTimeout(() => process.exit(process.exitCode || 0), 300);
}
