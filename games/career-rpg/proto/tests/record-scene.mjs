// Playwright：点电脑做一张单，点饮水机休息，点门口入夜。
// PLAYWRIGHT_CORE=/tmp/pw/node_modules/playwright-core/index.js node games/career-rpg/proto/tests/record-scene.mjs
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

async function boot(page) {
  await page.goto(origin);
  await page.waitForFunction(() => window.hefei);
  await page.evaluate(() => document.querySelector('#office').scrollIntoView({ block: 'start' }));
}

async function finishInterview(page) {
  const started = await page.evaluate(() => window.hefei.clickScene(326, 100));
  if (!started) throw new Error('boss has no path');
  await page.waitForFunction(() => document.querySelector('[data-dialogue]'), null, { timeout: 12000 });
  for (let i = 0; i < 20; i += 1) {
    if (await page.evaluate(() => window.hefei.present().interviewed)) break;
    const clicked = await page.evaluate(() => {
      const next = document.querySelector('[data-dialogue="next"], [data-dialogue="close"]');
      if (!next) return false;
      next.click();
      return true;
    });
    await page.waitForTimeout(clicked ? 80 : 250);
  }
  if (!await page.evaluate(() => window.hefei.present().interviewed)) throw new Error('interview did not finish');
  await page.evaluate(() => document.querySelector('[data-dialogue="close"]')?.click());
}

