// 底部行动按钮在文档流里。滚到可见后，中心点必须点到自己，不能被别的层挡住。
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '../../../../..');
const PAGE = '/games/career-rpg/proto/hangzhou/index.html';
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
};

test('action buttons and card titles are hit at 1280x720 and 390x844', async () => {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(ROOT, '.' + (url.endsWith('/') ? `${url}index.html` : url));
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
    const stream = createReadStream(file);
    stream.on('error', () => { res.writeHead(404); res.end(); });
    stream.on('open', () => {
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      stream.pipe(res);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}${PAGE}?seed=hangzhou`;
  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
    '--remote-debugging-port=0', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  try {
    const port = await new Promise((resolve, reject) => {
      let log = '';
      const timer = setTimeout(() => reject(new Error(log.slice(-300))), 20000);
      chrome.stderr.on('data', chunk => {
        log += chunk;
        const match = log.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);
        if (match) { clearTimeout(timer); resolve(Number(match[1])); }
      });
    });
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const list = await new Promise((resolve, reject) => {
      const read = () => {
        http.get(`http://127.0.0.1:${port}/json`, res => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', () => setTimeout(read, 100));
      };
      read();
      setTimeout(() => reject(new Error('no tab')), 8000);
    });
    const ws = new WebSocket(list.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error('ws')), { once: true });
    });
    let seq = 0;
    const pending = new Map();
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
    });
    const send = (method, params = {}) => {
      const id = ++seq;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(method)), 20000);
        pending.set(id, message => { clearTimeout(timer); resolve(message); });
      });
    };
    const evaluate = async (expression) => {
      const message = await send('Runtime.evaluate', { expression, returnByValue: true });
      if (message.result?.exceptionDetails) throw new Error(JSON.stringify(message.result.exceptionDetails).slice(0, 500));
      return message.result.result.value;
    };
    await send('Runtime.enable');
    await send('Page.enable');
    const probe = `(() => {
      const bar = document.querySelector('.actions');
      const position = getComputedStyle(bar).position;
      const targets = [
        ...document.querySelectorAll('.actions button'),
        ...document.querySelectorAll('h2'),
        ...document.querySelectorAll('.card .ticket-top strong, .slot strong'),
      ];
      const misses = [];
      for (const node of targets) {
        node.scrollIntoView({ block: 'center', inline: 'center' });
        const rect = node.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y);
        const own = hit === node || (hit && node.contains(hit));
        if (!own || rect.bottom > window.innerHeight || rect.top < 0 || rect.right > window.innerWidth || rect.left < 0) {
          misses.push({
            text: node.textContent.slice(0, 24),
            own,
            hit: hit ? hit.tagName + '.' + hit.className : null,
            top: rect.top,
            bottom: rect.bottom,
          });
        }
      }
      return { position, count: targets.length, misses };
    })()`;
    for (const [width, height] of [[1280, 720], [390, 844]]) {
      await send('Emulation.setDeviceMetricsOverride', {
        width, height, deviceScaleFactor: 1, mobile: width < 500,
      });
      await send('Page.navigate', { url: origin });
      let ready = false;
      for (let i = 0; i < 40; i += 1) {
        await sleep(50);
        ready = await evaluate('!!document.querySelector(".actions button")');
        if (ready) break;
      }
      assert.equal(ready, true, `${width} page did not boot`);
      const report = await evaluate(probe);
      assert.equal(report.position, 'static', `${width} actions position`);
      assert.ok(report.count > 4, `${width} targets ${report.count}`);
      assert.deepEqual(report.misses, [], `${width} ${JSON.stringify(report.misses)}`);
    }
    ws.close();
  } finally {
    chrome.kill('SIGTERM');
    server.close();
  }
});
