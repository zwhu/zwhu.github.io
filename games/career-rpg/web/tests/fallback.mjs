// Only profile-local graphics faults and one intercepted mandatory image; no story/focus calls.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const prose='在南京第一次做 C 端上线，用户在论坛反馈无法登录。故障大约两小时后恢复。CTO 带大家排查，同事过来安抚。事后补测试、写注释，把这次失败记下来。';
const instrument=`window.__fallbackInput={keys:[],pointers:[]};for(const type of ['keydown','keyup'])window.addEventListener(type,e=>window.__fallbackInput.keys.push({type,key:e.key,trusted:e.isTrusted,focus:document.activeElement.id}),true);for(const type of ['pointerdown','mousedown','touchstart'])window.addEventListener(type,e=>window.__fallbackInput.pointers.push(type),true);`;
const noGL=`(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(['webgl','webgl2','experimental-webgl'].includes(type))return null;return original.call(this,type,...args);};})()`;
export async function runFallback(ctx){
  const {send,on,run,state,key,shot,out,evidenceLabel,errors,url,profile}=ctx;
  const requested=process.argv.find(a=>a.startsWith('--fallback-case='))?.split('=')[1]?.split(',');
  if(requested?.some(c=>!/^(js-disabled|webgl-failed|resource-failed|context-lost|normal-smoke)-(1280|375)$/.test(c)))throw Error('Invalid fallback case');
  const only=requested?new Set(requested):null;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const cases=[],network=[],keyLog=[],observations=[];let operation='setup',current=null,navigationCount=0;
  on('Page.frameNavigated',p=>{if(!p.frame.parentId)navigationCount++;});
  const result={status:'running',scope:'FALLBACK faults and affected startup/focus/reading/return smoke only',environment:'Local isolated Chrome headless; 1280 and 375 simulated CSS widths, software WebGL; no real device/person/performance acceptance',url,profile,hashes:{},cases,limitations:['走路卡顿未解决，用户要求暂停','未验Safari/真机、作者与真人、整场景和正式发布','既有全键盘/旅程不重跑；新证据仅覆盖受影响烟测'],scene_accepted:false,next_scene_authorized:false};
  for(const file of ['main.mjs','index.html','style.css','world.mjs','story.mjs','actors.mjs','scene-config.mjs'])result.hashes[file]=createHash('sha256').update(await readFile(new URL('../'+file,import.meta.url))).digest('hex');
  const store=async()=>{await writeFile(new URL(`${evidenceLabel}-checks.json`,out),JSON.stringify(result,null,2)+'\n');await writeFile(new URL(`${evidenceLabel}-steps.json`,out),JSON.stringify({keys:keyLog,observations,network},null,2)+'\n');};
  const wait=async(expression,label)=>{for(let i=0;i<120;i++){if(await run(expression))return;await sleep(100);}throw Error(`Timed out: ${label}`);};
  const navigationAfter=async(before)=>{for(let i=0;i<120&&navigationCount<=before;i++)await sleep(100);assert.ok(navigationCount>before,'actual new document navigation');await wait("document.readyState==='complete'",'new document fully loaded');await send('Page.bringToFront');};
  const navigateKey=async()=>{const before=navigationCount;await press('Enter');await navigationAfter(before);};
  const press=async(k,duration=0,modifiers=0)=>{keyLog.push({case:current?.id,operation,key:k,modifiers,duration,transport:'Input.dispatchKeyEvent'});await key(k,duration,modifiers);};
  const tabTo=async(selector)=>{const modifiers=['#back-blog','#read-summary'].includes(selector)?8:0;operation=`${modifiers?'Shift+Tab':'Tab'} to ${selector}`;for(let i=0;i<32;i++){if(await run(`document.activeElement.matches(${JSON.stringify(selector)})`)){if(!await run('document.hasFocus()')){await press('Tab',0,8);await press('Tab');continue;}assert.ok(await run(`(()=>{const s=getComputedStyle(document.activeElement);return parseFloat(s.outlineWidth)>=2&&s.outlineStyle!=='none';})()`),'visible keyboard focus');return;}await press('Tab',0,modifiers);}throw Error(`Unreachable by keyboard Tab: ${selector}`);};
  const collect=async(label)=>{const data=await run(`({input:window.__fallbackInput||null,focus:document.activeElement.id,state:window.careerPrototype?.snapshot(),summary:document.querySelector('#chapter-summary')?.innerText})`);if(data.input){assert.equal(data.input.pointers.length,0);assert.ok(data.input.keys.every(e=>e.trusted));}observations.push({case:current.id,label,...data});};
  const summary=async(selector)=>{
    await tabTo(selector);await press('Enter');await sleep(150);
    assert.equal(await run('document.activeElement.id'),'chapter-summary');
    assert.equal(await run('document.querySelector("#chapter-summary p").textContent'),prose);
    const visible=await run(`(()=>{const p=document.querySelector('#chapter-summary p'),r=p.getBoundingClientRect(),s=document.querySelector('#chapter-summary');return{top:r.top,bottom:r.bottom,viewport:innerHeight,focus:s.matches(':focus-visible'),text:p.innerText};})()`);
    assert.ok(visible.top>=0&&visible.bottom<=visible.viewport,'summary first and final text visible');assert.ok(visible.focus,'summary keyboard focus');
    current.summary=visible;await collect('summary read');await shot(`${current.id}-summary.png`);
  };
  const blog=async(selector)=>{
    await tabTo(selector);const href=await run('document.activeElement.href');assert.equal(new URL(href).pathname,'/docs/index.html');
    const response=await fetch(href);assert.equal(response.status,200,'real repository docs target');const html=await response.text();assert.ok(html.includes('zwhu'),'real blog content');
    await collect('before keyboard return to blog');await navigateKey();await wait(`location.pathname==='/docs/index.html'&&!!document.querySelector('h1')`,'keyboard blog navigation');
    current.blog={href,status:response.status,pathname:await run('location.pathname'),title:await run('document.title'),method:'Tab and Enter; actual repository docs/index.html HTTP 200'};
  };
  const navigate=async()=>{const before=navigationCount;await send('Page.navigate',{url});await navigationAfter(before);await wait(`!!document.querySelector('#chapter-summary')`,'document');};
  const ready=async()=>{await wait('!!window.careerPrototype','game ready');assert.equal((await state()).chapter.state,'office');};
  const leaveIntro=async()=>{await tabTo('#close-dialogue');await press('Enter');assert.equal((await state()).state,'explore');assert.equal(await run('document.activeElement.id'),'stage');};
  const retry=async()=>{await tabTo('#retry-game');await collect('before keyboard retry');await navigateKey();await ready();assert.ok(await run('document.querySelector("#game-failure").hidden'));assert.equal(await run('document.activeElement.matches("#choices button")'),true);current.retry='keyboard Enter reload -> office dialogue, stable save preserved';};
  const inputScript=await send('Page.addScriptToEvaluateOnNewDocument',{source:instrument});
  await send('Network.enable');on('Network.responseReceived',p=>{if(['/docs/index.html','/main.mjs','/style.css','/web/'].some(s=>new URL(p.response.url).pathname.endsWith(s)))network.push({case:current?.id,url:p.response.url,status:p.response.status});});
  try{
    for(const width of [1280,375]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
      for(const fault of ['js-disabled','webgl-failed','resource-failed','context-lost']){
        if(only&&!only.has(`${fault}-${width}`))continue;
        current={id:`${fault}-${width}`,fault,width,status:'running',screenshots:[]};cases.push(current);operation=`inject ${fault}`;
        let faultScript=null,offFetch=null;const failedResources=[];
        if(fault==='js-disabled')await send('Emulation.setScriptExecutionDisabled',{value:true});
        if(fault==='webgl-failed')faultScript=(await send('Page.addScriptToEvaluateOnNewDocument',{source:noGL})).identifier;
        if(fault==='resource-failed'){
          offFetch=on('Fetch.requestPaused',p=>{failedResources.push(p.request.url);send('Fetch.failRequest',{requestId:p.requestId,errorReason:'ConnectionFailed'}).catch(e=>errors.push(e.message));});
          await send('Fetch.enable',{patterns:[{urlPattern:'*office-room-v2.png',requestStage:'Request'}]});
        }
        await navigate();
        if(fault==='context-lost'){
          await ready();await leaveIntro();current.beforeLoss=await state();current.saveBefore=await run('localStorage.getItem(window.careerPrototype.snapshot().saveKey)');
          assert.ok(await run(`(()=>{const c=document.querySelector('#stage>canvas');window.__lostGL=c.getContext('webgl2')||c.getContext('webgl');window.__loseExtension=__lostGL.getExtension('WEBGL_lose_context');if(!__loseExtension)return false;__loseExtension.loseContext();return true;})()`),'actual context loss extension');
        }
        if(fault!=='js-disabled'){
          await wait('!document.querySelector("#game-failure").hidden','readable failure');assert.equal(await run('document.activeElement.id'),'retry-game');
          const layout=await run(`(()=>{const e=document.querySelector('#game-failure'),r=e.getBoundingClientRect();return{display:getComputedStyle(e).display,top:r.top,bottom:r.bottom,height:r.height,text:e.innerText,liveCanvas:!!document.querySelector('#stage>canvas')};})()`);assert.notEqual(layout.display,'none');assert.ok(layout.height>100);assert.ok(layout.text.includes('继续文字阅读'));if(fault==='context-lost')assert.equal(layout.liveCanvas,false,'lost canvas detached, no browser failure layer');current.failureLayout=layout;
          current.message=await run('document.querySelector("#failure-message").textContent');assert.ok(current.message.length>10);
          await press('Tab',0,8);await press('Tab');assert.ok(await run('document.activeElement.matches(":focus-visible")'),'visible retry focus');
          if(fault==='context-lost'){
            await press('ArrowRight',180);await press('e');await press('m');const stopped=await state();assert.equal(stopped.state,'error');assert.equal(stopped.moving,false);assert.deepEqual(stopped.position,current.beforeLoss.position);assert.deepEqual(stopped.chapter,current.beforeLoss.chapter);assert.equal(await run('localStorage.getItem(window.careerPrototype.snapshot().saveKey)'),current.saveBefore);current.freeze='RAF stopped, input cannot move/advance; stable chapter/save unchanged';
          }
        }else{
          assert.equal(await state(),undefined);assert.ok(await run('document.documentElement.classList.contains("no-js")'));assert.equal(await run('getComputedStyle(document.querySelector(".game-shell")).display'),'none');current.message=await run('document.querySelector(".script-fallback").innerText');
        }
        await shot(`${current.id}-failure.png`);current.screenshots.push(`${current.id}-failure.png`,`${current.id}-summary.png`);
        await summary(fault==='js-disabled'?'#read-summary':'#failure-read');
        if(fault==='js-disabled'){
          await blog('#back-blog');await send('Emulation.setScriptExecutionDisabled',{value:false});await navigate();await ready();current.retry='browser/profile JavaScript restored; new navigation starts game; disabled JS retains summary and native return';
        }else{
          if(fault==='webgl-failed'&&width===1280){await tabTo('#retry-game');await collect('persistent WebGL failure');await navigateKey();await wait('!document.querySelector("#game-failure").hidden','persistent failure remains readable');current.persistentRetry='still readable with retry/summary/blog when graphics stay unavailable';}
          if(faultScript)await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:faultScript});
          if(offFetch){await send('Fetch.disable');offFetch();assert.equal(failedResources.length,1);current.failedResources=failedResources;}
          if(fault==='context-lost'){await run('__loseExtension.restoreContext()');await wait('document.querySelector("#failure-message").textContent.includes("已恢复")','context restored instruction');current.restoredMessage=await run('document.querySelector("#failure-message").innerText');assert.equal((await state()).state,'error');}
          await retry();await leaveIntro();await blog('#back-blog');
        }
        current.status='passed';await store();
      }
      if(only&&!only.has(`normal-smoke-${width}`))continue;
      current={id:`normal-smoke-${width}`,width,status:'running'};cases.push(current);operation='normal startup, reading and focus';await navigate();await ready();
      const p=(await state()).position,originalText=await run('document.querySelector("#dialogue").innerText');
      await tabTo('#close-dialogue');await press('Tab',0,8);assert.equal(await run('document.activeElement.id'),'dialogue');assert.ok(await run('document.activeElement.matches(":focus-visible")'));
      const page=await run('scrollY');await press('Home');await press('End');await press('PageDown');await press('Home');assert.equal(await run('scrollY'),page);assert.equal(await run('document.querySelector("#dialogue").innerText'),originalText);assert.deepEqual((await state()).position,p);
      await press('Tab');await press('Enter');assert.equal(await run('document.activeElement.id'),'stage');
      await press('Escape');assert.equal((await state()).state,'paused');await press('Escape');assert.equal((await state()).state,'explore');assert.equal(await run('document.activeElement.id'),'stage');
      current.reading='initial prose Shift+Tab/Home/End/PageDown; text/page/position unchanged; Enter -> stage; Esc pause/return focus';await shot(`${current.id}.png`);current.screenshots=[`${current.id}.png`];await summary('#read-summary');await blog('#back-blog');current.status='passed';await store();
    }
    assert.deepEqual(errors,[]);result.status='passed';result.pointerEvents=0;result.trustedKeyboard='all observed JS-enabled events trusted; JS-disabled uses the same actual Chrome CDP key transport, no script event recorder';result.keyEvents=keyLog.length*2;
    result.faultInjection='Only isolated profile Emulation/removed getContext fixture/one Fetch route/real WEBGL_lose_context; zero checkpoints, story calls, clicks, focus() or scrollTop assignments';await store();console.log(JSON.stringify({status:result.status,cases:cases.length,keys:keyLog.length,pointers:0,hashes:result.hashes}));
  }catch(error){result.status='failed';result.failure={case:current?.id,operation,message:error.stack,diagnostics:await run(`({readyState:document.readyState,hasFocus:document.hasFocus(),active:document.activeElement?.outerHTML,focus:document.activeElement?.matches(':focus'),outline:getComputedStyle(document.activeElement).outline})`).catch(()=>null)};if(current)current.status='failed';await shot(`${evidenceLabel}-failure.png`).catch(()=>{});await store();throw error;}
  finally{await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:inputScript.identifier}).catch(()=>{});await send('Fetch.disable').catch(()=>{});await send('Emulation.setScriptExecutionDisabled',{value:false}).catch(()=>{});}
}
