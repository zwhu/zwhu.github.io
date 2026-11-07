// Confirmed Nanjing flow, actual furniture draws, optional branches and legacy UI migration.
// New playthroughs use real keyboard; legacy fixtures are explicitly separated below.
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {startBrowserSite,openBrowser,delay} from './playtest-browser.mjs';
import {OFFICE} from '../chapters/nanjing.mjs';
import {blocked} from '../engine/world.mjs';

const root=path.resolve(import.meta.dirname,'../../../..');
const arg=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
const out=arg('out')?path.resolve(arg('out')):await mkdtemp(path.join(os.tmpdir(),'nanjing-playtest-'));
const visualOnly=arg('case')==='visual';
if(out===root||out.startsWith(root+path.sep))throw Error('Store evidence outside Git');
await mkdir(out,{recursive:true});
try{await readFile(path.join(out,'result.json'));throw Error('Choose a new output directory');}catch(error){if(error.code!=='ENOENT')throw error;}
const report={commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),steps:[],environment:'Chrome desktop 1280x960; new main flows use real keys and fresh profiles. Only 18 explicitly labelled legacy migration cases seed obsolete saves.',
  hashes:Object.fromEntries(await Promise.all(['games/career-rpg/web/main.mjs','games/career-rpg/web/chapters/nanjing.mjs','games/career-rpg/design/chapter-01.json'].map(async file=>[file,createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')])))};
const definition=JSON.parse(await readFile(path.join(root,'games/career-rpg/design/chapter-01.json'),'utf8'));
const site=await startBrowserSite();let b;
async function capture(id,title,feedback,predicate){
  await delay(100);
  const state=await b.snap(),draws=await b.read('window.__nanjingDraws||[]');
  const passed=await predicate(state,draws),screenshot=await b.shot(id+'.png');
  report.steps.push({id,title,feedback,status:passed?'passed':'failed',state,draws,screenshot});console.log(passed?'PASSED':'FAILED',id,title);
  return passed;
}
async function explore(){
  for(let i=0;i<8;i++){if((await b.snap()).state==='explore')return;await b.key('Escape');if((await b.snap()).state!=='explore')await b.key('Enter');}
  throw Error('Cannot reach exploration');
}
async function walk(tx,ty){
  const initial=(await b.snap()).position,start=[Math.round(initial.x),Math.round(initial.y)],key=p=>p.join(','),queue=[start],prev=new Map([[key(start),null]]);
  const routing={...OFFICE,obstacles:OFFICE.obstacles.map(o=>({x:o.x-3,y:o.y-3,w:o.w+6,h:o.h+6}))};let end;
  for(let index=0;index<queue.length;index++){
    const p=queue[index];if(Math.hypot(p[0]-tx,p[1]-ty)<=5){end=p;break;}
    for(const next of [[p[0]+1,p[1]],[p[0]-1,p[1]],[p[0],p[1]+1],[p[0],p[1]-1]])if(!prev.has(key(next))&&!blocked(...next,routing)){prev.set(key(next),p);queue.push(next);}
  }
  if(!end)throw Error('No interaction route');
  const points=[];for(let p=end;p;p=prev.get(key(p)))points.push(p);points.reverse();
  const corners=points.filter((p,i)=>i===points.length-1||i>0&&(p[0]-points[i-1][0]!==points[i+1][0]-p[0]||p[1]-points[i-1][1]!==points[i+1][1]-p[1]));
  for(const [x,y] of corners)for(let i=0;i<100;i++){
    const s=await b.snap();if(s.state!=='explore')throw Error('Walking in '+s.state);
    const dx=x-s.position.x,dy=y-s.position.y;if(Math.max(Math.abs(dx),Math.abs(dy))<=1)break;
    const horizontal=Math.abs(dx)>=Math.abs(dy);
    await b.key(horizontal?(dx>0?'ArrowRight':'ArrowLeft'):(dy>0?'ArrowDown':'ArrowUp'),Math.max(40,Math.min(350,Math.abs(horizontal?dx:dy)/60*1000-35)));
    const after=await b.snap();if(Math.hypot(after.position.x-s.position.x,after.position.y-s.position.y)<1)throw Error('Walk blocked');
    if(i===99)throw Error('Walk timeout');
  }
}
async function object(id){
  for(let i=0;i<12&&(await b.snap()).active!==id;i++)await b.key('q');
  if((await b.snap()).active!==id)throw Error('Cannot select '+id);await b.key('e');
}
async function select(action){
  for(let i=0;i<20;i++){
    const options=(await b.snap()).buttons,target=options.find(option=>option.action===action);
    assert.ok(target,'Missing choice '+action);
    if(target.selected){await b.key('Enter');return;}
    await b.key('ArrowRight');
  }
  throw Error('Cannot select '+action);
}
async function open(id){
  const target=[...OFFICE.objects,...OFFICE.actors].find(o=>o.id===id);
  const point=target.interaction||target;await walk(point.x,point.y);await object(id);
}
async function pickup(id,skill){
  await explore();await open(id);
  await capture('award-'+skill,'可选技能 '+skill+' 与统一确定按钮',['N20'],s=>s.chapter.skills[skill]==='got'&&s.buttons.some(o=>o.action==='skill-ok'));
  await b.reload();
  await capture('award-'+skill+'-reload','刷新保留技能和获得页',['N20'],s=>s.chapter.skills[skill]==='got'&&s.buttons.some(o=>o.action==='skill-ok'));
  await b.key('r');await b.key('Escape');
  await capture('award-'+skill+'-replay-cancel','获得页取消重玩回到原确定按钮',['N20'],s=>s.buttons.some(o=>o.action==='skill-ok'));
  await b.key('Enter');assert.equal((await b.snap()).state,'explore');
}
async function remainingFlow(){
  await explore();
  if((await b.snap()).chapter.state==='office'){await open('forum');await b.key('Enter');await explore();}
  if((await b.snap()).chapter.state==='incident'){await open('cto');await explore();}
  if((await b.snap()).chapter.state==='investigation'){
    if(!(await b.snap()).chapter.flags.includes('impact_confirmed')||!(await b.snap()).chapter.flags.includes('feedback_reviewed')){
      await open('forum');await select('analyze_server_logs');await explore();
    }
    await open('cto');
  }
  if((await b.snap()).chapter.state==='restored')await select('comfort_read');
  if((await b.snap()).chapter.state==='journey'){
    if((await b.snap()).state==='explore')await b.key('m');
    await select('finish-nanjing');
  }
  assert.equal((await b.snap()).chapter.state,'complete');
}
try{
  b=await openBrowser(site.url+'?chapter=nanjing',out);
  await b.send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{window.__nanjingDraws=[];
    const fill=CanvasRenderingContext2D.prototype.fillRect,draw=CanvasRenderingContext2D.prototype.drawImage;
    const main=ctx=>ctx.canvas.parentElement?.id==='stage'&&!ctx.canvas.id;
    CanvasRenderingContext2D.prototype.fillRect=function(...args){if(main(this)&&args[2]>=300&&args[3]>=200)window.__nanjingDraws=[];return Reflect.apply(fill,this,args);};
    CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(main(this)&&window.__nanjingDraws.length<40)window.__nanjingDraws.push({src:image.currentSrc||image.src||'',args});return Reflect.apply(draw,this,[image,...args]);};})();`});
  await b.reload();
  await capture('opening','开场只保留目标条，不重复显示目标对话',['N04'],s=>s.state==='explore'&&!s.conversationVisible);
  await explore();
  await capture('chairs','三个坐姿 NPC 由椅背前景正确遮挡',['N01','N02'],(s,draws)=>{
    const people=draws.filter(d=>d.src.includes('typing-team-v1'));
    return people.length===3&&people.every(person=>draws.some((d,index)=>index>draws.indexOf(person)&&d.src.includes('office-room-v2')&&d.args.length===8&&Math.abs(d.args[4]+d.args[6]/2-(person.args[4]+person.args[6]/2))<8));
  });
  await open('colleague-dev');
  await capture('colleague-dev','费翔椅旁对话，不重叠人物',['N02'],s=>s.position.x===326&&s.actors.find(a=>a.id==='colleague-dev').posture==='seatedTyping');await explore();
  await open('colleague-team');
  await capture('colleague-team','下排同伴椅旁对话',['N02','N17'],s=>s.position.x===125&&s.dialogue.includes('别忘了安抚用户'));await explore();await b.key('ArrowRight',180);
  await walk(240,180);await b.key('ArrowRight',350);
  await capture('desk-left-side','从桌左侧接近显示器，不穿进桌面',['N03'],s=>s.position.x<=253);await b.key('ArrowLeft',240);
  await walk(350,180);await b.key('ArrowLeft',300);
  await capture('desk-right-side','从桌右侧接近显示器，不穿进桌面',['N03'],s=>s.position.x>=341);await b.key('ArrowRight',240);
  await walk(296,211);await b.key('ArrowUp',260);
  await capture('desk-front','从桌前接近椅子，不穿进工位',['N03'],s=>s.position.y>=205);await b.key('ArrowDown',240);
  await walk(296,140);await b.key('ArrowDown',260);
  await capture('desk-collision','站立角色不能走到右下工位的显示器上',['N03'],s=>s.position.y<=147);
  if(!visualOnly){
    await b.key('ArrowUp',240);
    await walk(82,127);await object('forum');
    await capture('forum-direct','电脑直接打开反馈，不先展示选择说明',['N04'],s=>s.dialogue==='论坛里，有用户说无法登录。这是我第一次面对真实的线上 C 端用户。'&&!s.dialogue.includes('选择一项'));
    await capture('player-seated','主角办公坐在自己的椅背内',['N01'],(s,draws)=>draws.some(d=>d.src.includes('sit-back'))&&draws.some(d=>d.src.includes('office-room-v2')&&d.args.length===8&&d.args[4]===69));
    const atForum=(await b.snap()).position;await b.key('ArrowLeft',150);
    await capture('dialogue-lock','对话方向键不移动角色',['N01'],s=>JSON.stringify(s.position)===JSON.stringify(atForum));
    await b.reload();await capture('forum-reload','论坛正文刷新可恢复',['N04'],s=>s.dialogue.includes('论坛里')&&s.buttons.some(o=>o.action==='open_forum_post'));
    await select('open_forum_post');
    await capture('reaction','只保留一次登录框反应',['N07'],s=>s.dialogue==='我盯着登录框不知所措，这时 CTO 把我叫了过去。');await explore();
    await pickup('forum','fibjs');
    await open('cto');
    await capture('cto-start','在 CTO 椅旁开始排查，无前置确认',['N01','N06','N09','N17'],s=>s.position.x===215&&s.dialogue.includes('在 CTO 排查的时候，我开始去查日志，看看今天有哪些用户出现问题。')&&s.dialogue.includes('先止血、保存现场、排查日志，同时安抚用户。')&&!s.buttons.some(o=>o.action==='cto_rallies_team'));
    await explore();await open('forum');
    await capture('server-logs','自己的电脑查询、分析系统日志',['N10','N11','N12'],s=>s.dialogue==='我在自己的电脑上查询、分析系统日志，查看今天出现登录问题的用户。'&&s.buttons.some(o=>o.action==='analyze_server_logs'));
    await b.key('Escape');
    await capture('logs-cancel','取消日志查询保留未完成状态',['N11'],s=>s.state==='explore'&&!s.chapter.flags.includes('impact_confirmed'));
    await open('forum');await select('analyze_server_logs');
    await capture('logs-complete','查询一次完成，无记录菜单或 3/3 对话',['N11','N12','N18'],s=>s.state==='explore'&&s.chapter.flags.includes('impact_confirmed')&&!s.task.includes('3/3')&&!s.conversationVisible);
    await b.reload();await capture('logs-reload','日志完成后刷新保持位置和进度',['N18'],s=>s.chapter.flags.includes('impact_confirmed')&&s.state==='explore');
    await open('cto');
    await capture('restored','回到 CTO 直接两小时后恢复',['N18','N19'],s=>s.dialogue==='整整两小时后，问题才恢复。CTO、老板、同事都过来安慰我，告诉我没关系，大家都经历过。');
    await select('comfort_read');
    await capture('recap','简短复盘，可完成或继续探索',['N13','N14','N15','N16','N21'],s=>s.dialogue==='后来，我们补了测试，也补了注释，说明这里为什么会踩坑。'&&s.buttons.some(o=>o.action==='finish-nanjing')&&!s.task.includes('0/2'));
    await explore();
    await capture('glints','技能闪点对应自己的显示器与书架',['N20'],async()=>{
      const pixels=await b.read(`(()=>{const c=document.querySelector('#skill-glints').getContext('2d');const count=(x,y,w,h)=>{let n=0;const p=c.getImageData(x,y,w,h).data;for(let i=3;i<p.length;i+=4)if(p[i])n++;return n;};return {monitor:count(70,51,24,24),shelf:count(345,31,24,24),oldAisle:count(218,108,24,24)};})()`);
      return pixels.monitor>0&&pixels.shelf>0&&pixels.oldAisle===0;
    });
    await pickup('forum','cicd');await pickup('forum','release');await pickup('manual','failure');
    await b.key('m');await capture('manual','手册收束和可选技能，不阻塞完成',['N21'],s=>s.dialogue.includes('先止血、保存现场、排查日志，别忘了安抚用户。')&&s.buttons.some(o=>o.action==='finish-nanjing'));
    await b.reload();await select('finish-nanjing');
    await capture('complete','南京完成，直接提供去杭州',['N21'],s=>s.chapter.state==='complete'&&Object.values(s.chapter.skills).every(v=>v==='got')&&s.buttons.some(o=>o.action==='bridge-hangzhou'));
    await b.key('r');await b.key('Escape');
    await capture('complete-replay-cancel','章末取消重玩保留成果',['N21'],s=>s.chapter.state==='complete'&&s.buttons.some(o=>o.action==='bridge-hangzhou'));
    await select('bridge-hangzhou');await b.until(s=>s.state==='journey');
    report.bridgeScreenshots=[await b.shot('bridge-start.png')];await delay(1700);report.bridgeScreenshots.push(await b.shot('bridge-middle.png'));
    for(let i=0;i<60&&!await b.read('window.careerJourney().arrived');i++)await delay(100);
    assert.ok(await b.read('window.careerJourney().arrived'));report.bridgeScreenshots.push(await b.shot('bridge-arrived.png'));
    // Journey buttons use the same direction/Enter handler, outside #choices.
    await b.key('Enter');await b.until(s=>s.saveKey==='career-rpg:hangzhou:v1',15000);
    await capture('hangzhou-entry','地图确认真正进入杭州并保留南京存档',['N21'],async s=>s.chapter.state==='arrive'&&await b.read(`JSON.parse(localStorage.getItem('career-rpg:nanjing:v1')).state==='complete'`));
    await b.key('Enter');await b.key('m');const hangzhouPage=await b.snap();
    await b.send('Page.navigate',{url:site.url+'?chapter=nanjing'});await b.until(s=>s.saveKey==='career-rpg:nanjing:v1',15000);
    if((await b.snap()).state==='explore')await b.key('m');
    await select('bridge-hangzhou');for(let i=0;i<60&&!await b.read('window.careerJourney().arrived');i++)await delay(100);
    await b.key('Enter');await b.until(s=>s.saveKey==='career-rpg:hangzhou:v1',15000);
    await capture('hangzhou-existing-save','再次进杭州恢复已有手册与位置',['N21'],s=>s.dialogue===hangzhouPage.dialogue&&s.chapter.state===hangzhouPage.chapter.state&&JSON.stringify(s.position)===JSON.stringify(hangzhouPage.position));
    report.mainErrors=[...b.errors];assert.deepEqual(b.errors,[]);await b.close();
    b=await openBrowser(site.url+'?chapter=nanjing',out);
    await remainingFlow();
    await capture('skip-skills','不收集技能也能直接完成南京',['N21'],s=>s.chapter.state==='complete'&&Object.values(s.chapter.skills).every(v=>v==='got'));
    await b.key('r');await b.key('Enter');
    await capture('replay-confirm','确认重玩回到办公室，无旧开场对白',['N04'],s=>s.chapter.state==='office'&&s.state==='explore'&&s.chapter.flags.length===0);
    await b.reload();await capture('replay-reload','重玩后的新开局可恢复',['N04'],s=>s.chapter.state==='office'&&s.state==='explore');
    // Explicit legacy fixtures: only this section seeds old snapshots and obsolete page metadata.
    let index=0;
    for(const [stage,sets] of Object.entries(definition.legalSnapshots))for(const flags of sets){
      const fixture={schema:1,chapter:definition.id,state:stage,flags,play:{version:1,state:'dialogue',position:{x:294,y:155},facing:'down',page:{title:'旧任务',paragraphs:['这轮排查先到这里，笔记本还有没记下的。'],choices:[{label:'过去看看',event:'view_confirm_recheck_visited',id:''}],selectedIndex:0,speaker:'player',canDismiss:true,system:false,objectId:'cto-pc'}}};
      const injected=await b.send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{localStorage.setItem('career-rpg:nanjing:v1',${JSON.stringify(JSON.stringify(fixture))});window.__legacyNanjing=${JSON.stringify(stage)};})()`});
      await b.reload();await b.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injected.identifier});
      await capture('legacy-'+(++index)+'-'+stage,'旧存档 '+stage+' 接续（显式夹具）',['N18','N21'],async s=>await b.read('window.__legacyNanjing')===stage&&s.chapter.state===({report:'incident',learning:'journey'}[stage]||stage)&&flags.every(f=>s.chapter.flags.includes(f))&&!s.dialogue.includes('笔记本')&&s.position.x===294&&s.position.y===147&&!s.buttons.some(o=>o.action.includes('confirm_recheck')));
      assert.equal(await b.read('window.__legacyNanjing'),stage);
      assert.equal((await b.snap()).chapter.state,({report:'incident',learning:'journey'}[stage]||stage));
      await b.key('ArrowUp',200);await remainingFlow();assert.equal((await b.snap()).chapter.state,'complete');
      await capture('legacy-'+index+'-complete','旧 '+stage+' 进度实际接续到章末（夹具）',['N21'],s=>s.chapter.state==='complete');
    }

  }
  report.errors=[...b.errors];assert.deepEqual(report.errors,[]);assert.ok(b.responses.every(r=>r.status<400));report.requests=[...b.responses];report.inputs=[...b.inputRequests];
}catch(error){report.error=error.stack;if(b){report.failure=await b.snap();report.failureScreenshot=await b.shot('failure.png');}console.error(error.message);}
finally{
  await b?.close();await site.close();report.result=!report.error&&report.steps.length&&report.steps.every(s=>s.status==='passed')?'passed':'failed';
  await writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');
  const md=['# 南京试玩反馈回归','',`版本：${report.commit}；结果：${report.result}`,'',report.environment,''];
  for(const s of report.steps)md.push(`## ${s.id}：${s.title}`,'',`${s.status} · ${s.feedback.join('、')}`,'',`正文：${s.state.dialogue}`,`按钮：${s.state.buttons.map(o=>o.label||o.action).join(' / ')}`,'',`![${s.title}](${s.screenshot})`,'');
  for(const shot of report.bridgeScreenshots||[])md.push('![南京到杭州]('+shot+')','');
  if(report.error)md.push(report.error,'');await writeFile(path.join(out,'report.md'),md.join('\n'));
  console.log('Report:',path.join(out,'report.md'));
}
process.exitCode=report.result==='passed'?0:1;
