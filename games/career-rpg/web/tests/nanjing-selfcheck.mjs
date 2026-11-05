// Headless playthrough of the Nanjing chapter. Evidence only; not part of verify.py.
import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync, createReadStream} from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const OUT = path.join(ROOT, 'games/career-rpg/web/review/nanjing-selfcheck');
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
const chrome = spawn('google-chrome-stable', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader-webgl',
  '--autoplay-policy=no-user-gesture-required', '--lang=zh-CN', '--disable-translate', '--window-size=1280,900',
  '--remote-debugging-port=9337', pageURL,
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
      const tabs = JSON.parse(await httpGet('http://127.0.0.1:9337/json'));
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
const NAMES = ['fibjs／nodejs 做全栈', 'CI/CD 做集成测试', '对上线要有敬畏之心（灰度、观测、回滚）', '学会从失败中学习经验', 'React／Webpack'];
async function pickup(name, glintFile, awardFile) {
  const before = await snap();
  await shot(glintFile);
  await tap('e');
  const award = await waitText('获得技能：' + name);
  if (award.state === 'explore') throw new Error('award did not open ' + name);
  await shot(awardFile);
  const locked = award.position;
  await hold('ArrowRight', 280);
  const during = await snap();
  if (during.state === 'explore' || Math.hypot(during.position.x - locked.x, during.position.y - locked.y) > 2) throw new Error('award did not lock ' + name);
  await press('OK');
  const after = await snap();
  if (after.state !== 'explore') throw new Error('after ok ' + name + ' ' + after.state);
  return before;
}
async function openManual(part) {
  await tap('m');
  return waitText(part);
}
try {
  await connect();
  let view = await waitText('第一次做 C 端');
  if (view.title !== '像素前端') throw new Error('title ' + view.title);
  await evaluate('window.scrollTo(0,0)');
  await sleep(150);
  await shot('SLOGAN-01-title.png');
  if (!view.dialogue.includes('第一次做 C 端')) throw new Error('opening ' + view.dialogue);
  await shot('SLOGAN-01-opening.png');
  await dismiss();
  await openManual('???');
  view = await snap();
  if (view.slots.length !== 5 || view.slots.some(slot => slot !== '???')) throw new Error('opening slots ' + JSON.stringify(view.slots));
  await shot('NJ-SKILL-01-manual-empty.png');
  await dismiss();

  await walkTo(82, 127);
  await use('forum', '打开论坛反馈', '确认，去处理');
  await press('继续');
  await dismiss();
  await walkTo(185, 127);
  await use('cto', '听 CTO 排查', '过去看看');
  await dismiss();
  await walkTo(82, 127);
  await use('forum', '重读论坛反馈', '记下来');
  await dismiss();
  await walkTo(82, 127);
  await pickup(NAMES[0], 'NJ-SKILL-01-glint.png', 'NJ-SKILL-01-award.png');
  const audio = await evaluate('JSON.stringify(window.careerSkillAudio ? careerSkillAudio() : [])');
  writeFileSync(path.join(OUT, 'audio-log.json'), audio);
  if (!JSON.parse(audio).some(event => event.kind === 'oscillator-start')) throw new Error('no oscillator ' + audio);
  await openManual(NAMES[0]);
  view = await snap();
  if (!view.slots.some(slot => slot.includes(NAMES[0])) || view.slots.filter(slot => slot === '???').length !== 4) throw new Error('manual fibjs ' + JSON.stringify(view.slots));
  await shot('NJ-SKILL-01-manual.png');
  await dismiss();

  await walkTo(185, 127);
  await use('cto-pc', '查看排查记录', '记下来');
  await dismiss();
  await use('cto-pc', '确认这次影响到谁', '记下来');
  await dismiss();
  await use('cto', '这轮排查先到这里', '这轮排查先到这里');
  await waitText('两小时');
  await shot('NJ-STORY-01-restored.png');
  if (/有人扛|一起扛|一起承担/.test((await snap()).dialogue)) throw new Error('story still says 有人扛');
  await press('收起');
  await dismiss();
  await walkTo(120, 148);
  await pickup(NAMES[2], 'NJ-SKILL-03-glint.png', 'NJ-SKILL-03-award.png');
  await walkTo(185, 127);
  await use('cto-pc', '查看补测清单', '确认看过测试');
  await dismiss();
  await walkTo(230, 148);
  await pickup(NAMES[1], 'NJ-SKILL-02-glint.png', 'NJ-SKILL-02-award.png');
  await walkTo(185, 127);
  await use('cto-pc', '查看坑点注释', '确认看过注释');
  await dismiss();
  await walkTo(344, 86);
  await use('manual', '把这页写进手册');
  view = await waitText('失败留在这页');
  if (/有人扛|一起扛|一起承担/.test(view.dialogue)) throw new Error('manual still says 有人扛');
  await shot('NJ-STORY-01-manual.png');
  await dismiss();
  await walkTo(344, 86);
  await pickup(NAMES[3], 'NJ-SKILL-04-glint.png', 'NJ-SKILL-04-award.png');
  await walkTo(320, 150);
  await use('journey-map', '打开这段路程', '打开这段路程');
  const started = Date.now();
  let startShot = false, midShot = false;
  while (Date.now() - started < 8000) {
    const journey = await evaluate('careerJourney()');
    if (!startShot && journey.progress > 0.01 && journey.progress < 0.2) { await shot('NJ-BRIDGE-01-start.png'); await shot('SLOGAN-01-transition.png'); startShot = true; }
    if (!midShot && journey.progress > 0.4 && journey.progress < 0.7) { await shot('NJ-BRIDGE-01-mid.png'); midShot = true; }
    if (journey.arrived) break;
    await sleep(80);
  }
  view = await snap();
  if (!view.journey || view.slogan !== '像素前端') throw new Error('journey title ' + JSON.stringify(view));
  if (!startShot || !midShot) throw new Error('missed bridge frames ' + JSON.stringify(await evaluate('careerJourney()')));
  await shot('NJ-BRIDGE-01-arrive.png');
  await press('拾取');
  await waitText('获得技能：' + NAMES[4]);
  await shot('NJ-SKILL-05-award.png');
  await press('OK');
  await waitText('这段路程看完了');
  await press('这段路程看完了');
  await waitText('南京 · 本章完成');
  await dismiss();
  view = await openManual(NAMES[4]);
  for (const name of NAMES) if (!view.slots.some(slot => slot.includes(name))) throw new Error('complete manual missing ' + name + ' ' + JSON.stringify(view.slots));
  await shot('NJ-SKILL-05-manual-complete.png');
  await dismiss();

  await tap('m');
  await waitText('从办公室重玩');
  await press('从办公室重玩');
  await press('确认重新开始');
  await waitText('第一次做 C 端');
  await dismiss();
  await walkTo(82, 127); await use('forum', '打开论坛反馈', '确认，去处理'); await press('继续'); await dismiss();
  await walkTo(185, 127); await use('cto', '听 CTO 排查', '过去看看'); await dismiss();
  await walkTo(82, 127); await use('forum', '重读论坛反馈', '记下来'); await dismiss();
  await walkTo(185, 127); await use('cto-pc', '查看排查记录', '记下来'); await dismiss();
  await use('cto-pc', '确认这次影响到谁', '记下来'); await dismiss();
  await use('cto', '这轮排查先到这里', '这轮排查先到这里'); await press('收起'); await dismiss();
  await walkTo(185, 127); await use('cto-pc', '查看补测清单', '确认看过测试'); await dismiss();
  await use('cto-pc', '查看坑点注释', '确认看过注释'); await dismiss();
  await walkTo(344, 86); await use('manual', '把这页写进手册'); await dismiss();
  await walkTo(320, 150); await use('journey-map', '打开这段路程', '打开这段路程');
  const again = Date.now();
  while (Date.now() - again < 8000) {
    if ((await evaluate('careerJourney()')).arrived) break;
    await sleep(100);
  }
  await press('这段路程看完了');
  await waitText('南京 · 本章完成');
  await dismiss();
  view = await openManual(NAMES[4]);
  for (const name of NAMES) if (!view.slots.some(slot => slot.includes(name))) throw new Error('autogrant missing ' + name + ' ' + JSON.stringify(view.slots));
  await shot('NJ-SKILL-autogrant.png');
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
