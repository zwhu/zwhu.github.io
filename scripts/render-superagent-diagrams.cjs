#!/usr/bin/env node
// Static and interactive views share the published scene; no site runtime dependency.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'docs/assets/superagent');
const scene = fs.readFileSync(path.join(dir, 'scene.js'), 'utf8');
const data = vm.runInNewContext(scene + '\n({W,H,PLANES,BANDS,BOXES,EDGES,TEXTS,SWATCHES,CHIPS})');
assert.equal(new Set(data.BOXES.map(b => b.id)).size, data.BOXES.length);
const ids = new Set([...data.BOXES, ...data.BANDS].map(b => b.id));
assert(data.EDGES.every(e => ids.has(e.from) && ids.has(e.to)));
const template = fs.readFileSync(path.join(__dirname, 'vendor/architecture-canvas/template.js'), 'utf8');
const analytics = fs.readFileSync(path.join(root, 'docs/ub-mode-bench.html'), 'utf8').match(/<!-- Cloudflare Web Analytics -->[\s\S]*?<!-- End Cloudflare Web Analytics -->/)[0];
const moduleSource = template
  .replace('{{SLUG}}', 'superagent-architecture')
  .replace('{{SCENE}}', () => scene);
const checking = process.argv.includes('--check');
function write(name, value) {
  const target = path.join(dir, name);
  if (checking) assert.equal(fs.readFileSync(target, 'utf8'), value, `${name} is stale`);
  else fs.writeFileSync(target, value);
}
write('canvas.js', moduleSource);
// Keep existing direct links working; the article mounts the same module inline.
write('index.html', `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Super-agent 交互架构图 · zwhu</title>
<link rel="icon" href="../../favicon.svg" type="image/svg+xml">
<link rel="canonical" href="https://zwhu.github.io/assets/superagent/index.html">
<meta name="robots" content="noindex, follow">
<style>body{margin:0;background:#faf8f3;color:#292825;font:12px/1.8 system-ui}a{display:block;padding:10px 18px;color:#77746e}#architecture{height:calc(100dvh - 42px)}</style>
</head><body><a href="../../superagent.html">← 返回文章</a>
<div id="architecture"></div>
<script type="module">import { mountArchitecture } from './canvas.js';mountArchitecture(document.getElementById('architecture'), {shareView:true});</script>
${analytics}
</body></html>
`);

const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const colors = {bg:'#faf8f3', text:'#292825', muted:'#77746e', accent:'#a64335', line:'#e6e2da', code:'#f0ede6'};
const sizes = {title:28, sub:14, tag:13, hdr:16, bl:19, bs:16, bn:14, al:15, legend:14};
function text(x, y, value, size = 14, color = colors.text, weight = 400, anchor = 'start') {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}">${esc(value)}</text>`;
}
function svg(name, width, height, title, desc, body) {
  const value = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc"><title id="title">${esc(title)}</title><desc id="desc">${esc(desc)}</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10" fill="${colors.muted}"/></marker></defs><g font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif"><rect width="100%" height="100%" fill="${colors.bg}"/>${body}</g></svg>\n`;
  write(name + '.svg', value);
}
let body = '';
for (const band of data.BANDS) {
  body += `<rect x="${band.x}" y="${band.y}" width="${band.w}" height="${band.h}" rx="5" fill="none" stroke="${colors.line}"/>`;
  body += text(band.hdr.x, band.hdr.y, band.hdr.t, 17, colors.muted);
}
for (const e of data.EDGES) body += `<polyline points="${e.pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${colors.muted}" stroke-width="1.6" marker-end="url(#arrow)"/>`;
for (const box of data.BOXES) {
  body += `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="5" fill="${colors.bg}" stroke="${box.id === 'router' ? colors.accent : colors.line}"${box.dash ? ' stroke-dasharray="6 4"' : ''}/>`;
  for (const [style,x,y,value] of box.texts) body += text(x,y,value,sizes[style],style === 'bl' ? colors.text : colors.muted,style === 'bl' ? 600 : 400);
}
for (const e of data.EDGES) if (e.label) {
  const l = e.label;
  body += `<g${l.rot ? ` transform="rotate(${l.rot} ${l.x} ${l.y})"` : ''}>${text(l.x,l.y,l.t,14,colors.muted,400,l.anchor === 'center' ? 'middle' : 'start')}</g>`;
}
for (const t of data.TEXTS) if (t.t) body += text(t.x,t.y,t.t,sizes[t.s],t.s === 'title' ? colors.text : colors.muted,t.s === 'title' ? 600 : 400);
svg('architecture-full',data.W,data.H,'Super-agent 系统架构','五层架构和十八条调用或关联；详见文章中的分发、上下文、执行与一致性说明。',body);