async function playSequence(page, prefix) {
  await boot(page);
  await finishInterview(page);
  await page.screenshot({ path: path.join(STILLS, `scene-day-${prefix}.png`) });
  if (prefix === 'desktop') await page.screenshot({ path: path.join(STILLS, 'cooler-day-desktop.png') });
  const opened = await page.evaluate(() => window.hefei.clickScene(75, 132));
  if (!opened) throw new Error('computer has no path');
  await page.waitForSelector('#desk-panel', { timeout: 8000 });
  const workBox = await page.evaluate(() => {
    const office = document.querySelector('#office').getBoundingClientRect();
    const panel = document.querySelector('#desk-panel').getBoundingClientRect();
    const button = document.querySelector('#desk-panel [data-action="work"]');
    const title = document.querySelector('#desk-panel .ticket-top');
    const buttonRect = button.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const font = parseFloat(getComputedStyle(button).fontSize);
    const inside = (rect, box) => rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1 && rect.left >= box.left - 1 && rect.right <= box.right + 1 && rect.height > 12;
    return {
      font,
      button: inside(buttonRect, office) && inside(buttonRect, panel),
      title: inside(titleRect, office) && inside(titleRect, panel),
      height: buttonRect.height,
    };
  });
  if (!workBox.button || !workBox.title || workBox.font < 13) {
    throw new Error(`${prefix} desk clipped ${JSON.stringify(workBox)}`);
  }
  await page.screenshot({ path: path.join(STILLS, `scene-desk-${prefix}.png`) });
  if (prefix === '390') await page.screenshot({ path: path.join(STILLS, 'scene-desk-390-do.png') });
  const worked = await page.evaluate(() => {
    const button = document.querySelector('[data-action="work"]');
    if (!button) return false;
    button.click();
    return true;
  });
  if (!worked) throw new Error('no ticket button');
  await page.waitForFunction(() => window.hefei.present().ap < 3);
  const rested = await page.evaluate(() => window.hefei.clickScene(178, 70));
  if (!rested) throw new Error('water has no path');
  await page.waitForFunction(() => window.hefei.present().log.some(line => line.includes('休息')));
  const night = await page.evaluate(() => window.hefei.clickScene(190, 190));
  if (!night) throw new Error('door has no path');
  await page.waitForFunction(() => window.hefei.present().night);
  const nightBox = await page.evaluate(() => {
    const dialogue = document.querySelector('.dialogue')?.getBoundingClientRect();
    const hint = document.querySelector('.hint')?.getBoundingClientRect();
    const buttons = [...document.querySelectorAll('.scene-actions button')].map(button => ({
      text: button.textContent,
      rect: button.getBoundingClientRect(),
    }));
    const hit = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    return {
      texts: buttons.map(button => button.text),
      overlap: buttons.some(button => hit(button.rect, dialogue) || hit(button.rect, hint)),
    };
  });
  if (!nightBox.texts.includes('睡觉') || nightBox.overlap) throw new Error(`${prefix} night actions ${JSON.stringify(nightBox)}`);
  const chrome = await page.evaluate(() => {
    const hud = document.querySelector('.hud').getBoundingClientRect();
    const scene = document.querySelector('.scene-img').getBoundingClientRect();
    const panel = document.querySelector('.desk-panel');
    const fonts = {
      hud: parseFloat(getComputedStyle(document.querySelector('.hud')).fontSize),
      action: Math.min(...[...document.querySelectorAll('.scene-actions button')].map(node => parseFloat(getComputedStyle(node).fontSize))),
      panel: panel ? parseFloat(getComputedStyle(panel).fontSize) : 13,
    };
    const dialogue = document.querySelector('.dialogue');
    return {
      overlap: hud.bottom > scene.top + 1,
      fonts,
      dialogueBg: dialogue ? getComputedStyle(dialogue).backgroundColor : '',
      imgs: [...document.querySelectorAll('#stage img')].map(img => img.getAttribute('src') || ''),
      hints: document.querySelectorAll('.hint').length,
    };
  });
  if (chrome.overlap || chrome.fonts.hud < 13 || chrome.fonts.action < 13 || chrome.fonts.panel < 13) {
    throw new Error(`${prefix} chrome ${JSON.stringify(chrome)}`);
  }
  if (chrome.hints > 1) throw new Error(`${prefix} banners ${chrome.hints}`);
  if (/rgba\([^)]*,\s*0?\.[0-9]/.test(chrome.dialogueBg)) throw new Error(`${prefix} dialogue ${chrome.dialogueBg}`);
  const extra = chrome.imgs.filter(src => !/02-main-night-v2|water-cooler-night|player-seated|player-walk-hefei/.test(src));
  if (extra.length) throw new Error(`${prefix} extra night sprites ${extra.join(',')}`);
  await page.screenshot({ path: path.join(STILLS, `scene-night-${prefix}.png`) });
  if (prefix === 'desktop') await page.screenshot({ path: path.join(STILLS, 'cooler-night-desktop.png') });
  const layout = await page.evaluate(() => ({
    board: !!document.querySelector('.board'),
    seed: !!document.querySelector('#seed-form'),
    panel: !!document.querySelector('#desk-panel'),
    hud: !!document.querySelector('.hud'),
    hint: /快捷键/.test(document.body.innerText),
    office: document.querySelector('#office')?.getBoundingClientRect().width,
  }));
  if (layout.board || !layout.seed || !layout.hud || layout.hint) throw new Error('layout ' + JSON.stringify(layout));
  return layout;
}

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const videoDir = path.join(tmpdir(), 'hefei-scene-video');
mkdirSync(videoDir, { recursive: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
try {
  const desktop = await playSequence(page, 'desktop');
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const narrow = await phone.newPage();
  narrow.on('pageerror', error => errors.push(String(error)));
  const mobile = await playSequence(narrow, '390');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ desktop, mobile }));
  await phone.close();
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  server.close();
  if (video) {
    const webm = await video.path();
    const mp4 = path.join(OUT, 'in-scene.mp4');
    await new Promise((resolve, reject) => {
      const encoder = spawn('ffmpeg', [
        '-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4,
      ], { stdio: ['ignore', 'ignore', 'pipe'] });
      let err = '';
      encoder.stderr.on('data', chunk => { err += chunk; });
      encoder.on('exit', code => (code === 0 ? resolve() : reject(new Error(err.slice(-500)))));
    });
  }
}
