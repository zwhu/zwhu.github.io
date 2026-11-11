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

  async function walk(x, y, facing) {
    const started = await page.evaluate(({ x, y }) => window.hefei.clickScene(x, y), { x, y });
    if (!started) throw new Error(`no path to ${x},${y}`);
    await page.waitForFunction(want => {
      const walker = window.hefei.walker();
      return walker.moving && walker.facing === want && walker.pose === 'stand';
    }, facing, { timeout: 5000 });
    const seen = new Set();
    for (let i = 0; i < 8; i += 1) {
      seen.add(await page.evaluate(() => document.querySelector('#walker img')?.style.left || ''));
      await page.waitForTimeout(120);
    }
    if (seen.size < 2) throw new Error(`${facing} frames did not change ${[...seen].join('|')}`);
    return facing;
  }

  await walk(210, 194, 'right');
  await page.screenshot({ path: path.join(STILLS, 'walk-4dir.png') });
  await walk(28, 192, 'left');
  await walk(28, 108, 'up');
  await walk(28, 192, 'down');
  const back = await page.evaluate(() => window.hefei.clickScene(75, 132));
  if (!back) throw new Error('no path back to the desk');
  await page.waitForFunction(() => window.hefei.walker().pose === 'seated', null, { timeout: 8000 });
  const sat = await page.evaluate(() => {
    const node = document.querySelector('#walker');
    return { pose: window.hefei.walker().pose, tag: node.tagName, src: node.getAttribute('src') };
  });
  if (sat.tag !== 'IMG' || !sat.src.includes('player-seated.png')) throw new Error('still standing ' + JSON.stringify(sat));
  await page.waitForTimeout(500);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ directions: ['right', 'left', 'up', 'down'], sat }));
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
