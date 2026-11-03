#!/usr/bin/env node
// Source diagrams are redrawn with the site's typography and colors; archived originals remain unchanged.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../docs/assets/superagent/redrawn'),checking=process.argv.includes('--check');
if(!checking)fs.mkdirSync(dir,{recursive:true});
function write(file,content){const target=path.join(dir,file);if(checking)assert(fs.existsSync(target)&&fs.readFileSync(target,'utf8')===content,`${file} is stale; run node scripts/render-superagent-source-diagrams.cjs`);else fs.writeFileSync(target,content)}
const c={bg:'#faf8f3',text:'#292825',muted:'#77746e',accent:'#a64335',line:'#e6e2da',panel:'#faf8f3'};
const esc=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[x]));
const figures=[];
function scene(n,w,h,title){return {n,w,h,title,nodes:[],edges:[],labels:[],rules:[]}}
function node(s,id,x,y,w,h,title,lines=[],accent=false,dash=false){s.nodes.push({id,x,y,w,h,title,lines,accent,dash});return id}
function edge(s,from,to,points,{accent=false,dash=false,both=false,label='',lx=0,ly=0}={}){s.edges.push({from,to,points,accent,dash,both,label,lx,ly})}
function label(s,x,y,text,size=14,color='muted'){s.labels.push({x,y,text,size,color})}
function rule(s,x1,y1,x2,y2,dash=false){s.rules.push({x1,y1,x2,y2,dash})}
function render(s){
 assert.equal(new Set(s.nodes.map(n=>n.id)).size,s.nodes.length);
 const ids=new Set(s.nodes.map(n=>n.id));assert(s.edges.every(e=>ids.has(e.from)&&ids.has(e.to)));
 assert(s.nodes.every(n=>n.x>=0&&n.y>=0&&n.x+n.w<=s.w&&n.y+n.h<=s.h));
 const bidirectionalTips=s.edges.filter(e=>e.both).flatMap(e=>{const points=e.points.trim().split(/\s+/);return [points[0],points[points.length-1]]});
 assert.equal(new Set(bidirectionalTips).size,bidirectionalTips.length,'Bidirectional edges must use distinct arrowhead ports');
 const text=(x,y,t,size,color,weight=400,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${c[color]}" font-weight="${weight}" ${extra}>${esc(t)}</text>`;
 let body=s.rules.map(r=>`<line x1="${r.x1}" y1="${r.y1}" x2="${r.x2}" y2="${r.y2}" stroke="${c.line}"${r.dash?' stroke-dasharray="5 5"':''}/>`).join('');
 for(const e of s.edges){const color=e.accent?'accent':'muted';body+=`<polyline points="${e.points}" fill="none" stroke="${c[color]}" stroke-width="${e.accent?2:1.3}"${e.dash?' stroke-dasharray="5 4"':''} marker-end="url(#arrow-${color})"${e.both?` marker-start="url(#arrow-${color})"`:''}/>`}
 for(const n of s.nodes){
  body+=`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="3" fill="${c.panel}" stroke="${n.accent?c.accent:c.line}" stroke-width="${n.accent?1.3:.8}"${n.dash?' stroke-dasharray="5 4"':''}/>`;
  const titleLines=Array.isArray(n.title)?n.title:[n.title];const titleSize=17;
  const limit=`data-node="${n.id}" data-max-width="${n.w-30}"`;
  titleLines.forEach((t,i)=>{body+=text(n.x+15,n.y+28+i*24,t,titleSize,n.accent?'accent':'text',500,limit)});
  n.lines.forEach((t,i)=>{body+=text(n.x+15,n.y+28+titleLines.length*24+6+i*22,t,14,'muted',400,limit)});
 }
 for(const e of s.edges)if(e.label){
  const lines=e.label.split('\n');lines.forEach((t,i)=>{body+=text(e.lx,e.ly+i*18,t,13,e.accent?'accent':'muted',400,`paint-order="stroke" stroke="${c.bg}" stroke-width="4" stroke-linejoin="round"`)});
 }
 for(const l of s.labels)body+=text(l.x,l.y,l.text,l.size,l.color);
 const markers=['accent','muted'].map(k=>`<marker id="arrow-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9" fill="none" stroke="${c[k]}" stroke-width="1.4"/></marker>`).join('');
 const name=`fig${String(s.n).padStart(2,'0')}.svg`;
 const description=`据 dsh 原文图 ${s.n} 重绘。${s.nodes.map(n=>(Array.isArray(n.title)?n.title.join(' '):n.title)+': '+n.lines.join('，')).join('；')}。`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}" height="${s.h}" viewBox="0 0 ${s.w} ${s.h}" role="img" aria-labelledby="title desc"><title id="title">${esc(s.title)}</title><desc id="desc">${esc(description)}</desc><defs>${markers}</defs><rect width="${s.w}" height="${s.h}" fill="${c.bg}"/><g font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif">${body}</g></svg>\n`;
 write(name,svg);
 return {file:name,width:s.w,height:s.h,nodes:s.nodes.length,edges:s.edges.length};
}
function publish(a){figures.push({originalFigure:a.n,title:a.title,...render(a)})}

// 4. Router's shared context and isolated worker contexts; channels and workers exchange through Router.
let a=scene(4,760,300,'双层分工：统一交互，隔离执行');
['IM','GitHub','邮件 / 日程'].forEach((t,i)=>{node(a,'c'+i,14,18+i*89,150,64,t)});
node(a,'router',264,97,230,110,'Router 层',['共享上下文','路由与对外交互'],true);
// Each relation has its own Router port and corridor; shared trunks would stack arrowheads.
const channelPorts=[116,139,184],workerPorts=[116,145,184];
for(let i=0;i<3;i++){
 node(a,'w'+i,574,18+i*89,172,76,'Worker '+(i+1),['隔离上下文']);
 edge(a,'c'+i,'router',i===1?'164,139 264,139':`164,${50+i*89} 210,${50+i*89} 210,${channelPorts[i]} 264,${channelPorts[i]}`,{both:true});
 edge(a,'router','w'+i,i===1?'494,145 574,145':`494,${workerPorts[i]} 534,${workerPorts[i]} 534,${56+i*89} 574,${56+i*89}`,{both:true});
}
publish(a);

// 7. The first event establishes a subscription; subsequent events follow the program path.
a=scene(7,760,260,'订阅与直通：初始判断，后续投递');
node(a,'thread',16,144,210,88,'同一 Thread 的事件',['例如同一 PR 或 IM 话题']);node(a,'router',268,14,244,84,'Router 层',['创建 Worker 并建立订阅']);node(a,'worker',548,144,196,88,'Worker Session',['已订阅该 Thread'],true);
edge(a,'thread','router','120,144 120,56 268,56',{dash:true,label:'初始事件 · Slow Path',lx:34,ly:120});edge(a,'router','worker','512,56 646,56 646,144',{dash:true});edge(a,'thread','worker','226,189 548,189',{accent:true,label:'后续事件直通 · Fast Path',lx:242,ly:175});publish(a);

// 5. Three example triggers, deterministic admission, semantic decision and the surviving trigger.
a=scene(5,820,362,'两级过滤：先过规则，再读语义');
const triggerTitles=['Trigger 1 · 非监听群','Trigger 2 · 日常消息','Trigger 3 · 缺陷反馈'];
const triggerLines=[['“中午去食堂还是外卖？”'],['“新版本界面看着挺清爽”'],['“切换会话时偶发白屏”']];
for(let i=0;i<3;i++){node(a,'t'+i,14,20+i*109,252,92,triggerTitles[i],triggerLines[i],i===2)}
node(a,'program',312,54,236,210,'程序层策略',['Fast Path','确定性规则准入','群组范围 / 来源白名单','拦截 Trigger 1','放行 Trigger 2、3'],true);node(a,'semantic',584,74,222,160,'语义层策略',['Slow Path','LLM 按提示词判断语义','静默 2，触发 3']);node(a,'result',584,278,222,66,'开始路由 Trigger 3',[],true);
for(let i=0;i<3;i++)edge(a,'t'+i,'program',`266,${66+i*109} 287,${66+i*109} 287,${105+i*45} 312,${105+i*45}`,{accent:i===2});edge(a,'program','semantic','548,156 584,156',{accent:true,label:'候选',lx:549,ly:141});edge(a,'semantic','result','695,234 695,278',{accent:true});publish(a);

// 11. Loop and state are bidirectional; the loop connects to each daemon environment.
a=scene(11,760,302,'计算、状态与执行环境分离');
node(a,'loop',48,15,300,96,'Agent Loop',['云端无状态弹性容器'],true);node(a,'db',436,15,276,96,'Session 数据库',['持久化状态存储']);edge(a,'loop','db','348,62 436,62',{both:true});rule(a,15,150,745,150,true);label(a,16,141,'云端计算与状态',13);label(a,16,177,'按需接入执行环境',13);
const environments=['个人开发机','云端托管 / 按需环境','间歇在线的个人设备'];
for(let i=0;i<3;i++){node(a,'env'+i,15+i*249,203,232,82,environments[i],['轻量端侧 daemon']);edge(a,'loop','env'+i,`197,111 197,186 ${131+i*249},186 ${131+i*249},203`)}publish(a);

// 3. Overview preserves the source's input path, program bypass, state links and watchdog.
a=scene(3,820,468,'Super-agent 整体设计');
node(a,'trigger',14,18,226,84,'[3] 环境事件',['群消息 / PR / CI']);node(a,'filter',286,18,218,84,'[3] 两级过滤',['Fast / Slow Path']);node(a,'router',554,18,252,108,'[2] Router 层',['共享上下文','全局路由与交互'],true);
node(a,'w1',14,182,226,84,'[2] Worker 1',['隔离上下文']);node(a,'wn',286,182,218,84,'[2] Worker N',['隔离上下文']);node(a,'channels',554,171,252,84,'[4] 多信道交互',['IM / GitHub / 邮件']);node(a,'env',554,288,252,84,'[5] 执行环境',['轻量 daemon 原地接入'],false,true);node(a,'db',286,383,520,68,'[5] Session 数据库',['持久化保存所有 Session 状态']);node(a,'watchdog',14,371,226,80,'[6] Watchdog',['外部监控与自愈']);
edge(a,'trigger','filter','240,60 286,60');edge(a,'filter','router','504,60 554,60');edge(a,'router','channels','680,126 680,171');edge(a,'router','w1','600,126 600,145 127,145 127,182');edge(a,'router','wn','640,126 640,157 395,157 395,182');edge(a,'filter','w1','300,102 260,102 260,159 22,159 22,182',{accent:true,dash:true,label:'订阅直通',lx:22,ly:148});edge(a,'router','db','804,123 815,123 815,417 806,417');edge(a,'w1','db','127,266 127,345 306,345 306,383');edge(a,'wn','db','395,266 395,383');edge(a,'wn','env','504,225 526,225 526,330 554,330');edge(a,'watchdog','db','240,411 286,411',{dash:true});
publish(a);

// 8. Preserve both object references and the particular read calls in the source figure.
a=scene(8,760,600,'Inline & Spill：沿引用逐跳召回');
node(a,'trigger',14,22,300,168,'Trigger #42 · Inline',['前 50 字与相邻消息','超出部分 Spill 截断','thread_id: #08','worker_id: #03'],true);
node(a,'spill',416,22,330,82,'Trigger #42 剩余内容',['按需读取 Spill 部分']);node(a,'thread',416,170,330,136,'Thread #08',['近期事件摘要；更早历史 Spill','trigger_ids: [#39, #40]','worker_ids: [#02, #03]'],true);
node(a,'t40',416,364,330,78,'Trigger #40 详情',['同样遵循 Inline & Spill']);node(a,'worker',14,350,300,108,'Worker #03 状态',['任务进度与状态摘要','thread_id: #15']);node(a,'thread15',14,516,300,68,'Thread #15 详情',['关联 Pull Request']);
edge(a,'trigger','spill','314,66 416,66',{dash:true,label:'read_trigger(#42)',lx:320,ly:16});edge(a,'trigger','thread','164,190 164,234 416,234',{accent:true,dash:true,label:'read_thread(#08)',lx:176,ly:220});edge(a,'thread','t40','580,306 580,364',{accent:true,dash:true,label:'read_trigger(#40)',lx:596,ly:342});edge(a,'thread','worker','416,274 360,274 360,404 314,404',{accent:true,dash:true,label:'read_worker(#03)',lx:20,ly:330});edge(a,'worker','thread15','164,458 164,516',{accent:true,dash:true,label:'read_thread(#15)',lx:180,ly:495});
publish(a);

// 10. Foreground timeline and the separate background job preserve the run()/start() distinction.
a=scene(10,820,412,'同步与异步 ReAct Loop');
label(a,14,22,'经典 ReAct Loop',18,'text');
node(a,'sync-msg',14,45,154,68,'用户消息 1');node(a,'run',203,45,160,90,'LLM Call',['调用 run()']);node(a,'sync-result',544,45,140,90,['工具调用结束'],['返回结果']);node(a,'sync-llm',710,45,96,108,['LLM','Call'],['回复用户']);node(a,'sync-tool',203,154,481,64,'同步执行耗时工具');
edge(a,'sync-msg','run','168,80 203,80');edge(a,'run','sync-tool','280,135 280,154');edge(a,'sync-tool','sync-result','620,154 620,135');edge(a,'sync-result','sync-llm','684,80 710,80');edge(a,'run','sync-result','363,80 544,80',{dash:true,label:'前台阻塞等待工具返回',lx:371,ly:67});rule(a,14,244,806,244);
label(a,14,274,'异步 ReAct Loop',18,'text');
node(a,'async-msg',14,295,138,90,'用户消息 1',[],true);node(a,'start',174,295,145,90,'LLM Call',['调用 start()'],true);node(a,'started',341,295,132,90,'立即返回',['Started 通知']);node(a,'msg2',495,295,132,90,'用户消息 2',[],true);node(a,'reply',649,295,157,90,'LLM Call',['即时回复'],true);
// The async result and job need a second row; grow the scene rather than shrinking its text.
a.h=606;node(a,'async-tool',174,456,299,82,'后台异步执行耗时工具',[],true);node(a,'inject',495,456,132,110,['新消息投递'],['完成结果']);node(a,'deliver',649,456,157,110,'LLM Call',['交付任务结果'],true);
edge(a,'async-msg','start','152,340 174,340');edge(a,'start','started','319,340 341,340');edge(a,'started','msg2','473,340 495,340');edge(a,'msg2','reply','627,340 649,340');edge(a,'start','async-tool','247,385 247,456',{accent:true});edge(a,'async-tool','started','390,456 390,412 407,412 407,385',{dash:true,label:'启动通知',lx:413,ly:439});edge(a,'async-tool','inject','473,496 495,496',{accent:true,dash:true});edge(a,'reply','inject','732,385 732,419 563,419 563,456');edge(a,'inject','deliver','627,496 649,496');label(a,14,593,'新输入在当前模型步骤结束后处理，后台工具继续运行。',14);
publish(a);

write('sources.json',JSON.stringify({sourceArticle:'https://mp.weixin.qq.com/s/zoS7GlReWPhfCjENGxXCdg',description:'博客风格重绘；原文设计图，不是公开版本实现范围的新证据。',figures},null,2)+'\n');
console.log(`${checking?'Checked':'Generated'} ${figures.length} source diagrams.`);
