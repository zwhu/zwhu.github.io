// Browser input and observation only. No production state mutation or DOM clicks.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {serveSite} from './keyboard-scenarios.mjs';

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export const observation = `(() => {
  if (!window.careerPrototype) return null;
  const s = window.careerPrototype.snapshot(), conversation = document.querySelector('#conversation');
  const buttons = [...document.querySelectorAll('#choices button')].filter(b => b.getClientRects().length && !b.disabled);
  const body = document.querySelector('#dialogue');
  const style = getComputedStyle(conversation);
  const glintContext=document.querySelector('#skill-glints')?.getContext('2d');
  const litPixels=(x,y)=>{if(!glintContext)return 0;const pixels=glintContext.getImageData(x,y,22,22).data;let count=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])count++;return count;};
  return {...s, dialogue: body.textContent.trim(), nameplate: document.querySelector('#nameplate')?.textContent || '',
    conversationVisible: !!conversation.getClientRects().length && style.display!=='none' && style.visibility!=='hidden',
    conversationHiddenAttr: conversation.hidden, conversationDisplay: style.display,
    paused: document.querySelector('#pause-menu')?.open || false,
    task: document.querySelector('#task').textContent, focus: document.activeElement.id || document.activeElement.tagName,
    fontSize: parseFloat(getComputedStyle(body).fontSize),
    buttons: buttons.map(b => ({label:b.textContent.trim(), action:b.dataset.action || b.dataset.event || b.id,
      caret:b.classList.contains('continue-caret'), selected:b===document.activeElement})),
    learningHints:{book:litPixels(14,38),computer:litPixels(65,114)},
    storage: localStorage.getItem(s.saveKey), worldFrame:window.__playtestWorld || null,
    inputCount:window.__playtestInput?.length || 0, input: (window.__playtestInput || []).slice(-80)};
})()`;

export async function startBrowserSite() {
  const site = await serveSite({repository:true});
  return {...site, close:() => new Promise(resolve => site.server.close(resolve))};
}

