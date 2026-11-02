#!/usr/bin/env node
// Source diagrams are redrawn with the site's typography and colors; archived originals remain unchanged.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../assets/superagent/redrawn'),checking=process.argv.includes('--check');
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
function render(s,mobile=false){
 assert.equal(new Set(s.nodes.map(n=>n.id)).size,s.nodes.length);
 const ids=new Set(s.nodes.map(n=>n.id));assert(s.edges.every(e=>ids.has(e.from)&&ids.has(e.to)));
 assert(s.nodes.every(n=>n.x>=0&&n.y>=0&&n.x+n.w<=s.w&&n.y+n.h<=s.h));
 const text=(x,y,t,size,color,weight=400,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${c[color]}" font-weight="${weight}" ${extra}>${esc(t)}</text>`;
 let body=s.rules.map(r=>`<line x1="${r.x1}" y1="${r.y1}" x2="${r.x2}" y2="${r.y2}" stroke="${c.line}"${r.dash?' stroke-dasharray="5 5"':''}/>`).join('');
 for(const e of s.edges){const color=e.accent?'accent':'muted';body+=`<polyline points="${e.points}" fill="none" stroke="${c[color]}" stroke-width="${e.accent?2:1.3}"${e.dash?' stroke-dasharray="5 4"':''} marker-end="url(#arrow-${color})"${e.both?` marker-start="url(#arrow-${color})"`:''}/>`}
 for(const n of s.nodes){
  body+=`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="3" fill="${c.panel}" stroke="${n.accent?c.accent:c.line}" stroke-width="${n.accent?1.3:.8}"${n.dash?' stroke-dasharray="5 4"':''}/>`;
  const titleLines=Array.isArray(n.title)?n.title:[n.title];const titleSize=mobile?16:17;
  const limit=`data-node="${n.id}" data-max-width="${n.w-30}"`;
  titleLines.forEach((t,i)=>{body+=text(n.x+15,n.y+28+i*24,t,titleSize,n.accent?'accent':'text',500,limit)});
  n.lines.forEach((t,i)=>{body+=text(n.x+15,n.y+28+titleLines.length*24+6+i*22,t,mobile?13:14,'muted',400,limit)});
 }
 for(const e of s.edges)if(e.label){
  const lines=e.label.split('\n');lines.forEach((t,i)=>{body+=text(e.lx,e.ly+i*18,t,13,e.accent?'accent':'muted',400,`paint-order="stroke" stroke="${c.bg}" stroke-width="4" stroke-linejoin="round"`)});
 }
 for(const l of s.labels)body+=text(l.x,l.y,l.text,l.size,l.color);
 const markers=['accent','muted'].map(k=>`<marker id="arrow-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9" fill="none" stroke="${c[k]}" stroke-width="1.4"/></marker>`).join('');
 const name=`fig${String(s.n).padStart(2,'0')}${mobile?'-mobile':''}.svg`;
 const description=`据 DeepSeek Harness 原文图 ${s.n} 重绘。${s.nodes.map(n=>(Array.isArray(n.title)?n.title.join(' '):n.title)+': '+n.lines.join('，')).join('；')}。重排版不改变作者设计与公开原型的区别。`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}" height="${s.h}" viewBox="0 0 ${s.w} ${s.h}" role="img" aria-labelledby="title desc"><title id="title">${esc(s.title)}</title><desc id="desc">${esc(description)}</desc><defs>${markers}</defs><rect width="${s.w}" height="${s.h}" fill="${c.bg}"/><g font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif">${body}</g></svg>\n`;
 write(name,svg);
 return {file:name,width:s.w,height:s.h,nodes:s.nodes.length,edges:s.edges.length};
}
function publish(a,b){
 // Mobile must represent the same nodes and directed relations, even when the layout changes.
 assert.deepEqual(a.nodes.map(n=>n.id).sort(),b.nodes.map(n=>n.id).sort());
 const relations=s=>s.edges.map(e=>[e.from,e.to,e.both||false].join(':')).sort();assert.deepEqual(relations(a),relations(b));
 figures.push({originalFigure:a.n,title:a.title,desktop:render(a),mobile:render(b,true)});
}

// 4. Router's shared context and isolated worker contexts; channels and workers exchange through Router.
let a=scene(4,760,300,'双层分工：统一交互，隔离执行'),b=scene(4,360,590,a.title);
['IM','GitHub','邮件 / 日程'].forEach((t,i)=>{node(a,'c'+i,14,18+i*89,150,64,t);node(b,'c'+i,15,14+i*72,330,60,t)});
node(a,'router',264,97,230,110,'Router 层',['共享上下文','路由与对外交互'],true);node(b,'router',15,252,330,106,'Router 层',['共享上下文，路由与对外交互'],true);
for(let i=0;i<3;i++){node(a,'w'+i,574,18+i*89,172,76,'Worker '+(i+1),['隔离上下文']);node(b,'w'+i,15,385+i*65,330,58,'Worker '+(i+1),[],false);edge(a,'c'+i,'router',`164,${50+i*89} 210,${50+i*89} 210,152 264,152`,{both:true});edge(a,'router','w'+i,`494,152 534,152 534,${55+i*89} 574,${55+i*89}`,{both:true});edge(b,'c'+i,'router',`345,${44+i*72} 355,${44+i*72} 355,298 345,298`,{both:true});edge(b,'router','w'+i,`15,314 5,314 5,${414+i*65} 15,${414+i*65}`,{both:true})}
label(b,35,575,'三个 Worker 各有独立上下文；数量为示意。',12);publish(a,b);

// 7. The first event establishes a subscription; subsequent events follow the program path.
a=scene(7,760,260,'订阅与直通：初始判断，后续投递');b=scene(7,360,472,a.title);
node(a,'thread',16,144,210,88,'同一 Thread 的事件',['例如同一 PR 或 IM 话题']);node(a,'router',268,14,244,84,'Router 层',['创建 Worker 并建立订阅']);node(a,'worker',548,144,196,88,'Worker Session',['已订阅该 Thread'],true);
edge(a,'thread','router','120,144 120,56 268,56',{dash:true,label:'初始事件 · Slow Path',lx:34,ly:120});edge(a,'router','worker','512,56 646,56 646,144',{dash:true});edge(a,'thread','worker','226,189 548,189',{accent:true,label:'后续事件直通 · Fast Path',lx:242,ly:175});
node(b,'thread',15,14,330,86,'同一 Thread 的事件',['例如同一 PR 或 IM 话题']);node(b,'router',15,153,330,86,'Router 层',['创建 Worker 并建立订阅']);node(b,'worker',15,319,330,86,'Worker Session',['已订阅该 Thread'],true);
edge(b,'thread','router','180,100 180,153',{dash:true,label:'初始事件 · Slow Path',lx:22,ly:134});edge(b,'router','worker','180,239 180,319',{dash:true,label:'创建并订阅',lx:23,ly:285});edge(b,'thread','worker','345,57 355,57 355,362 345,362',{accent:true});label(b,20,443,'朱砂红路径：后续事件直接投递。',14,'accent');publish(a,b);

// 5. Three example triggers, deterministic admission, semantic decision and the surviving trigger.
a=scene(5,820,362,'两级过滤：先过规则，再读语义');b=scene(5,360,760,a.title);
const triggerTitles=['Trigger 1 · 非监听群','Trigger 2 · 日常消息','Trigger 3 · 缺陷反馈'];
const triggerLines=[['“中午去食堂还是外卖？”'],['“新版本界面看着挺清爽”'],['“切换会话时偶发白屏”']];
for(let i=0;i<3;i++){node(a,'t'+i,14,20+i*109,252,92,triggerTitles[i],triggerLines[i],i===2);node(b,'t'+i,15,15+i*95,330,82,triggerTitles[i],triggerLines[i],i===2)}
node(a,'program',312,54,236,210,'程序层策略',['Fast Path','确定性规则准入','群组范围 / 来源白名单','拦截 Trigger 1','放行 Trigger 2、3'],true);node(a,'semantic',584,74,222,160,'语义层策略',['Slow Path','LLM 按提示词判断语义','静默 2，触发 3']);node(a,'result',584,278,222,66,'开始路由 Trigger 3',[],true);
for(let i=0;i<3;i++)edge(a,'t'+i,'program',`266,${66+i*109} 287,${66+i*109} 287,${105+i*45} 312,${105+i*45}`,{accent:i===2});edge(a,'program','semantic','548,156 584,156',{accent:true,label:'候选',lx:549,ly:141});edge(a,'semantic','result','695,234 695,278',{accent:true});
label(a,321,311,'规则挡住的事件不需要调用 LLM。',13);label(a,14,353,'保留原文的三条示例；判断是原文示意，未实测准确率。',12);
node(b,'program',15,325,330,171,'程序层策略',['Fast Path · 确定性规则准入','群组范围 / 来源白名单','拦截 Trigger 1；放行 2、3'],true);node(b,'semantic',15,541,330,114,'语义层策略',['Slow Path · LLM 读语义','静默 Trigger 2，触发 Trigger 3']);node(b,'result',15,699,330,55,'开始路由 Trigger 3',[],true);
for(let i=0;i<3;i++)edge(b,'t'+i,'program',`345,${56+i*95} 355,${56+i*95} 355,${358+i*35} 345,${358+i*35}`,{accent:i===2});edge(b,'program','semantic','180,496 180,541',{accent:true,label:'候选事件',lx:20,ly:522});edge(b,'semantic','result','180,655 180,699',{accent:true});publish(a,b);

// 11. Loop and state are bidirectional; the loop connects to each daemon environment.
a=scene(11,760,302,'计算、状态与执行环境分离');b=scene(11,360,620,a.title);
node(a,'loop',48,15,300,96,'Agent Loop',['云端无状态弹性容器'],true);node(a,'db',436,15,276,96,'Session 数据库',['持久化状态存储']);edge(a,'loop','db','348,62 436,62',{both:true});rule(a,15,150,745,150,true);label(a,16,141,'云端计算与状态',13);label(a,16,177,'按需接入执行环境',13);
const environments=['个人开发机','云端托管 / 按需环境','间歇在线的个人设备'];
for(let i=0;i<3;i++){node(a,'env'+i,15+i*249,203,232,82,environments[i],['轻量端侧 daemon']);edge(a,'loop','env'+i,`197,111 197,186 ${131+i*249},186 ${131+i*249},203`)}
node(b,'loop',15,14,330,86,'Agent Loop',['云端无状态弹性容器'],true);node(b,'db',15,144,330,85,'Session 数据库',['持久化状态存储']);edge(b,'loop','db','180,100 180,144',{both:true});rule(b,15,259,345,259,true);label(b,16,284,'执行环境留在原地，Loop 按需接入。',13);
for(let i=0;i<3;i++){node(b,'env'+i,15,314+i*93,330,82,environments[i],['轻量端侧 daemon']);edge(b,'loop','env'+i,`15,57 5,57 5,${355+i*93} 15,${355+i*93}`)}publish(a,b);

// 3. Overview preserves the source's input path, program bypass, state links and watchdog.
a=scene(3,820,468,'Super-agent 整体设计');b=scene(3,360,972,a.title);
node(a,'trigger',14,18,226,84,'[3] 环境事件',['群消息 / PR / CI']);node(a,'filter',286,18,218,84,'[3] 两级过滤',['Fast / Slow Path']);node(a,'router',554,18,252,108,'[2] Router 层',['共享上下文','全局路由与交互'],true);
node(a,'w1',14,182,226,84,'[2] Worker 1',['隔离上下文']);node(a,'wn',286,182,218,84,'[2] Worker N',['隔离上下文']);node(a,'channels',554,171,252,84,'[4] 多信道交互',['IM / GitHub / 邮件']);node(a,'env',554,288,252,84,'[5] 执行环境',['轻量 daemon 原地接入'],false,true);node(a,'db',286,383,520,68,'[5] Session 数据库',['持久化保存所有 Session 状态']);node(a,'watchdog',14,371,226,80,'[6] Watchdog',['外部监控与自愈']);
edge(a,'trigger','filter','240,60 286,60');edge(a,'filter','router','504,60 554,60');edge(a,'router','channels','680,126 680,171');edge(a,'router','w1','600,126 600,145 127,145 127,182');edge(a,'router','wn','640,126 640,157 395,157 395,182');edge(a,'filter','w1','300,102 260,102 260,159 22,159 22,182',{accent:true,dash:true,label:'订阅直通',lx:22,ly:148});edge(a,'router','db','804,123 815,123 815,417 806,417');edge(a,'w1','db','127,266 127,345 306,345 306,383');edge(a,'wn','db','395,266 395,383');edge(a,'wn','env','504,225 526,225 526,330 554,330');edge(a,'watchdog','db','240,411 286,411',{dash:true});
const overviewNodes=[['trigger','[3] 环境事件',['群消息 / PR / CI'],80],['filter','[3] 两级过滤',['Fast / Slow Path'],80],['router','[2] Router 层',['共享上下文，全局路由与交互'],88],['channels','[4] 多信道交互',['IM / GitHub / 邮件'],80],['w1','[2] Worker 1',['隔离上下文'],80],['wn','[2] Worker N',['隔离上下文'],80],['env','[5] 执行环境',['轻量 daemon 原地接入'],80],['db','[5] Session 数据库',['持久化保存所有 Session 状态'],80],['watchdog','[6] Watchdog',['外部监控与自愈'],80]];
let y=14;for(const [id,title,lines,h] of overviewNodes){node(b,id,18,y,324,h,title,lines,id==='router',id==='env');y+=102}
const by=new Map(b.nodes.map(n=>[n.id,n]));function connection(from,to,side=1,opts={}){const f=by.get(from),t=by.get(to),x=side?351:9;edge(b,from,to,`${side?342:18},${f.y+f.h/2} ${x},${f.y+f.h/2} ${x},${t.y+t.h/2} ${side?342:18},${t.y+t.h/2}`,opts)}
edge(b,'trigger','filter','180,94 180,116');edge(b,'filter','router','180,196 180,218');edge(b,'router','channels','180,306 180,320');connection('router','w1',0);connection('router','wn',0);connection('filter','w1',1,{accent:true,dash:true});connection('router','db',1);connection('w1','db',0);connection('wn','db',0);edge(b,'wn','env','180,604 180,626');edge(b,'watchdog','db','180,830 180,808',{dash:true});label(b,18,952,'章节号沿用原文；不表示公开版已全实现。',12);publish(a,b);

// 8. Preserve both object references and the particular read calls in the source figure.
a=scene(8,760,600,'Inline & Spill：沿引用逐跳召回');b=scene(8,360,844,a.title);
node(a,'trigger',14,22,300,168,'Trigger #42 · Inline',['前 50 字与相邻消息','超出部分 Spill 截断','thread_id: #08','worker_id: #03'],true);
node(a,'spill',416,22,330,82,'Trigger #42 剩余内容',['按需读取 Spill 部分']);node(a,'thread',416,170,330,136,'Thread #08',['近期事件摘要；更早历史 Spill','trigger_ids: [#39, #40]','worker_ids: [#02, #03]'],true);
node(a,'t40',416,364,330,78,'Trigger #40 详情',['同样遵循 Inline & Spill']);node(a,'worker',14,350,300,108,'Worker #03 状态',['任务进度与状态摘要','thread_id: #15']);node(a,'thread15',14,516,300,68,'Thread #15 详情',['关联 Pull Request']);
edge(a,'trigger','spill','314,66 416,66',{dash:true,label:'read_trigger(#42)',lx:320,ly:16});edge(a,'trigger','thread','164,190 164,234 416,234',{accent:true,dash:true,label:'read_thread(#08)',lx:176,ly:220});edge(a,'thread','t40','580,306 580,364',{accent:true,dash:true,label:'read_trigger(#40)',lx:596,ly:342});edge(a,'thread','worker','416,274 360,274 360,404 314,404',{accent:true,dash:true,label:'read_worker(#03)',lx:20,ly:330});edge(a,'worker','thread15','164,458 164,516',{accent:true,dash:true,label:'read_thread(#15)',lx:180,ly:495});
const mobileNodes=[['trigger','Trigger #42 · Inline',['前 50 字与相邻消息','超出部分 Spill 截断','thread_id: #08','worker_id: #03'],150],['spill','Trigger #42 剩余内容',['按需读取 Spill 部分'],68],['thread','Thread #08',['近期事件摘要；更早历史 Spill','trigger_ids: [#39, #40]','worker_ids: [#02, #03]'],122],['t40','Trigger #40 详情',['同样遵循 Inline & Spill'],68],['worker','Worker #03 状态',['任务进度与状态摘要','thread_id: #15'],90],['thread15','Thread #15 详情',['关联 Pull Request'],68]];
y=14;for(const [id,title,lines,h] of mobileNodes){node(b,id,15,y,330,h,title,lines,['trigger','thread'].includes(id));y+=h+50}
const mb=new Map(b.nodes.map(n=>[n.id,n]));const med=(from,to,call,side=false)=>{const f=mb.get(from),t=mb.get(to);edge(b,from,to,side?`345,${f.y+f.h/2} 355,${f.y+f.h/2} 355,${t.y+t.h/2} 345,${t.y+t.h/2}`:`180,${f.y+f.h} 180,${t.y}`,{accent:from!=='trigger'||to!=='spill',dash:true});label(b,22,t.y-25,call,14,from==='trigger'&&to==='spill'?'muted':'accent')};med('trigger','spill','read_trigger(#42)');med('trigger','thread','read_thread(#08)',true);med('thread','t40','read_trigger(#40)');med('thread','worker','read_worker(#03)',true);med('worker','thread15','read_thread(#15)');publish(a,b);

// 10. Foreground timeline and the separate background job preserve the run()/start() distinction.
a=scene(10,820,412,'同步与异步 ReAct Loop');b=scene(10,360,960,a.title);
label(a,14,22,'经典 ReAct Loop',18,'text');
node(a,'sync-msg',14,45,154,68,'用户消息 1');node(a,'run',203,45,160,90,'LLM Call',['调用 run()']);node(a,'sync-result',544,45,140,90,['工具调用结束'],['返回结果']);node(a,'sync-llm',710,45,96,108,['LLM','Call'],['回复用户']);node(a,'sync-tool',203,154,481,64,'同步执行耗时工具');
edge(a,'sync-msg','run','168,80 203,80');edge(a,'run','sync-tool','280,135 280,154');edge(a,'sync-tool','sync-result','620,154 620,135');edge(a,'sync-result','sync-llm','684,80 710,80');edge(a,'run','sync-result','363,80 544,80',{dash:true,label:'前台阻塞等待工具返回',lx:371,ly:67});rule(a,14,244,806,244);
label(a,14,274,'异步 ReAct Loop',18,'text');
node(a,'async-msg',14,295,138,90,'用户消息 1',[],true);node(a,'start',174,295,145,90,'LLM Call',['调用 start()'],true);node(a,'started',341,295,132,90,'立即返回',['Started 通知']);node(a,'msg2',495,295,132,90,'用户消息 2',[],true);node(a,'reply',649,295,157,90,'LLM Call',['即时回复'],true);
// The async result and job need a second row; grow the scene rather than shrinking its text.
a.h=606;node(a,'async-tool',174,456,299,82,'后台异步执行耗时工具',[],true);node(a,'inject',495,456,132,110,['新消息投递'],['完成结果']);node(a,'deliver',649,456,157,110,'LLM Call',['交付任务结果'],true);
edge(a,'async-msg','start','152,340 174,340');edge(a,'start','started','319,340 341,340');edge(a,'started','msg2','473,340 495,340');edge(a,'msg2','reply','627,340 649,340');edge(a,'start','async-tool','247,385 247,456',{accent:true});edge(a,'async-tool','started','390,456 390,412 407,412 407,385',{dash:true,label:'启动通知',lx:413,ly:439});edge(a,'async-tool','inject','473,496 495,496',{accent:true,dash:true});edge(a,'reply','inject','732,385 732,419 563,419 563,456');edge(a,'inject','deliver','627,496 649,496');label(a,14,593,'新输入在当前模型步骤结束后处理，后台工具继续运行。',14);
label(b,15,27,'经典：等待工具结束',18,'text');
node(b,'sync-msg',15,46,330,49,'用户消息 1');node(b,'run',15,117,157,85,'LLM Call',['调用 run()']);node(b,'sync-tool',188,117,157,85,['同步执行','耗时工具']);node(b,'sync-result',15,247,157,84,'工具调用结束',['返回结果']);node(b,'sync-llm',188,247,157,84,'LLM Call',['回复用户']);
edge(b,'sync-msg','run','93,95 93,117');edge(b,'run','sync-tool','172,160 188,160');edge(b,'sync-tool','sync-result','266,202 266,225 93,225 93,247');edge(b,'sync-result','sync-llm','172,290 188,290');edge(b,'run','sync-result','93,202 93,247',{dash:true});rule(b,15,362,345,362);label(b,15,396,'异步：前台继续接收输入',18,'text');
node(b,'async-msg',15,418,330,49,'用户消息 1',[],true);node(b,'start',15,490,157,82,'LLM Call',['调用 start()'],true);node(b,'started',188,490,157,82,'立即返回',['Started 通知']);node(b,'msg2',15,616,157,76,'用户消息 2',[],true);node(b,'reply',188,616,157,76,'LLM Call',['即时回复'],true);node(b,'async-tool',15,738,330,69,'后台异步执行耗时工具',[],true);node(b,'inject',15,851,157,86,'新消息投递',['完成结果']);node(b,'deliver',188,851,157,86,'LLM Call',['交付任务结果'],true);
edge(b,'async-msg','start','93,467 93,490');edge(b,'start','started','172,531 188,531');edge(b,'started','msg2','266,572 266,594 93,594 93,616');edge(b,'msg2','reply','172,654 188,654');edge(b,'start','async-tool','15,531 5,531 5,771 15,771',{accent:true});edge(b,'async-tool','started','345,771 355,771 355,531 345,531',{dash:true});edge(b,'async-tool','inject','93,807 93,851',{accent:true,dash:true});edge(b,'reply','inject','345,654 355,654 355,827 93,827 93,851');edge(b,'inject','deliver','172,894 188,894');publish(a,b);

write('sources.json',JSON.stringify({sourceArticle:'https://mp.weixin.qq.com/s/zoS7GlReWPhfCjENGxXCdg',description:'博客风格重绘；原文设计图，不是公开版本实现范围的新证据。',figures},null,2)+'\n');
console.log(`${checking?'Checked':'Generated'} ${figures.length} source diagrams, each with desktop and mobile layouts; matching nodes and relations checked.`);
