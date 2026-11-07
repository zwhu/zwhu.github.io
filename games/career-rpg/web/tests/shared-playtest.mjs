// Verify the two other chapters after shared input, drawing and save changes.
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {startBrowserSite,openBrowser,delay} from './playtest-browser.mjs';
import {blocked} from '../engine/world.mjs';
import {OFFICE} from '../chapters/nanjing.mjs';
import {HANGZHOU} from '../chapters/hangzhou.mjs';

const root=path.resolve(import.meta.dirname,'../../../..');
const requested=process.argv.find(arg=>arg.startsWith('--out='))?.slice(6);
const out=requested?path.resolve(requested):await mkdtemp(path.join(os.tmpdir(),'career-rpg-shared-'));
if(out===root||out.startsWith(root+path.sep))throw Error('Store screenshots outside the repository');
await mkdir(out,{recursive:true});
try{await readFile(path.join(out,'result.json'));throw Error('Output already contains a report; choose a new directory');}catch(error){if(error.code!=='ENOENT')throw error;}
const site=await startBrowserSite(),report={commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  environment:'Chrome desktop 1280x960; fresh profiles, real keys, no seeded saves or DOM clicks',cases:[]};

function waypoints(position,target,config){
  // Keep key-release tolerance away from tight obstacle corners.
  const routing={...config,obstacles:config.obstacles.map(object=>({x:object.x-3,y:object.y-3,w:object.w+6,h:object.h+6}))};
  const start=[Math.round(position.x),Math.round(position.y)],key=point=>point.join(','),queue=[start],prev=new Map([[key(start),null]]);
  let found;
  for(let index=0;index<queue.length;index++){
    const point=queue[index];
    if(Math.hypot(point[0]-target.x,point[1]-target.y)<=8){found=point;break;}
    for(const next of [[point[0]+1,point[1]],[point[0]-1,point[1]],[point[0],point[1]+1],[point[0],point[1]-1]]){
      if(prev.has(key(next))||blocked(...next,routing))continue;
      prev.set(key(next),point);queue.push(next);
    }
  }
  assert.ok(found,'No walkable interaction route');
  const points=[];for(let point=found;point;point=prev.get(key(point)))points.push(point);
  points.reverse();
  return points.filter((point,index)=>index===points.length-1||index>0&&
    (point[0]-points[index-1][0]!==points[index+1][0]-point[0]||point[1]-points[index-1][1]!==points[index+1][1]-point[1]));
}

async function run(chapter,config,flow){
  const row={chapter,steps:[],status:'running'};report.cases.push(row);
  let b;
  try{
    b=await openBrowser(site.url+'?chapter='+chapter,out);
    const record=async label=>{
      const state=await b.snap(),screenshot=await b.shot(chapter+'-'+label+'.png');
      row.steps.push({label,state,screenshot});console.log('PASSED',chapter,label);
    };
    const select=async selector=>{
      for(let index=0;index<30;index++){
        const match=await b.read(`(()=>{const target=document.querySelector(${JSON.stringify(selector)});return {exists:!!target&&!!target.getClientRects().length,selected:target===document.activeElement};})()`);
        assert.ok(match.exists,'Missing active option '+selector);
        if(match.selected){await b.key('Enter');return;}
        await b.key('ArrowRight');
      }
      throw Error('Cannot select '+selector);
    };
    const settle=async()=>{
      for(let index=0;index<10;index++){
        const state=await b.snap();
        if(state.state==='explore'){assert.equal(state.conversationVisible,false);return;}
        await b.key('Escape');
        if((await b.snap()).state!=='explore')await b.key('Enter');
      }
      throw Error('Cannot return to exploration');
    };
    const open=async id=>{
      await settle();
      const object=[...config.objects,...config.actors].find(item=>item.id===id),target=object.interaction||object;
      for(const [x,y] of waypoints((await b.snap()).position,target,config)){
        for(let index=0;index<100;index++){
          const before=await b.snap(),dx=x-before.position.x,dy=y-before.position.y;
          if(Math.max(Math.abs(dx),Math.abs(dy))<=1)break;
          const horizontal=Math.abs(dx)>=Math.abs(dy),key=horizontal?(dx>0?'ArrowRight':'ArrowLeft'):(dy>0?'ArrowDown':'ArrowUp');
          await b.key(key,Math.max(40,Math.min(350,Math.abs(horizontal?dx:dy)/60*1000-35)));
          const after=await b.snap();
          assert.ok(Math.hypot(after.position.x-before.position.x,after.position.y-before.position.y)>=1,`Walk blocked at ${before.position.x},${before.position.y}; waypoint ${x},${y}`);
          if(index===99)throw Error('Walk timeout');
        }
      }
      for(let index=0;index<10&&(await b.snap()).active!==id;index++)await b.key('q');
      assert.equal((await b.snap()).active,id);await b.key('e');
    };
    const act=async(id,event)=>{
      await open(id);
      if(await b.read(`Boolean(document.querySelector('[data-event="view_${event}"]'))`))await select(`[data-event="view_${event}"]`);
      await select(`[data-event="${event}"]`);await record(event);
    };
    const pickup=async(id,skill)=>{
      await open(id);
      assert.equal((await b.snap()).chapter.skills[skill],'got');
      assert.match((await b.snap()).dialogue,/获得技能/);
      await record('award-'+skill);await b.key('Enter');await settle();
    };
    await b.key('Enter');await settle();await record('opening-close');
    await flow({b,record,select,settle,act,pickup});
    assert.equal((await b.snap()).chapter.state,'complete');
    const before=await b.snap();await b.reload();
    assert.deepEqual((await b.snap()).chapter.skills,before.chapter.skills);
    assert.equal((await b.snap()).chapter.state,'complete');await record('complete-reload');
    row.errors=[...b.errors];row.requests=[...b.responses];row.inputs=[...b.inputRequests];
    assert.deepEqual(row.errors,[]);assert.ok(row.requests.every(request=>request.status<400));
    row.status='passed';
  }catch(error){row.status='failed';row.error=error.stack;if(b){row.failure=await b.snap();row.screenshot=await b.shot(chapter+'-failure.png');}console.error(row.error);}
  finally{await b?.close();}
}

