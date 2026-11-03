#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit,unquote
import gzip,mimetypes,threading,time
import argparse
parser=argparse.ArgumentParser(description='Local 1 Mbps / 150 ms loading comparison; third-party requests are stubbed in this preview only.')
parser.add_argument('--before',type=Path,required=True,help='Directory containing the pre-change site snapshot')
parser.add_argument('--port',type=int,default=8772)
args=parser.parse_args()
from site_paths import SITE_ROOT as ROOT
BEFORE=args.before.resolve()
if (BEFORE / 'docs/index.html').is_file():
 BEFORE = BEFORE / 'docs'
RATE=125000;LATENCY=.15;lock=threading.Lock();next_slot=0
PROBE='''<script>(()=>{let lcp=0,cls=0;for(const type of ['largest-contentful-paint','layout-shift'])try{new PerformanceObserver(list=>{for(const e of list.getEntries()){if(type==='largest-contentful-paint')lcp=e.startTime;else if(!e.hadRecentInput)cls+=e.value}}).observe({type,buffered:true})}catch{}addEventListener('DOMContentLoaded',()=>setTimeout(()=>{const n=performance.getEntriesByType('navigation')[0],o=document.createElement('output');o.id='loading-measurement';o.hidden=true;o.textContent=JSON.stringify({profile:'1Mbps,150ms TTFB,gzip,no-store,third-party stubs',ttfb:n.responseStart,htmlEnd:n.responseEnd,domReady:n.domContentLoadedEventEnd,htmlEncoded:n.encodedBodySize,htmlDecoded:n.decodedBodySize,paint:performance.getEntriesByType('paint').map(e=>({name:e.name,time:e.startTime})),lcp,cls,resources:performance.getEntriesByType('resource').map(e=>({name:e.name,duration:e.duration,size:e.transferSize,encoded:e.encodedBodySize}))});document.body.append(o)},1000),{once:true})})();</script>'''
class Preview(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  global next_slot
  url=unquote(urlsplit(self.path).path)
  if url=='/__third-party.js':data=b'/* Isolated third-party network for repeatable local loading measurement. */';kind='text/javascript'
  else:
   base=BEFORE if url.startswith('/before/') else ROOT;relative=(url.removeprefix('/before/') if base==BEFORE else url.lstrip('/')) or 'index.html'
   path=(base/relative).resolve()
   if not path.is_relative_to(base) or not path.is_file():self.send_error(404);return
   data=path.read_bytes();kind=mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
   if path.suffix=='.html':data=data.decode().replace('</head>',PROBE+'</head>').replace('https://static.cloudflareinsights.com/beacon.min.js','/__third-party.js?cloudflare').encode()
   if path.name=='comments.js':data=data.replace(b'https://giscus.app/client.js',b'/__third-party.js?giscus')
  compress=kind.startswith('text/') or kind in ('application/javascript','image/svg+xml','application/json')
  if compress:data=gzip.compress(data)
  time.sleep(LATENCY);self.send_response(200);self.send_header('Content-Type',kind);self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store')
  if compress:self.send_header('Content-Encoding','gzip')
  self.end_headers()
  try:
   for start in range(0,len(data),2048):
    chunk=data[start:start+2048]
    with lock:slot=max(next_slot,time.monotonic());next_slot=slot+len(chunk)/RATE
    time.sleep(max(0,slot-time.monotonic()));self.wfile.write(chunk);self.wfile.flush()
  except (BrokenPipeError,ConnectionResetError):pass
print(f'Loading comparison at http://127.0.0.1:{args.port}/ (before: /before/); no-store, gzip, 1 Mbps, 150 ms',flush=True)
ThreadingHTTPServer(('127.0.0.1',args.port),Preview).serve_forever()
