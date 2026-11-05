// Observers only: no timing/FPS/CPU/heap profiler, no scene/plot state mutations.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=fileURLToPath(new URL('../../../../',import.meta.url));
const hash=data=>createHash('sha256').update(data).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

export const instrumentation=`(()=>{
  const p=window.__lifecycle={docID:crypto.randomUUID(),classes:{},refs:{},contexts:[],images:[],canvases:[],observers:[],listeners:[],pendingRAF:new Set(),cancelRAFCalls:0,input:{keys:0,untrusted:0,pointers:0}};
  const stat=kind=>p.classes[kind]||(p.classes[kind]={created:0,disposeCalls:0,disposed:0});
  const disposed=new WeakSet();p.markDispose=(kind,object)=>{const s=stat(kind);s.disposeCalls++;if(!disposed.has(object)){disposed.add(object);s.disposed++;}};
  p.track=(kind,object)=>{stat(kind).created++;if(kind==='scenes'||kind==='renderers')p.refs[kind]=new WeakRef(object);};
  const nativeAdd=EventTarget.prototype.addEventListener,nativeRemove=EventTarget.prototype.removeEventListener,index=new WeakMap();
  EventTarget.prototype.addEventListener=function(type,listener,options){
    if(!listener||listener.__lifecycleObserver)return nativeAdd.call(this,type,listener,options);
    const capture=typeof options==='boolean'?options:!!options?.capture,once=!!(typeof options==='object'&&options?.once);
    let records=index.get(this);if(!records){records=[];index.set(this,records);}
    let e=records.find(r=>r.active&&r.type===type&&r.capture===capture&&r.listener.deref()===listener);
    let wrapper;if(!e){e={target:new WeakRef(this),listener:new WeakRef(listener),type,capture,once,active:true};wrapper=function(event){if(once)e.active=false;return typeof listener==='function'?listener.call(this,event):listener.handleEvent(event);};e.wrapper=new WeakRef(wrapper);records.push(e);p.listeners.push(e);}else wrapper=e.wrapper.deref();
    return nativeAdd.call(this,type,wrapper,options);
  };
  EventTarget.prototype.removeEventListener=function(type,listener,options){const capture=typeof options==='boolean'?options:!!options?.capture,e=index.get(this)?.find(r=>r.active&&r.type===type&&r.capture===capture&&r.listener.deref()===listener);if(e){e.active=false;return nativeRemove.call(this,type,e.wrapper.deref(),options);}return nativeRemove.call(this,type,listener,options);};
  const raf=requestAnimationFrame,cancel=cancelAnimationFrame;
  window.requestAnimationFrame=function(callback){let id;id=raf.call(window,function(t){p.pendingRAF.delete(id);callback.call(window,t);});p.pendingRAF.add(id);return id;};
  window.cancelAnimationFrame=function(id){p.cancelRAFCalls++;p.pendingRAF.delete(id);return cancel.call(window,id);};
  const contexts=new WeakMap(),handles=new WeakMap();
  const context=gl=>{let c=contexts.get(gl);if(!c){c={ref:new WeakRef(gl),resources:{}};contexts.set(gl,c);p.contexts.push(c);}return c;};
  const pairs=[['createTexture','deleteTexture','textures'],['createBuffer','deleteBuffer','buffers'],['createProgram','deleteProgram','programs'],['createShader','deleteShader','shaders'],['createFramebuffer','deleteFramebuffer','framebuffers'],['createRenderbuffer','deleteRenderbuffer','renderbuffers'],['createVertexArray','deleteVertexArray','vertexArrays'],['createSampler','deleteSampler','samplers'],['createTransformFeedback','deleteTransformFeedback','transformFeedbacks'],['createQuery','deleteQuery','queries'],['fenceSync','deleteSync','syncs']];
  for(const proto of [window.WebGLRenderingContext?.prototype,window.WebGL2RenderingContext?.prototype])if(proto)for(const [make,remove,kind] of pairs){
    for(const [name,creating] of [[make,true],[remove,false]])if(Object.hasOwn(proto,name)){
      const native=proto[name];proto[name]=function(...args){const result=native.apply(this,args),c=context(this),s=c.resources[kind]||(c.resources[kind]={created:0,deleted:0,live:0});if(creating&&result){s.created++;s.live++;handles.set(result,{kind,active:true});}else if(!creating){const h=args[0]&&handles.get(args[0]);if(h?.active){h.active=false;s.deleted++;s.live--;}}return result;};
    }
  }
  const getContext=HTMLCanvasElement.prototype.getContext,seen=new WeakSet();p.twoDContexts=[];
  HTMLCanvasElement.prototype.getContext=function(type,...args){const c=getContext.call(this,type,...args);if(c&&!seen.has(c)){seen.add(c);if(type==='2d')p.twoDContexts.push(new WeakRef(c));else if(type.startsWith('webgl')||type==='experimental-webgl')context(c);}return c;};
  for(const name of ['createElement','createElementNS']){const native=Document.prototype[name];Document.prototype[name]=function(...args){const element=native.apply(this,args);if(element.localName==='canvas')p.canvases.push(new WeakRef(element));return element;};}
  const ImageNative=window.Image;window.Image=new Proxy(ImageNative,{construct(target,args){const image=Reflect.construct(target,args,target);p.images.push(new WeakRef(image));return image;}});
  const ResizeNative=window.ResizeObserver;window.ResizeObserver=class extends ResizeNative{constructor(cb){super(cb);this.__counter={ref:new WeakRef(this),targets:[],disconnectCalls:0};p.observers.push(this.__counter);}observe(target,...args){if(!this.__counter.targets.some(x=>x.active&&x.ref.deref()===target))this.__counter.targets.push({ref:new WeakRef(target),active:true});return super.observe(target,...args);}unobserve(target){for(const x of this.__counter.targets)if(x.ref.deref()===target)x.active=false;return super.unobserve(target);}disconnect(){this.__counter.disconnectCalls++;for(const x of this.__counter.targets)x.active=false;return super.disconnect();}};
  p.snapshot=()=>{
    const scene=p.refs.scenes?.deref(),renderer=p.refs.renderers?.deref();let nodes=0,meshes=0;if(scene)scene.traverse(o=>{nodes++;if(o.isMesh)meshes++;});
    const active=p.listeners.filter(e=>e.active&&e.target.deref());
    const connected=e=>{const t=e.target.deref();return t===window||t===document||!!t?.isConnected;};
    return {docID:p.docID,classes:structuredClone(p.classes),scene:{nodes,meshes},rendererInfo:renderer?{geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs?.length??null}:null,
      dom:{canvases:document.querySelectorAll('canvas').length,labels:document.querySelectorAll('.actor-label').length,effects:document.querySelectorAll('#actor-effects>*').length,markers:document.querySelectorAll('.task-marker').length,buttons:document.querySelectorAll('button').length},
      listeners:{registered:p.listeners.length,activeConnected:active.filter(connected).length,activeDetachedWeaklyObserved:active.filter(e=>!connected(e)).length,scope:'add/remove/once only; onload/onerror properties excluded; WeakRefs do not prove garbage collection'},
      raf:{pending:p.pendingRAF.size,cancelCalls:p.cancelRAFCalls},webgl:p.contexts.map(c=>({resources:structuredClone(c.resources),contextWeaklyReachable:!!c.ref.deref()})),
      shared:{imageObjectsCreated:p.images.length,imageObjectsWeaklyReachable:p.images.filter(r=>r.deref()).length,scriptCanvasesCreated:p.canvases.length,twoDContextsObserved:p.twoDContexts.length,resizeObserversCreated:p.observers.length,resizeDisconnectCalls:p.observers.reduce((n,o)=>n+o.disconnectCalls,0),resizeActiveTargets:p.observers.reduce((n,o)=>n+o.targets.filter(t=>t.active&&t.ref.deref()?.isConnected).length,0)},input:{...p.input}};
  };
  const input=function(e){if(e.type.startsWith('key')){p.input.keys++;if(!e.isTrusted)p.input.untrusted++;}else p.input.pointers++;};input.__lifecycleObserver=true;
  for(const type of ['keydown','keyup','pointerdown','mousedown','touchstart'])nativeAdd.call(window,type,input,true);
})()`;

