// One fresh journey. Reads diagnostics and selects real UI options with CDP keys only.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

// Observers audit inputs and normal application saves; they do not advance or reset the story.
export const instrumentation=`(()=>{
  const evidence=window.__journeyEvidence={initialStorage:[],keys:[],pointers:[],storageWrites:[],storageDeletes:[]};
  for(let n=0;n<localStorage.length;n++){const key=localStorage.key(n);evidence.initialStorage.push({key,value:localStorage.getItem(key)});}
  for(const type of ['keydown','keyup'])window.addEventListener(type,e=>evidence.keys.push({type,key:e.key,repeat:e.repeat,trusted:e.isTrusted,focus:e.target.id||e.target.dataset?.event||e.target.dataset?.action||e.target.tagName,chapter:window.careerPrototype?.snapshot().chapter.state}),true);
  for(const type of ['pointerdown','mousedown','touchstart'])window.addEventListener(type,e=>evidence.pointers.push({type,trusted:e.isTrusted}),true);
  const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem,clear=Storage.prototype.clear;
  Storage.prototype.setItem=function(key,value){if(this===localStorage)evidence.storageWrites.push({key,value,stack:new Error().stack});return set.call(this,key,value);};
  Storage.prototype.removeItem=function(key){if(this===localStorage)evidence.storageDeletes.push({key});return remove.call(this,key);};
  Storage.prototype.clear=function(){if(this===localStorage)evidence.storageDeletes.push({clear:true});return clear.call(this);};
})();`;