export async function openBrowser(url, out) {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'career-playtest-chrome-'));
  const executable = process.env.CHROME || (existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome-stable');
  const chrome = spawn(executable, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--enable-unsafe-swiftshader', '--hide-scrollbars', '--disable-dev-shm-usage', 'about:blank'], {stdio:['ignore','ignore','pipe']});
  let socket, sequence = 0;
  const pending = new Map(), errors = [], responses = [], inputRequests = [];
  try {
    const port = await new Promise((resolve,reject) => {
      let log = '';
      const timer = setTimeout(() => reject(Error('Chrome startup timeout: '+log.slice(-500))), 15000);
      chrome.stderr.on('data', chunk => {log += chunk;const m=log.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);if(m){clearTimeout(timer);resolve(Number(m[1]));}});
      chrome.once('error', error => {clearTimeout(timer);reject(error);});
      chrome.once('exit', code => {clearTimeout(timer);reject(Error('Chrome exited '+code));});
    });
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {method:'PUT'})).json();
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve,reject) => {socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data), p = pending.get(message.id);
      if(p){clearTimeout(p.timer);pending.delete(message.id);message.error?p.reject(Error(message.error.message)):p.resolve(message.result);}
      if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      if(message.method==='Network.responseReceived')responses.push({url:message.params.response.url,status:message.params.response.status});
    });
    const send = (method,params={}) => new Promise((resolve,reject) => {
      if(method.startsWith('Input.dispatch'))inputRequests.push({method,params});
      const id=++sequence, timer=setTimeout(() => {pending.delete(id);reject(Error('CDP timeout: '+method));},15000);
      pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
    });
    const read = async expression => {
      const result = await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
      if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:960,deviceScaleFactor:1,mobile:false});
    await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__playtestDocument=crypto.randomUUID();window.__playtestInput=[];for(const type of ['keydown','keyup','pointerdown'])window.addEventListener(type,e=>window.__playtestInput.push({type,key:e.key||'',trusted:e.isTrusted,repeat:e.repeat||false,focus:document.activeElement.id||document.activeElement.tagName}),true);
      window.__playtestWorld={frames:0,props:[],spriteDraws:[]};
      const clear=CanvasRenderingContext2D.prototype.clearRect,fill=CanvasRenderingContext2D.prototype.fillRect,draw=CanvasRenderingContext2D.prototype.drawImage;
      const main=ctx=>ctx.canvas.parentElement?.id==='stage'&&!ctx.canvas.id;
      CanvasRenderingContext2D.prototype.clearRect=function(...args){if(main(this)){window.__playtestWorld.frames++;window.__playtestWorld.props=[];window.__playtestWorld.spriteDraws=[];}return Reflect.apply(clear,this,args);};
      CanvasRenderingContext2D.prototype.fillRect=function(...args){if(main(this)&&args[2]>=300&&args[3]>=200){window.__playtestWorld.frames++;window.__playtestWorld.props=[];window.__playtestWorld.spriteDraws=[];}return Reflect.apply(fill,this,args);};
      CanvasRenderingContext2D.prototype.drawImage=function(source,...args){const src=source?.currentSrc||source?.src||'';if(main(this)&&/(hefei-office-(day|night)|typing-team-v1|sit-back|player-walk-v2-sheet)/.test(src)&&window.__playtestWorld.spriteDraws.length<20)window.__playtestWorld.spriteDraws.push({src,args,opacity:this.globalAlpha});if(main(this)&&src.includes('/hefei-props/')&&window.__playtestWorld.props.length<16)window.__playtestWorld.props.push({src,args,opacity:this.globalAlpha});return Reflect.apply(draw,this,[source,...args]);};`});
    await send('Page.navigate',{url});await send('Page.bringToFront');
    const snap = () => read(observation);
    const until = async (predicate,timeout=5000) => {
      const deadline=Date.now()+timeout;let value;
      while(Date.now()<deadline){value=await snap();if(value&&predicate(value))return value;await delay(60);}
      throw Error('Browser condition timeout: '+JSON.stringify(value&&{state:value.state,chapter:value.chapter.state,dialogue:value.dialogue,buttons:value.buttons,position:value.position}));
    };
    await until(s => s.state!=='loading',15000);
    const reload = async () => {
      const previous=await read('window.__playtestDocument');
      await send('Page.reload',{ignoreCache:true});
      const deadline=Date.now()+15000;
      while(Date.now()<deadline){
        try{if(await read('window.__playtestDocument')!==previous&&await read('Boolean(window.__playtestDocument&&window.careerPrototype)')){await until(s=>s.state!=='loading',15000);return;}}catch(error){if(!/context|Cannot find/i.test(error.message))throw error;}
        await delay(60);
      }
      throw Error('Reload did not produce a new ready document');
    };
    const codes={Enter:13,Escape:27,ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,Tab:9,' ':32};
    const keyParams = key => ({key,code:key===' '?'Space':key.length===1?'Key'+key.toUpperCase():key,
      windowsVirtualKeyCode:codes[key]||key.toUpperCase().charCodeAt(0),...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});
    const key = async (value,duration=0) => {
      await send('Input.dispatchKeyEvent',{type:'keyDown',...keyParams(value)});
      if(duration)await delay(duration);
      await send('Input.dispatchKeyEvent',{type:'keyUp',...keyParams(value)});await delay(85);
    };
    const holdEnter = async () => {
      await send('Input.dispatchKeyEvent',{type:'keyDown',...keyParams('Enter')});await delay(90);
      const first=await snap();
      for(let i=0;i<3;i++){await send('Input.dispatchKeyEvent',{type:'keyDown',...keyParams('Enter'),autoRepeat:true});await delay(55);}
      const repeated=await snap();await send('Input.dispatchKeyEvent',{type:'keyUp',...keyParams('Enter')});
      return {first,repeated};
    };
    const pointer = async (x,y) => {
      await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});await delay(100);
    };
    const shot = async name => {
      await mkdir(out,{recursive:true});
      await read(`document.querySelector('.game-shell').scrollIntoView({block:'center'})`);await delay(50);
      const box=await read(`(()=>{const r=document.querySelector('.game-shell').getBoundingClientRect();return {x:Math.max(0,r.x+scrollX),y:Math.max(0,r.y+scrollY),width:r.width,height:r.height};})()`);
      const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{...box,scale:1}});
      await writeFile(path.join(out,name),Buffer.from(result.data,'base64'));return name;
    };
    const close = async () => {
      for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Browser closed'));}pending.clear();
      socket.close();
      const ended=new Promise(resolve => chrome.once('exit',resolve));chrome.kill();await Promise.race([ended,delay(2000)]);
      await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});
    };
    return {send,read,snap,until,reload,key,holdEnter,pointer,shot,errors,responses,inputRequests,close,profile,port};
  } catch(error) {
    socket?.close();chrome.kill();await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});throw error;
  }
}
