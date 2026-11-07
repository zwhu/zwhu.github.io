// Acceptance of the author's 2026-11-07 feedback using real browser input.
import {mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {startBrowserSite,openBrowser,delay} from './playtest-browser.mjs';

const ROOT=path.resolve(import.meta.dirname,'../../../..');
const arg=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
const mode=arg('mode')||'acceptance', selected=arg('case');
if(!['acceptance','baseline'].includes(mode))throw Error('Use --mode=acceptance or --mode=baseline');
const out=arg('out')?path.resolve(arg('out')):await mkdtemp(path.join(os.tmpdir(),'career-rpg-playtest-'));
if(out===ROOT||out.startsWith(ROOT+path.sep))throw Error('Store screenshots outside the repository');
await mkdir(out,{recursive:true});
try{await readFile(path.join(out,'result.json'));throw Error('Output already contains a report; choose a new directory');}catch(error){if(error.code!=='ENOENT')throw error;}
const hash=async file=>createHash('sha256').update(await readFile(path.join(ROOT,file))).digest('hex');
const report={mode,commit:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),
  productionHashes:Object.fromEntries(await Promise.all(['games/career-rpg/web/main.mjs','games/career-rpg/web/style.css','games/career-rpg/design/chapter-hefei.json'].map(async file=>[file,await hash(file)]))),
  environment:'Chrome headless, 1280x960, desktop; actual CDP key/pointer events; no performance or phone acceptance',
  scope:'Hefei main flow and feedback contracts. Visual screenshots require author review. Baseline mode may use explicitly recorded legacy UI labels; it never makes a failed contract pass.',cases:[]};
const site=await startBrowserSite();report.localURL=site.url+'?chapter=hefei';console.log('Local game:',report.localURL);
const cases=[];
function scenario(id,title,run,chapter='hefei'){cases.push({id,title,run,chapter});}

async function check(ctx,id,title,feedback,predicate) {
  const state=await ctx.browser.snap(), passed=await predicate(state);
  const row={id,title,feedback,status:passed?'passed':'failed',state,screenshot:await ctx.browser.shot(`${ctx.row.id}-${id}.png`)};
  ctx.row.steps.push(row);console.log(row.status.toUpperCase(),ctx.row.id,id,title);return passed;
}
async function explore(ctx) {
  for(let i=0;i<8;i++){const s=await ctx.browser.snap();if(s.state==='explore'&&(!s.conversationVisible||mode==='baseline'))return s;await ctx.browser.key('Enter');await delay(80);}
  throw Error('Keyboard could not return to exploration');
}

scenario('dialogue-focus','对话开启后，焦点离开按钮仍可回车推进',async ctx=>{
  const b=ctx.browser, box=await b.read(`(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/3};})()`);
  await b.pointer(box.x,box.y);ctx.row.input='Real pointer sets scene focus, then Enter; no scripted focus';
  const before=await b.snap();await b.key('Enter');
  await check(ctx,'enter','活跃对话收到 Enter 后收起，不依赖按钮焦点',['F01','F03'],s=>before.conversationVisible&&s.state==='explore'&&!s.conversationVisible);
});
scenario('opening-and-resume','开场文案、正常回车、位置保存和无暂停弹窗',async ctx=>{
  const b=ctx.browser;
  await check(ctx,'copy','开场完整叙述与面试名牌',['F02'],s=>s.nameplate==='面试'&&s.dialogue==='原本录用的人嫌工资低，没来。我鼓起勇气，毛遂自荐。');
  await b.key('Enter');
  await check(ctx,'close','无文本选项时 Enter 收起末句',['F01','F03'],s=>s.state==='explore'&&!s.conversationVisible);
  await explore(ctx);await b.key('ArrowLeft',180);const before=await b.snap();
  await b.key('Escape');await check(ctx,'no-pause','Esc 不弹稍作停留菜单',['F05'],s=>!s.paused);
  await b.reload();
  await check(ctx,'restore','刷新恢复角色位置和已确认进度',['F05'],s=>Math.hypot(s.position.x-before.position.x,s.position.y-before.position.y)<=1&&JSON.stringify(s.chapter.flags)===JSON.stringify(before.chapter.flags));
});