export async function runJourney(ctx){
  const {send,run,state,key,walk,open,shot,config,errors,out,url,responses,navigations,profile}=ctx;
  const hashes={};for(const name of ['main.mjs','index.html','style.css'])hashes[name]=createHash('sha256').update(await readFile(new URL('../'+name,import.meta.url))).digest('hex');
  const result={status:'running',scene:'nanjing-office',stage:'keyboard-journey',command:'node games/career-rpg/web/tests/browser.mjs --keyboard-journey',workspace:fileURLToPath(new URL('../../../../',import.meta.url)),url,profile,hashes,steps:[],screenshots:[],scope:'One new game to complete; no reload, checkpoint seeding, mouse input or production state-changing function calls. Software WebGL technical evidence only.'};
  let operation='fresh-start',lastKey=0;
  const evidence=()=>run('window.__journeyEvidence');
  const focus=()=>run('document.activeElement.id||document.activeElement.dataset.event||document.activeElement.dataset.action');
  const select=async selector=>{
    for(let n=0;n<20;n++){
      if(await run(`document.activeElement.matches(${JSON.stringify(selector)})`))return;
      const direction=await run(`(()=>{const a=document.activeElement.getBoundingClientRect(),target=document.querySelector(${JSON.stringify(selector)});if(!target||target.disabled)throw Error('Missing/enabled option');const b=target.getBoundingClientRect(),dy=(b.top+b.bottom-a.top-a.bottom)/2;if(Math.abs(dy)>Math.min(a.height,b.height)/2)return dy>0?'ArrowDown':'ArrowUp';return b.left>a.left?'ArrowRight':'ArrowLeft';})()`);
      await key(direction);
    }
    throw Error('Cannot select by keyboard: '+selector);
  };
  const record=async label=>{
    const s=await state(),e=await evidence();
    result.steps.push({step:result.steps.length+1,label,chapter:s.chapter.state,flags:s.chapter.flags,ui:s.state,position:s.position,focus:await focus(),keyEventRange:[lastKey,e.keys.length],keys:e.keys.slice(lastKey).map(k=>`${k.type}:${k.key}`),saved:JSON.parse(await run('localStorage.getItem(window.careerPrototype.snapshot().saveKey)'))});
    lastKey=e.keys.length;await writeFile(new URL('steps.json',out),JSON.stringify(result.steps,null,2)+'\n');
  };
  const confirm=async(event,expectedState,flag=null)=>{
    operation=event;await select(`[data-event="${event}"]`);await key('Enter');
    const s=await state();assert.equal(s.chapter.state,expectedState,event);if(flag)assert.ok(s.chapter.flags.includes(flag),flag);await record(event);
  };
  const act=async(event,expectedState,flag=null)=>{await confirm('view_'+event,(await state()).chapter.state);await confirm(event,expectedState,flag);};
  const close=async()=>{await key('Escape');assert.equal((await state()).state,'explore');assert.equal(await focus(),'stage');};
  const capture=async(name,kind)=>{await shot(name);result.screenshots.push({file:name,kind,chapter:(await state()).chapter.state,viewport:{width:1280,height:900,dpr:1},hashes});};
  try{
    assert.deepEqual((await evidence()).initialStorage,[],'New isolated profile must start empty; no storage reset/seed is needed');
    const loaded={};
    for(const name of ['main.mjs','index.html','style.css']){
      const resourceURL=new URL(name==='index.html'?'./':name,url).href;
      const response=responses.find(r=>r.url===resourceURL);assert.ok(response,'Missing current-workspace response: '+resourceURL);assert.equal(response.status,200);
      const body=await send('Network.getResponseBody',{requestId:response.id});
      const actual=createHash('sha256').update(Buffer.from(body.body,body.base64Encoded?'base64':'utf8')).digest('hex');assert.equal(actual,hashes[name],name+' loaded bytes do not match current workspace');loaded[name]={url:resourceURL,sha256:actual};
    }
    result.loaded_resources=loaded;result.browser=await send('Browser.getVersion');
    assert.equal((await state()).chapter.state,'office');await record('new-game-office');
    await key('Enter');assert.equal((await state()).state,'explore');await record('enter-office');
    const forum=config.objects.find(o=>o.id==='forum'),computer=config.objects.find(o=>o.id==='cto-pc'),shelf=config.objects.find(o=>o.id==='manual'),cto=config.actors.find(a=>a.id==='cto');

    operation='walk-to-forum';await walk(forum.x,forum.y);await open('forum');await record(operation);
    assert.equal((await state()).actors.find(a=>a.id==='player').posture,'seatedTyping');await capture('player-seated.png','主角在论坛工位坐姿');
    // Native Tab/Shift+Tab remains usable while reading this first page.
    await key('Tab');await key('Tab',0,8);
    await act('open_forum_post','report');
    assert.equal(await run('document.querySelector("#portrait").dataset.expression'),'tense');await capture('player-tense.png','论坛反馈后的紧张');
    await confirm('read_feedback','incident');await close();

    operation='walk-to-cto';await walk(cto.interaction.x,cto.interaction.y);await open('cto');await record(operation);
    assert.equal(await run('document.querySelector("#conversation").dataset.actor'),'cto');await capture('cto-bubble.png','CTO头部气泡');
    await act('cto_rallies_team','investigation');await close();

    operation='revisit-feedback';await walk(forum.x,forum.y);await open('forum');await act('confirm_feedback_reviewed','investigation','feedback_reviewed');await close();
    operation='investigation-record';await walk(computer.x,computer.y);await open('cto-pc');await act('confirm_recheck_visited','investigation','recheck_visited');await close();
    operation='impact-confirmation';await open('cto-pc');await act('confirm_impact_scope','investigation','impact_confirmed');await close();

    operation='return-to-cto';await open('cto');await act('resume_narrative','restored');
    assert.equal(await run('document.querySelector("#portrait").dataset.expression'),'happy');await capture('player-happy.png','两小时后恢复与团队安慰');
    await confirm('comfort_read','learning');await close();

    operation='test-learning';await open('cto-pc');await act('review_test_plan','learning','test_reviewed');await close();
    operation='comment-learning';await open('cto-pc');await act('review_trap_comment','learning','comment_reviewed');await close();
    operation='write-manual';await walk(shelf.x,shelf.y);await open('manual');await confirm('write_manual_entry','complete');
    await capture('chapter-complete.png','手册归档与南京完成');

    operation='audit-continuity';const e=await evidence(),s=await state();
    const statePath=result.steps.map(step=>step.chapter).filter((v,i,a)=>i===0||v!==a[i-1]);
    assert.deepEqual(statePath,['office','report','incident','investigation','restored','learning','complete']);
    assert.equal(s.chapter.state,'complete');assert.deepEqual(e.pointers,[]);assert.ok(e.keys.length>0);assert.ok(e.keys.every(k=>k.trusted));assert.deepEqual(e.storageDeletes,[]);
    assert.ok(e.storageWrites.every(w=>w.key===s.saveKey&&w.stack.includes('/web/story.mjs')),'Unexpected manual storage write or checkpoint seeding');
    const saveStates=e.storageWrites.map(w=>JSON.parse(w.value).state);
    assert.deepEqual(saveStates,['office','report','incident','investigation','investigation','investigation','investigation','restored','learning','learning','learning','complete']);
    assert.deepEqual(navigations,[url],'Journey must have one navigation and no reload/checkpoint jump');assert.deepEqual(errors,[]);
    result.status='passed';result.state_path=statePath;result.final=s.chapter;result.input={trusted_key_events:e.keys.length,pointer_inputs:e.pointers.length};result.continuity={fresh_profile:true,navigations,storage_writes:e.storageWrites.length,manual_storage_changes:0,checkpoint_seeding:0,production_saves_only:true};
    await writeFile(new URL('input-and-storage.json',out),JSON.stringify(e,null,2)+'\n');
    console.log(JSON.stringify({result:result.status,states:statePath,steps:result.steps.length,keys:e.keys.length,pointers:e.pointers.length,main_sha256:hashes['main.mjs']}));
  }catch(error){result.status='failed';result.operation=operation;result.error=error.stack;result.failureState=await state();result.failureEvidence=await evidence();await shot('journey-failure.png');throw error;}
  finally{await writeFile(new URL('summary.json',out),JSON.stringify(result,null,2)+'\n');}
}
