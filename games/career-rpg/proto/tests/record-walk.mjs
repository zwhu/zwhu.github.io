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
sit = Image.open(${JSON.stringify(seatedFile)}).convert('RGBA').resize((25 * 4, 29 * 4), Image.NEAREST)
red = sum(1 for px in sit.getdata() if len(px) > 3 and px[3] > 200 and px[0] > 120 and px[0] > px[1] + 30 and px[0] > px[2] + 30)
if red < 8:
    raise SystemExit('seated frame has no red shirt (%s)' % red)
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
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
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
    const deadline = Date.now() + 8000;
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

  await page.evaluate(() => window.hefei.clickScene(26, 194));
  await page.waitForFunction(() => !window.hefei.walker().moving, null, { timeout: 5000 });
  const timings = {
    right: await walk(112, 194, 'right'),
    left: await walk(26, 194, 'left'),
    up: await walk(26, 96, 'up'),
    down: await walk(26, 194, 'down'),
  };
  await page.screenshot({ path: path.join(STILLS, 'walk-4dir.png') });
  const back = await page.evaluate(() => window.hefei.clickScene(75, 132));
  if (!back) throw new Error('no path back to the desk');
  await page.waitForFunction(() => window.hefei.walker().pose === 'seated', null, { timeout: 8000 });
  const sat = await page.evaluate(() => {
    const node = document.querySelector('#walker');
    return { pose: window.hefei.walker().pose, tag: node.tagName, src: node.getAttribute('src') || '' };
  });
  if (sat.tag !== 'IMG' || !sat.src.includes('player-seated.png')) throw new Error('still standing ' + JSON.stringify(sat));
  await page.waitForTimeout(2000);
  if (errors.length) throw new Error(errors.join('\n'));
  const seatedShot = path.join(tmpdir(), 'hefei-seated-crop.png');
  await page.locator('#walker').screenshot({ path: seatedShot });
  await zoomStill(path.join(STILLS, 'walk-4dir-zoom.png'), seatedShot);
  console.log(JSON.stringify({ timings, sat }));
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  server.close();
  if (video) {
    const webm = await video.path();
    const mp4 = path.join(OUT, 'walk-4dir.mp4');
    await new Promise((resolve, reject) => {
      const encoder = spawn('ffmpeg', [
        '-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4,
      ], { stdio: ['ignore', 'ignore', 'pipe'] });
      let err = '';
      encoder.stderr.on('data', chunk => { err += chunk; });
      encoder.on('exit', code => (code === 0 ? resolve() : reject(new Error(err.slice(-600)))));
    });
  }
}
