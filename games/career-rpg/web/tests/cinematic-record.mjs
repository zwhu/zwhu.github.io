// Headless recording for ?cinematic=hefei. Reuses the selfcheck Chrome path.
// node games/career-rpg/web/tests/cinematic-record.mjs
import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync, createReadStream, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import http from 'node:http';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const OUT = path.join(ROOT, 'games/career-rpg/web/review/cinematic');
const FRAMES = path.join(tmpdir(), 'career-cinematic-frames');
mkdirSync(OUT, {recursive: true});
mkdirSync(path.join(OUT, 'stills'), {recursive: true});
rmSync(FRAMES, {recursive: true, force: true});
mkdirSync(FRAMES, {recursive: true});
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
async function shot(name, clip) {
  const message = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false, ...(clip ? {clip} : {})});
  const buffer = Buffer.from(message.result.data, 'base64');
  writeFileSync(name, buffer);
  return buffer;
}
function pngSize(buffer) {
  return {width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20)};
}
try {
  await connect();
  await send('Page.addScriptToEvaluateOnNewDocument', {source: 'window.__cinematicExternal = true;'});
  await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});
  await send('Page.navigate', {url: origin + '?chapter=hefei'});
  let normal = null;
  for (let i = 0; i < 80 && !normal; i++) {
    await sleep(150);
    normal = await evaluate('window.careerPrototype ? careerPrototype.snapshot() : null');
  }
  if (!normal) throw new Error('normal play did not start');
  const title = await evaluate(`document.querySelector('#game-title')?.textContent || ''`);
  if (title !== '像素前端') throw new Error('title ' + title);
  const armed = await evaluate('typeof window.careerCinematic');
  if (armed !== 'undefined') throw new Error('cinematic armed without the query');
  await sleep(400);
  const later = await evaluate('careerPrototype.snapshot().position');
  if (later.x !== normal.position.x || later.y !== normal.position.y) throw new Error('normal play moved on its own');
  const normalShot = await shot(path.join(OUT, 'normal-hefei.png'));
  const normalSize = pngSize(normalShot);
  await send('Emulation.setDeviceMetricsOverride', {width: 216, height: 216, deviceScaleFactor: 1, mobile: false});
  await send('Page.navigate', {url: origin + '?cinematic=hefei'});
  let ready = false;
  for (let i = 0; i < 80 && !ready; i++) {
    await sleep(150);
    ready = await evaluate('!!window.careerCinematic');
  }
  if (!ready) throw new Error(await evaluate('document.body.innerText.slice(0, 400)'));
  const output = await evaluate('careerCinematic.output');
  if (output !== 216) throw new Error('output ' + output);
  const stills = [];
  let frames = 0;
  let last = null;
  const started = Date.now();
  while (frames < 12000) {
    const report = await evaluate('careerCinematic.tick()');
    if (!report) throw new Error('tick returned empty');
    if (report.error) throw new Error(report.error);
    if (report.skip) continue;
    const buffer = await shot(path.join(FRAMES, String(frames).padStart(5, '0') + '.png'), {x: 0, y: 0, width: 216, height: 216, scale: 1});
    const size = pngSize(buffer);
    if (size.width !== 216 || size.height !== 216) throw new Error('frame ' + frames + ' is ' + size.width + 'x' + size.height);
    if (report.still) {
      const raw = Buffer.from(report.still.png.replace(/^data:image\/png;base64,/, ''), 'base64');
      const stillSize = pngSize(raw);
      if (stillSize.width !== stillSize.height) throw new Error(report.still.name + ' not square');
      if (stillSize.width !== report.still.width) throw new Error(report.still.name + ' size');
      const file = path.join(OUT, 'stills', report.still.name + '.png');
      writeFileSync(file, raw);
      stills.push({name: report.still.name, width: stillSize.width, height: stillSize.height, file: path.relative(ROOT, file)});
    }
    last = report;
    frames += 1;
    if (frames % 300 === 0) console.log('frames', frames, 'shot', report.shot, 'phase', report.phase, 's', ((Date.now() - started) / 1000).toFixed(1));
    if (report.done) break;
  }
  if (!last?.done) throw new Error('recording did not finish ' + JSON.stringify(last));
  const played = await evaluate('careerCinematic.report()');
  const video = path.join(OUT, 'hefei.mp4');
  await new Promise((resolve, reject) => {
    const encoder = spawn('ffmpeg', [
      '-y', '-framerate', '60', '-i', path.join(FRAMES, '%05d.png'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-movflags', '+faststart', video,
    ], {stdio: ['ignore', 'ignore', 'pipe']});
    let err = '';
    encoder.stderr.on('data', chunk => { err += chunk; });
    encoder.on('exit', code => code === 0 ? resolve() : reject(new Error(err.slice(-800))));
  });
  const probe = await new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_frames,duration', '-of', 'json', video], {stdio: ['ignore', 'pipe', 'pipe']});
    let out = '';
    ffprobe.stdout.on('data', chunk => { out += chunk; });
    ffprobe.on('exit', code => code === 0 ? resolve(JSON.parse(out)) : reject(new Error('ffprobe ' + code)));
  });
  const stream = probe.streams[0];
  if (Number(stream.width) !== Number(stream.height)) throw new Error('video not square ' + stream.width + 'x' + stream.height);
  const log = {
    chapter: 'hefei',
    url: '?cinematic=hefei',
    command: 'node games/career-rpg/web/tests/cinematic-record.mjs',
    frames,
    output: {width: Number(stream.width), height: Number(stream.height), duration: Number(stream.duration), nbFrames: Number(stream.nb_frames)},
    shots: played.played,
    stills,
    video: path.relative(ROOT, video),
    normal: {title, position: normal.position, moved: false, cinematic: false, screenshot: {width: normalSize.width, height: normalSize.height, file: 'games/career-rpg/web/review/cinematic/normal-hefei.png'}},
  };
  writeFileSync(path.join(OUT, 'hefei-log.json'), JSON.stringify(log, null, 2) + '\n');
  rmSync(FRAMES, {recursive: true, force: true});
  console.log(JSON.stringify({frames, output: log.output, stills: stills.map(item => item.name + ' ' + item.width), shots: played.played.map(item => item.type + ':' + item.id)}, null, 2));
} catch (error) {
  console.error('CINEMATIC_RECORD_FAIL', error);
  process.exitCode = 1;
} finally {
  chrome.kill('SIGTERM');
  server.close();
  setTimeout(() => process.exit(process.exitCode || 0), 300);
}
