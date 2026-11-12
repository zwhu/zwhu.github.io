// Playwright：左、右、上、下各走一段，再回工位坐下。
// NODE_PATH 指向装了 playwright-core 的目录后：
// node games/career-rpg/proto/tests/record-walk.mjs
import { spawn } from 'node:child_process';
import { createReadStream, mkdirSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
const playwright = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { chromium } = playwright.chromium ? playwright : playwright.default;

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const OUT = path.join(ROOT, 'games/career-rpg/proto/review');
const STILLS = path.join(OUT, 'stills');
mkdirSync(STILLS, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.json': 'application/json',
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
const origin = `http://127.0.0.1:${server.address().port}/games/career-rpg/proto/index.html?seed=hefei`;

function zoomStill(file, seatedFile) {
  const py = `
import json
from PIL import Image, ImageDraw, ImageFont
root = ${JSON.stringify(path.join(ROOT, 'games/career-rpg/proto'))}
sheet = json.load(open(root + '/walk/walk.sprites.json'))
image = Image.open(root + '/walk/player-walk-hefei.png').convert('RGBA')
font = ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-microhei.ttc', 28)
cell = 224
panels = []
for facing, label in (('down', '下'), ('up', '上'), ('left', '左'), ('right', '右')):
    frame = sheet['directions'][facing]['frames'][2]
    crop = image.crop((frame['x'], frame['y'], frame['x'] + frame['w'], frame['y'] + frame['h']))
    panels.append((label, crop.resize((frame['w'] * 4, frame['h'] * 4), Image.NEAREST)))
stage = Image.open(${JSON.stringify(seatedFile)}).convert('RGBA')
scale = stage.width / 640
box = (int(90 * scale), int(175 * scale), int(135 * scale), int(220 * scale))
sit = stage.crop(box).resize((48 * 4, 48 * 4), Image.NEAREST)
red = sum(1 for px in sit.getdata() if len(px) > 3 and px[3] > 200 and px[0] > 120 and px[0] > px[1] + 30 and px[0] > px[2] + 30)
if red < 40:
    raise SystemExit('seated crop has no red shirt (%s)' % red)
panels.append(('坐', sit))
out = Image.new('RGBA', (cell * len(panels), cell + 40), (239, 236, 228, 255))
draw = ImageDraw.Draw(out)
for index, (label, sprite) in enumerate(panels):
    x = index * cell + (cell - sprite.width) // 2
    y = 36 + (cell - sprite.height) // 2
    out.alpha_composite(sprite, (x, y))
    draw.text((index * cell + 16, 6), label, fill=(32, 30, 28, 255), font=font)
out.convert('RGB').save(${JSON.stringify(file)})
`;
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['-'], { stdio: ['pipe', 'inherit', 'pipe'] });
    let err = '';
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(err.slice(-400)))));
    child.stdin.end(py);
  });
}

const videoDir = path.join(tmpdir(), 'hefei-walk-video');
mkdirSync(videoDir, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 960 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 960 } },
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(String(error)));

