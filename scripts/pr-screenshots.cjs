#!/usr/bin/env node
// Capture desktop and mobile screenshots of changed pages and attach them to a PR.
// Images are pushed to the pr-screenshots branch (never main), so Pages and the site stay unchanged.
// Usage: node scripts/pr-screenshots.cjs [--pr N] [--page a.html]... [--section id]... [--widths 1280,375]
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const { spawn, execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SITE_ROOT = path.join(ROOT, 'docs');
const BRANCH = 'pr-screenshots', START = '<!-- pr-screenshots:start -->', END = '<!-- pr-screenshots:end -->';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.json': 'application/json', '.mp4': 'video/mp4' };

function args() {
  const out = { pages: [], sections: [], widths: [1280, 375], pr: null, out: path.join(os.tmpdir(), 'zwhu-pr-screenshots') };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const value = argv[++i];
    if (value === undefined) throw new Error(`Missing value for ${argv[i - 1]}`);
    if (argv[i - 1] === '--page') out.pages.push(value);
    else if (argv[i - 1] === '--section') out.sections.push(value);
    else if (argv[i - 1] === '--widths') out.widths = value.split(',').map(Number);
    else if (argv[i - 1] === '--pr') out.pr = Number(value);
    else if (argv[i - 1] === '--out') out.out = path.resolve(value);
    else throw new Error(`Unknown option ${argv[i - 1]}`);
  }
  return out;
}

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();

function changedPages() {
  const base = git('merge-base', 'origin/main', 'HEAD');
  const tracked = git('diff', '--name-only', base, '--', '*.html').split('\n');
  const untracked = git('ls-files', '--others', '--exclude-standard', '--', '*.html').split('\n');
  return [...new Set([...tracked, ...untracked])].filter(f => /^docs\/[^/]+\.html$/.test(f) && fs.existsSync(path.join(ROOT, f))).map(f => f.slice(5));
}