export const vendorWrapper=`import * as Native from './three.module.min.js?lifecycle-native';
export * from './three.module.min.js?lifecycle-native';
const probe=window.__lifecycle;
const counted=(Base,kind)=>class extends Base{constructor(...args){super(...args);probe.track(kind,this);if(['geometries','materials','textures'].includes(kind))this.addEventListener('dispose',function(){probe.markDispose(kind,this);});if(kind==='renderers'){const dispose=this.dispose;this.dispose=function(...args){const result=dispose.apply(this,args);probe.markDispose(kind,this);return result;};}}};
export const Scene=counted(Native.Scene,'scenes');
export const WebGLRenderer=counted(Native.WebGLRenderer,'renderers');
export const Texture=counted(Native.Texture,'textures');
export const PlaneGeometry=counted(Native.PlaneGeometry,'geometries');
export const MeshBasicMaterial=counted(Native.MeshBasicMaterial,'materials');
export const Mesh=counted(Native.Mesh,'meshes');
export const OrthographicCamera=counted(Native.OrthographicCamera,'cameras');
`;

export async function runLifecycle({send,on,run,state,key,out,evidenceLabel,errors,url,profile}){
  const cycles=Number(process.argv.find(a=>a.startsWith('--lifecycle-cycles='))?.split('=')[1]||20);if(![1,20].includes(cycles))throw Error('Lifecycle cycles must be1 for observer validation or20 for the bounded series');
  const manifest=JSON.parse(await readFile(new URL('../review/resource-budget/manifest.json',import.meta.url))),hashes={};
  for(const r of manifest.resources)hashes[r.file]=hash(await readFile(path.join(repo,r.file)));
  const rounds=[],exits=[],contexts=[],interceptions=[];let operation='instrumentation';
  const result={status:'working',scene:'nanjing-office',stage:'lifecycle',profile,url,hashes,cycles,rounds,exits,contexts,interceptions,
    scope:'Existing chapter replay through trusted keyboard, then native full document reload. Cycles1 validates native observation chain;20 is the bounded series. No in-document room-switch API exists; not simulated scene transitions.',
    instrumentation:{sourceSHA256:hash(Buffer.from(instrumentation)),vendorWrapperSHA256:hash(Buffer.from(vendorWrapper)),mode:'Test-profile Fetch wrapper preserves native r180 constructors/behavior and counts creation/dispose events. WeakRefs avoid observer ownership. No production source mutation or timing/performance probe.'}};
  const save=async()=>{await writeFile(new URL(`${evidenceLabel}-counts.json`,out),JSON.stringify(result,null,2)+'\n');};
  const fetchErrors=[];
  result.runtimeErrors=[];
  on('Runtime.exceptionThrown',p=>result.runtimeErrors.push({text:p.exceptionDetails.text,description:p.exceptionDetails.exception?.description||null}));
  on('Runtime.bindingCalled',p=>{if(p.name==='__lifecycleReport')exits.push(JSON.parse(p.payload));});
  on('Runtime.executionContextCreated',p=>{if(p.context.auxData?.isDefault)contexts.push({event:'created',id:p.context.id,origin:p.context.origin,frame:p.context.auxData.frameId});});
  on('Runtime.executionContextDestroyed',p=>contexts.push({event:'destroyed',id:p.executionContextId}));
  on('Runtime.executionContextsCleared',()=>contexts.push({event:'cleared'}));
  on('Fetch.requestPaused',p=>{
    const parsed=new URL(p.request.url),vendor=new URL('./vendor/three.module.min.js',url);
    let action;
    if(parsed.origin!==new URL(url).origin){interceptions.push({kind:'blocked-unrelated-public-network',url:p.request.url});action=send('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'});}
    else if(parsed.pathname===vendor.pathname&&!parsed.search){interceptions.push({kind:'test-only-three-wrapper',url:p.request.url});action=send('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(vendorWrapper).toString('base64')});}
    else action=send('Fetch.continueRequest',{requestId:p.requestId});
    action.catch(e=>fetchErrors.push(e.message));
  });
  await send('Runtime.addBinding',{name:'__lifecycleReport'});
  const script=await send('Page.addScriptToEvaluateOnNewDocument',{source:instrumentation});
  await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  result.browser=(await send('Browser.getVersion')).product;
  const sample=async()=>{const value=await run('window.__lifecycle.snapshot()'),s=await state();return {...value,roles:{count:s.actors.length,ids:s.actors.map(a=>a.id)}};};
  const ready=async(previous=null)=>{for(let i=0;i<120;i++){try{if(await run(`!!window.careerPrototype&&!!window.__lifecycle?.refs.renderers?.deref()&&window.__lifecycle.refs.renderers.deref().info.memory.geometries>0${previous?`&&window.__lifecycle.docID!==${JSON.stringify(previous)}`:''}`))return;}catch{}await sleep(100);}throw Error('New document lifecycle readiness unavailable');};
  const closeIntro=async()=>{await send('Page.bringToFront');for(let i=0;i<12&&!await run('document.activeElement.id==="close-dialogue"');i++)await key('Tab');assert.equal(await run('document.activeElement.id'),'close-dialogue');await key('Enter');assert.equal((await state()).state,'explore');assert.equal(await run('document.activeElement.id'),'stage');};
  const assertStable=(a,b)=>{assert.deepEqual(b.classes,a.classes,'replay must reuse scene/renderer/actors/resources');assert.deepEqual(b.scene,a.scene);assert.deepEqual(b.roles,a.roles);assert.deepEqual(b.rendererInfo,a.rendererInfo);assert.deepEqual(b.dom,a.dom);assert.equal(b.listeners.activeConnected,a.listeners.activeConnected);assert.equal(b.raf.pending,1);assert.deepEqual(b.shared,a.shared);assert.deepEqual(b.webgl.map(x=>x.resources),a.webgl.map(x=>x.resources));assert.equal(b.input.untrusted,0);assert.equal(b.input.pointers,0);};
  try{
    await send('Page.navigate',{url});await ready();await closeIntro();result.baseline=await sample();
    for(let cycle=1;cycle<=cycles;cycle++){
      operation=`cycle${cycle}: keyboard chapter replay`;
      const before=await sample();assert.equal((await state()).chapter.state,'office');
      await key('Escape');await key('ArrowRight');await key('ArrowRight');assert.equal(await run('document.activeElement.id'),'restart');await key('Enter');assert.equal(await run('document.activeElement.dataset.action'),'confirm-replay');await key('Enter');await closeIntro();
      const replayed=await sample();assertStable(before,replayed);
      const monitor=await run(`(()=>{const handler=function(e){let data={event:'pagehide-after-app-dispose',nativeEventType:e.type,nativeEventTrusted:e.isTrusted,docID:window.__lifecycle.docID,persisted:e.persisted,runtimeBindingType:typeof window.__lifecycleReport};try{Object.assign(data,window.__lifecycle.snapshot());data.snapshotOutcome='returned';}catch(error){data.snapshotOutcome='exception';data.snapshotError=String(error);}sessionStorage.setItem('__career_rpg_lifecycle_probe',JSON.stringify(data));try{if(typeof window.__lifecycleReport==='function'){window.__lifecycleReport(JSON.stringify(data));data.bindingOutcome='returned';}else data.bindingOutcome='unavailable';}catch(error){data.bindingOutcome='exception';data.bindingError=String(error);}sessionStorage.setItem('__career_rpg_lifecycle_probe',JSON.stringify(data));};handler.__lifecycleObserver=true;window.addEventListener('pagehide',handler,{once:true});return {registered:true,bindingType:typeof window.__lifecycleReport};})()`);assert.equal(monitor.registered,true);
      const round={cycle,before,replayed,observerRegistration:monitor,result:'awaiting-unload-evidence'};rounds.push(round);await save();
      operation=`cycle${cycle}: native document reload/pagehide`;
      await send('Page.reload');await ready(before.docID);await closeIntro();
      const entered=await sample();let exit=exits.find(e=>e.docID===before.docID),bindingObserved=!!exit;
      const stored=await run('sessionStorage.getItem("__career_rpg_lifecycle_probe")');if(stored){const data=JSON.parse(stored);if(data.docID===before.docID){exit={...data,cdpBindingObserved:bindingObserved};const at=exits.findIndex(e=>e.docID===before.docID);if(at<0)exits.push(exit);else exits[at]=exit;}}
      round.reentered=entered;round.pagehide=exit||null;await save();
      assert.ok(exit,'real pagehide observed after production disposal');assert.ok(!exit.snapshotError,exit.snapshotError);assert.equal(exit.persisted,false,'native reload must be full document unload, not BFCache');
      assert.equal(exit.nativeEventType,'pagehide');assert.equal(exit.nativeEventTrusted,true);assert.equal(exit.snapshotOutcome,'returned');
      assert.equal(exit.raf.pending,0);assert.equal(exit.classes.renderers.disposed,1);
      for(const kind of ['geometries','materials','textures'])assert.equal(exit.classes[kind].created,exit.classes[kind].disposed,kind+' logical objects disposed');
      assert.equal(exit.rendererInfo.geometries,0);assert.equal(exit.rendererInfo.textures,0);
      assertStable(result.baseline,entered);
      round.pagehideDocID=exit.docID;round.result='observed-stable';await save();
      if(cycle%5===0)console.log(JSON.stringify({cycles:cycle,sceneMeshes:entered.scene.meshes,pendingRAF:entered.raf.pending,logicalTextures:entered.classes.textures.created,connectedListeners:entered.listeners.activeConnected}));
    }
    assert.deepEqual(fetchErrors,[]);assert.deepEqual(errors,[]);
    result.final=await sample();result.status='observed_stable_full_memory_unverified';result.production_unchanged=true;result.unloadTelemetry='Same native pagehide observer snapshots stored in isolated test-only sessionStorage key __career_rpg_lifecycle_probe; game localStorage save never altered by test. CDP binding optional, not sole unload evidence.';
    for(const [f,expected] of Object.entries(hashes))assert.equal(hash(await readFile(path.join(repo,f))),expected);
    result.unverified=['Complete JS heap/native decoded-image/canvas/driver memory release and byte growth, no heap profiler/GC proof used','Weakly seen detached nodes/listeners are not a retention/leak verdict; property event handlers excluded','Internal per-context fallback WebGL textures may outlive renderer.dispose until browser context teardown; JS delete counts do not prove implicit driver reclamation','Global DOM listeners/ResizeObserver rely on full document teardown; no application disconnect guarantee is inferred','Only real chapter replay plus document reload exists and was tested; no separate scene-switch path, BFCache restoration or hidden lifecycle failure paths tested','Headless/software WebGL is not true device or author/whole-scene acceptance'];
    result.next='Stop for supervisor independent lifecycle interpretation; leave full lifecycle gate unverified where native/heap evidence is missing. Resource budget failed and walking stutter remains paused.';await save();
    console.log(JSON.stringify({status:result.status,cycles:rounds.length,pagehide:exits.length,production_unchanged:true,finalMeshes:result.final.scene.meshes,finalRAF:result.final.raf.pending}));
  }catch(error){result.status='failed_or_incomplete';result.failure={operation,message:error.stack,diagnostic:await run(`({failureText:document.querySelector('#failure-message')?.textContent,loading:document.querySelector('#loading')?.textContent,probeExists:!!window.__lifecycle,classes:window.__lifecycle?.classes,gameExists:!!window.careerPrototype})`).catch(()=>null)};await save();throw error;}
  finally{await send('Fetch.disable').catch(()=>{});await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:script.identifier}).catch(()=>{});}
}
