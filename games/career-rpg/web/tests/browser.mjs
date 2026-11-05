// Desktop acceptance through Chrome DevTools Protocol; no npm dependencies.
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const keyboardAcceptance=process.argv.includes('--keyboard-acceptance');
const keyboardJourney=process.argv.includes('--keyboard-journey');
const dialogueReading=process.argv.includes('--dialogue-reading');
const fallback=process.argv.includes('--fallback');
const blogIsolation=process.argv.includes('--blog-isolation');
const lifecycle=process.argv.includes('--lifecycle');
if(lifecycle&&process.argv.some(a=>['--blog-isolation','--fallback','--keyboard-acceptance','--keyboard-journey','--dialogue-reading','--keyboard-only','--cold-move','--features-only','--walk-only','--marker-only','--restored-only'].includes(a)))throw Error('Lifecycle only repeats real chapter replay/document reload, without performance modes');
if(blogIsolation&&process.argv.some(a=>['--fallback','--keyboard-acceptance','--keyboard-journey','--dialogue-reading','--keyboard-only','--cold-move','--features-only','--walk-only','--marker-only','--restored-only'].includes(a)))throw Error('Blog isolation only visits two blog pages; do not combine game modes');
if(fallback&&process.argv.some(a=>['--keyboard-acceptance','--keyboard-journey','--dialogue-reading','--cold-move','--features-only','--walk-only','--marker-only','--restored-only'].includes(a)))throw Error('Fallback is a standalone fault and smoke check');
if(dialogueReading&&process.argv.some(a=>['--keyboard-acceptance','--keyboard-journey','--cold-move','--features-only','--walk-only','--marker-only','--restored-only'].includes(a)))throw Error('Dialogue reading is a standalone representative-path check');
if(keyboardJourney&&process.argv.some(a=>['--keyboard-acceptance','--cold-move','--features-only','--walk-only','--marker-only','--restored-only'].includes(a)))throw Error('Keyboard journey is a single standalone path; do not combine modes');
const root=new URL('../',import.meta.url),out=new URL(lifecycle?'../review/lifecycle/':blogIsolation?'../review/blog-isolation/':fallback?'../review/fallback/':dialogueReading?'../review/dialogue-reading/':keyboardJourney?'../review/keyboard-journey/':keyboardAcceptance?'../review/keyboard-acceptance/':'../review/',import.meta.url);
const keyboardOnly=process.argv.includes('--keyboard-only')||keyboardAcceptance||keyboardJourney||dialogueReading;
const evidenceLabel=process.argv.find(a=>a.startsWith('--evidence='))?.split('=')[1]||'after';
if(!/^[a-z0-9-]+$/.test(evidenceLabel))throw Error('Invalid evidence label');
await mkdir(out,{recursive:true});
const keyboardHarness=keyboardAcceptance||keyboardJourney||dialogueReading||fallback||blogIsolation||lifecycle?await import('./keyboard-scenarios.mjs'):null;
const journeyHarness=keyboardJourney?await import('./keyboard-journey.mjs'):null;
const readingHarness=dialogueReading?await import('./dialogue-reading.mjs'):null;
const fallbackHarness=fallback?await import('./fallback.mjs'):null;
const isolationHarness=blogIsolation?await import('./blog-isolation.mjs'):null;
const lifecycleHarness=lifecycle?await import('./lifecycle.mjs'):null;
const keyboardSite=keyboardHarness?await keyboardHarness.serveSite({repository:fallback||blogIsolation||lifecycle}):null;
const profile=await mkdtemp(path.join(os.tmpdir(),'career-web-chrome-'));
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--enable-unsafe-swiftshader','--hide-scrollbars','about:blank'],{stdio:['ignore','ignore','pipe']});
const port=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>{chrome.kill();keyboardSite?.server.close();reject(Error(`Chrome startup timeout: ${log.slice(-1000)}`));},15000);chrome.stderr.on('data',b=>{log+=b;const m=log.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);if(m){clearTimeout(timer);resolve(Number(m[1]));}});chrome.on('error',e=>{clearTimeout(timer);keyboardSite?.server.close();reject(e);});chrome.on('exit',code=>{clearTimeout(timer);keyboardSite?.server.close();reject(Error(`Chrome exit ${code}: ${log.slice(-1000)}`));});});
let ws;const checks={};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  const target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
  let id=0;const pending=new Map(),errors=[],responses=[],navigations=[],listeners=new Map();
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);for(const fn of listeners.get(m.method)||[])fn(m.params);});
  const on=(method,fn)=>{if(!listeners.has(method))listeners.set(method,new Set());listeners.get(method).add(fn);return()=>listeners.get(method).delete(fn);};
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);else if(keyboardJourney&&m.method==='Network.responseReceived')responses.push({id:m.params.requestId,url:m.params.response.url,status:m.params.response.status});else if(keyboardJourney&&m.method==='Page.frameNavigated'&&!m.params.frame.parentId)navigations.push(m.params.frame.url);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
  const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||'evaluation failed');return r.result.value;};
  const state=()=>run('window.careerPrototype?.snapshot()');
  const key=async(k,duration=0,modifiers=0)=>{const codes={ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,Escape:27,Enter:13,Tab:9,PageUp:33,PageDown:34,Home:36,End:35,' ':32};const code=k===' '?'Space':k.length===1?`Key${k.toUpperCase()}`:k,vk=codes[k]||k.toUpperCase().charCodeAt(0),params={key:k,code,windowsVirtualKeyCode:vk,modifiers};await send('Input.dispatchKeyEvent',{type:'keyDown',...params,...(k==='Enter'?{text:'\r',unmodifiedText:'\r'}:k===' '?{text:' ',unmodifiedText:' '}: {})});if(duration)await sleep(duration);await send('Input.dispatchKeyEvent',{type:'keyUp',...params});await sleep(70);};
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  const url=keyboardSite?.url||process.env.URL||'http://127.0.0.1:8765/games/career-rpg/web/';
  if(keyboardJourney){await send('Network.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:journeyHarness.instrumentation});}
  if(dialogueReading)await send('Page.addScriptToEvaluateOnNewDocument',{source:await readingHarness.fixtureScript()});
  if(process.argv.includes('--cold-move'))await send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const p=window.__coldProbe={frames:[],longTasks:[],label:'startup',keyAt:{},firstMoveAt:{}};const raf=window.requestAnimationFrame;let previous=0;window.requestAnimationFrame=cb=>raf.call(window,t=>{const begin=performance.now(),label=p.label;try{cb(t);}finally{const end=performance.now();p.frames.push({label,time:t,gap:previous?t-previous:0,cpu:end-begin});previous=t;if(p.keyAt[label]&&!p.firstMoveAt[label]&&window.careerPrototype?.snapshot().moving)p.firstMoveAt[label]=end;}});window.addEventListener('keydown',e=>{if(e.key.startsWith('Arrow')&&!p.keyAt[p.label])p.keyAt[p.label]=performance.now();},true);new PerformanceObserver(list=>{for(const e of list.getEntries())p.longTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});})()`});
  if(!fallback&&!blogIsolation&&!lifecycle)await send('Page.navigate',{url});
  const ready=async()=>{let s;for(let n=0;n<120;n++){await sleep(100);s=await state();if(s)return s;}await shot('chapter-startup-error.png');throw Error(await run('document.body.innerText'));};
  await mkdir(out,{recursive:true});
  const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(new URL(name,out),Buffer.from(r.data,'base64'));};
  if(lifecycle){
    await lifecycleHarness.runLifecycle({send,on,run,state,key,out,evidenceLabel,errors,url,profile});
  }else if(blogIsolation){
    await isolationHarness.runIsolation({send,on,run,out,evidenceLabel,errors,url,profile});
  }else if(fallback){
    await fallbackHarness.runFallback({send,on,run,state,key,shot,out,evidenceLabel,errors,url,profile});
  }else{
  await ready();
  const config=await run('(async()=> (await import("./scene-config.mjs")).OFFICE)()');
  const forum=config.objects.find(o=>o.id==='forum'),computer=config.objects.find(o=>o.id==='cto-pc'),shelf=config.objects.find(o=>o.id==='manual'),cto=config.actors.find(a=>a.id==='cto');
  const saved=()=>run('localStorage.getItem(window.careerPrototype.snapshot().saveKey)');
  let keyConfirmCount=0;
  const click=async selector=>{await sleep(210);assert.equal(await run(`!!document.querySelector(${JSON.stringify(selector)})`),true,selector);
    if(keyboardOnly){let found=false;for(let n=0;n<30;n++){found=await run(`document.activeElement?.matches(${JSON.stringify(selector)})`);if(found)break;await key('Tab');}assert.ok(found,`keyboard focus ${selector}`);await key('Tab',0,8);await key('Tab');assert.equal(await run(`document.activeElement?.matches(${JSON.stringify(selector)})`),true);await key(keyConfirmCount++%2?' ':'Enter');}
    else await run(`document.querySelector(${JSON.stringify(selector)}).click()`);await sleep(70);};
  const close=()=>click('#close-dialogue');
  const choose=event=>click(`[data-event="${event}"]`);
  const act=async event=>{await choose('view_'+event);await choose(event);};
  const reload=async()=>{await send('Page.reload',{ignoreCache:true});await sleep(150);return ready();};
  const open=async(id=null)=>{if(keyboardOnly)assert.equal(await run('document.activeElement.id'),'stage');else await run('document.querySelector("#stage").focus()');if(id){for(let n=0;n<5&&(await state()).active!==id;n++)await key('q');assert.equal((await state()).active,id);}await key('e');};
  const walk=async(x,y)=>{
    if(keyboardOnly)assert.equal(await run('document.activeElement.id'),'stage');else await run('document.querySelector("#stage").focus()');
    let p=(await state()).position;
    const transit=config.navigation.transitY;
    if(Math.abs(p.y-transit)>2)await key(p.y<transit?'ArrowDown':'ArrowUp',Math.abs(p.y-transit)/60*1000);
    p=(await state()).position;if(Math.abs(p.x-x)>2)await key(p.x<x?'ArrowRight':'ArrowLeft',Math.abs(p.x-x)/60*1000);
    p=(await state()).position;if(Math.abs(p.y-y)>2)await key(p.y<y?'ArrowDown':'ArrowUp',Math.abs(p.y-y)/60*1000);
  };
  if(dialogueReading){
    await readingHarness.runReading({send,run,state,key,reload,shot,out,evidenceLabel,errors,url});
  }else if(keyboardJourney){
    await journeyHarness.runJourney({send,run,state,key,walk,open,shot,config,errors,out,url,responses,navigations,profile});
  }else if(keyboardAcceptance){
    await keyboardHarness.runChecks({send,run,state,key,walk,open,reload,shot,config,checks,errors,out,evidenceLabel,port});
  }else if(process.argv.includes('--restored-only')){
    await run(`(async()=>{const d=await(await fetch('../design/chapter-01.json')).json();localStorage.setItem(d.savePolicy.key,JSON.stringify({schema:1,chapter:d.id,state:'restored',flags:d.legalSnapshots.restored[0]}));})()`);
    const restored=await reload();assert.equal(restored.chapter.state,'restored');
    const prose=await run('document.querySelector("#dialogue").textContent');
    assert.ok(prose.includes('整整两小时后，问题恢复了。'));assert.ok(!prose.includes('画面压暗'));
    await shot('chapter-restored.png');
    await writeFile(new URL('restored-copy-check.json',out),JSON.stringify({result:'passed',state:'restored',prose,stageDirectionHidden:true},null,2)+'\n');
    console.log('Restored prose and screenshot passed.');
  }else if(process.argv.includes('--cold-move')){
    const runs=[];
    for(let trial=0;trial<3;trial++){
      await run(`(async()=>{const d=await(await fetch('../design/chapter-01.json')).json();localStorage.setItem(d.savePolicy.key,JSON.stringify({schema:1,chapter:d.id,state:'office',flags:[]}));})()`);await reload();await close();
      await run('window.__coldProbe.label="cold"');await key('ArrowRight',1000);await run('window.__coldProbe.label="idle"');await sleep(700);
      await run('window.__coldProbe.label="warm"');await key('ArrowRight',1000);await run('window.__coldProbe.label="idle"');
      runs.push(await run('window.__coldProbe'));
    }
    const percentile=(list,p)=>[...list].sort((a,b)=>a-b)[Math.min(list.length-1,Math.floor(list.length*p))];
    const summarize=(run,label)=>{const frames=run.frames.filter(f=>f.label===label);return {frames:frames.length,maxGap:Math.max(...frames.map(f=>f.gap)),p95Gap:percentile(frames.map(f=>f.gap),.95),maxCPU:Math.max(...frames.map(f=>f.cpu)),p95CPU:percentile(frames.map(f=>f.cpu),.95),inputToFirstMove:run.firstMoveAt[label]-run.keyAt[label]};};
    const summary=runs.map(r=>({cold:summarize(r,'cold'),warm:summarize(r,'warm'),startupMaxCPU:Math.max(...r.frames.filter(f=>f.label==='startup').map(f=>f.cpu)),longTasks:r.longTasks}));
    const reproduced=summary.filter(r=>r.cold.maxCPU>Math.max(20,r.warm.maxCPU*2)||r.cold.maxGap>Math.max(40,r.warm.maxGap*1.5)||r.cold.inputToFirstMove>Math.max(50,r.warm.inputToFirstMove*2)).length>=2;
    await writeFile(new URL('cold-move-baseline.json',out),JSON.stringify({result:reproduced?'reproduced':'not-reproduced',method:'3 refreshes; first 1s rightward movement vs same-direction warm movement after700ms; real CDP input and RAF callback timings',environment:'Chrome headless1280x900/software WebGL; not the user machine result',threshold:'>=2/3 runs: cold CPU>max(20ms,2xwarm), or gap>max(40ms,1.5xwarm), or response>max(50ms,2xwarm)',summary,runs},null,2)+'\n');
    console.log(JSON.stringify({result:reproduced?'reproduced':'not-reproduced',summary}));if(reproduced)process.exitCode=1;
  }else if(process.argv.includes('--marker-only')){
    await run(`(async()=>{const d=await(await fetch('../design/chapter-01.json')).json();localStorage.setItem(d.savePolicy.key,JSON.stringify({schema:1,chapter:d.id,state:'office',flags:[]}));})()`);await reload();await close();
    const sample=()=>run(`(()=>{const e=document.querySelector('.task-marker[data-object="forum"]'),s=getComputedStyle(e),r=e.getBoundingClientRect();return {top:r.top,left:r.left,fontSize:s.fontSize,stroke:s.webkitTextStrokeWidth,animation:s.animationName,duration:s.animationDuration};})()`);
    const samples=[];for(let n=0;n<9;n++){samples.push(await sample());await sleep(150);}const range=Math.max(...samples.map(s=>s.top))-Math.min(...samples.map(s=>s.top));assert.ok(range>=4&&range<=6.5);assert.equal(samples[0].fontSize,'30px');assert.equal(samples[0].stroke,'2px');await shot('task-marker-visible.png');
    assert.equal(await run('document.querySelector(".actor-label[data-actor=colleague-dev]").textContent'),'费翔🐘');
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await sleep(100);const r1=await sample();await sleep(250);const r2=await sample();assert.equal(r1.animation,'none');assert.ok(Math.abs(r1.top-r2.top)<.1);
    await writeFile(new URL('task-marker-check.json',out),JSON.stringify({result:'passed',fontCSSPixels:30,strokeCSSPixels:2,animationPeriodSeconds:1.4,measuredVerticalRangeCSSPixels:range,reduceMotionStops:true,name:'费翔🐘',samples},null,2)+'\n');console.log('Marker visibility, float range, reduced motion and green colleague name passed.');
  }else if(process.argv.includes('--walk-only')){
    await run(`(async()=>{const d=await(await fetch('../design/chapter-01.json')).json();localStorage.setItem(d.savePolicy.key,JSON.stringify({schema:1,chapter:d.id,state:'office',flags:[]}));})()`);await reload();await close();
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    const samples=[];let previousFrame=-1,shots=0;
    for(let n=0;n<16;n++){
      await sleep(70);const value=await run('({time:performance.now(),state:window.careerPrototype.snapshot()})');samples.push(value);
      assert.equal(value.state.moving,true);assert.equal(value.state.facing,'right');
      const expected=[0,1,0,2][Math.floor(value.state.walkTime*4)%4];assert.equal(value.state.frames.player,9+expected);
      if(value.state.frames.player!==previousFrame&&shots<4){await shot(`walk-sample-${String(shots).padStart(2,'0')}.png`);shots++;previousFrame=value.state.frames.player;}
    }
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await sleep(40);const idle=await state();assert.equal(idle.moving,false);assert.equal(idle.frames.player,9);
    const first=samples[0].state.walkMetrics;for(const v of samples){assert.equal(v.state.walkMetrics.width,first.width);assert.equal(v.state.walkMetrics.height,first.height);assert.equal(v.state.walkMetrics.offset,first.offset);assert.equal(v.state.walkMetrics.reference.height,first.reference.height);}
    assert.deepEqual(errors,[]);await writeFile(new URL('walk-cadence-check.json',out),JSON.stringify({result:'passed',poseHz:4,stepsPerSecond:2,sequence:['idle','stepA','idle','stepB'],movementSpeed:60,stableScale:true,stableFootAnchor:true,releaseImmediatelyIdle:true,samples:samples.map(v=>({time:v.time,walkTime:v.state.walkTime,frame:v.state.frames.player,metrics:v.state.walkMetrics})),scope:'Targeted Chrome rightward movement and screenshot sequence; no full chapter rerun'},null,2)+'\n');console.log('Walking cadence, fixed scale, sole anchor and immediate idle passed.');
  }else if(process.argv.includes('--features-only')){
    const seed=async stateName=>{await run(`(async()=>{const d=await(await fetch('../design/chapter-01.json')).json();localStorage.setItem(d.savePolicy.key,JSON.stringify({schema:1,chapter:d.id,state:${JSON.stringify(stateName)},flags:d.legalSnapshots[${JSON.stringify(stateName)}][0]}));})()`);return reload();};
    const bubbleInside=async()=>{const r=await run(`(()=>{const a=document.querySelector('#conversation').getBoundingClientRect(),b=document.querySelector('#stage').getBoundingClientRect();return {a:{left:a.left,right:a.right,top:a.top,bottom:a.bottom},b:{left:b.left,right:b.right,top:b.top,bottom:b.bottom},modal:!!document.querySelector(':modal')};})()`);assert.equal(r.modal,false);assert.ok(r.a.left>=r.b.left&&r.a.right<=r.b.right&&r.a.top>=r.b.top&&r.a.bottom<=r.b.bottom);};
    await seed('office');await close();let snap=await state();assert.equal(snap.actors.filter(a=>a.id!=='player'&&a.posture==='seatedTyping').length,3);await shot('shared-office-work.png');checks.threePartnersWorking=true;
    const beforeFrames=snap.frames;let changedTyping=false;for(let n=0;n<8&&!changedTyping;n++){await sleep(100);snap=await state();changedTyping=Object.keys(beforeFrames).filter(id=>id!=='player').some(id=>snap.frames[id]!==beforeFrames[id]);}assert.ok(changedTyping);checks.typingHasTwoFrames=true;
    for(const [direction,k,row] of [['down','ArrowDown',0],['up','ArrowUp',1],['left','ArrowLeft',2],['right','ArrowRight',3]]){
      await run('document.querySelector("#stage").focus()');await send('Input.dispatchKeyEvent',{type:'keyDown',key:k,code:k});await sleep(260);snap=await state();assert.equal(snap.facing,direction);assert.equal(snap.moving,true);assert.equal(Math.floor(snap.frames.player/3),row);assert.ok(snap.frames.player%3>0);await shot(`shared-walk-${direction}.png`);await send('Input.dispatchKeyEvent',{type:'keyUp',key:k,code:k});await sleep(100);assert.equal((await state()).frames.player,row*3);
    }checks.fourDirectionsAnimatedAndIdle=true;
    await walk(forum.x,forum.y);const foot=(await state()).position;await open('forum');snap=await state();assert.equal(snap.actors.find(a=>a.id==='player').posture,'seatedTyping');assert.deepEqual(snap.position,foot);assert.ok(snap.markers.some(m=>m.events.includes('open_forum_post')));await bubbleInside();await shot('shared-player-typing.png');checks.playerComputerSeatedAndFootSafe=true;
    await act('open_forum_post');snap=await state();assert.ok(!snap.markers.some(m=>m.events.includes('open_forum_post')));assert.equal(await run('document.querySelector("#portrait").dataset.expression'),'tense');assert.equal(await run('document.querySelector(".emotion-badge").dataset.expression'),'tense');await bubbleInside();await shot('shared-tense.png');checks.acceptedMarkerAndTensePortrait=true;
    await choose('read_feedback');await close();await walk(cto.interaction.x,cto.interaction.y);const selected=(await state()).active;await key('q');assert.notEqual((await state()).active,selected);await key('q');assert.equal((await state()).active,selected);checks.qSwitchNearbyObjects=true;await open('cto');assert.equal(await run('document.querySelector("#conversation").dataset.actor'),'cto');assert.equal(await run('document.querySelector("#portrait").dataset.actor'),'cto');const ctoFrame=(await state()).frames.cto;await sleep(400);assert.equal((await state()).frames.cto,ctoFrame);await bubbleInside();await shot('shared-cto-bubble.png');await close();checks.ctoBubbleAndTypingPause=true;
    for(const id of ['colleague-dev','colleague-team']){const a=config.actors.find(a=>a.id===id),point=a.interaction||a;await walk(point.x,point.y);await open(id);assert.equal(await run('document.querySelector("#conversation").dataset.actor'),id);await bubbleInside();await close();}checks.bothCompanionsInteract=true;
    await seed('restored');assert.equal(await run('document.querySelector("#portrait").dataset.expression'),'happy');assert.equal(await run('document.querySelector(".emotion-badge").dataset.expression'),'happy');await bubbleInside();await shot('shared-happy.png');checks.happyPortraitAndHeadBadge=true;
    await seed('office');await close();assert.ok((await state()).markers.some(m=>m.events.includes('open_forum_post')));checks.replayMarkerReturns=true;
    assert.deepEqual(errors,[]);await writeFile(new URL('shared-features-checks.json',out),JSON.stringify({result:'passed',browser:'Chrome headless desktop1280x900/software WebGL',checks,scope:'Configurable actors, non-modal bubbles, task markers, emotion imagery and seated typing; no other-end or performance acceptance'},null,2)+'\n');console.log(JSON.stringify(checks));
  }else{
  await run('localStorage.removeItem(window.careerPrototype.snapshot().saveKey)');
  let s=await reload();assert.equal(s.chapter.state,'office');assert.equal(s.three,'180');assert.ok(s.bounds.width<1024);checks.realThreeAndTransparentBounds=true;
  await close();await shot('chapter-office.png');
  await walk(forum.x,forum.y);await open('forum');await act('open_forum_post');assert.equal((await state()).chapter.state,'report');
  const reportSave=await saved();s=await reload();assert.equal(s.chapter.state,'report');assert.equal(await saved(),reportSave);checks.refreshExactReport=true;
  await choose('read_feedback');assert.equal((await state()).chapter.state,'incident');await close();
  await walk(cto.interaction.x,cto.interaction.y);await open('cto');await act('cto_rallies_team');assert.equal((await state()).chapter.state,'investigation');await close();
  await open('cto-pc');await act('confirm_recheck_visited');await close();
  const investigationSave=await saved();s=await reload();assert.equal(await saved(),investigationSave);assert.ok(s.chapter.flags.includes('recheck_visited'));await close();checks.refreshExactInvestigation=true;
  await open('cto-pc');await click('[data-action="read-recheck_visited"]');assert.equal(await saved(),investigationSave);await close();checks.duplicateReadonlyNoSave=true;
  await open('cto-pc');await act('confirm_impact_scope');await close();
  await walk(forum.x,forum.y);await open('forum');await act('confirm_feedback_reviewed');await close();
  await walk(cto.interaction.x,cto.interaction.y);await open('cto');await act('resume_narrative');assert.equal((await state()).chapter.state,'restored');
  assert.ok(await run('document.querySelector("#dialogue").textContent.includes("两小时")'));await shot('chapter-restored.png');
  const restoredSave=await saved();await reload();assert.equal(await saved(),restoredSave);await choose('comfort_read');assert.equal((await state()).chapter.state,'learning');await close();
  const learningStart=await saved();
  await open('cto-pc');await act('review_test_plan');await close();
  const firstReview=await saved();await open('cto-pc');await click('[data-action="read-test_reviewed"]');assert.equal(await saved(),firstReview);await close();
  await open('cto-pc');await act('review_trap_comment');await close();
  await walk(shelf.x,shelf.y);await open('manual');await choose('write_manual_entry');assert.equal((await state()).chapter.state,'journey');await close();
  const journeyMap=config.objects.find(o=>o.id==='journey-map');await walk(journeyMap.x,journeyMap.y);await open('journey-map');await act('open_journey');
  for(let n=0;n<40&&!(await run('window.careerJourney?.().arrived'));n++)await sleep(200);
  await click('[data-action="journey-finish"]');assert.equal((await state()).chapter.state,'complete');await shot('chapter-complete.png');checks.completeFirstLearningOrder=true;
  const completedSave=await saved();s=await reload();assert.equal(s.chapter.state,'complete');assert.equal(await saved(),completedSave);await close();await click('#manual');assert.ok(await run('document.querySelector("#dialogue").textContent.includes("补测试")'));await close();checks.completeRefreshAndManual=true;
  // Reload the actual earlier legal checkpoint to exercise the other learning order in the browser.
  await run(`localStorage.setItem(window.careerPrototype.snapshot().saveKey,${JSON.stringify(learningStart)})`);await reload();await close();
  await open('cto-pc');await act('review_trap_comment');await close();await open('cto-pc');await act('review_test_plan');await close();await walk(shelf.x,shelf.y);await open('manual');await choose('write_manual_entry');assert.equal((await state()).chapter.state,'journey');await close();await walk(journeyMap.x,journeyMap.y);await open('journey-map');await act('open_journey');for(let n=0;n<40&&!(await run('window.careerJourney?.().arrived'));n++)await sleep(200);await click('[data-action="journey-finish"]');assert.equal((await state()).chapter.state,'complete');checks.secondLearningOrder=true;
  await close();await key('Escape');assert.equal((await state()).state,'paused');await key('Escape');assert.equal((await state()).state,'explore');checks.pauseAndResume=true;
  const before=(await state()).position;await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});await run('window.dispatchEvent(new Event("blur"))');assert.equal((await state()).state,'paused');const blurred=(await state()).position;await click('#resume');await sleep(250);assert.deepEqual((await state()).position,blurred);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});checks.blurHandlerClearsInput=true;
  await click('#manual');await click('[data-action="replay"]');await click('[data-action="confirm-replay"]');assert.equal((await state()).chapter.state,'office');checks.replay=true;
  await run('localStorage.setItem("unrelated-test-key","keep");localStorage.setItem(window.careerPrototype.snapshot().saveKey,"{broken")');await reload();assert.ok(await run('document.querySelector("#dialogue").textContent.includes("没有被覆盖")'));await click('[data-action="continue-unsaved"]');assert.equal((await state()).saving,false);assert.equal(await saved(),'{broken');await close();await walk(forum.x,forum.y);await open('forum');await act('open_forum_post');assert.equal((await state()).chapter.state,'report');assert.equal(await saved(),'{broken');checks.damagedSavePreservedAndPlayable=true;
  await reload();await click('[data-action="reset-save"]');assert.equal((await state()).chapter.state,'office');assert.equal(await run('localStorage.getItem("unrelated-test-key")'),'keep');checks.explicitResetOnlyOwnSave=true;
  await run('localStorage.setItem(window.careerPrototype.snapshot().saveKey,JSON.stringify({schema:0,state:"office"}))');await reload();assert.ok(await run('document.querySelector("#dialogue").textContent.includes("无法识别")'));await click('[data-action="reset-save"]');checks.oldSaveSafePrompt=true;
  // Leave this isolated Chrome profile at a legitimate office checkpoint.
  assert.deepEqual(errors,[]);checks.noUncaughtBrowserErrors=true;
  if(keyboardOnly){checks.tabAndShiftTabFocus=true;checks.enterAndSpaceConfirm=true;checks.allCoreActionsWithoutMouse=true;}
  await writeFile(new URL(keyboardOnly?'keyboard-checks.json':'chapter-checks.json',out),JSON.stringify({result:'passed',browser:'Chrome headless / desktop 1280x900 / software WebGL',checks,scope:'Desktop chapter flow; blur handler synthetic; no reading-duration, real-device or performance acceptance'},null,2)+'\n');
  console.log(JSON.stringify(checks));
  }
  }
}finally{ws?.close();chrome.kill();keyboardSite?.server.close();}