try {
  await page.goto(origin);
  await page.waitForFunction(() => window.hefei);
  await page.evaluate(() => document.querySelector('#office').scrollIntoView({ block: 'start' }));
  const seated = await page.evaluate(() => window.hefei.walker().pose);
  if (seated !== 'seated') throw new Error('did not start seated');

  async function walk(x, y, facing, holdMs = 1500) {
    const started = await page.evaluate(({ x, y }) => window.hefei.clickScene(x, y), { x, y });
    if (!started) throw new Error(`no path to ${x},${y}`);
    const seen = new Set();
    let matched = 0;
    let last = Date.now();
    const deadline = Date.now() + 12000;
    while (matched < holdMs) {
      if (Date.now() > deadline) throw new Error(`${facing} only faced that way for ${matched}ms`);
      const now = await page.evaluate(() => {
        const walker = window.hefei.walker();
        return {
          moving: walker.moving,
          facing: walker.facing,
          pose: walker.pose,
          frame: document.querySelector('#walker img')?.style.left || '',
        };
      });
      const tick = Date.now();
      if (now.moving && now.facing === facing && now.pose === 'stand') {
        matched += tick - last;
        seen.add(now.frame);
      }
      last = tick;
      await page.waitForTimeout(40);
    }
    if (seen.size < 2) throw new Error(`${facing} frames did not change ${[...seen].join('|')}`);
    return matched;
  }

  await page.evaluate(() => window.hefei.clickScene(48, 300));
  await page.waitForFunction(() => !window.hefei.walker().moving, null, { timeout: 8000 });
  const timings = {
    right: await walk(220, 300, 'right'),
    left: await walk(48, 300, 'left'),
    up: await walk(48, 100, 'up'),
    down: await walk(48, 300, 'down'),
  };
  await page.screenshot({ path: path.join(STILLS, 'walk-4dir.png') });
  const back = await page.evaluate(() => window.hefei.clickScene(110, 185));
  if (!back) throw new Error('no path back to the desk');
  await page.waitForFunction(() => window.hefei.walker().pose === 'seated' && document.querySelector('#dialogue'), null, { timeout: 8000 });
  const sat = await page.evaluate(() => {
    const node = document.querySelector('#walker');
    return { pose: window.hefei.walker().pose, tag: node.tagName, src: node.getAttribute('src') || '' };
  });
  if (sat.tag !== 'IMG' || !sat.src.includes('player-seated.png')) throw new Error('still standing ' + JSON.stringify(sat));
  for (let i = 0; i < 6; i += 1) {
    const open = await page.evaluate(() => {
      const next = document.querySelector('[data-dialogue="close"], [data-dialogue="next"]');
      if (!next) return false;
      next.click();
      return true;
    });
    if (!open) break;
    await page.waitForTimeout(40);
  }
  await page.waitForFunction(() => !document.querySelector('#dialogue'));
  const covered = await page.evaluate(() => {
    const stage = document.querySelector('#stage').getBoundingClientRect();
    const desk = {
      left: stage.left + (99 / 640) * stage.width,
      top: stage.top + (184 / 360) * stage.height,
      right: stage.left + (124 / 640) * stage.width,
      bottom: stage.top + (213 / 360) * stage.height,
    };
    const blockers = [...document.querySelectorAll('.dialogue, .hint, .desk-panel, .scene-actions, .hud')];
    const hit = (node) => {
      const box = node.getBoundingClientRect();
      return box.left < desk.right && box.right > desk.left && box.top < desk.bottom && box.bottom > desk.top;
    };
    return blockers.filter(hit).map(node => node.className);
  });
  if (covered.length) throw new Error('desk covered by ' + covered.join(','));
  const holdFrame = path.join(tmpdir(), 'hefei-hold.png');
  const holdUntil = Date.now() + 2200;
  while (Date.now() < holdUntil) {
    await page.screenshot({ path: holdFrame });
    await page.waitForTimeout(80);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  const seatedShot = path.join(tmpdir(), 'hefei-stage.png');
  await page.locator('#stage').screenshot({ path: seatedShot });
  await zoomStill(path.join(STILLS, 'walk-4dir-zoom.png'), seatedShot);
  const phoneDir = path.join(tmpdir(), 'hefei-walk-390');
  mkdirSync(phoneDir, { recursive: true });
  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    recordVideo: { dir: phoneDir, size: { width: 390, height: 844 } },
  });
  const narrow = await phoneContext.newPage();
  narrow.on('pageerror', error => errors.push(String(error)));
  await narrow.goto(origin);
  await narrow.waitForFunction(() => window.hefei);
  await narrow.evaluate(() => document.querySelector('#office').scrollIntoView({ block: 'start' }));
  async function walkNarrow(x, y, facing) {
    const started = await narrow.evaluate(({ x, y }) => window.hefei.clickScene(x, y), { x, y });
    if (!started) throw new Error(`390 no path to ${x},${y}`);
    const seen = new Set();
    const scrolls = [];
    let matched = 0;
    let last = Date.now();
    const deadline = Date.now() + 15000;
    while (matched < 1500) {
      if (Date.now() > deadline) throw new Error(`390 ${facing} only faced that way for ${matched}ms`);
      const now = await narrow.evaluate(() => {
        const walker = window.hefei.walker();
        return {
          moving: walker.moving,
          facing: walker.facing,
          pose: walker.pose,
          frame: document.querySelector('#walker img')?.style.left || '',
          scroll: document.querySelector('.stage-scroll').scrollLeft,
          stageW: document.querySelector('#stage').getBoundingClientRect().width,
        };
      });
      if (Math.abs(now.stageW - 640) > 1) throw new Error(`390 not 1x ${now.stageW}`);
      const tick = Date.now();
      if (now.moving && now.facing === facing && now.pose === 'stand') {
        matched += tick - last;
        seen.add(now.frame);
        scrolls.push(now.scroll);
      }
      last = tick;
      await narrow.waitForTimeout(40);
    }
    if (seen.size < 2) throw new Error(`390 ${facing} frames did not change`);
    return { matched, scrolls };
  }
  await narrow.evaluate(() => window.hefei.clickScene(300, 300));
  await narrow.waitForFunction(() => !window.hefei.walker().moving, null, { timeout: 15000 });
  const right = await walkNarrow(560, 300, 'right');
  const left = await walkNarrow(48, 300, 'left');
  await walkNarrow(48, 100, 'up');
  await walkNarrow(48, 300, 'down');
  const followed = Math.max(...right.scrolls) - Math.min(...right.scrolls) > 20
    || Math.max(...left.scrolls) - Math.min(...left.scrolls) > 20;
  if (!followed) throw new Error(`390 camera stayed put ${JSON.stringify({ right: right.scrolls, left: left.scrolls })}`);
  const backNarrow = await narrow.evaluate(() => window.hefei.clickScene(110, 185));
  if (!backNarrow) throw new Error('390 no path back to B1');
  await narrow.waitForFunction(() => window.hefei.walker().pose === 'seated', null, { timeout: 20000 });
  for (let i = 0; i < 6; i += 1) {
    const open = await narrow.evaluate(() => {
      const next = document.querySelector('[data-dialogue="close"], [data-dialogue="next"]');
      if (!next) return false;
      next.click();
      return true;
    });
    if (!open) break;
    await narrow.waitForTimeout(40);
  }
  await narrow.waitForFunction(() => !document.querySelector('#dialogue'));
  const ended = await narrow.evaluate(() => {
    const walker = window.hefei.walker();
    const player = document.querySelector('#walker').getBoundingClientRect();
    const view = document.querySelector('.stage-scroll').getBoundingClientRect();
    return {
      pose: walker.pose,
      x: walker.x,
      onScreen: player.left >= view.left - 1 && player.right <= view.right + 1 && player.bottom <= view.bottom + 1,
    };
  });
  if (ended.pose !== 'seated' || Math.abs(ended.x - 111) > 4 || !ended.onScreen) {
    throw new Error(`390 did not sit at B1 ${JSON.stringify(ended)}`);
  }
  await narrow.waitForTimeout(1600);
  if (errors.length) throw new Error(errors.join('\n'));
  const phoneRecording = narrow.video();
  await phoneContext.close();
  const phoneWebm = await phoneRecording.path();
  console.log(JSON.stringify({ timings, sat, phone: ended }));
  var phoneVideo = phoneWebm;
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  server.close();
  async function encode(webm, mp4) {
    await new Promise((resolve, reject) => {
      const encoder = spawn('ffmpeg', [
        '-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4,
      ], { stdio: ['ignore', 'ignore', 'pipe'] });
      let err = '';
      encoder.stderr.on('data', chunk => { err += chunk; });
      encoder.on('exit', code => (code === 0 ? resolve() : reject(new Error(err.slice(-600)))));
    });
  }
  if (video) await encode(await video.path(), path.join(OUT, 'walk-4dir.mp4'));
  if (typeof phoneVideo !== 'undefined' && phoneVideo) await encode(phoneVideo, path.join(OUT, 'walk-390.mp4'));
}