function serve() {
  const server = http.createServer((req, res) => {
    const file = path.resolve(SITE_ROOT, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
    if (!file.startsWith(SITE_ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

function launchChrome(profile) {
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--hide-scrollbars', 'about:blank'],
    { stdio: ['ignore', 'ignore', 'pipe'] });
  return new Promise((resolve, reject) => {
    let log = '';
    chrome.on('error', reject);
    chrome.stderr.on('data', chunk => {
      log += chunk;
      const match = log.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);
      if (match) resolve({ chrome, port: Number(match[1]) });
    });
    chrome.on('exit', code => reject(new Error(`Chrome exited (${code}). Set CHROME=/path/to/chrome.\n${log}`)));
  });
}

async function openTab(port) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  let id = 0; const pending = new Map(), waiters = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) waiters.filter(w => w.method === m.method).forEach(w => { waiters.splice(waiters.indexOf(w), 1); w.resolve(); });
  });
  const send = (method, params = {}) => new Promise((r, j) => {
    const i = ++id; pending.set(i, m => (m.error ? j(new Error(`${method}: ${m.error.message}`)) : r(m.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const once = method => new Promise(resolve => waiters.push({ method, resolve }));
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'evaluate failed');
    return r.result.value;
  };
  const close = async () => { ws.close(); await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`); };
  return { send, once, evaluate, close };
}

// Waits for fonts and visible images so lazy figures are painted before capture.
const SETTLE = `(async()=>{await document.fonts.ready;await new Promise(r=>setTimeout(r,400));
await Promise.all([...document.images].filter(i=>!i.complete&&i.getBoundingClientRect().top<innerHeight*2)
.map(i=>new Promise(r=>{i.addEventListener('load',r,{once:true});i.addEventListener('error',r,{once:true});setTimeout(r,3000)})))})()`;

// A section runs from its heading to the next heading of the same level, capped so mobile shots stay readable.
const sectionClip = id => `(()=>{const h=document.getElementById(${JSON.stringify(id)});if(!h)return null;
h.scrollIntoView();const top=h.getBoundingClientRect().top+scrollY-16;let n=h.nextElementSibling;
while(n&&!(n.tagName===h.tagName))n=n.nextElementSibling;
const end=n?n.getBoundingClientRect().top+scrollY:document.documentElement.scrollHeight;
return {x:0,y:Math.max(0,top),width:innerWidth,height:Math.min(end-top,4000),scale:1}})()`;

async function capture(port, base, page, width, section) {
  const tab = await openTab(port);
  try {
    await tab.send('Page.enable');
    await tab.send('Emulation.setDeviceMetricsOverride', { width, height: width < 600 ? 812 : 900, deviceScaleFactor: 1, mobile: width < 600 });
    const loaded = tab.once('Page.loadEventFired');
    await tab.send('Page.navigate', { url: `${base}/${page}` });
    await loaded;
    let clip = null;
    if (section) {
      clip = await tab.evaluate(sectionClip(section));
      if (!clip) return null;
    }
    await tab.evaluate(SETTLE);
    const shot = await tab.send('Page.captureScreenshot', clip ? { format: 'png', clip, captureBeyondViewport: true } : { format: 'png' });
    return Buffer.from(shot.data, 'base64');
  } finally {
    await tab.close();
  }
}

// Commit the images onto the pr-screenshots branch with a temporary index; the working tree is untouched.
function publish(pr, files) {
  try { git('fetch', '-q', 'origin', `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`); } catch { /* first upload */ }
  const parent = (() => { try { return git('rev-parse', '-q', '--verify', `refs/remotes/origin/${BRANCH}`); } catch { return ''; } })();
  const index = path.join(os.tmpdir(), `zwhu-pr-screenshots-${process.pid}.index`);
  const env = { ...process.env, GIT_INDEX_FILE: index };
  const run = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', env }).trim();
  try {
    if (parent) run('read-tree', parent); else run('read-tree', '--empty');
    run('rm', '-r', '-q', '--cached', '--ignore-unmatch', `pr-${pr}`);
    for (const file of files) run('update-index', '--add', '--cacheinfo', `100644,${run('hash-object', '-w', file)},pr-${pr}/${path.basename(file)}`);
    const tree = run('write-tree');
    const commit = run('commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', `Screenshots for #${pr}`);
    run('push', '-q', 'origin', `${commit}:refs/heads/${BRANCH}`);
    return commit;
  } finally {
    fs.rmSync(index, { force: true });
  }
}

function markdown(repo, commit, pr, shots) {
  const url = name => `https://raw.githubusercontent.com/${repo}/${commit}/pr-${pr}/${name}`;
  const widths = [...new Set(shots.map(s => s.width))];
  const lines = [START, '## 截图', '', `本地 \`node scripts/pr-screenshots.cjs\` 生成，宽度 ${widths.join(' / ')}px。`, ''];
  for (const page of [...new Set(shots.map(s => s.page))]) {
    lines.push(`**${page}**`, '', `| 位置 | ${widths.map(w => `${w}px`).join(' | ')} |`, `| --- | ${widths.map(() => '---').join(' | ')} |`);
    for (const where of [...new Set(shots.filter(s => s.page === page).map(s => s.where))]) {
      const cells = widths.map(w => {
        const s = shots.find(x => x.page === page && x.where === where && x.width === w);
        return s ? `<img src="${url(s.name)}" width="${w < 600 ? 200 : 440}" alt="${page} ${where} ${w}px">` : '';
      });
      lines.push(`| ${where === 'top' ? '首屏' : `#${where}`} | ${cells.join(' | ')} |`);
    }
    lines.push('');
  }
  lines.push(END);
  return lines.join('\n');
}

function updateBody(pr, block) {
  const body = execFileSync('gh', ['pr', 'view', String(pr), '--json', 'body', '-q', '.body'], { cwd: ROOT, encoding: 'utf8' }).replace(/\s+$/, '');
  const pattern = new RegExp(`${START}[\\s\\S]*?${END}`);
  const next = pattern.test(body) ? body.replace(pattern, block) : `${body}\n\n${block}`;
  execFileSync('gh', ['pr', 'edit', String(pr), '--body-file', '-'], { cwd: ROOT, input: next + '\n', stdio: ['pipe', 'ignore', 'inherit'] });
}

async function main() {
  const opt = args();
  const pages = opt.pages.length ? opt.pages : changedPages();
  if (!pages.length) throw new Error('No changed docs HTML pages; pass --page name.html');
  fs.mkdirSync(opt.out, { recursive: true });
  const server = await serve(), profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zwhu-pr-chrome-'));
  const { chrome, port } = await launchChrome(profile);
  const base = `http://127.0.0.1:${server.address().port}`, shots = [];
  try {
    for (const page of pages) for (const where of ['top', ...opt.sections]) for (const width of opt.widths) {
      const data = await capture(port, base, page, width, where === 'top' ? null : where);
      if (!data) continue;
      const name = `${page.replace(/\.html$/, '')}-${where}-${width}.png`;
      fs.writeFileSync(path.join(opt.out, name), data);
      shots.push({ page, where, width, name });
      console.log(`Captured ${name}`);
    }
  } finally {
    const exited = new Promise(r => chrome.once('exit', r));
    chrome.kill(); server.close(); await exited;
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
  }
  if (!opt.pr) { console.log(`Saved ${shots.length} screenshots to ${opt.out}; pass --pr N to attach them.`); return; }
  const repo = execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const commit = publish(opt.pr, shots.map(s => path.join(opt.out, s.name)));
  updateBody(opt.pr, markdown(repo, commit, opt.pr, shots));
  console.log(`Attached ${shots.length} screenshots to PR #${opt.pr} (${BRANCH}@${commit.slice(0, 7)}).`);
}

main().catch(error => { console.error(error.message); process.exit(1); });
