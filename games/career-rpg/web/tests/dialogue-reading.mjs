import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

export async function fixtureScript(){
  const d=JSON.parse(await readFile(new URL('../../design/chapter-01.json',import.meta.url),'utf8'));
  const save=JSON.stringify({schema:1,chapter:d.id,state:'complete',flags:d.legalSnapshots.complete[0]});
  return `localStorage.setItem(${JSON.stringify(d.savePolicy.key)},${JSON.stringify(save)});window.__readingKeys=[];window.__readingPointers=[];for(const type of ['keydown','keyup'])window.addEventListener(type,e=>window.__readingKeys.push({type,key:e.key,trusted:e.isTrusted,focus:e.target.id||e.target.dataset?.action||e.target.tagName}),true);window.addEventListener('pointerdown',e=>window.__readingPointers.push(e.type),true);`;
}

export async function runReading(ctx){
  const {send,run,state,key,reload,shot,out,evidenceLabel,errors,url}=ctx;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const result={stage:'dialogue-reading',scene:'nanjing-office',url,fixture:'Complete legal checkpoint on page load; long system case appends 12 copies of its existing paragraph only in isolated test DOM. No script focus/scroll assignments or story function calls.',cases:[],hashes:{}};
  for(const name of ['main.mjs','index.html','style.css'])result.hashes[name]=createHash('sha256').update(await readFile(new URL('../'+name,import.meta.url))).digest('hex');
  const metrics=()=>run(`(()=>{
    const d=document.querySelector('#dialogue'),box=d.getBoundingClientRect();let clip={top:box.top+d.clientTop,bottom:box.top+d.clientTop+d.clientHeight,left:box.left+d.clientLeft,right:box.left+d.clientLeft+d.clientWidth};
    for(let p=d.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),r=p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(s.overflowY)){clip.top=Math.max(clip.top,r.top+p.clientTop);clip.bottom=Math.min(clip.bottom,r.top+p.clientTop+p.clientHeight);}if(/auto|scroll|hidden|clip/.test(s.overflowX)){clip.left=Math.max(clip.left,r.left+p.clientLeft);clip.right=Math.min(clip.right,r.left+p.clientLeft+p.clientWidth);}}
    clip.top=Math.max(0,clip.top);clip.bottom=Math.min(innerHeight,clip.bottom);clip.left=Math.max(0,clip.left);clip.right=Math.min(innerWidth,clip.right);
    const rect=p=>{const range=document.createRange();range.selectNodeContents(p);return [...range.getClientRects()].map(r=>({top:r.top,bottom:r.bottom,left:r.left,right:r.right}));};
    const first=rect(d.firstElementChild)[0],last=rect(d.lastElementChild).at(-1),visible=r=>r&&r.top>=clip.top-.75&&r.bottom<=clip.bottom+.75&&r.left>=clip.left-.75&&r.right<=clip.right+.75&&[r.left+1,(r.left+r.right)/2,r.right-1].every(x=>[r.top+1,(r.top+r.bottom)/2,r.bottom-1].every(y=>d.contains(document.elementFromPoint(x,y))));
    return {focus:document.activeElement.id||document.activeElement.dataset.action||document.activeElement.dataset.event,focusVisible:document.activeElement.matches(':focus-visible'),outline:getComputedStyle(document.activeElement).outlineStyle,scrollTop:d.scrollTop,scrollHeight:d.scrollHeight,clientHeight:d.clientHeight,windowY:scrollY,stageScrollTop:document.querySelector('#stage').scrollTop,stageScrollLeft:document.querySelector('#stage').scrollLeft,clip,first,last,firstVisible:visible(first),lastVisible:visible(last),lastParagraph:d.lastElementChild.textContent,prose:d.textContent};
  })()`);
  const readingKey=async k=>{await key(k);await sleep(240);};
  let activeCase;
  try{
    for(const kind of ['complete','long-system'])for(const width of [1280,375]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await reload();
      if(kind==='long-system'){
        await key('Enter');assert.equal(await run('document.querySelector("#system-dialog").open'),true);
        await run(`(()=>{const d=document.querySelector('#dialogue'),text=d.lastElementChild.textContent;for(let n=0;n<12;n++){const p=document.createElement('p');p.textContent=text;p.dataset.fixture='long-system';d.append(p);}})()`);
      }
      await sleep(120);const before=(await state());
      activeCase={kind,width,observations:[],tabTrail:[],result:'pending'};result.cases.push(activeCase);
      activeCase.initial=await metrics();activeCase.originalProse=activeCase.initial.prose;
      assert.ok(activeCase.initial.scrollHeight>activeCase.initial.clientHeight,'Representative case must overflow');
      for(const k of ['PageDown','PageUp','End','Home']){await readingKey(k);activeCase.observations.push({key:k,scope:'default option focus',...(await metrics())});}
      for(let n=0;n<16;n++){
        if((await metrics()).focus==='dialogue')break;
        await key('Tab',0,8);activeCase.tabTrail.push(await metrics());
      }
      activeCase.bodyReachable=(await metrics()).focus==='dialogue';
      if(activeCase.bodyReachable){
        await readingKey('Home');activeCase.first=await metrics();await shot(`${evidenceLabel}-${kind}-${width}-first.png`);
        const windowY=activeCase.first.windowY;
        for(const k of ['PageDown','PageDown','PageUp','End','PageDown']){await readingKey(k);activeCase.observations.push({key:k,scope:'body focus',...(await metrics())});}
        activeCase.last=await metrics();await shot(`${evidenceLabel}-${kind}-${width}-last.png`);
        activeCase.readable=activeCase.first.firstVisible&&activeCase.last.lastVisible&&activeCase.last.focusVisible&&activeCase.last.outline!=='none'&&activeCase.first.scrollTop<1&&activeCase.last.scrollTop>=activeCase.last.scrollHeight-activeCase.last.clientHeight-1;
        activeCase.pageStayed=activeCase.observations.every(o=>o.windowY===activeCase.initial.windowY)&&windowY===activeCase.initial.windowY&&activeCase.first.stageScrollTop===0&&activeCase.observations.filter(o=>o.scope==='body focus').every(o=>o.windowY===windowY&&o.stageScrollTop===0&&o.stageScrollLeft===0);
        assert.equal(activeCase.last.prose,activeCase.originalProse,'Keys must not remove or shorten prose');
      }else{activeCase.readable=false;activeCase.pageStayed=false;await shot(`${evidenceLabel}-${kind}-${width}-unreachable.png`);}
      // Return using native Tab and direction keys, then confirm the existing return option.
      let option=false;
      for(let n=0;n<18;n++){option=await run('document.activeElement.matches("#choices button")');if(option)break;await key('Tab');}
      assert.ok(option,'Return options not keyboard-reachable');
      for(let n=0;n<8&&(await metrics()).focus!=='close-dialogue';n++)await key('ArrowRight');
      assert.equal((await metrics()).focus,'close-dialogue');await key('Enter');
      const after=await state();assert.deepEqual(after.chapter,before.chapter);assert.deepEqual(after.position,before.position);
      activeCase.returnAndConfirmNoMovement=true;activeCase.keys=await run('window.__readingKeys');activeCase.pointers=await run('window.__readingPointers');
      assert.ok(activeCase.keys.every(k=>k.trusted));assert.deepEqual(activeCase.pointers,[]);
      activeCase.result=activeCase.readable&&activeCase.pageStayed?'passed':'failed';
      await writeFile(new URL(`${evidenceLabel}-cases.json`,out),JSON.stringify(result.cases,null,2)+'\n');
    }
    assert.deepEqual(errors,[]);
    result.result=result.cases.every(c=>c.result==='passed')?'existing-keys-sufficient':'reading-gap-reproduced';
    console.log(JSON.stringify({result:result.result,cases:result.cases.map(c=>({kind:c.kind,width:c.width,bodyReachable:c.bodyReachable,readable:c.readable,pageStayed:c.pageStayed}))}));
    if(result.result==='reading-gap-reproduced')process.exitCode=1;
  }catch(error){result.result='failed';result.error=error.stack;result.activeCase=activeCase;await shot(`${evidenceLabel}-error.png`);throw error;}
  finally{await writeFile(new URL(`${evidenceLabel}-summary.json`,out),JSON.stringify(result,null,2)+'\n');}
}
