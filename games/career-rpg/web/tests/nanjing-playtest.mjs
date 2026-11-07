// Diagnostic draft for author feedback; final narrative gates await flow review.
// Actual keyboard and observed draw order; this does not mutate the story.
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
const report={commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),steps:[],environment:'Chrome desktop 1280x960, real keyboard, no story jumps or seeded saves',
  hashes:Object.fromEntries(await Promise.all(['games/career-rpg/web/main.mjs','games/career-rpg/web/chapters/nanjing.mjs','games/career-rpg/design/chapter-01.json'].map(async file=>[file,createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')])))};
const site=await startBrowserSite();let b;
async function capture(id,title,feedback,predicate){
  const state=await b.snap(),draws=await b.read('window.__nanjingDraws||[]');
  const passed=await predicate(state,draws),screenshot=await b.shot(id+'.png');
  report.steps.push({id,title,feedback,status:passed?'passed':'failed',state,draws,screenshot});console.log(passed?'PASSED':'FAILED',id,title);
  return passed;
}
async function explore(){
  for(let i=0;i<8;i++){if((await b.snap()).state==='explore')return;await b.key('Enter');}
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
try{
  b=await openBrowser(site.url+'?chapter=nanjing',out);
  await b.send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__nanjingDraws=[];
    const fill=CanvasRenderingContext2D.prototype.fillRect,draw=CanvasRenderingContext2D.prototype.drawImage;
    const main=ctx=>ctx.canvas.parentElement?.id==='stage'&&!ctx.canvas.id;
    CanvasRenderingContext2D.prototype.fillRect=function(...args){if(main(this)&&args[2]>=300&&args[3]>=200)window.__nanjingDraws=[];return Reflect.apply(fill,this,args);};
    CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(main(this)&&window.__nanjingDraws.length<40)window.__nanjingDraws.push({src:image.currentSrc||image.src||'',args});return Reflect.apply(draw,this,[image,...args]);};`});
  await b.reload();
  await capture('opening','开场只保留目标条，不重复显示目标对话',['N04'],s=>s.state==='explore'&&!s.conversationVisible);
  await explore();
  await capture('chairs','三个坐姿 NPC 由椅背前景正确遮挡',['N01','N02'],(s,draws)=>{
    const people=draws.filter(d=>d.src.includes('typing-team-v1'));
    return people.length===3&&people.every(person=>draws.some((d,index)=>index>draws.indexOf(person)&&d.src.includes('office-room-v2')&&d.args.length===8&&Math.abs(d.args[4]+d.args[6]/2-(person.args[4]+person.args[6]/2))<8));
  });
  await walk(296,140);await b.key('ArrowDown',260);
  await capture('desk-collision','站立角色不能走到右下工位的显示器上',['N03'],s=>s.position.y<=147);
  if(!visualOnly){
    await walk(82,127);await object('forum');
    await capture('forum-direct','电脑直接打开反馈，不先展示选择说明',['N04'],s=>s.dialogue.includes('论坛里')&&!s.dialogue.includes('选择一项'));
  }
  report.errors=[...b.errors];report.requests=[...b.responses];report.inputs=[...b.inputRequests];
}catch(error){report.error=error.stack;if(b){report.failure=await b.snap();report.failureScreenshot=await b.shot('failure.png');}console.error(error.message);}
finally{
  await b?.close();await site.close();report.result=!report.error&&report.steps.length&&report.steps.every(s=>s.status==='passed')?'passed':'failed';
  await writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');
  const md=['# 南京试玩反馈回归','',`版本：${report.commit}；结果：${report.result}`,'',report.environment,''];
  for(const s of report.steps)md.push(`## ${s.id}：${s.title}`,'',`${s.status} · ${s.feedback.join('、')}`,'',`正文：${s.state.dialogue}`,'',`![${s.title}](${s.screenshot})`,'');
  if(report.error)md.push(report.error,'');await writeFile(path.join(out,'report.md'),md.join('\n'));
  console.log('Report:',path.join(out,'report.md'));
}
process.exitCode=report.result==='passed'?0:1;
