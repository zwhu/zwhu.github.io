// 真实 Chrome：面试五句、白天对话、夜里 Dota、三种结局。
// node games/career-rpg/proto/tests/record-art.mjs
import { spawn } from 'node:child_process';
import { createReadStream, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BARELY_ACTIONS, BARELY_SEED, LOSS_ACTIONS, LOSS_SEED, REMEMBERED_ACTIONS, REMEMBERED_SEED } from '../line.mjs';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const OUT = path.join(ROOT, 'games/career-rpg/proto/review');
const STILLS = path.join(OUT, 'stills');
const PROTO = '/games/career-rpg/proto/index.html';
mkdirSync(STILLS, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
};
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
        if (message.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(message.params.exceptionDetails).slice(0, 400));
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
function selector(action) {
  if (action.type === 'work') return `[data-action="work"][data-id="${action.ticketId}"]`;
  if (action.type === 'study') return `[data-action="study"][data-skill="${action.skill}"]`;
  return `[data-action="${action.type}"]`;
}

const framesRoot = path.join(tmpdir(), 'hefei-art-frames');
rmSync(framesRoot, { recursive: true, force: true });
mkdirSync(framesRoot);

const report = { clips: [], stills: [] };

try {
  await connect();
  await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false });

  async function record(name, seed, play, fps = 2) {
    const dir = path.join(framesRoot, name);
    mkdirSync(dir);
    await goto(seed);
    let index = 0;
    const save = async (copies = 1) => {
      const file = path.join(dir, String(index).padStart(4, '0') + '.png');
      await shot(file);
      index += 1;
      for (let i = 1; i < copies; i += 1) {
        await shot(path.join(dir, String(index).padStart(4, '0') + '.png'));
        index += 1;
      }
      return file;
    };
    const note = await play(save);
    const file = path.join(OUT, name + '.mp4');
    await encode(dir, file, fps);
    report.clips.push({ file: path.relative(ROOT, file), seed, frames: index, ...note });
  }

  await record('interview', 'hefei', async save => {
    await save(2);
    if (!await evaluate(`!!document.querySelector('#dialogue')`)) await walkTo('boss');
    const lines = [];
    for (let i = 0; i < 6; i += 1) {
      const step = await evaluate(`(() => {
        if (window.hefei.present().interviewed && !document.querySelector('[data-dialogue="next"]')) {
          return { done: true, name: document.querySelector('#nameplate')?.textContent || '', text: document.querySelector('#dialogue-text')?.textContent || '', arrow: !!document.querySelector('.spot.speaking'), hint: /快捷键|[ZXC]键/.test(document.body.innerText) };
        }
        return { done: false, name: document.querySelector('#nameplate')?.textContent || '', text: document.querySelector('#dialogue-text')?.textContent || '', arrow: !!document.querySelector('.spot.speaking'), spot: document.querySelector('.spot.speaking')?.getAttribute('data-spot') || '', hint: /快捷键|[ZXC]键/.test(document.body.innerText) };
      })()`);
      if (step.hint) throw new Error('shortcut hint ' + step.text);
      if (step.done) break;
      lines.push(step);
      const held = await save(3);
      if (i === 0) writeFileSync(path.join(STILLS, 'art-interview-narrator.png'), (await import('node:fs')).readFileSync(held));
      if (step.spot === 'boss' && step.name === '老板') writeFileSync(path.join(STILLS, 'art-interview-boss.png'), (await import('node:fs')).readFileSync(held));
      if (step.spot === 'player') writeFileSync(path.join(STILLS, 'art-interview-player.png'), (await import('node:fs')).readFileSync(held));
      await evaluate(`document.querySelector('[data-dialogue="next"]').click()`);
    }
    if (lines[0].name !== '面试' || lines[0].text !== '原本录用的人嫌工资低，没来。' || lines[0].arrow) {
      throw new Error('opening ' + JSON.stringify(lines[0]));
    }
    if (lines[1].name !== '老板' || lines[1].spot !== 'boss' || !lines[1].arrow) throw new Error('boss line ' + JSON.stringify(lines[1]));
    if (lines[2].name !== '我' || lines[2].spot !== 'player' || !lines[2].arrow) throw new Error('player line ' + JSON.stringify(lines[2]));
    if (lines[3].spot !== 'boss' || !lines[3].arrow) throw new Error('boss reply ' + JSON.stringify(lines[3]));
    if (lines[4].text !== '就这样留下了。' || lines[4].name || lines[4].arrow) throw new Error('stayed ' + JSON.stringify(lines[4]));
    await save(3);
    const week = await evaluate(`document.querySelector('#dialogue-text')?.textContent || ''`);
    if (week !== '试用的第一周。桌上已经有单了。') throw new Error('week open ' + week);
    if (await evaluate(`!!document.querySelector('#nameplate') || !!document.querySelector('.spot.speaking')`)) throw new Error('week open has a speaker');
    await save(3);
    return { lines: lines.map(line => line.text) };
  });

  await record('day-talk', 'hefei', async save => {
    await finishInterview();
    await walkTo('lunch');
    await save(4);
    const before = await evaluate(`({name:document.querySelector('#nameplate')?.textContent, text:document.querySelector('#dialogue-text')?.textContent, arrow:!!document.querySelector('.spot.speaking'), spot:document.querySelector('.spot.speaking')?.getAttribute('data-spot')})`);
    if (before.name !== '饭搭子' || !before.text.includes('好饿，去吃面吗？') || before.spot !== 'lunch' || !before.arrow) {
      throw new Error('lunch ' + JSON.stringify(before));
    }
    const held = await save(2);
    const fs = await import('node:fs');
    fs.copyFileSync(held, path.join(STILLS, 'art-day-lunch.png'));
    await evaluate(`document.querySelector('[data-choice="accept"]').click()`);
    const afterFile = await save(4);
    const after = await evaluate(`({text:document.querySelector('#dialogue-text')?.textContent, stamina:document.querySelector('#stamina')?.textContent, ap:document.querySelector('#ap')?.textContent})`);
    if (after.text !== '吃完了。人倒是饱了。' || after.stamina !== '10' || after.ap !== '2') throw new Error('after lunch ' + JSON.stringify(after));
    fs.copyFileSync(afterFile, path.join(STILLS, 'art-day-lunch-after.png'));
    return { before: before.text, after };
  });

  await record('night-dota', 'hefei', async save => {
    await finishInterview();
    await evaluate(`document.querySelector('[data-action="night"]').click()`);
    await save(3);
    const night = await evaluate(`document.querySelector('#dialogue-text')?.textContent || ''`);
    if (night !== '白天的活告一段落。天黑了，我还没走。') throw new Error('night ' + night);
    const nightPeople = await evaluate(`[...document.querySelectorAll('[data-person]')].map(node => node.getAttribute('data-person')).join(',')`);
    if (nightPeople !== 'party') throw new Error('night people ' + nightPeople);
    if (await evaluate(`!!document.querySelector('#nameplate') || !!document.querySelector('.spot.speaking')`)) throw new Error('night narration has a speaker');
    const nightFile = await save(1);
    const fs = await import('node:fs');
    fs.copyFileSync(nightFile, path.join(STILLS, 'art-night-falls.png'));
    await evaluate(`document.querySelector('[data-dialogue="next"]').click()`);
    const passFile = await save(3);
    const pass = await evaluate(`document.querySelector('#dialogue-text')?.textContent || ''`);
    if (pass !== '日夜颠倒地学新东西，拼命把活干好，争取能留下来。') throw new Error('days pass ' + pass);
    fs.copyFileSync(passFile, path.join(STILLS, 'art-days-pass.png'));
    await evaluate(`document.querySelector('[data-dialogue="close"]').click()`);
    await walkTo('party');
    await save(3);
    const party = await evaluate(`document.querySelector('#dialogue-text')?.textContent || ''`);
    if (!party.includes('Dota')) throw new Error('party ' + party);
    await evaluate(`document.querySelector('[data-choice="accept"]').click()`);
    const opened = await evaluate(`document.querySelector('#dialogue-text')?.textContent || ''`);
    if (opened !== '开了。') throw new Error('opened ' + opened);
    const openedFile = await save(2);
    const fs2 = await import('node:fs');
    fs2.copyFileSync(openedFile, path.join(STILLS, 'art-opened.png'));
    await evaluate(`document.querySelector('[data-dialogue="next"]').click()`);
    await sleep(300);
    const dotaFile = await save(2);
    fs.copyFileSync(dotaFile, path.join(STILLS, 'art-night-dota.png'));
    const lane = await evaluate(`document.querySelector('#dota')?.innerText || ''`);
    if (!lane.includes('影魔') || !lane.includes('短') || /[ZXC]/.test(lane)) throw new Error('dota lane ' + lane);
    await sleep(1200);
    await save(2);
    await evaluate(`document.querySelector('[data-dota="skip"]').click()`);
    await sleep(80);
    await save(3);
    const result = await evaluate(`document.querySelector('#dota [data-result]')?.getAttribute('data-result') || ''`);
    if (!result) throw new Error('dota did not finish');
    return { night, pass, party, result };
  });

  async function playEnding(name, seed, actions, expect) {
    await record(name, seed, async save => {
      await evaluate(`(${JSON.stringify(actions)}).forEach(action => window.hefei.act(action))`);
      await evaluate(`document.querySelector('#ending')?.scrollIntoView({block:'start'})`);
      const text = await evaluate(`document.querySelector('#ending-text')?.textContent || ''`);
      const title = await evaluate(`document.querySelector('#ending h2')?.textContent || ''`);
      if (!text.includes(expect) || text.includes('争取') || text.startsWith(`${title}。`)) throw new Error(name + ' text ' + title + ' / ' + text);
      const held = await save(8);
      const fs = await import('node:fs');
      fs.copyFileSync(held, path.join(STILLS, `art-${name}.png`));
      return { title, text };
    }, 2);
  }

  await playEnding('ending-quit', LOSS_SEED, LOSS_ACTIONS, '被劝退');
  await playEnding('ending-stay', BARELY_SEED, BARELY_ACTIONS, '还没写完');
  await playEnding('ending-remembered', REMEMBERED_SEED, REMEMBERED_ACTIONS, '努力工作的人一定会被看到的');

  async function talkbox(file) {
    await goto('hefei');
    await finishInterview();
    await evaluate(`document.querySelector('#office').scrollIntoView({ block: 'center' })`);
    await walkTo('lunch');
    const info = await evaluate(`(() => {
      const office = document.querySelector('#office').getBoundingClientRect();
      const box = document.querySelector('#dialogue').getBoundingClientRect();
      const choice = document.querySelector('[data-choice="accept"]').getBoundingClientRect();
      const caret = document.querySelector('.caret').getBoundingClientRect();
      return {
        name: document.querySelector('#nameplate')?.textContent || '',
        choices: [...document.querySelectorAll('[data-choice]')].map(node => node.textContent).join(','),
        inside: box.left >= office.left - 1 && box.right <= office.right + 1 && box.top >= office.top - 1 && box.bottom <= office.bottom + 1,
        choiceInside: choice.left >= box.left && choice.right <= box.right + 1 && choice.top >= box.top && choice.bottom <= box.bottom + 1,
        caretInside: caret.left >= box.left && caret.right <= box.right + 1 && caret.top >= box.top && caret.bottom <= box.bottom + 1,
      };
    })()`);
    if (info.name !== '饭搭子' || info.choices !== '去,下次' || !info.inside || !info.choiceInside || !info.caretInside) {
      throw new Error('talkbox ' + JSON.stringify(info));
    }
    await shot(file);
  }
  await talkbox(path.join(STILLS, 'art-talkbox-desktop.png'));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await talkbox(path.join(STILLS, 'art-talkbox-390.png'));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await goto('hefei');
  await shot(path.join(STILLS, 'art-mobile-day.png'));
  await walkTo('boss');
  await shot(path.join(STILLS, 'art-mobile-interview.png'));
  report.stills = [
    'art-interview-narrator.png',
    'art-interview-boss.png',
    'art-interview-player.png',
    'art-day-lunch.png',
    'art-day-lunch-after.png',
    'art-night-falls.png',
    'art-days-pass.png',
    'art-night-dota.png',
    'art-opened.png',
    'art-talkbox-desktop.png',
    'art-talkbox-390.png',
    'art-ending-quit.png',
    'art-ending-stay.png',
    'art-ending-remembered.png',
    'art-mobile-day.png',
    'art-mobile-interview.png',
  ].map(name => `games/career-rpg/proto/review/stills/${name}`);
  if (errors.length) throw new Error(errors.join('\n'));
  writeFileSync(path.join(OUT, 'art-capture.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error('ART_CAPTURE_FAIL', error);
  process.exitCode = 1;
} finally {
  chrome.kill('SIGTERM');
  server.close();
  rmSync(framesRoot, { recursive: true, force: true });
}