scenario('automatic-resume','独立检查取消暂停和角色位置持久化',async ctx=>{
  const b=ctx.browser;await b.key('Enter');await b.until(s=>s.state==='explore');
  await b.key('ArrowLeft',200);const before=await b.snap();
  await b.key('Escape');await check(ctx,'no-pause','探索状态不进入稍作停留弹窗',['F05'],s=>!s.paused);
  await b.reload();
  await check(ctx,'position','刷新后保留已移动的位置',['F05'],s=>Math.hypot(s.position.x-before.position.x,s.position.y-before.position.y)<=1);
});

async function walkTo(ctx,x,y) {
  const b=ctx.browser;
  for(let i=0;i<100;i++){
    const s=await b.snap();if(s.state!=='explore')throw Error('Cannot walk in '+s.state);
    const dx=x-s.position.x,dy=y-s.position.y;if(Math.max(Math.abs(dx),Math.abs(dy))<=1)return;
    const horizontal=Math.abs(dx)>=Math.abs(dy),key=horizontal?(dx>0?'ArrowRight':'ArrowLeft'):(dy>0?'ArrowDown':'ArrowUp');
    await b.key(key,Math.max(40,Math.min(350,Math.abs(horizontal?dx:dy)/60*1000-35)));
    const after=await b.snap();
    if(Math.hypot(after.position.x-s.position.x,after.position.y-s.position.y)<1)throw Error(`Walking blocked at ${s.position.x},${s.position.y}, target ${x},${y}`);
  }
  throw Error('Walking timeout');
}
async function route(ctx,points){for(const [x,y] of points)await walkTo(ctx,x,y);}
async function object(ctx,id) {
  for(let i=0;i<10;i++){if((await ctx.browser.snap()).active===id)return;await ctx.browser.key('q');}
  throw Error('Keyboard could not select object '+id);
}
async function press(ctx,label) {
  for(let i=0;i<12;i++){
    const s=await ctx.browser.snap();if(!s.buttons.some(b=>b.label===label))throw Error('Missing button '+label);
    if(s.buttons.some(b=>b.label===label&&b.selected)){await ctx.browser.key('Enter');return;}
    await ctx.browser.key('ArrowRight');
  }
  throw Error('Directions could not select '+label);
}
async function collect(ctx,id,skill) {
  const b=ctx.browser;let described=false,award=false,obsoleteLinux=false;
  for(let i=0;i<12;i++){
    let s=await b.snap();
    if(s.state==='transition'){await b.key('Enter');continue;}
    if(s.state==='explore'){
      if(s.chapter.skills[skill]==='got'){
        if(skill==='linux'&&!obsoleteLinux)await check(ctx,'linux-no-extra','直接获得 Linux 技能，没有额外说明确认页',['F09'],()=>award);
        if(skill==='jquery'&&!described)await check(ctx,'jquery-book','必须展示获得技能书文案',['F11'],()=>false);
        return;
      }
      await object(ctx,id);await b.key('e');continue;
    }
    if(s.state!=='dialogue')throw Error('Unexpected collect state '+s.state);
    if(skill==='jquery'&&!s.dialogue.includes('书架上夹着')&&!described){
      described=true;await check(ctx,'jquery-book','jQuery 学习提示为获得技能书',['F11'],next=>/获得技能书.*锋利的\s*jQuery/.test(next.dialogue));
    }
    if(s.dialogue.includes('获得技能')&&s.chapter.skills[skill]==='got'){
      award=true;const before=s.position;await b.key('Enter');
      await check(ctx,skill+'-award','获得提示可回车收起，角色不误动',['F10','F12'],next=>next.state==='explore'&&!next.conversationVisible&&next.position.x===before.x&&next.position.y===before.y);
      continue;
    }
    if(skill==='linux'&&s.dialogue.includes('第一次用 Linux')){
      obsoleteLinux=true;
      await check(ctx,'linux-no-extra','不出现被要求删除的 Linux/Git 说明确认页',['F09'],()=>false);
      if(mode==='acceptance')throw Error('Obsolete Linux/Git confirmation page blocks the new contract');
    }
    const named=s.buttons.find(button=>!button.caret);
    if(named){
      if(['接任务','记下来','OK'].includes(named.label))ctx.row.legacyActions.push({action:named.label,skill,dialogue:s.dialogue});
      await press(ctx,named.label);
    }else await b.key('Enter');
  }
  throw Error('Skill collection did not complete '+skill+'; award seen='+award);
}
async function mainFlow(ctx,day,night) {
  const b=ctx.browser;
  await check(ctx,'opening','面试开场文案完整',['F02'],s=>s.dialogue==='原本录用的人嫌工资低，没来。我鼓起勇气，毛遂自荐。');
  await b.key('Enter');await check(ctx,'opening-close','末句回车后窗口实际消失',['F01','F03'],s=>s.state==='explore'&&!s.conversationVisible);await explore(ctx);
  for(const [id,x] of [['colleague-b2',147],['colleague-b3',215]]){
    await route(ctx,[[x,196]]);await object(ctx,id);await b.key('e');
    await check(ctx,id,'可选同事对话不推进面试事件',['F03'],s=>s.chapter.state==='interview'&&!s.chapter.flags.includes('asked'));
    await b.key('Enter');await explore(ctx);
  }
  await route(ctx,[[24,196],[24,90]]);await object(ctx,'jquery-book');await b.key('e');
  await check(ctx,'shelf-before-interview','面试结束前书架提示先找老板，未获得技能',['F06'],s=>s.dialogue.includes('现在先去找老板面试')&&s.chapter.skills.jquery==='none');
  await b.key('Enter');await explore(ctx);
  await route(ctx,[[24,196],[270,196],[270,128],[310,128]]);await object(ctx,'boss');await b.key('e');
  await check(ctx,'boss-choice','老板对话出现玩家争取机会的选项',['F03'],s=>s.buttons.some(button=>button.label==='我不要工资，让我来试试就行。'));
  const pair=await b.holdEnter();
  await check(ctx,'hold-enter','按住 Enter 不连续推进新对话',['F03'],()=>pair.first.dialogue===pair.repeated.dialogue&&JSON.stringify(pair.first.chapter)===JSON.stringify(pair.repeated.chapter));
  for(let i=0;i<8;i++){const s=await b.snap();if(s.chapter.state==='day_tasks'&&s.state==='explore')break;await b.key('Enter');await delay(80);}
  await explore(ctx);await route(ctx,[[270,128],[270,196],[75,196]]);await object(ctx,'my-pc');await b.key('e');
  const menu=await b.snap();
  const newMenu=await check(ctx,'demand-entry','需求入口只呈现开始需求与两种选择',['F07','F08'],s=>s.dialogue.includes('开始今天的需求')&&['确定','继续探索办公室'].every(label=>s.buttons.some(button=>button.label===label))&&!s.buttons.some(button=>button.label==='接任务'));
  if(newMenu){
    await press(ctx,'继续探索办公室');
    await check(ctx,'demand-cancel','继续探索不接取需求，窗口实际收起',['F07'],s=>s.state==='explore'&&!s.conversationVisible&&JSON.stringify(s.chapter.flags)===JSON.stringify(menu.chapter.flags));
    await explore(ctx);await object(ctx,'my-pc');await b.key('e');await press(ctx,'确定');
  }else{
    ctx.row.unavailableBranches=['需求入口：继续探索办公室','需求入口：确定（新文案）'];
    if(mode==='acceptance')throw Error('New demand menu is missing; dependent learning branches were not executed');
    ctx.row.legacyActions.push({action:'接任务',reason:'Baseline capture only; new demand branches are unavailable'});await press(ctx,'接任务');
  }
  await check(ctx,'demand-result','接取后无空对话或残留接任务按钮',['F08'],s=>s.state==='explore'&&!s.conversationVisible);await explore(ctx);
  await check(ctx,'learning-hints','待学习的书架和现有电脑显示闪点',['F06','F13'],s=>s.learningHints.book>0&&s.learningHints.computer>0);
  await check(ctx,'day-world','白天实际绘制没有叠加道具屏幕和书架电脑',['F06','F13'],s=>s.worldFrame?.frames>0&&s.worldFrame.props.length===0);
  for(const skill of day){
    if(skill==='jquery')await route(ctx,[[24,196],[24,90]]);else await route(ctx,[[24,196],[75,196]]);
    const id=skill==='jquery'?'jquery-book':'linux-screen';await object(ctx,id);await b.key('e');await collect(ctx,id,skill);await explore(ctx);
  }
  if((await b.snap()).state==='transition')await b.key('Enter');
  await check(ctx,'night','白天完成后进入夜间，日间技能已获得',['F05'],s=>s.chapter.state==='night_study'&&s.chapter.skills.linux==='got'&&s.chapter.skills.jquery==='got');
  await check(ctx,'night-hint','夜间学习在现有电脑上显示闪点',['F13','F14'],s=>s.learningHints.computer>0&&s.learningHints.book===0);
  await check(ctx,'night-world','夜间实际绘制没有半透明道具屏幕重影',['F13','F14'],s=>s.worldFrame?.frames>0&&s.worldFrame.props.length===0);
  await explore(ctx);await route(ctx,[[24,196],[75,196]]);
  for(const skill of night){const id=skill==='java'?'java-book':'db-screen';await object(ctx,id);await b.key('e');await collect(ctx,id,skill);await explore(ctx);}
  await check(ctx,'all-skills','四个技能都通过实际交互获得',['F05','F10','F12'],s=>['linux','jquery','java','db'].every(skill=>s.chapter.skills[skill]==='got'));
  await check(ctx,'no-world-icons','收集后实际绘制没有残留道具浮标',['F13','F14'],s=>s.worldFrame?.frames>0&&s.worldFrame.props.length===0);
  await route(ctx,[[270,196],[270,128],[310,128]]);await object(ctx,'boss');await b.key('e');
  await check(ctx,'raise','加薪阶段的原剧情保留',['F13','F14'],s=>s.dialogue.includes('努力工作的人一定会被看到'));
  for(let i=0;i<5;i++){const s=await b.snap();if(s.chapter.state==='complete')break;await b.key('Enter');}
  await check(ctx,'complete','合法主流程到达章末',['F03'],s=>s.chapter.state==='complete');
  await b.key('Escape');await b.key('m');
  await check(ctx,'handbook','手册展示四项已获得技能',['F05'],async s=>Object.values(s.chapter.skills).every(value=>value==='got')&&await b.read(`document.querySelector('#skill-slots')?.getClientRects().length>0`));
  const saved=await b.snap();await b.reload();
  await check(ctx,'reload-complete','章末刷新保持章节和收集结果',['F05'],s=>s.chapter.state==='complete'&&JSON.stringify(s.chapter.skills)===JSON.stringify(saved.chapter.skills));
  await press(ctx,'从办公室重玩');await b.key('Escape');
  await check(ctx,'replay-cancel','取消重玩保持章末进度',['F05'],s=>s.chapter.state==='complete'&&JSON.stringify(s.chapter.skills)===JSON.stringify(saved.chapter.skills));
  await press(ctx,'从办公室重玩');await press(ctx,'确认重新开始');
  await check(ctx,'replay-confirm','确认重玩清空本章进度并回到面试',['F05'],s=>s.chapter.state==='interview'&&s.chapter.flags.length===0&&Object.values(s.chapter.skills).every(value=>value==='none'));
}
for(const day of [['linux','jquery'],['jquery','linux']])for(const night of [['java','db'],['db','java']]){
  scenario('flow-'+day.join('-')+'-'+night.join('-'),'完整主流程：'+day.join(' → ')+' / '+night.join(' → '),ctx=>mainFlow(ctx,day,night));
}
for(const chapter of ['nanjing','hangzhou'])scenario('shared-'+chapter,chapter+' 共用对话实际收起',async ctx=>{
  const before=await ctx.browser.snap();await ctx.browser.key('Enter');
  await check(ctx,'close','开场末句回车后状态与实际窗口同步',['F01','F03'],s=>before.conversationVisible&&s.state==='explore'&&!s.conversationVisible);
},chapter);

