// 真实 Chrome：四个人各说一次，以及老哥预告的单第二天确实到来。
// node games/career-rpg/proto/tests/record-v03.mjs
import { spawn } from 'node:child_process';
import { createReadStream, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const OUT = path.join(ROOT, 'games/career-rpg/proto/review');
const PROTO = '/games/career-rpg/proto/index.html';
const TALK_SEED = 'hefei';
const FORECAST_SEED = 'forecast-seed';
mkdirSync(OUT, { recursive: true });

const mime = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
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
  '--lang=zh-CN', '--disable-translate', '--remote-debugging-port=0', 'about:blank',
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
        if (message.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(message.params.exceptionDetails).slice(0, 500));
        if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
          errors.push(message.params.args.map(arg => arg.value || arg.description || '').join(' '));
        }
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
const SPOT = { boss: [326, 100], lunch: [266, 160], neighbor: [147, 150], party: [106, 180] };

async function closeDialogue() {
  for (let i = 0; i < 6; i += 1) {
    if (!await evaluate(`!!document.querySelector('#dialogue')`)) return;
    await evaluate(`document.querySelector('[data-dialogue="next"], [data-dialogue="close"]')?.click()`);
    await sleep(30);
  }
}

async function walkTo(person) {
  const [x, y] = SPOT[person];
  const started = await evaluate(`window.hefei.clickScene(${x}, ${y})`);
  if (!started) throw new Error('no path to ' + person);
  for (let i = 0; i < 60; i += 1) {
    await sleep(80);
    if (await evaluate(`!!document.querySelector('#dialogue')`)) return;
  }
  throw new Error('no dialogue at ' + person);
}

async function finishInterview() {
  if (!await evaluate(`!!document.querySelector('#dialogue')`)) await walkTo('boss');
  for (let i = 0; i < 12; i += 1) {
    if (await evaluate(`window.hefei.present().interviewed && !document.querySelector('[data-dialogue="next"]')`)) break;
    await evaluate(`document.querySelector('[data-dialogue="next"], [data-dialogue="close"]')?.click()`);
    await sleep(40);
  }
  await evaluate(`document.querySelector('[data-dialogue="close"]')?.click()`);
}

async function reachNextMorning() {
  const start = await evaluate(`window.hefei.present().week * 10 + window.hefei.present().day`);
  for (let i = 0; i < 20; i += 1) {
    const now = await evaluate(`({ key: window.hefei.present().week * 10 + window.hefei.present().day, night: window.hefei.present().night })`);
    if (now.key > start && !now.night) return;
    await evaluate(`(() => {
      const close = document.querySelector('[data-dialogue="close"], [data-dialogue="next"]');
      if (close) { close.click(); return; }
      const rest = document.querySelector('[data-action="rest"]');
      if (rest) { rest.click(); return; }
      const sleep = document.querySelector('[data-action="sleep"]');
      if (sleep) { sleep.click(); return; }
      const night = document.querySelector('[data-action="night"]');
      if (night) night.click();
    })()`);
    await sleep(40);
  }
  throw new Error('did not reach the next morning');
}