try{
  await run('nanjing',OFFICE,async({b,record,select,settle,act})=>{
    await act('forum','open_forum_post');await select('[data-event="read_feedback"]');await record('read-feedback');
    await act('cto','cto_rallies_team');
    await act('forum','confirm_feedback_reviewed');
    await act('cto-pc','confirm_recheck_visited');await act('cto-pc','confirm_impact_scope');
    await act('cto','resume_narrative');await select('[data-event="comfort_read"]');await record('comfort-read');
    await act('cto-pc','review_test_plan');await act('cto-pc','review_trap_comment');
    await act('manual','write_manual_entry');await act('journey-map','open_journey');
    for(let index=0;index<80&&!await b.read('window.careerJourney().arrived');index++)await delay(100);
    assert.ok(await b.read('window.careerJourney().arrived'));
    await select('[data-action="journey-finish"]');await record('journey-complete');
    await settle();await b.key('m');await record('manual-complete');
  });
  await run('hangzhou',HANGZHOU,async({b,record,select,settle,act,pickup})=>{
    await act('check-in','check_in');await act('publish','review_publish');await select('[data-event="to_night"]');
    await pickup('publish','publish');
    await act('patterns-book','study_patterns');await select('[data-event="to_plugins"]');await pickup('patterns-book','patterns');
    await act('webpack-screen','study_webpack');
    await act('webpack-screen','study_babel');await select('[data-event="to_sheets"]');
    await pickup('webpack-screen','webpack');await pickup('webpack-screen','babel');
    assert.equal((await b.snap()).boardLit,false);
    for(let index=1;index<=5;index++)await act('line-'+index,'read_line_'+index);
    assert.equal((await b.snap()).boardLit,true);await record('whiteboard-lit');
    await act('whiteboard','light_board');await pickup('whiteboard','forms');
    await act('exit','finish_chapter');await settle();await b.key('m');
    assert.ok(Object.values((await b.snap()).chapter.skills).every(status=>status==='got'));await record('manual-complete');
  });
}finally{
  await site.close();report.result=report.cases.every(row=>row.status==='passed')?'passed':'failed';
  await writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');
  const md=['# 南京与杭州共用逻辑回归','',`版本：${report.commit}；结果：${report.result}`,'',report.environment,''];
  for(const row of report.cases){md.push(`## ${row.chapter}`,'',`结果：${row.status}`,'');for(const step of row.steps)md.push(`### ${step.label}`,'',`剧情：${step.state.chapter.state}；窗口可见：${step.state.conversationVisible}`,'',`![${step.label}](${step.screenshot})`,'');if(row.error)md.push(row.error,'');}
  await writeFile(path.join(out,'report.md'),md.join('\n'));console.log('Report:',path.join(out,'report.md'));
}
process.exitCode=report.result==='passed'?0:1;
