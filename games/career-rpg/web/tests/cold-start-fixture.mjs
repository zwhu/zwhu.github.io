// Single shared body scheduler, not CDP + server double throttling. No production edits.
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import path from 'node:path';
import {serveSite} from './keyboard-scenarios.mjs';
const delay=ms=>new Promise(r=>setTimeout(r,Math.max(0,Math.ceil(ms))));
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function serveCandidate(){
  const rate=125000,latency=150,chunkLimit=4096,queue=[],requests=[],chunks=[],periods=[];
  let pumping=false,active=true;
  const pump=async()=>{
    if(pumping)return;pumping=true;
    const period={start:performance.now(),bytes:0,end:null};periods.push(period);
    while(queue.length&&active){
      const item=queue.shift();
      if(item.res.destroyed){item.resolve();continue;}
      const bytes=Math.min(chunkLimit,item.body.length-item.offset);
      const deadline=period.start+(period.bytes+bytes)*1000/rate;
      while(performance.now()<deadline)await delay(deadline-performance.now());
      const at=performance.now();item.res.write(item.body.subarray(item.offset,item.offset+bytes));
      item.offset+=bytes;period.bytes+=bytes;
      chunks.push({request:item.record.id,at,bytes,period:periods.length-1,cumulative:period.bytes});
      if(item.offset<item.body.length)queue.push(item);
      else{item.res.end();item.record.completed=at;item.record.sentBytes=item.offset;item.resolve();}
    }
    period.end=performance.now();pumping=false;
  };
  const delivery=async({req,res,file,data,headers})=>{
    const arrived=performance.now(),url=new URL(req.url,'http://localhost');
    let body=data,kind='production',encoding='identity';
    if(url.searchParams.get('budget-probe')){body=Buffer.alloc(131072,97);headers['Content-Type']='application/octet-stream';kind='parallel-calibration';}
    else if(url.searchParams.has('budget-calibration')){
      kind='calibration-page';headers['Content-Type']='text/html';
      body=Buffer.from('<!doctype html><html><head><link rel="icon" href="data:,"></head><body><button id="confirm">观察链确认</button><script>window.calibration={confirmed:false};document.querySelector("button").onclick=()=>window.calibration.confirmed=true;window.probe=Promise.all(["a","b"].map(x=>fetch("./art/player-walk-v1.png?budget-probe="+x).then(async r=>({bytes:(await r.arrayBuffer()).byteLength,status:r.status}))));</script></body></html>');
    }
    const raw=body;
    if(kind!=='parallel-calibration'&&['.html','.css','.mjs','.js','.json'].includes(path.extname(file))){body=gzipSync(raw,{level:9});encoding='gzip';assert.deepEqual(gunzipSync(body),raw);headers['Content-Encoding']='gzip';headers.Vary='Accept-Encoding';}
    headers['Content-Length']=String(body.length);
    const record={id:requests.length,url:req.url,file,kind,arrived,rawBytes:raw.length,bodyBytes:body.length,rawSHA256:hash(raw),bodySHA256:hash(body),encoding,headers};requests.push(record);
    while(performance.now()<arrived+latency)await delay(arrived+latency-performance.now());
    record.headersAt=performance.now();
    if(!active||res.destroyed)return;
    res.writeHead(200,headers);
    await new Promise(resolve=>{queue.push({res,body,offset:0,record,resolve});void pump();});
  };
  const site=await serveSite({repository:true,delivery});
  return {...site,requests,chunks,periods,settings:{aggregateBodyBytesPerSecond:rate,latencyMs:latency,chunkBytes:chunkLimit,cdpShaping:false,compression:'text gzip level9; PNG identity; headers outside body cap'},stop:()=>{active=false;for(const item of queue.splice(0)){item.res.destroy();item.resolve();}site.server.closeAllConnections();site.server.close();}};
}