async function goto(seed) {
  await send('Page.navigate', { url: `${origin}?seed=${encodeURIComponent(seed)}` });
  for (let i = 0; i < 50; i += 1) {
    await sleep(80);
    if (await evaluate('!!window.hefei')) return;
  }
  throw new Error('page did not boot ' + seed);
}
async function encode(framesDir, file, fps) {
  await new Promise((resolve, reject) => {
    const encoder = spawn('ffmpeg', [
      '-y', '-framerate', String(fps), '-i', path.join(framesDir, '%04d.png'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', file,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    encoder.stderr.on('data', chunk => { err += chunk; });
    encoder.on('exit', code => (code === 0 ? resolve() : reject(new Error(err.slice(-600)))));
  });
}

const framesRoot = path.join(tmpdir(), 'hefei-v03-frames');
rmSync(framesRoot, { recursive: true, force: true });
mkdirSync(framesRoot);
const stills = path.join(OUT, 'stills');
mkdirSync(stills, { recursive: true });

function sceneScript() {
  return `(() => {
    const spot = document.querySelector('.spot.speaking');
    const arrow = spot ? spot.querySelector('.arrow') : null;
    const body = spot ? spot.querySelector('.body') : null;
    const box = document.querySelector('#dialogue');
    const plate = document.querySelector('#nameplate');
    const text = document.querySelector('#dialogue-text');
    const arrowStyle = arrow ? getComputedStyle(arrow) : null;
    const boxStyle = box ? getComputedStyle(box) : null;
    const arrowBox = arrow ? arrow.getBoundingClientRect() : null;
    const bodyBox = body ? body.getBoundingClientRect() : null;
    const plateBox = plate ? plate.getBoundingClientRect() : null;
    const office = document.querySelector('#office');
    const officeBox = office ? office.getBoundingClientRect() : null;
    const rect = box ? box.getBoundingClientRect() : null;
    const stamina = document.querySelector('#stamina');
    const staminaBox = stamina ? stamina.getBoundingClientRect() : null;
    return {
      people: [...document.querySelectorAll('[data-person]')].map(node => node.getAttribute('data-person')),
      name: plate ? plate.textContent : '',
      text: text ? text.textContent : '',
      stamina: stamina ? stamina.textContent : '',
      ap: document.querySelector('#ap') ? document.querySelector('#ap').textContent : '',
      arrowVisible: arrowStyle ? arrowStyle.visibility === 'visible' : false,
      arrowColor: arrowStyle ? arrowStyle.borderTopColor : '',
      arrowAbove: Boolean(arrowBox && bodyBox && arrowBox.bottom <= bodyBox.top + 1),
      boxColor: boxStyle ? boxStyle.backgroundColor : '',
      insideScene: Boolean(officeBox && rect && rect.left >= officeBox.left - 1 && rect.right <= officeBox.right + 1 && rect.top >= officeBox.top - 1 && rect.bottom <= officeBox.bottom + 1),
      nearSceneBottom: Boolean(officeBox && rect && officeBox.bottom - rect.bottom >= -1 && officeBox.bottom - rect.bottom <= officeBox.height * 0.08),
      caret: !!document.querySelector('.caret'),
      nameVisible: Boolean(plateBox && plateBox.width > 0 && plateBox.height > 0 && plateBox.top < window.innerHeight),
      staminaVisible: Boolean(staminaBox && staminaBox.top >= 0 && staminaBox.bottom <= window.innerHeight),
      hint: /快捷键|[ZXC]键/.test(document.body.innerText),
      forecastTitle: box ? box.getAttribute('data-forecast-title') : '',
      forecastDifficulty: box ? box.getAttribute('data-forecast-difficulty') : '',
      forecastDue: box ? box.getAttribute('data-forecast-due') : '',
    };
  })()`;
}

try {
  await connect();
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  async function recordTalks() {
    const dir = path.join(framesRoot, 'coworkers');
    mkdirSync(dir);
    let index = 0;
    const save = async (copies = 1) => {
      const file = path.join(dir, String(index).padStart(4, '0') + '.png');
      await shot(file);
      index += 1;
      for (let i = 1; i < copies; i += 1) {
        const extra = path.join(dir, String(index).padStart(4, '0') + '.png');
        await shot(extra);
        index += 1;
      }
      return file;
    };
    await goto(TALK_SEED);
    await evaluate('window.scrollTo(0, 0)');
    const dayPeople = await evaluate(`[...document.querySelectorAll('[data-person]')].map(node => node.getAttribute('data-person')).join(',')`);
    if (dayPeople !== 'boss,lunch,neighbor') throw new Error('day people ' + dayPeople);
    await save(3);
    await walkTo('boss');
    await save(4);
    const intro = await evaluate(sceneScript());
    if (intro.name !== '面试') throw new Error('interview nameplate ' + intro.name);
    if (intro.text !== '原本录用的人嫌工资低，没来。') throw new Error('interview line ' + intro.text);
    if (intro.arrowVisible) throw new Error('narrator has an arrow');
    if (intro.hint) throw new Error('interview shows a shortcut hint');
    await finishInterview();
    const hired = await evaluate(`window.hefei.present().interviewed`);
    if (!hired) throw new Error('interview did not finish');
    await save(2);

    const boss = await speak('boss', '老板');
    if (boss.text.includes('面试')) throw new Error('boss line still the interview ' + boss.text);
    await evaluate(`document.querySelector('[data-dialogue="close"]').click()`);
    await save(2);

    const neighbor = await speak('neighbor', '隔壁工位老哥');
    if (!neighbor.text.includes('明天会来')) throw new Error('neighbor line ' + neighbor.text);
    await evaluate(`document.querySelector('[data-dialogue="close"]').click()`);
    await save(2);

    const night = await evaluate(`(() => { document.querySelector('[data-action="night"]').click(); return [...document.querySelectorAll('[data-person]')].map(node => node.getAttribute('data-person')).join(','); })()`);
    if (night !== 'party') throw new Error('night people ' + night);
    const nightLine = await evaluate(`document.querySelector('#dialogue-text')?.textContent || ''`);
    if (nightLine !== '白天的活告一段落。天黑了，我还没走。') throw new Error('night line ' + nightLine);
    await save(3);

    async function speak(person, name) {
      await closeDialogue();
      await walkTo(person);
      await save(4);
      const scene = await evaluate(sceneScript());
      if (scene.name !== name) throw new Error(person + ' nameplate ' + scene.name);
      if (!scene.text) throw new Error(person + ' empty line');
      if (!scene.arrowVisible || !scene.arrowAbove) throw new Error(person + ' arrow ' + JSON.stringify(scene));
      if (scene.arrowColor !== 'rgb(208, 0, 0)') throw new Error(person + ' arrow color ' + scene.arrowColor);
      if (!/249,\s*248,\s*241/.test(scene.boxColor)) throw new Error(person + ' box ' + scene.boxColor);
      if (!scene.insideScene || !scene.nearSceneBottom || !scene.caret || !scene.nameVisible || !scene.staminaVisible) throw new Error(person + ' layout ' + JSON.stringify(scene));
      if (scene.hint) throw new Error(person + ' shows a shortcut hint');
      return scene;
    }

    const blocked = await evaluate(`(() => {
      const before = window.hefei.present().log[0];
      for (const person of ['boss', 'lunch', 'neighbor']) {
        if (document.querySelector('[data-person="' + person + '"]')) return 'button ' + person;
      }
      return before;
    })()`);
    if (String(blocked).startsWith('button')) throw new Error('night still clickable ' + blocked);

    const teammate = await speak('party', '开黑队友');
    if (!teammate.text.includes('Dota')) throw new Error('party line ' + teammate.text);
    if (teammate.stamina !== '10') throw new Error('stamina before dota ' + teammate.stamina);
    await save(2);
    await evaluate(`document.querySelector('[data-choice="accept"]').click()`);
    const openedLine = await evaluate(`document.querySelector('#dialogue-text')?.textContent || ''`);
    if (openedLine !== '开了。') throw new Error('opened line ' + openedLine);
    await evaluate(`document.querySelector('[data-dialogue="next"]').click()`);
    await sleep(60);
    await evaluate(`document.querySelector('[data-dota="skip"]').click()`);
    await sleep(40);
    await evaluate(`document.querySelector('[data-dota="back"]').click()`);
    await sleep(40);
    const afterDota = await evaluate(`document.querySelector('#stamina').textContent`);
    if (afterDota !== '7') throw new Error('stamina after dota ' + afterDota);
    if (await evaluate(`!!document.querySelector('#dota')`)) throw new Error('dota still open');
    await save(3);

    await reachNextMorning();
    const beforeNoodles = await speak('lunch', '饭搭子');
    if (!beforeNoodles.text.includes('好饿，去吃面')) throw new Error('lunch line ' + beforeNoodles.text);
    const held = await save(4);
    await evaluate(`document.querySelector('[data-choice="accept"]').click()`);
    await save(6);
    const after = await evaluate(sceneScript());
    if (after.stamina !== '10') throw new Error('stamina after noodles ' + after.stamina);
    if (after.ap !== '2') throw new Error('ap after noodles ' + after.ap);
    if (after.text !== '吃完了。人倒是饱了。') throw new Error('noodle result ' + after.text);
    if (after.name !== '饭搭子' || !after.arrowVisible || !/249,\s*248,\s*241/.test(after.boxColor) || !after.insideScene) {
      throw new Error('noodle scene ' + JSON.stringify(after));
    }
    const last = path.join(dir, String(index - 1).padStart(4, '0') + '.png');
    const fs = await import('node:fs');
    fs.copyFileSync(held, path.join(stills, 'noodles-before.png'));
    fs.copyFileSync(last, path.join(stills, 'noodles-after.png'));
    const file = path.join(OUT, 'coworkers.mp4');
    await encode(dir, file, 2);
    return { file: path.relative(ROOT, file), frames: index, boss: boss.text, teammate: teammate.text, neighbor: neighbor.text, lunch: beforeNoodles.text, after };
  }

  async function recordForecast() {
    const dir = path.join(framesRoot, 'forecast');
    mkdirSync(dir);
    let index = 0;
    const save = async (copies = 1) => {
      await shot(path.join(dir, String(index).padStart(4, '0') + '.png'));
      index += 1;
      for (let i = 1; i < copies; i += 1) {
        await shot(path.join(dir, String(index).padStart(4, '0') + '.png'));
        index += 1;
      }
    };
    await goto(FORECAST_SEED);
    await evaluate('window.scrollTo(0, 0)');
    await finishInterview();
    const hiredForecast = await evaluate(`window.hefei.present().interviewed`);
    if (!hiredForecast) throw new Error('forecast interview did not finish');
    await save(2);
    await walkTo('neighbor');
    await save(6);
    const scene = await evaluate(sceneScript());
    if (scene.name !== '隔壁工位老哥') throw new Error('forecast name ' + scene.name);
    if (!scene.forecastTitle || !scene.text.includes(scene.forecastTitle)) throw new Error('forecast text ' + scene.text);
    if (!scene.text.includes(`${scene.forecastDifficulty} 点`) || !scene.text.includes(`期限 ${scene.forecastDue} 天`)) {
      throw new Error('forecast numbers ' + scene.text);
    }
    if (!scene.arrowVisible || !scene.insideScene || !/249,\s*248,\s*241/.test(scene.boxColor)) throw new Error('forecast scene ' + JSON.stringify(scene));
    const fs = await import('node:fs');
    fs.copyFileSync(path.join(dir, String(index - 1).padStart(4, '0') + '.png'), path.join(stills, 'forecast-said.png'));
    await evaluate(`document.querySelector('[data-dialogue="close"]').click()`);
    await reachNextMorning();
    await evaluate(`window.hefei.clickScene(75, 132)`);
    for (let i = 0; i < 40; i += 1) {
      if (await evaluate(`!!document.querySelector('#desk-panel')`)) break;
      await sleep(80);
    }
    const morning = await evaluate(`(() => {
      const title = ${JSON.stringify(scene.forecastTitle)};
      const due = ${JSON.stringify(scene.forecastDue)};
      const cost = ${JSON.stringify(scene.forecastDifficulty)};
      const view = window.hefei.present();
      const ticket = view.tickets.find(item => item.title === title && String(item.difficulty) === cost && String(item.dueIn) === due);
      if (ticket) {
        const list = view.tickets;
        const index = list.findIndex(item => item.id === ticket.id);
        for (let step = 0; step < index; step += 1) document.querySelector('[data-desk="next"]')?.click();
      }
      const card = ticket ? document.querySelector('[data-ticket="' + ticket.id + '"]') : null;
      return {
        week: view.week,
        day: view.dayName,
        found: Boolean(ticket),
        card: card ? card.innerText : '',
        log: view.log.join(' | '),
      };
    })()`);
    if (!morning.found) throw new Error('predicted ticket missing ' + JSON.stringify(morning));
    if (!morning.card.includes(scene.forecastTitle)) throw new Error('card ' + morning.card);
    if (!morning.log.includes(scene.forecastTitle)) throw new Error('log lost the prediction ' + morning.log);
    await save(6);
    fs.copyFileSync(path.join(dir, String(index - 1).padStart(4, '0') + '.png'), path.join(stills, 'forecast-arrived.png'));
    const file = path.join(OUT, 'forecast.mp4');
    await encode(dir, file, 2);
    return { file: path.relative(ROOT, file), frames: index, said: scene.text, morning };
  }

  const talks = await recordTalks();
  const forecast = await recordForecast();

  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await goto(TALK_SEED);
  await finishInterview();
  await walkTo('boss');
  await shot(path.join(stills, 'mobile-dialogue.png'));
  const mobile = await evaluate(sceneScript());
  if (!mobile.insideScene || !mobile.caret || mobile.name !== '老板' || !mobile.arrowVisible) throw new Error('mobile ' + JSON.stringify(mobile));

  if (errors.length) throw new Error('console errors\n' + errors.join('\n'));
  const report = { origin, talkSeed: TALK_SEED, forecastSeed: FORECAST_SEED, talks, forecast, mobile, consoleErrors: errors };
  writeFileSync(path.join(OUT, 'v03-capture.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error('CAPTURE_FAIL', error);
  process.exitCode = 1;
} finally {
  chrome.kill('SIGTERM');
  server.close();
  rmSync(framesRoot, { recursive: true, force: true });
}