scenario('restore-dialogue','刷新恢复正在进行的对话与选项',async ctx=>{
  const b=ctx.browser;await b.key('Enter');await b.until(s=>s.state==='explore');
  await route(ctx,[[270,196],[270,128],[310,128]]);await object(ctx,'boss');await b.key('e');await b.key('Enter');await b.key('ArrowRight');
  const before=await b.snap();await check(ctx,'before','记录刷新前的对话和选择',['F05'],()=>true);
  await b.reload();
  await check(ctx,'after','刷新后保留对话内容、选择和角色位置',['F05'],s=>s.dialogue===before.dialogue&&s.buttons.find(button=>button.selected)?.label===before.buttons.find(button=>button.selected)?.label&&Math.hypot(s.position.x-before.position.x,s.position.y-before.position.y)<=1);
});
scenario('actual-blur','真实切换标签页后自动恢复，按住的移动键被清除',async ctx=>{
  const b=ctx.browser;await b.key('Enter');await b.until(s=>s.state==='explore');
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});await delay(80);
  const target=await(await fetch(`http://127.0.0.1:${b.port}/json/new?about:blank`,{method:'PUT'})).json();
  const ws=new WebSocket(target.webSocketDebuggerUrl);
  try{
    await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Other tab focus timeout')),5000);ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id===1){clearTimeout(timer);m.error?reject(Error(m.error.message)):resolve();}},{once:true});ws.send(JSON.stringify({id:1,method:'Page.bringToFront'}));});
    await delay(120);await b.send('Page.bringToFront');await delay(120);
    const back=await b.snap();await delay(200);
    await check(ctx,'resume','切换回来没有暂停弹窗且未继续移动',['F05'],s=>!s.paused&&s.position.x===back.position.x&&s.position.y===back.position.y);
  }finally{ws.close();await fetch(`http://127.0.0.1:${b.port}/json/close/${target.id}`);await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});}
});

