// Reuses browser.mjs's CDP keyboard and walking helpers. No production state calls or clicks.
import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

export async function serveSite({repository=false,delivery=null}={}){
  const base=path.resolve(fileURLToPath(new URL(repository?'../../../../':'../../',import.meta.url)));
  const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2'};
  const server=http.createServer(async(req,res)=>{
    try{
      const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      // Chrome asks for this implicit root resource even though the game does not.
      if(repository&&requested==='/favicon.ico'){res.writeHead(204);res.end();return;}
      // The FALLBACK fixture mounts real development URLs, never .git or other workspaces.
      if(repository&&!['/games/career-rpg/','/docs/'].some(prefix=>requested.startsWith(prefix))){res.writeHead(403);res.end();return;}
      const file=path.resolve(base,'.'+requested+(requested.endsWith('/')?'index.html':''));
      if(!file.startsWith(base+path.sep)||(repository&&!['games/career-rpg/','docs/'].some(prefix=>path.relative(base,file).startsWith(prefix)))){res.writeHead(403);res.end();return;}
      const data=await readFile(file),headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'};
      // Optional candidate transport is test-only; all existing modes retain identity delivery.
      if(delivery){await delivery({req,res,file,data,headers});return;}
      res.writeHead(200,headers);res.end(data);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});
  return {server,url:`http://127.0.0.1:${server.address().port}/${repository?'games/career-rpg/':''}web/`};
}

export async function runChecks(ctx){
  const {send,run,state,key,shot,checks,out,evidenceLabel,walk,open,reload,config,port}=ctx;
  const storageOnly=process.argv.includes('--keyboard-storage-only');
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  let operation='startup';
  const result={scope:'Targeted keyboard gaps only; existing chapter/story, movement and performance evidence not rerun',environment:'Desktop Chrome headless, 1280x900, software WebGL; no real-device or performance acceptance',input:'Chrome CDP Input.dispatchKeyEvent; no clicks or production state-changing functions',checks};
  const main=await readFile(new URL('../main.mjs',import.meta.url));result.mainSHA256=createHash('sha256').update(main).digest('hex');
  result.fixtures='LocalStorage legal checkpoints and isolated storage failure only; no chapter.advance, button.click, dispatchEvent or direct focus to drive acceptance.';
  const rows=[];result.operations=rows;
  const focus=()=>run('document.activeElement.id||document.activeElement.dataset.event||document.activeElement.dataset.action');
  const observe=()=>run(`(()=>{window.__keyboardEvidence={keys:[],clicks:[],pointers:[],windowEvents:[]};for(const type of ['keydown','keyup'])window.addEventListener(type,e=>window.__keyboardEvidence.keys.push({type,key:e.key,repeat:e.repeat,trusted:e.isTrusted,focus:document.activeElement.id||document.activeElement.dataset.action||document.activeElement.dataset.event}),true);window.addEventListener('click',e=>window.__keyboardEvidence.clicks.push({action:e.target.dataset.action||e.target.dataset.event||e.target.id}),true);window.addEventListener('pointerdown',e=>window.__keyboardEvidence.pointers.push(e.type),true);for(const name of ['blur','focus'])window.addEventListener(name,e=>window.__keyboardEvidence.windowEvents.push({type:name,trusted:e.isTrusted}));document.addEventListener('visibilitychange',e=>window.__keyboardEvidence.windowEvents.push({type:'visibilitychange',hidden:document.hidden,trusted:e.isTrusted}));})()`);
  const inputEvidence=[];
  const collect=async()=>{const e=await run('window.__keyboardEvidence');if(e)inputEvidence.push(e);};
  const seed=async name=>{await collect();await run(`(async()=>{const d=await(await fetch('../design/chapter-01.json')).json();localStorage.setItem(d.savePolicy.key,JSON.stringify({schema:1,chapter:d.id,state:${JSON.stringify(name)},flags:d.legalSnapshots[${JSON.stringify(name)}][0]}));})()`);await reload();await observe();await sleep(210);};
  const select=async(selector,via=null)=>{
    for(let n=0;n<20;n++){
      if(await run(`document.activeElement.matches(${JSON.stringify(selector)})`))return;
      const direction=via||await run(`(()=>{const a=document.activeElement.getBoundingClientRect(),b=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(),dy=(b.top+b.bottom-a.top-a.bottom)/2;if(Math.abs(dy)>Math.min(a.height,b.height)/2)return dy>0?'ArrowDown':'ArrowUp';return b.left>a.left?'ArrowRight':'ArrowLeft';})()`);
      await key(direction);
    }
    throw Error(`Keyboard cannot select ${selector}`);
  };
  const enter=async()=>{await sleep(210);await key('Enter');};
  const note=(id,keys,description)=>{checks[id]=true;rows.push({id,keys,operation:description,result:'passed'});};
  const hold=async(k,repeats=5)=>{
    const p={key:k,code:k===' '?'Space':k,windowsVirtualKeyCode:k===' '?32:13,...(k==='Enter'?{text:'\r',unmodifiedText:'\r'}:{text:' ',unmodifiedText:' '})};
    await send('Input.dispatchKeyEvent',{type:'keyDown',...p});await sleep(250);
    for(let n=0;n<repeats;n++){await send('Input.dispatchKeyEvent',{type:'keyDown',...p,autoRepeat:true});await sleep(70);}
  };
  const release=k=>send('Input.dispatchKeyEvent',{type:'keyUp',key:k,code:k===' '?'Space':k,windowsVirtualKeyCode:k===' '?32:k==='ArrowRight'?39:13});
  const still=async action=>{const p=(await state()).position;await action();assert.deepEqual((await state()).position,p,'Menu/dialogue input must not move player');};
  const switchAway=async()=>{
    const target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
    const socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
    await new Promise((r,j)=>{socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id===1)m.error?j(Error(m.error.message)):r();},{once:true});socket.send(JSON.stringify({id:1,method:'Page.bringToFront',params:{}}));});
    await sleep(180);return async()=>{socket.close();await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);await send('Page.bringToFront');await sleep(180);};
  };
  const storageCase=async()=>{
    operation='write-failure-retry-and-continue';await seed('learning');await key('Escape');const computer=config.objects.find(o=>o.id==='cto-pc');await walk(computer.x,computer.y);await open('cto-pc');await enter();
    const existingSave=await run('localStorage.getItem(window.careerPrototype.snapshot().saveKey)');
    await run(`(()=>{window.__originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===window.careerPrototype.snapshot().saveKey)throw Error('keyboard fixture storage unavailable');return window.__originalSetItem.call(this,key,value);};})()`);
    await enter();assert.equal(await focus(),'retry-save');await enter();assert.equal(await focus(),'retry-save');await key('Escape');assert.equal((await state()).state,'paused');await key('Escape');assert.equal(await focus(),'retry-save');await key('ArrowDown');assert.equal(await focus(),'reset-save');await enter();assert.equal((await state()).saving,false);assert.equal(await run('localStorage.getItem(window.careerPrototype.snapshot().saveKey)'),existingSave);await key('Escape');await run('Storage.prototype.setItem=window.__originalSetItem');
    note('storageFailureKeyboard','Enter retry Esc ↓ Enter','Write failure retry and continue-unsaved reached with keys; existing save preserved');
  };
  try{
    await observe();
    if(storageOnly){await storageCase();}else{
    await sleep(210);await key('Enter');assert.equal((await state()).state,'explore');
    operation='pause-menu-direction-navigation';await key('Escape');
    assert.equal(await run('document.activeElement.id'),'resume');
    await key('ArrowDown');assert.equal(await run('document.activeElement.id'),'pause-manual','ArrowDown must select the next pause option');
    await key('ArrowUp');assert.equal(await focus(),'resume');await key('ArrowRight');assert.equal(await focus(),'pause-manual');await key('ArrowLeft');assert.equal(await focus(),'resume');
    await still(async()=>{await key('ArrowDown');await key('ArrowDown');await key('ArrowUp');});
    await shot(`${evidenceLabel}-pause-selection.png`);
    assert.equal(await run('getComputedStyle(document.activeElement).outlineStyle'),'solid');
    note('pauseDirectionNavigation','↑↓←→','Pause options select visibly; all four directions; player stays still');
    operation='pause-manual-return';await select('#pause-manual');await enter();assert.equal(await run('document.querySelector("#speaker").textContent'),'工作手册');await key('Escape');assert.equal((await state()).state,'paused');await key('Escape');assert.equal((await state()).state,'explore');
    note('pauseManualReturn','↓ Enter Esc Esc','Manual returns to pause menu, then exploration');

    operation='tab-hud-and-shortcuts';await key('m');assert.equal((await state()).state,'dialogue');await key('Escape');assert.equal(await focus(),'stage');await key('Tab');assert.equal(await focus(),'manual');await key('Tab',0,8);assert.equal(await focus(),'stage');await key('Tab');await enter();await key('Escape');assert.equal(await focus(),'manual');
    await still(async()=>{await key('ArrowRight');await key('ArrowDown');});
    await key('Tab',0,8);assert.equal(await focus(),'stage');
    note('tabHudAndManualFocus','M Esc Tab Shift+Tab Enter','Tab retained; HUD manual returns to its button; HUD focus cannot move player');

    operation='dialogue-choices-and-enter-boundary';await seed('learning');await key('Escape');
    const computer=config.objects.find(o=>o.id==='cto-pc');await walk(computer.x,computer.y);const initialTarget=(await state()).active;await key('q');assert.notEqual((await state()).active,initialTarget);await key('q');assert.equal((await state()).active,initialTarget);await open('cto-pc');
    assert.equal(await focus(),'view_review_test_plan');
    await still(async()=>{await key('ArrowDown');assert.notEqual(await focus(),'view_review_test_plan');await key('ArrowUp');assert.equal(await focus(),'view_review_test_plan');await key('ArrowRight');assert.equal(await focus(),'view_review_trap_comment');await key('ArrowLeft');});
    await key('Tab');assert.equal(await focus(),'view_review_trap_comment');await key('Tab',0,8);assert.equal(await focus(),'view_review_test_plan');
    note('dialogueDirectionAndShortcuts','E Q ↑↓ Tab Shift+Tab','Nearby target Q and E retained; dialogue selects both available actions without moving');
    const prior=(await state()).chapter;
    const seatedBefore=(await state()).actors.find(a=>a.id==='player');
    await hold('Enter');assert.equal(await focus(),'review_test_plan');assert.deepEqual((await state()).chapter,prior,'Held Enter must not confirm the new page');await release('Enter');
    await key('Escape');assert.equal(await focus(),'view_review_test_plan');assert.deepEqual((await state()).chapter,prior);
    assert.deepEqual((await state()).actors.find(a=>a.id==='player'),seatedBefore,'Returning options must preserve the seated actor/anchor');
    note('confirmationPageBack','Enter held/repeat Esc','Held Enter only opens confirmation; Esc returns to original selected option');
    await key('Enter');await hold('Enter');assert.ok((await state()).chapter.flags.includes('test_reviewed'));assert.equal((await state()).state,'dialogue');const accepted=(await state()).chapter;await release('Enter');await sleep(210);assert.deepEqual((await state()).chapter,accepted);
    await key('Escape');assert.equal((await state()).state,'explore');
    note('enterReleaseBoundary','Enter held/repeat, release, new Enter','One confirmation records once; repeats cannot close the next interface or trigger behind it');
    await open('cto-pc');await select('[data-event="view_review_trap_comment"]');await sleep(210);await hold(' ');assert.equal(await focus(),'review_trap_comment');assert.ok(!(await state()).chapter.flags.includes('comment_reviewed'));await release(' ');await sleep(80);assert.ok(!(await state()).chapter.flags.includes('comment_reviewed'),'Space keyup must not confirm a new interface');
    await sleep(210);await key(' ');assert.ok((await state()).chapter.flags.includes('comment_reviewed'));await key('Escape');
    note('spaceReleaseBoundary','Space held/repeat, release, new Space','Space retained and release does not accidentally confirm next page');

    operation='required-dialogue-pause-disabled';await seed('report');const report=(await state()).chapter,reportFocus=await focus();await key('Escape');assert.equal((await state()).state,'paused');assert.equal(await run('document.querySelector("#pause-manual").disabled&&document.querySelector("#restart").disabled'),true);
    await still(async()=>{for(const k of ['ArrowDown','ArrowRight','ArrowUp','ArrowLeft']){await key(k);assert.equal(await focus(),'resume');}});await enter();assert.equal((await state()).state,'dialogue');assert.equal(await focus(),reportFocus);assert.deepEqual((await state()).chapter,report);
    note('requiredDialoguePauseAndDisabled','Esc ↑↓←→ Enter','Required report is preserved; disabled manual/replay skipped; resume restores original choice');
    await key('Escape');await key('Tab');assert.equal(await focus(),'resume');await key('Tab',0,8);assert.equal(await focus(),'resume');await key('Escape');

    operation='actual-window-blur-dialogue';await send('Page.bringToFront');const returnToGame=await switchAway();assert.equal((await state()).state,'paused','Actual tab switch must pause dialogue');await returnToGame();assert.equal(await focus(),'resume');await enter();assert.equal(await focus(),reportFocus);assert.deepEqual((await state()).chapter,report);const nativeEvents=await run('window.__keyboardEvidence.windowEvents');assert.ok(nativeEvents.some(e=>e.trusted&&(e.type==='blur'||e.hidden)),'No real blur/hidden event observed');
    note('nativeDialogueFocusRestore','browser tab switch, Enter','Real trusted blur/visibility event pauses dialogue; returning restores resume then prior choice');

    operation='actual-window-blur-held-movement';await seed('office');await key('Escape');await send('Page.bringToFront');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await sleep(90);const returnFromMovement=await switchAway();assert.equal((await state()).state,'paused');await returnFromMovement();assert.equal(await focus(),'resume');await enter();const restoredPosition=(await state()).position;await sleep(180);assert.deepEqual((await state()).position,restoredPosition);await release('ArrowRight');assert.equal(await focus(),'stage');
    note('nativeBlurClearsHeldMovement','held →, tab switch, Enter','Actual focus loss clears held movement; returning has no position jump or residual input');

    operation='completion-replay-return';await seed('complete');await key('ArrowDown');assert.equal(await focus(),'close-dialogue');await key('ArrowUp');assert.equal(await focus(),'replay');await enter();assert.equal(await run('document.querySelector("#system-dialog").open'),true);await key('Escape');assert.equal(await focus(),'replay');assert.equal((await state()).chapter.state,'complete');
    await key('Escape');await key('m');await enter();await select('#close-dialogue');await enter();assert.equal(await focus(),'replay');await enter();await sleep(210);await hold('Enter');assert.equal((await state()).chapter.state,'office');assert.equal((await state()).state,'dialogue');await release('Enter');await key('Escape');
    note('completionManualReplay','↑↓ Enter Esc M','Completion/manual/replay options navigate and cancel; confirming replay starts once without skipping introduction');

    operation='invalid-save-system-options';await collect();await run('localStorage.setItem(window.careerPrototype.snapshot().saveKey,"{broken");localStorage.setItem("keyboard-unrelated","keep")');await reload();await observe();await sleep(210);
    assert.equal(await focus(),'reset-save');await key('ArrowDown');assert.equal(await focus(),'continue-unsaved');await key('ArrowUp');assert.equal(await focus(),'reset-save');await key('Escape');assert.equal((await state()).state,'paused');await key('Escape');assert.equal(await focus(),'reset-save');await key('ArrowDown');await enter();assert.equal((await state()).saving,false);assert.equal(await run('localStorage.getItem(window.careerPrototype.snapshot().saveKey)'),'{broken');await key('Escape');
    note('damagedSaveChoices','↑↓ Esc Enter','Damaged save options and safe pause return work; only-in-session retains original save');
    await collect();await reload();await observe();await sleep(210);await enter();assert.equal((await state()).chapter.state,'office');assert.equal(await run('localStorage.getItem("keyboard-unrelated")'),'keep');await key('Escape');
    note('explicitSaveReset','Enter','Explicit reset operates only on game save; unrelated storage retained');

    await storageCase();

    operation='responsive-menu-preview';await seed('office');await key('Escape');await key('Escape');
    for(const width of [375,560,700,1280]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:width===375?2:1,mobile:false});await sleep(80);
      const p=(await state()).position;
      for(const k of ['ArrowDown','ArrowUp','ArrowRight','ArrowLeft'])await key(k);
      assert.deepEqual((await state()).position,p);assert.equal(await run('document.documentElement.scrollWidth<=innerWidth'),true);
      const bounds=await run('(()=>{const b=document.activeElement.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};})()');assert.ok(bounds.left>=0&&bounds.right<=width&&bounds.top>=0&&bounds.bottom<=900);
      await shot(`${evidenceLabel}-menu-${width}.png`);
    }
    note('responsiveDirectionPreview','↑↓←→ at 375/560/700/1280 CSS px','Wrapped menu option navigation and visible selection; simulated narrow viewport, not real mobile device');
    await key('Escape');await key('m');await shot(`${evidenceLabel}-bubble-1280.png`);await key('Escape');
    }
    assert.deepEqual(ctx.errors,[]);
    await collect();result.inputEvidence=inputEvidence;
    assert.ok(inputEvidence.flatMap(e=>e.keys).length>10);
    assert.ok(inputEvidence.flatMap(e=>e.keys).every(e=>e.trusted));assert.deepEqual(inputEvidence.flatMap(e=>e.pointers),[]);
    note('realKeyboardEventsOnly','CDP keyboard events','All observed key events trusted; zero pointer inputs; no clicks/state actions used by test');
    result.result='passed';
    console.log(JSON.stringify({result:result.result,checks:rows.length,mainSHA256:result.mainSHA256}));
  }catch(error){result.result='failed';result.operation=operation;result.error=error.stack;result.failureState=await state();result.failureInput=await run('window.__keyboardEvidence');result.focus=await focus();await shot(`${evidenceLabel}-failure.png`);throw error;}
  finally{await writeFile(new URL(`${evidenceLabel}-checks.json`,out),JSON.stringify(result,null,2)+'\n');}
}
