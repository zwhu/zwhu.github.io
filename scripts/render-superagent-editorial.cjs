#!/usr/bin/env node
// Editorial images carry a theme or a measured comparison, not an implied algorithm.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'assets/superagent');
const bg='#faf8f3',ink='#292825',muted='#77746e',accent='#a64335',line='#d6d0c6',paper='#f0ede6';
const text=(x,y,t,size=15,color=ink,weight=400,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" ${extra}>${t}</text>`;
const shell=(w,h,title,desc,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title desc"><title id="title">${title}</title><desc id="desc">${desc}</desc><rect width="${w}" height="${h}" fill="${bg}"/><g font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif">${body}</g></svg>\n`;
let body=`<path d="M32 300 C100 355 85 188 178 200 S260 115 346 171 S437 298 532 252 S590 177 618 183" fill="none" stroke="${accent}" stroke-width="3"/>`;
body+=`<g transform="translate(47 89) rotate(-8 87 85)"><path d="M0 0 H174 V127 L143 158 H0 Z" fill="${bg}" stroke="${line}" stroke-width="1.4"/><path d="M143 158 V127 H174" fill="${paper}" stroke="${line}" stroke-width="1.2"/>${text(19,32,'话题',15,muted)}<path d="M19 53 H147 M19 69 H117 M19 85 H138" stroke="${line}"/>${text(19,119,'旧版 Excel 呢？',17,ink,500)}<circle cx="160" cy="16" r="3" fill="${accent}"/></g>`;
body+=`<g transform="translate(260 225) rotate(7 102 81)"><path d="M0 0 H203 V132 L176 158 H0 Z" fill="${bg}" stroke="${line}" stroke-width="1.4"/><path d="M176 158 V132 H203" fill="${paper}" stroke="${line}" stroke-width="1.2"/>${text(19,33,'PULL REQUEST',12,muted,400,'letter-spacing="1.2"')}${text(17,91,'#123',45,ink,500)}<path d="M22 114 H154" stroke="${line}"/><circle cx="187" cy="17" r="3" fill="${accent}"/></g>`;
body+=`<g transform="translate(460 40) rotate(-5 66 63)"><rect width="137" height="128" fill="${bg}" stroke="${line}" stroke-width="1.4"/><path d="M0 31 H137 M29 -7 V9 M108 -7 V9" fill="none" stroke="${muted}" stroke-width="2"/>${text(14,22,'两周以后',13,muted)}<g fill="${line}">${[0,1,2].flatMap(y=>[0,1,2,3].map(x=>`<circle cx="${23+x*28}" cy="${52+y*27}" r="2"/>`)).join('')}</g><circle cx="107" cy="106" r="12" fill="none" stroke="${accent}" stroke-width="2"/></g>`;
// The red thread passes through each paper surface; it signifies continuity, not routing.
body+=`<path d="M162 163 C207 94 245 88 277 103 C310 121 260 167 260 203 C260 235 289 252 299 258 M402 288 C446 320 456 194 479 153 C493 127 522 130 537 146" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>`;
body+=`<g transform="translate(287 133)"><circle r="25" fill="${bg}" stroke="${accent}" stroke-width="1.5"/>${text(0,7,'42',20,accent,500,'text-anchor="middle"')}</g>${text(52,371,'入口会变。',17,muted)}${text(52,399,'任务的线索，还在。',20,ink,500)}<path d="M522 353 C549 328 580 337 580 363 C580 393 539 392 539 370 C539 349 565 341 593 363" fill="none" stroke="${accent}" stroke-width="2.2"/>`;
fs.writeFileSync(path.join(dir,'continuity-cover.svg'),shell(640,440,'任务的线索，还在','概念插画：一条红线穿过话题、PR与日历，表达任务线索跨入口与时间延续。不是程序流程图，也没有编码真实实验数据。',body));

const p95=[29.0,15.7],cache=[10.82,23.23];
assert(Math.abs((p95[0]-p95[1])/p95[0]-.45862)<.0001);
assert(Math.abs(cache[1]/cache[0]-2.14695)<.0001);
body=text(24,62,'慢端完成更快，缓存读取更多',27,ink,600);
body+=`<line x1="24" y1="85" x2="816" y2="85" stroke="${line}"/><line x1="423" y1="107" x2="423" y2="289" stroke="${line}"/>`;
body+=text(24,122,'p95 完成耗时',15,muted)+text(456,122,'缓存读取量',15,muted);
function bar(x,y,w,value,label,color){return text(x,y,label,13,muted)+`<rect x="${x}" y="${y+13}" width="${w}" height="17" fill="${color}"/>`+text(x+w+8,y+27,value,14,ink,500)}
body+=bar(24,161,310,'29.0 分钟','单会话 · 优先委派',line)+bar(24,233,310*15.7/29,'15.7 分钟','Super-agent',accent);
body+=bar(456,161,137,'1,082 万','单会话 · 优先委派',line)+bar(456,233,295,'2,323 万','Super-agent',accent);
body+=text(24,304,'约缩短 46%',16,accent,500)+text(456,304,'约为 2.15 倍',16,accent,500);

fs.writeFileSync(path.join(dir,'tradeoff.svg'),shell(840,326,'调度改善与缓存读取代价','与优先委派单会话比较，Super-agent p95从29.0到15.7分钟，缓存读取从1082到2323万token。分别使用相同量尺，不比较两种单位的条形长度。',body));
body=text(20,65,'慢端更快，缓存读取更多',23,ink,600);
body+=`<line x1="20" y1="88" x2="390" y2="88" stroke="${line}"/>`+text(20,118,'p95 完成耗时',14,muted);
body+=bar(20,151,250,'29.0 分钟','单会话 · 优先委派',line)+bar(20,213,250*15.7/29,'15.7 分钟','Super-agent',accent)+text(20,272,'约缩短 46%',15,accent,500);
body+=`<line x1="20" y1="294" x2="390" y2="294" stroke="${line}"/>`+text(20,326,'缓存读取量',14,muted);
body+=bar(20,359,116,'1,082 万','单会话 · 优先委派',line)+bar(20,421,250,'2,323 万','Super-agent',accent)+text(20,480,'约为 2.15 倍',15,accent,500);

fs.writeFileSync(path.join(dir,'tradeoff-mobile.svg'),shell(410,503,'调度改善与缓存读取代价（移动端）','与优先委派单会话比较，p95缩短约46%，缓存读取约为2.15倍；每方案5次，未测代码质量与人工收益。',body));
console.log('Generated concept illustration and responsive tradeoff diagrams; comparison arithmetic checked.');