async function runCase(test) {
  const row={id:test.id,title:test.title,status:'running',input:'Real keyboard; no Tab, scripted focus, DOM clicks or seeded saves',steps:[],legacyActions:[]};
  report.cases.push(row);let browser;
  try {
    row.chapter=test.chapter;
    browser=await openBrowser(site.url+'?chapter='+test.chapter,out);const ctx={browser,row};
    await test.run(ctx);
    row.inputEvents=await browser.read('window.__playtestInput');
    row.inputRequests=[...browser.inputRequests];
    row.errors=[...browser.errors];row.requests=[...browser.responses];
    row.status=row.steps.some(step=>step.status==='failed')||row.errors.length||row.requests.some(request=>request.status>=400)?'failed':'passed';
  } catch(error) {
    row.status='failed';row.blocker=error.message;
    if(browser)row.inputRequests=[...browser.inputRequests];
    if(browser){row.failureState=await browser.snap().catch(()=>null);row.failureScreenshot=await browser.shot(`${test.id}-blocked.png`).catch(()=>null);}
  } finally {await browser?.close();}
}
try {
  if(selected&&!cases.some(test=>test.id===selected))throw Error('Unknown case '+selected);
  report.selectedCases=cases.filter(test=>!selected||test.id===selected).map(test=>({id:test.id,title:test.title}));
  for(const test of cases.filter(test=>!selected||test.id===selected))await runCase(test);
} finally {
  await site.close();
  report.result=report.cases.length&&report.cases.length===report.selectedCases?.length&&report.cases.every(test=>test.status==='passed')?'passed':'failed';
  report.visualReview='pending: fonts, button style and actual furniture appearance require reviewing screenshots; config assertions alone are not visual acceptance';
  await writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');
  const md=['# 合肥主流程回归报告','',`- 结果：${report.result}`,`- 模式：${mode}`,`- 代码提交：${report.commit}`,`- 环境：${report.environment}`,'',report.scope,'','视觉审阅：待作者核对字号、按钮和家具外观；配置检查不代替视觉验收。',''];
  for(const row of report.cases){
    md.push(`## ${row.id}：${row.title}`,'',`状态：${row.status}`,'',`输入：${row.input}`,'');
    for(const step of row.steps)md.push(`### ${step.id}：${step.title}`,'',`结果：${step.status}；反馈：${step.feedback.join('、')}`,'',`状态：${step.state.state}；窗口实际可见：${step.state.conversationVisible}；hidden 属性：${step.state.conversationHiddenAttr}；焦点：${step.state.focus}；正文字号：${step.state.fontSize}px。`,'',`正文：${step.state.dialogue||'（无）'}`,'',`按钮：${step.state.buttons.map(b=>b.label||'继续箭头').join(' / ')||'（无）'}`,'',`![${step.title}](${step.screenshot})`,'');
    if(row.legacyActions.length)md.push('基线取证使用的旧操作（不代表新要求通过）：'+row.legacyActions.map(action=>action.action).join('、'),'');
    if(row.unavailableBranches?.length)md.push('当前版本缺失的分支：'+row.unavailableBranches.join('、'),'');
    if(row.blocker)md.push(`阻塞：${row.blocker}`,'',...(row.failureScreenshot?[`![阻塞截图](${row.failureScreenshot})`,'']:[]));
  }
  await writeFile(path.join(out,'report.md'),md.join('\n'));
  console.log('Report:',path.join(out,'report.md'));console.log('Result:',report.result);
}
process.exitCode=report.result==='passed'?0:1;