// Reading projection: collapse intermediate calls, retaining scene node identities.
const boxes = new Map(data.BOXES.map(b => [b.id,b]));
function box(id,x,y,w,line) {
  const b = boxes.get(id); assert(b);
  return `<rect x="${x}" y="${y}" width="${w}" height="76" rx="5" fill="${colors.bg}" stroke="${id === 'router' ? colors.accent : colors.line}"/>` + text(x+16,y+29,b.name,16,colors.text,600) + text(x+16,y+54,line,13,colors.muted);
}
function arrow(points,label,x,y) {
  return `<polyline points="${points}" fill="none" stroke="${colors.muted}" stroke-width="1.5" marker-end="url(#arrow)"/>` + (label ? text(x,y,label,12,colors.muted) : '');
}
body = text(24,32,'事件按任务关系分发',19,colors.text,600)
  + box('intake',24,72,248,'保存事件、查订阅') + box('thread',328,72,248,'保存讨论与任务的关系')
  + box('router',24,222,248,'新请求或关联不明时判断') + box('worker',328,222,248,'原任务继续调查、修改与验证')
  + box('ticket',24,372,248,'原请求、授权与执行轮次') + box('result',328,372,248,'验证后报告；必要时询问人')
  + arrow('272,110 322,110','查询',284,99)
  + arrow('145,148 145,216','待判断候选',155,184)
  + arrow('452,148 452,216','已有订阅直通',462,184)
  + arrow('272,260 322,260','分派',284,249)
  + arrow('145,298 145,366','事务保存',155,335)
  + arrow('452,298 452,366','产物与状态',462,335)
  + text(24,486,'Router 与 Worker 各有上下文；程序保存关联，详细执行由 Worker 负责。',13,colors.muted);
svg('architecture',600,510,'Super-agent 分发架构','Intake 查询 Thread 订阅，已知消息直达 Worker；待判断消息由 Router 选择任务。',body);
body = text(24,32,'记录与外部执行分开，失败可恢复',19,colors.text,600)
  + `<rect x="24" y="65" width="552" height="135" rx="5" fill="none" stroke="${colors.line}"/>`
  + text(42,92,'同一个 SQLite 事务',13,colors.accent,600)
  + text(42,124,'Decision · Ticket · Assignment · Thread 订阅',15)
  + text(42,159,'Effects / Outbox：保存待执行动作和消息',15)
  + arrow('300,200 300,246','提交成功后执行',312,228)
  + box('executor',24,252,248,'创建 / 找回 Worker，投递输入')
  + box('result',328,252,248,'外部请求与任务库没有共同事务')
  + arrow('145,328 145,379 300,379 300,402','失败留队列；成功记录回执',185,367)
  + arrow('452,328 452,379 300,379')
  + text(24,432,'稳定 ID 防重复；generation 防旧回调清除新动作。',14,colors.muted)
  + text(24,459,'提交前重查当前任务 / 评估；业务判断错误仍可能建立重复任务。',13,colors.muted);
svg('consistency',600,483,'事务与持久动作队列','事务内同时保存状态与动作意图，提交后执行外部操作，失败保留并重试。',body);
console.log(`${checking ? 'Checked' : 'Generated'} interactive module, HTML, full SVG and reading projection.`);
