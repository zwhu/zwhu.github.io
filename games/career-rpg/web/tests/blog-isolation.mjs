// Two real public blog pages only; reuse browser.mjs's fresh profile/CDP/server.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const repo=fileURLToPath(new URL('../../../../',import.meta.url));
const hash=data=>createHash('sha256').update(data).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const forbidden=url=>/career-rpg|(?:^|\/)three(?:\.core|\.module)?(?:\.min)?\.js(?:[?#]|$)|(?:^|\/)(?:world|story|actors|scene-config)\.mjs(?:[?#]|$)|(?:office-room-v2|player-walk-v1|player-walk-v2(?:-sheet)?|npc-team-v1|player-emotions-v1|typing-team-v1)\.(?:png|webp)(?:[?#]|$)/i.test(url);

async function staticEvidence(out){
  const script=String.raw`import json,hashlib,re
from pathlib import Path
from html.parser import HTMLParser
root=Path.cwd();docs=root/'docs'
class Page(HTMLParser):
 def __init__(self,text):
  super().__init__();self.refs=[];self.feed(text)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag in ['script','img','iframe','audio','video','source','embed'] and a.get('src'):self.refs.append(a['src'])
  if tag=='object' and a.get('data'):self.refs.append(a['data'])
  if tag=='link' and any(x in a.get('rel','').split() for x in ['stylesheet','icon','apple-touch-icon','preload','modulepreload']) and a.get('href'):self.refs.append(a['href'])
  if a.get('srcset'):self.refs.extend(x.strip().split()[0] for x in a['srcset'].split(',') if x.strip())
pattern=re.compile(r'career-rpg|(?:^|/)three(?:\.core|\.module)?(?:\.min)?\.js(?:[?#]|$)|(?:office-room-v2|player-walk-v1|player-walk-v2(?:-sheet)?|npc-team-v1|player-emotions-v1|typing-team-v1)\.(?:png|webp)',re.I)
rows=[]
for p in sorted(docs.rglob('*.html')):
 data=p.read_bytes();page=Page(data.decode());refs=page.refs
 inline=[{'offset':m.start(),'text':m.group(0)} for m in pattern.finditer(data.decode())]
 rows.append({'file':str(p.relative_to(root)),'sha256':hashlib.sha256(data).hexdigest(),'direct_resource_references':refs,'forbidden_resource_references':[u for u in refs if pattern.search(u)],'literal_occurrences_for_review':inline})
shared=[]
for p in sorted([*docs.glob('*.js'),*docs.glob('*.css')]):
 text=p.read_text();shared.append({'file':str(p.relative_to(root)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'game_literal_occurrences':[m.group(0) for m in pattern.finditer(text)]})
print(json.dumps({'scope':'All current docs/**/*.html direct load references plus root shared JS/CSS literal scan; no claim of recursive execution or all-page browser coverage','pages':rows,'shared_files':shared,'direct_game_reference_count':sum(len(r['forbidden_resource_references']) for r in rows)},ensure_ascii=False))`;
  // Standard-library parser only; no package installation or repository hooks.
  const {spawnSync}=await import('node:child_process');
  const result=spawnSync('python3',['-c',script],{cwd:repo,encoding:'utf8'});
  if(result.status!==0)throw Error(result.stderr);
  const evidence=JSON.parse(result.stdout);
  await writeFile(new URL('static-references.json',out),JSON.stringify(evidence,null,2)+'\n');
  return evidence;
}

export async function runIsolation({send,on,run,out,evidenceLabel,errors,url,profile}){
  const origin=new URL(url).origin,rows=[],pages=[],requestMap=new Map(),blocked=new Set();
  let current=null,navigation=0,inflight=new Set(),lastEvent=0;
  const manifest=JSON.parse(await readFile(new URL('../review/resource-budget/manifest.json',import.meta.url)));
  const production=Object.fromEntries(await Promise.all(manifest.resources.map(async r=>[r.file,hash(await readFile(path.join(repo,r.file)))])));
  const summary={status:'working',scene:'nanjing-office',stage:'blog-isolation-and-options',environment:'Fresh isolated Chrome headless desktop 1280x900; real repository docs assets, no game page visited',profile,origin,pages,request_list:`${evidenceLabel}-requests.json`,scene_accepted:false,next_scene_authorized:false};
  const save=async()=>{await writeFile(new URL(`${evidenceLabel}-requests.json`,out),JSON.stringify({origin,profile,scope:summary.environment,requests:rows},null,2)+'\n');await writeFile(new URL(`${evidenceLabel}-checks.json`,out),JSON.stringify(summary,null,2)+'\n');};
  on('Page.frameNavigated',p=>{if(!p.frame.parentId)navigation++;});
  on('Network.requestWillBeSent',p=>{
    if(!current)return;
    const row={page:current.path,requestId:p.requestId,url:p.request.url,method:p.request.method,resourceType:p.type,initiatorType:p.initiator.type,forbiddenGameResource:forbidden(p.request.url),status:null,failed:null};
    if(p.redirectResponse){const prior=requestMap.get(p.requestId);if(prior){prior.status=p.redirectResponse.status;prior.redirectedTo=p.request.url;}}
    rows.push(row);requestMap.set(p.requestId,row);inflight.add(p.requestId);lastEvent=Date.now();
  });
  on('Network.responseReceived',p=>{const r=requestMap.get(p.requestId);if(r){r.status=p.response.status;r.mimeType=p.response.mimeType;r.fromDiskCache=!!p.response.fromDiskCache;r.fromServiceWorker=!!p.response.fromServiceWorker;r.fromPrefetchCache=!!p.response.fromPrefetchCache;}lastEvent=Date.now();});
  on('Network.loadingFinished',p=>{inflight.delete(p.requestId);lastEvent=Date.now();});
  on('Network.loadingFailed',p=>{const r=requestMap.get(p.requestId);if(r)r.failed={error:p.errorText,canceled:!!p.canceled,blockedReason:p.blockedReason||null};inflight.delete(p.requestId);lastEvent=Date.now();});
  const interceptErrors=[];
  on('Fetch.requestPaused',p=>{
    const external=!p.request.url.startsWith(origin+'/');
    if(external){blocked.add(p.request.url);send('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'}).catch(e=>interceptErrors.push(e.message));}
    else send('Fetch.continueRequest',{requestId:p.requestId}).catch(e=>interceptErrors.push(e.message));
  });
  await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBypassServiceWorker',{bypass:true});
  await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  summary.browser=(await send('Browser.getVersion')).product;
  try{
    for(const page of ['/docs/index.html','/docs/claude-code-review.html']){
      current={path:page,url:origin+page,status:'working'};pages.push(current);inflight=new Set();lastEvent=Date.now();
      await send('Network.clearBrowserCache');await send('Storage.clearDataForOrigin',{origin,storageTypes:'all'});
      const before=navigation;await send('Page.navigate',{url:current.url});
      let loaded=false;for(let i=0;i<100;i++){if(navigation>before&&await run('document.readyState==="complete"')){loaded=true;break;}await sleep(100);}assert.ok(loaded,'local document loaded within bounded wait');
      // Scroll only this public article to trigger native lazy assets/comments; no game interaction.
      const heights=await run('({height:document.documentElement.scrollHeight,viewport:innerHeight})');
      let totalScrolls=0;
      while(totalScrolls<80){const atEnd=await run('scrollY+innerHeight>=document.documentElement.scrollHeight-2');if(atEnd)break;await send('Input.dispatchKeyEvent',{type:'keyDown',key:'PageDown',code:'PageDown',windowsVirtualKeyCode:34});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'PageDown',code:'PageDown',windowsVirtualKeyCode:34});await sleep(90);totalScrolls++;}
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End',windowsVirtualKeyCode:35,modifiers:2});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'End',code:'End',windowsVirtualKeyCode:35,modifiers:2});
      for(let i=0;i<50;i++){if(inflight.size===0&&Date.now()-lastEvent>=600)break;await sleep(100);}assert.equal(inflight.size,0,'all local/intercepted requests completed');
      const selected=rows.filter(r=>r.page===page),forbiddenRows=selected.filter(r=>r.forbiddenGameResource);
      const localFailures=selected.filter(r=>r.url.startsWith(origin+'/')&&(r.failed||r.status>=400));
      const externalRows=selected.filter(r=>!r.url.startsWith(origin+'/'));
      current.status=forbiddenRows.length?'failed':'passed';current.requestCount=selected.length;current.gameResourceCount=forbiddenRows.length;current.failures=localFailures;current.blockedExternal=externalRows.map(r=>({url:r.url,resourceType:r.resourceType,failed:r.failed,intentionallyBlocked:blocked.has(r.url)}));
      current.cache={clearBeforeNavigation:true,disabled:true,storageClearedForIsolatedOrigin:true,serviceWorkerBypassed:true,observedLocalCacheHits:selected.filter(r=>r.url.startsWith(origin+'/')&&(r.fromDiskCache||r.fromServiceWorker||r.fromPrefetchCache)).length};
      current.title=await run('document.title');current.articleCoverage={initialViewport:true,pageDownCount:totalScrolls,documentHeight:heights.height,viewport:heights.viewport,endReached:await run('scrollY+innerHeight>=document.documentElement.scrollHeight-2'),purpose:'Trigger lazy public article images/comment request; no game or performance measurements'};
      current.documentSHA256=hash(await readFile(path.join(repo,page.slice(1))));
      assert.equal(selected.find(r=>r.url===current.url&&r.resourceType==='Document')?.status,200);
      assert.equal(current.cache.observedLocalCacheHits,0);assert.equal(forbiddenRows.length,0,'no game/Three/atlas/script requests, including blocked external requests');
      await save();
    }
    const staticResults=await staticEvidence(out);assert.equal(staticResults.direct_game_reference_count,0);
    assert.deepEqual(interceptErrors,[]);summary.status='passed_scoped';summary.static_pages=staticResults.pages.length;summary.static_evidence='static-references.json';summary.production_unchanged=true;
    for(const [file,expected] of Object.entries(production))assert.equal(hash(await readFile(path.join(repo,file))),expected);
    summary.production_hashes=production;summary.runtimeExceptions=errors;summary.totalGameResourceRequests=rows.filter(r=>r.forbiddenGameResource).length;
    summary.boundaries=['Two-page real network evidence only, Chrome headless desktop; static references cover docs HTML but do not prove every page/browser execution','All unrelated public Internet requests blocked before network. Third-party code execution and online analytics/comment behavior are outside this scoped result','PageDown/End only exercise public article lazy loads; no mouse/gameplay, no startup/frame or walking performance','Resource-budget remains failed; scene/next-scene acceptance false; true-device/author/people gates unchanged'];
    summary.fixtureFailures=rows.filter(r=>r.url.startsWith(origin+'/')&&(r.failed||r.status>=400));summary.next='Stop for independent supervisor isolation review and resource design-option review.';await save();
    console.log(JSON.stringify({status:summary.status,pages:pages.map(p=>({path:p.path,requests:p.requestCount,gameResources:p.gameResourceCount,localFailures:p.failures.length,externalBlocked:p.blockedExternal.length})),staticPages:summary.static_pages,gameRequests:summary.totalGameResourceRequests}));
  }catch(error){summary.status='failed';summary.failure=error.stack;await save();throw error;}
  finally{await send('Fetch.disable').catch(()=>{});}
}
