// Bounded candidate only: one observation/shaping validation, then three cold profiles.
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {serveCandidate} from './cold-start-fixture.mjs';
const label=process.argv.find(a=>a.startsWith('--evidence='))?.slice(11)||'worker';
assert.match(label,/^[a-z0-9-]+$/);
const out=fileURLToPath(new URL(`../review/resource-budget/cold-start-candidate/${label}/`,import.meta.url));
const temp='/private/tmp/traex-career-rpg-supervisor/cold-start-candidate';
await mkdir(out,{recursive:true});await mkdir(temp,{recursive:true});
const json=(file,value)=>writeFile(path.join(out,file),JSON.stringify(value,null,2)+'\n');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const hash=data=>createHash('sha256').update(data).digest('hex');
const manifest=JSON.parse(await readFile(new URL('../review/resource-budget/manifest.json',import.meta.url)));
const baseline=[];
for(const row of manifest.resources){const data=await readFile(row.file);assert.equal(hash(data),row.sha256,row.file);baseline.push({file:row.file,sha256:row.sha256,rawBytes:data.length});}
const instrumentation=`(()=>{
  const evidence=window.__coldEvidence={initialStorage:[],keys:[],pointers:[]};
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);evidence.initialStorage.push({key:k,value:localStorage.getItem(k)});}}catch(e){evidence.storageError=String(e);}
  for(const type of ['keydown','keyup'])addEventListener(type,e=>evidence.keys.push({type,key:e.key,trusted:e.isTrusted,repeat:e.repeat,time:performance.now(),focus:document.activeElement.id||document.activeElement.tagName}),true);
  for(const type of ['pointerdown','mousedown','touchstart'])addEventListener(type,e=>evidence.pointers.push({type,trusted:e.isTrusted,time:performance.now()}),true);
})()`;
const observe=`(()=>{
  const s=window.careerPrototype?.snapshot(),stage=document.querySelector('#stage'),canvas=stage?.querySelector('canvas[aria-hidden="true"]');
  const rect=canvas?.getBoundingClientRect();
  return {now:performance.now(),timeOrigin:performance.timeOrigin,navigation:performance.getEntriesByType('navigation')[0]?.toJSON(),
    position:s?.position,state:s?.state,chapter:s?.chapter,focus:document.activeElement.id||document.activeElement.tagName,
    loading:!!document.querySelector('#loading'),failure:document.querySelector('#game-failure')?.hidden===false,
    visibleScene:!!rect&&rect.width>0&&rect.height>0&&getComputedStyle(canvas).visibility==='visible',
    speaker:document.querySelector('#speaker')?.textContent,saveKey:s?.saveKey,
    summary:document.querySelector('#chapter-summary')?.textContent,blogLink:document.querySelector('#back-blog')?.href};
})()`;
async function browser(){
  const profile=await mkdtemp(path.join(temp,'profile-'));
  const args=['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--enable-unsafe-swiftshader','--hide-scrollbars','--no-first-run','--no-default-browser-check','--disable-background-networking','about:blank'];
  const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args,{stdio:['ignore','ignore','pipe']});
  let log='';chrome.stderr.on('data',b=>{log=(log+b).slice(-12000);});
  const port=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{chrome.kill();reject(Error(`Chrome startup timeout: ${log.slice(-1500)}`));},15000);
    chrome.stderr.on('data',()=>{const m=log.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);if(m){clearTimeout(timer);resolve(Number(m[1]));}});
    chrome.on('error',e=>{clearTimeout(timer);reject(e);});chrome.on('exit',code=>{clearTimeout(timer);reject(Error(`Chrome exit ${code}: ${log.slice(-1500)}`));});
  });
  const target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
  const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
  let id=0;const pending=new Map(),events=[],requests=[],byId=new Map(),errors=[];
  ws.addEventListener('message',e=>{
    const m=JSON.parse(e.data);
    if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}return;}
    const p=m.params;
    if(m.method==='Runtime.exceptionThrown')errors.push(p.exceptionDetails);
    if(m.method==='Network.requestWillBeSent'){const row={id:p.requestId,url:p.request.url,type:p.type,method:p.request.method,requestTimestamp:p.timestamp,wallTime:p.wallTime,initiator:p.initiator,redirect:p.redirectResponse};requests.push(row);byId.set(p.requestId,row);}
    if(m.method==='Network.responseReceived'){const row=byId.get(p.requestId);if(row)row.response={status:p.response.status,mime:p.response.mimeType,headers:p.response.headers,fromDiskCache:p.response.fromDiskCache,fromServiceWorker:p.response.fromServiceWorker,fromPrefetchCache:p.response.fromPrefetchCache,timing:p.response.timing,protocol:p.response.protocol};}
    if(m.method==='Network.requestServedFromCache'&&byId.has(p.requestId))byId.get(p.requestId).servedFromCache=true;
    if(m.method==='Network.dataReceived')events.push({method:m.method,...p});
    if(m.method==='Network.loadingFinished'&&byId.has(p.requestId))Object.assign(byId.get(p.requestId),{finishedTimestamp:p.timestamp,cdpEncodedDataLength:p.encodedDataLength});
    if(m.method==='Network.loadingFailed'&&byId.has(p.requestId))byId.get(p.requestId).failure=p;
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error(`CDP timeout ${method}`));},7000);
    pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));
  });
  const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  const keyEvent=(key,type)=>send('Input.dispatchKeyEvent',{type,key,code:key.length===1?`Key${key.toUpperCase()}`:key,windowsVirtualKeyCode:{Tab:9,Enter:13,ArrowRight:39,Escape:27,m:77}[key],...(type==='keyDown'&&key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});
  const key=async k=>{await keyEvent(k,'keyDown');await keyEvent(k,'keyUp');await sleep(220);};
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
  await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBypassServiceWorker',{bypass:true});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:instrumentation});
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.bringToFront');
  const stop=async()=>{ws.close();chrome.kill('SIGTERM');await writeFile(path.join(profile,'candidate-chrome-stderr.log'),log);};
  return {profile,args,send,run,key,keyEvent,requests,events,errors,stop};
}
function auditShaping(site){
  for(const req of site.requests)assert.ok(req.headersAt-req.arrived>=149.9,`latency:${req.url}`);
  for(const c of site.chunks){const period=site.periods[c.period];assert.ok(c.cumulative<=125000*(c.at-period.start)/1000+1,'aggregate cap exceeded');}
  return {requests:site.requests.length,chunks:site.chunks.length,busyPeriods:site.periods.length,latencyMinimumMs:Math.min(...site.requests.map(r=>r.headersAt-r.arrived)),aggregateCapVerified:true,granularityBytes:4096,headersNotShaped:true};
}
async function capture(b,name){const r=await b.send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(r.data,'base64'));return name;}
async function exercise(b,site,name){
  const record={name,profile:b.profile,status:'incomplete',steps:[],screenshots:[],limitSeconds:60,inputs:'trusted CDP keyboard only; no focus/state/save mutation'};
  const start=performance.now(),requestStart=b.requests.length,eventStart=b.events.length,errorStart=b.errors.length;
  try{
    const nav=await b.send('Page.navigate',{url:site.url});assert.ok(!nav.errorText,nav.errorText);
    let ready;
    while(performance.now()-start<59500){
      try{const s=await b.run(observe);if(s.failure)throw Error('production fallback displayed');if(s.chapter&&s.state==='dialogue'&&!s.loading){ready=s;break;}}catch(e){if(!/context|document|navigation|Cannot read/i.test(String(e)))throw e;}
      await sleep(200);
    }
    assert.ok(ready,'60-second limit: no keyboard-ready introduction observed');
    assert.equal(ready.chapter.state,'office');assert.equal(ready.focus,'close-dialogue');
    const initial=await b.run('window.__coldEvidence.initialStorage');assert.deepEqual(initial,[],'profile not cold/fresh');
    record.steps.push({operation:'intro-ready',observation:ready});
    await sleep(220);await b.key('Enter');
    const before=await b.run(observe);assert.equal(before.state,'explore');assert.equal(before.focus,'stage');
    record.steps.push({operation:'Enter/release',observation:before});
    await b.keyEvent('ArrowRight','keyDown');
    let moved;
    try{await sleep(120);moved=await b.run(observe);}finally{await b.keyEvent('ArrowRight','keyUp');}
    assert.ok(Math.hypot(moved.position.x-before.position.x,moved.position.y-before.position.y)>=1,'trusted direction did not move >=1 logical pixel');
    assert.equal(moved.state,'explore');assert.equal(moved.focus,'stage');assert.equal(moved.visibleScene,true);
    record.t0=moved.navigation.startTime;record.t1=moved.now;record.timeOrigin=moved.timeOrigin;record.elapsedSeconds=(record.t1-record.t0)/1000;
    assert.ok(record.elapsedSeconds<=60,'operability occurred after60s bound');
    record.steps.push({operation:'trusted movement first observation; then release',observation:moved});
    await sleep(220);const settled=await b.run(observe);
    await b.key('m');const manual=await b.run(observe);assert.equal(manual.state,'dialogue');assert.equal(manual.speaker,'工作手册');assert.deepEqual(manual.position,settled.position);
    record.steps.push({operation:'M',observation:manual});
    await b.key('Escape');const returned=await b.run(observe);assert.equal(returned.state,'explore');assert.equal(returned.focus,'stage');assert.deepEqual(returned.position,settled.position);
    record.steps.push({operation:'Esc',observation:returned});
    record.screenshots.push(await capture(b,`${name}-operable.png`));
    const graphics=await b.run(`(()=>{const c=document.querySelector('#stage canvas[aria-hidden="true"]'),g=c.getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return {version:g.getParameter(g.VERSION),renderer:g.getParameter(e?e.UNMASKED_RENDERER_WEBGL:g.RENDERER)};})()`);
    record.graphics=graphics;record.status='success';record.candidateWithin40Seconds=record.elapsedSeconds<=40;
  }catch(e){record.status='failed';record.failure=String(e);try{record.lastObservation=await b.run(observe);record.screenshots.push(await capture(b,`${name}-failure.png`));}catch(x){record.captureFailure=String(x);}}
  try{
    record.input=await b.run('window.__coldEvidence');
    assert.equal(record.input.pointers.length,0);assert.ok(record.input.keys.every(k=>k.trusted&&!k.repeat));
    record.resourceTimings=await b.run('performance.getEntriesByType("resource").map(x=>x.toJSON())');
  }catch(e){record.status='failed';record.observationFailure=String(e);}
  record.requests=b.requests.slice(requestStart);record.networkData=b.events.slice(eventStart);record.runtimeExceptions=b.errors.slice(errorStart);
  if(record.runtimeExceptions.length){record.status='failed';record.failure='Runtime exceptions recorded';}
  record.wallBoundSeconds=(performance.now()-start)/1000;
  const production=site.requests.filter(r=>r.kind==='production');
  record.fixtureBodyBytes=production.reduce((n,r)=>n+r.bodyBytes,0);
  record.fixtureRuntimeResources=production.length;
  await json(`${name}.json`,record);
  console.log(JSON.stringify({trial:name,status:record.status,seconds:record.elapsedSeconds||null,failure:record.failure||record.observationFailure||null}));
  return record;
}
const summary={stage:'original-art-cold-start-candidate',status:'working',command:`node games/career-rpg/web/tests/cold-start-candidate.mjs --evidence=${label}`,productionHashes:baseline,environment:'isolated Chrome1280x900; software WebGL if reported; controlled local HTTP, not hardware/deployment acceptance',trials:[],productionChanged:false,thresholdsChanged:false,originalBudget:'failed unchanged;512KiB/2MiB/8s',candidateSeconds:40,scene_accepted:false,next_scene_authorized:false,walking_stutter:'unresolved author-paused',full_journey_goal:'paused'};
const progress=async(status,completed,next)=>writeFile('/private/tmp/traex-career-rpg-supervisor/worker-progress.json',JSON.stringify({status,scene:'nanjing-office',stage:'original-art-cold-start-candidate',completed,next,checks:{productionChanged:false,budget:'failed unchanged',candidate40:'not threshold approval'},evidence:[path.relative(process.cwd(),path.join(out,'summary.json'))],blockers:[],scene_accepted:false,next_scene_authorized:false},null,2)+'\n');
let currentSite,currentBrowser;
try{
  await progress('working',['Test-only shared125000B/s transport implemented; noCDP shaping'],['One validation; if reliable then exactly3 cold profiles']);
  currentSite=await serveCandidate();currentBrowser=await browser();summary.browserVersion=await currentBrowser.send('Browser.getVersion');summary.transport=currentSite.settings;
  await currentBrowser.send('Page.navigate',{url:currentSite.url+'?budget-calibration=1'});
  const probe=await currentBrowser.run('window.probe');assert.deepEqual(probe,[{bytes:131072,status:200},{bytes:131072,status:200}]);
  await currentBrowser.key('Tab');assert.equal(await currentBrowser.run('document.activeElement.id'),'confirm');await currentBrowser.key('Enter');assert.equal(await currentBrowser.run('window.calibration.confirmed'),true);
  const parallel=currentSite.requests.filter(r=>r.kind==='parallel-calibration');
  const duration=(Math.max(...parallel.map(r=>r.completed))-Math.min(...parallel.map(r=>r.headersAt)))/1000;
  assert.ok(duration>=262144/125000-0.01&&duration<262144/125000+0.5,'parallel aggregate probe outside reliable range');
  const keys=await currentBrowser.run('window.__coldEvidence');assert.ok(keys.keys.length===4&&keys.keys.every(k=>k.trusted));assert.equal(keys.pointers.length,0);
  const validation=await exercise(currentBrowser,currentSite,'chain-validation');assert.equal(validation.status,'success',validation.failure||validation.observationFailure);
  summary.validation={status:'passed',parallelBodyBytes:262144,parallelSeconds:duration,input:keys,gameEvidence:'chain-validation.json',shaping:auditShaping(currentSite)};
  await json('chain-transport.json',{settings:currentSite.settings,requests:currentSite.requests,chunks:currentSite.chunks,periods:currentSite.periods,allCDPRequests:currentBrowser.requests});
  await currentBrowser.stop();currentBrowser=null;currentSite.stop();currentSite=null;
  await progress('working',['Single observation/shaping chain passed'],['Run exactly3 independent cold profiles;60s bound each']);
  for(let i=1;i<=3;i++){
    currentSite=await serveCandidate();currentBrowser=await browser();
    const result=await exercise(currentBrowser,currentSite,`trial-${i}`);
    try{result.shaping=auditShaping(currentSite);assert.equal(result.fixtureRuntimeResources,15);assert.equal(result.fixtureBodyBytes,4558569);for(const r of result.requests)assert.ok(!r.servedFromCache&&!r.response?.fromDiskCache&&!r.response?.fromServiceWorker);}
    catch(e){result.status='failed';result.validationFailure=String(e);}
    await json(`trial-${i}.json`,result);await json(`trial-${i}-transport.json`,{settings:currentSite.settings,requests:currentSite.requests,chunks:currentSite.chunks,periods:currentSite.periods});
    summary.trials.push({id:i,status:result.status,elapsedSeconds:result.elapsedSeconds||null,candidateWithin40Seconds:result.status==='success'&&result.candidateWithin40Seconds,keys:result.input?.keys.length,pointers:result.input?.pointers.length,bodyBytes:result.fixtureBodyBytes,evidence:`trial-${i}.json`,screenshot:result.screenshots[0],failure:result.failure||result.validationFailure||result.observationFailure||null});
    await currentBrowser.stop();currentBrowser=null;currentSite.stop();currentSite=null;
    await json('summary.json',summary);await progress('working',[`${i}/3 formal cold trials completed; failures retained`],[i<3?'Next independent cold profile':'Finalize candidate evidence then stop']);
  }
  const values=summary.trials.filter(t=>t.status==='success').map(t=>t.elapsedSeconds).sort((a,b)=>a-b);
  summary.medianSeconds=values.length===3?values[1]:null;summary.maxSeconds=values.length===3?values[2]:null;
  summary.candidateResult=values.length!==3?'incomplete_or_failed':summary.medianSeconds<=40?'within_proposed_40s_in_this_fixture':'exceeds_proposed_40s_in_this_fixture';
  summary.status='ready_for_review';
}catch(e){summary.status='incomplete';summary.failure=String(e);summary.candidateResult='unverified; unreliable chain or execution failure, no blind retry';console.log(JSON.stringify({status:summary.status,failure:summary.failure}));}
finally{
  if(currentSite)await json('incomplete-transport.json',{settings:currentSite.settings,requests:currentSite.requests,chunks:currentSite.chunks,periods:currentSite.periods});
  if(currentBrowser)await currentBrowser.stop();currentSite?.stop();
  for(const row of baseline)assert.equal(hash(await readFile(row.file)),row.sha256,'production changed');
  summary.identityDeliveryLimitation='Current default fixture identity body5191167B has41.529336s body-only lower bound; candidate test-only text gzip does not prove deployed encoding/40s.';
  summary.unverified=['hardware/real-device/deployment startup','long-wait UI (unchanged; no new40s notification/retry UI)','author/human experience','other scene gates and complete memory lifecycle'];
  summary.next='Stop for supervisor independent candidate review; budget and startup thresholds require explicit approval.';
  await json('summary.json',summary);await progress(summary.status,['Candidate evidence retained;15 production hashes unchanged'],['Stop for independent supervisor review; no threshold/UI changes']);
}
