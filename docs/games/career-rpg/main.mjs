import {nearbyAll,integrateWalk,MOVE_SPEED,blocked} from './engine/world.mjs';
import {createChapter} from './story.mjs';
import {actionsFor,pendingMarkers,expressionFor,sceneTarget,presentCast,transitionBeat,transitionFinished} from './chapters/logic.mjs';
import {createActor,seatedFrame,motionForRender,walkClock,scanAtlas} from './actors.mjs';
import {createView,maskedImage} from './engine/view.mjs';
import {encodePage,inspectPlay} from './engine/play-state.mjs';
import {GAME_TITLE} from './title.mjs';
import {wrapNarrow} from './narrow-wrap.mjs';
import {sceneRequest,createDirector,validateScript,walkIntent} from './cinematic/director.mjs';
const requested=sceneRequest(location.search);
const cinematicName=requested.cinematic;
const chapterKey=requested.chapter;
const cinematicOn=!!cinematicName;
// One chapter module. HANGZHOU, hefei and nanjing stay independent of the renderer.
const chapterUrl=chapterKey==='hangzhou'?'./chapters/hangzhou.mjs':chapterKey==='hefei'?'./chapters/hefei.mjs':'./chapters/nanjing.mjs';
const chapterModule=await import(chapterUrl);
const sceneConfig=chapterModule.HANGZHOU||chapterModule.HEFEI||chapterModule.OFFICE;
document.title=GAME_TITLE;
const gameTitle=document.querySelector('#game-title');if(gameTitle)gameTitle.textContent=GAME_TITLE;

const stage=document.querySelector('#stage');
const loading=document.querySelector('#loading');
const task=document.querySelector('#task');
const interaction=document.querySelector('#interaction');
const conversation=document.querySelector('#conversation');
const speakerArrow=document.createElement('span');
speakerArrow.id='speaker-arrow';speakerArrow.hidden=true;speakerArrow.setAttribute('aria-hidden','true');
stage.append(speakerArrow);
const systemDialog=document.querySelector('#system-dialog');
document.documentElement.classList.remove('no-js');
const failure=document.querySelector('#game-failure');
function showFailure(message){
  setState('error');confirmationKeys.clear();moving=false;cancelAnimationFrame(raf);
  // A lost canvas can retain the browser's failure layer even after CSS hides it.
  view?.canvas.remove();
  conversation.hidden=true;if(systemDialog.open)systemDialog.close();
  document.querySelector('#manual').disabled=true;
  stage.removeAttribute('tabindex');stage.setAttribute('role','region');stage.setAttribute('aria-label','办公室暂不可用，请重试或继续文字阅读');
  stage.closest('.game-shell').classList.add('has-failure');failure.hidden=false;
  document.querySelector('#failure-message').textContent=message;
  document.querySelector('#retry-game').focus();
}
const actorViews=new Map(),atlasData={};
let dialogueSpeaker='player',currentSpeaker='player',facing='down',walkTime=0,moving=false,dialogueObject=null,lastMovedAt=-Infinity;
const keys=new Set();
let position={x:172,y:154},state='loading',active=null,chapter,snapshot,storage,saving=true;
let player,previous=0,walkRemainder=0,raf=0,choicesReady=0,dismissible=true;
let lastUISnapshot=null,lastInteraction='',selectedTargetID='';
let castSnapshot=null,castCache=sceneConfig;
let transitionEvent=null,transitionStarted=0,transitionIndex=-1,awardOpen=false,awardFlashUntil=0,returnToJourney=false,journeyMode=null;
let cinematicDirector=null,cinematicView=null,simFrame=0;
let chapterDefinition,playSavingReady=false,restoringPlay=false,suspended=false,currentAward='',queuedAward=null;
let lastTransitionEvent=null,lastTransitionIndex=-1,loopReady=false;
function cinematicClock(){return Math.round(simFrame*1000/60);}
let audioCtx=null;const skillAudioLog=[];
function ensureAudio(){try{if(!audioCtx)audioCtx=new AudioContext();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx;}catch{return null;}}
function playSkillDing(){
  const ctx=ensureAudio();if(!ctx)return;
  const start=ctx.currentTime,notes=[660,880,1320];
  for(let i=0;i<notes.length;i++){
    const when=start+i*.06,osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type='sine';osc.frequency.setValueAtTime(notes[i],when);osc.frequency.exponentialRampToValueAtTime(notes[i]*1.04,when+.09);
    gain.gain.setValueAtTime(.0001,when);gain.gain.exponentialRampToValueAtTime(.12,when+.015);gain.gain.exponentialRampToValueAtTime(.0001,when+.16);
    osc.connect(gain);gain.connect(ctx.destination);osc.start(when);osc.stop(when+.18);
    skillAudioLog.push({kind:'oscillator-start',frequency:notes[i],when});
  }
}
window.careerSkillAudio=()=>skillAudioLog.map(entry=>({...entry}));
let dayImage,nightImage,roomImage,lampImage,dimOpacity=0,lampOn=false,card,cardImg,caption,glintCanvas,glintCtx,view;
const propViews=[];
function readyRoles(){return new Set((chapter?.skillSlots?.(snapshot)||[]).filter(skill=>skill.status==='ready').map(skill=>skill.role));}
function visibleRoom(){
  if(!snapshot)return sceneConfig;
  if(castSnapshot===snapshot)return castCache;
  const cast=presentCast(sceneConfig,snapshot);
  const ready=readyRoles();
  const objects=ready.size?sceneConfig.objects.filter(object=>cast.objects.includes(object)||ready.has(object.role)):cast.objects;
  castCache=cast===sceneConfig&&!ready.size?sceneConfig:{...sceneConfig,actors:cast.actors,objects};
  castSnapshot=snapshot;return castCache;
}
function chapterSpawn(){return {...sceneConfig.entryPoints[chapter.initial().state]};}
function eventTitle(event){return sceneConfig.actionTitles?.[event]||actionTitles[event];}
let pageContext=null,dialogueBack=null,dialogueReturnFocus=stage,dialoguePlate='',lastGameFocus=stage;
const confirmationKeys=new Set();
const readingKeys=new Set(['PageUp','PageDown','Home','End','ArrowUp','ArrowDown']);
const movement=new Map([['ArrowLeft',[-1,0]],['a',[-1,0]],['ArrowRight',[1,0]],['d',[1,0]],['ArrowUp',[0,-1]],['w',[0,-1]],['ArrowDown',[0,1]],['s',[0,1]]]);
const actionTitles={open_forum_post:'打开论坛反馈',cto_rallies_team:'听 CTO 排查',confirm_feedback_reviewed:'重读论坛反馈',confirm_recheck_visited:'查看排查记录',confirm_impact_scope:'确认这次影响到谁',resume_narrative:'这轮排查先到这里',review_test_plan:'查看补测清单',review_trap_comment:'查看坑点注释',write_manual_entry:'把这一页写进手册',open_journey:'打开这段路程',notice_react:'看见下一章',finish_journey:'这段路程看完了'};
const pageLines={open_forum_post:['office-daily','office-n3','office-reaction'],cto_rallies_team:['incident-rally'],confirm_feedback_reviewed:['investigation-confirm-1'],confirm_recheck_visited:['investigation-confirm-3'],confirm_impact_scope:['investigation-confirm-2'],resume_narrative:['investigation-pending'],review_test_plan:['learning-test-first'],review_trap_comment:['learning-comment-first'],write_manual_entry:['learning-manual-1'],open_journey:['journey-open']};
function clearInput(){keys.clear();previous=0;walkRemainder=0;}
function setState(next){state=next;clearInput();}
function optionScope(){return state==='dialogue'?(systemDialog.open?systemDialog:conversation):state==='journey'?document.querySelector('#journey-map'):null;}
function enabledOptions(scope=optionScope()){return [...(scope?.querySelectorAll('.choices button')||[])].filter(b=>!b.disabled&&b.getAttribute('aria-disabled')!=='true'&&b.getClientRects().length);}
function focusElement(element){(element?.isConnected&&element.matches('button, [href], [tabindex]')&&!element.disabled&&element.getAttribute('aria-disabled')!=='true'&&element.getClientRects().length?element:stage).focus({preventScroll:true});}
function focusCurrentUI(){const scope=optionScope();if(scope){focusElement(scope.contains(lastGameFocus)?lastGameFocus:enabledOptions(scope)[0]);}else if(state==='explore')focusElement(lastGameFocus);}
function closeConversation(){
  if(pageContext?.choices.some(choice=>choice.id==='explore-office')){settleExplore();return;}
  if(!dismissible){focusCurrentUI();return;}
  const back=dialogueBack,returnFocus=dialogueReturnFocus;
  hideObjectCard();conversation.hidden=true;speakerArrow.hidden=true;dialogueObject=null;selectedTargetID='';if(systemDialog.open)systemDialog.close();setState('explore');
  if(back)back();else focusElement(returnFocus);
  if(!back)pageContext=null;
  savePlayState();
}
function capturePage(){return pageContext?{...pageContext,paragraphIds:pageContext.paragraphs.map(text=>chapterDefinition.dialogues.find(line=>(line.playerText??line.text)===text)?.id||''),selectedIndex:enabledOptions().indexOf(document.activeElement),object:dialogueObject,targetID:selectedTargetID}:null;}
function restorePage(page){
  dialogueObject=page.object;selectedTargetID=page.targetID;
  show(page.title,page.paragraphs,page.choices,page.canDismiss,page.speaker,page.system,{back:page.back,returnFocus:page.returnFocus,plate:page.plate||'',parent:page.parent,slots:page.slots,spoken:page.spoken});
  focusElement(enabledOptions()[Math.max(0,page.selectedIndex)]);
}
function show(title,paragraphs,choices=[],canDismiss=true,speaker=dialogueSpeaker,system=false,options={}){
  const content=document.querySelector('#dialogue-content');
  dialogueBack=options.back||null;dialogueReturnFocus=options.returnFocus||document.activeElement;
  dialoguePlate=options.plate||'';
  pageContext={title,paragraphs,choices,canDismiss,speaker,system,back:dialogueBack,returnFocus:dialogueReturnFocus,plate:dialoguePlate,parent:options.parent||null,slots:options.slots||null,spoken:!!options.spoken};
  currentSpeaker=speaker;
  if(system){conversation.hidden=true;systemDialog.append(content);}else{if(systemDialog.open)systemDialog.close();conversation.append(content);conversation.hidden=false;}
  setState('dialogue');dismissible=canDismiss;
  document.querySelector('#speaker').textContent=title;
  const portrait=document.querySelector('#portrait');
  const narrating=speaker==='narrator'||!sceneConfig?.actors?.some(actor=>actor.id===speaker);
  portrait.hidden=narrating;
  if(!narrating)drawPortrait(portrait,speaker);
  const body=document.querySelector('#dialogue');body.replaceChildren();
  for(const text of paragraphs){const p=document.createElement('p');p.dataset.narrow=text;p.textContent=text;body.append(p);}
  const container=document.querySelector('#choices');container.replaceChildren();
  for(const choice of choices){const button=document.createElement('button');button.type='button';button.textContent=choice.label;
    button.disabled=choice.disabled===true;
    if(choice.event)button.dataset.event=choice.event;if(choice.id)button.dataset.action=choice.id;
    // Key down/up isolation handles keyboard confirmation; a pointer double click still needs the short guard.
    button.addEventListener('click',event=>{if((event.detail>0&&performance.now()<choicesReady)||button.disabled||button.getAttribute('aria-disabled')==='true')return;choice.run();});container.append(button);}
  if(canDismiss){
    const button=document.createElement('button');button.type='button';button.id='close-dialogue';
    if(system)button.textContent=dialogueBack?'返回':'继续';
    else if(choices.length)button.textContent=dialogueBack?'返回':'继续探索';
    else{button.className='continue-caret';button.setAttribute('aria-label',dialogueBack?'返回':'继续');}
    button.addEventListener('click',event=>{if(event.detail===0||performance.now()>=choicesReady)closeConversation();});
    container.append(button);
  }
  choicesReady=performance.now()+180;
  if(options.spoken)conversation.dataset.spoken='1';else delete conversation.dataset.spoken;
  if(system&&!systemDialog.open)systemDialog.showModal();
  renderSkillSlots(options.slots||null);
  repaintNarrow();
  placeBubble();enabledOptions()[0]?.focus();updateUI();
  savePlayState();
}
function savePlayState(){
  if(!playSavingReady||!saving||restoringPlay||cinematicOn||!snapshot||!['explore','dialogue','transition','journey'].includes(state))return;
  const play={version:1,state,position:{...position},facing,
    page:state==='dialogue'?encodePage(capturePage()):null,award:awardOpen?currentAward:'',returnToJourney,
    transition:transitionEvent,index:Math.max(0,transitionIndex),queuedAward:queuedAward?.id||'',
    journey:state==='journey'||returnToJourney?{mode:journeyMode,progress:journeyProgress,arrived:journeyArrived,selection:Math.max(0,enabledOptions().indexOf(document.activeElement))}:null};
  if(!chapter.save(storage,{...snapshot,play}))document.querySelector('#save-status').textContent='本次状态未保存，刷新后回到上次保存的位置';
}
function saveTransitionCheckpoint(){
  if(lastTransitionEvent===transitionEvent&&lastTransitionIndex===transitionIndex)return;
  lastTransitionEvent=transitionEvent;lastTransitionIndex=transitionIndex;savePlayState();
}
function restoredChoice(choice){
  const transition=chapterDefinition.transitions.find(item=>item.event===(choice.event||'').replace(/^view_/,''));
  if(transition)return {...choice,label:choice.event.startsWith('view_')?eventTitle(transition.event)||transition.label:transition.label,run:()=>choice.event.startsWith('view_')?confirmPage(transition):sceneConfig.transitionLines?.[transition.event]?beginTransition(transition.event):accept(transition.event)};
  const actions={
    'continue-line':()=>{const next=chapter.actions(snapshot,'boss').find(item=>item.event==='boss_lets_try');if(next)confirmPage(next,false);},
    'skill-ok':finishSkillAward,'replay':confirmReplay,'explore-office':settleExplore,
    'confirm-replay':()=>{snapshot=chapter.initial();position=chapterSpawn();currentAward='';awardOpen=false;persist(enterScene);},
    'journey':()=>openJourney('bridge'),'bridge-hangzhou':()=>openJourney('to-hangzhou')
  };
  if(choice.id.startsWith('preface-')){
    const next=chapterDefinition.transitions.find(item=>item.event===choice.id.slice(8));
    if(next)return {...choice,run:()=>confirmPage(next,false)};
  }
  return Object.hasOwn(actions,choice.id)?{...choice,label:choice.id==='skill-ok'?'确定':choice.label,run:actions[choice.id]}:null;
}
function restoreSavedPage(page){
  const choices=page.choices.map(restoredChoice);if(choices.some(choice=>!choice))return false;
  dialogueObject=[...sceneConfig.objects,...sceneConfig.actors].find(object=>object.id===page.objectId)||null;
  const paragraphs=page.paragraphs.map((text,index)=>page.paragraphIds?.[index]?chapter.text(page.paragraphIds[index])||text:text);
  show(page.title,paragraphs,choices,page.canDismiss,page.speaker,page.system,{plate:page.plate,spoken:page.spoken,
    parent:page.parent,back:page.parent?()=>restoreSavedPage(page.parent):null,slots:page.manual?chapter.skillSlots(snapshot):null,returnFocus:stage});
  focusElement(enabledOptions()[Math.max(0,page.selectedIndex)]);
  if(dialogueObject)showObjectCard(dialogueObject);
  return true;
}
async function restorePlayState(saved){
  const play=inspectPlay(saved,sceneConfig.bounds);if(!play||blocked(play.position.x,play.position.y,sceneConfig))return false;
  restoringPlay=true;
  try{
    position={...play.position};facing=play.facing;
    if(play.state==='dialogue'){
      if(!restoreSavedPage(play.page))return false;
      currentAward=play.award||'';awardOpen=!!currentAward;
      returnToJourney=!!play.returnToJourney;
      if(returnToJourney&&play.journey){journeyMode=play.journey.mode;journeyArrived=!!play.journey.arrived;journeyProgress=play.journey.progress||0;}
      if(awardOpen){const skill=chapter.skillSlots(snapshot).find(item=>item.id===currentAward);if(skill)paintAwardIcon(skill);}
    }else if(play.state==='transition'&&sceneConfig.transitionBeats?.[play.transition]){
      transitionEvent=play.transition;transitionIndex=-1;
      const index=Math.min(play.index,sceneConfig.transitionBeats[transitionEvent].length-1);
      transitionStarted=performance.now()-index*sceneConfig.beatMs;setState('transition');
      queuedAward=chapter.skillSlots(snapshot)?.find(item=>item.id===play.queuedAward)||null;
      showNarrationBar(chapter.text(sceneConfig.transitionLines[transitionEvent]));applyBeat(sceneConfig.transitionBeats[transitionEvent][index]);
    }else if(play.state==='journey'&&['bridge','chapter','to-hangzhou'].includes(play.journey?.mode)){
      journeyArrived=!!play.journey.arrived;await openJourney(play.journey.mode,true);
      journeyProgress=Math.max(0,Math.min(1,play.journey.progress||0));
      const suggestion=journeyMap.data.animation_suggestion;
      journeyStarted=performance.now()-journeyProgress*(journeyRoute==='nanjing-hangzhou'?(suggestion.duration_ms_nanjing_to_hangzhou||3200):(suggestion.duration_ms_hefei_to_nanjing||3200));
      drawJourney(journeyProgress);
      if(journeyArrived)focusElement(enabledOptions()[Math.max(0,play.journey.selection||0)]);
    }else settleExplore();
    return true;
  }finally{restoringPlay=false;}
}
let measureCanvas;
function measureSlot(text,font){
  if(!measureCanvas)measureCanvas=document.createElement('canvas');
  const pen=measureCanvas.getContext('2d');
  pen.imageSmoothingEnabled=false;
  pen.font=font;
  return Math.ceil(pen.measureText(text||' ').width);
}
function paintNarrow(el,text){
  if(!el)return;
  el.dataset.narrow=text;
  const style=getComputedStyle(el);
  const slot=el.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
  if(!(slot>0)){if(!el.querySelector('.narrow-line'))el.textContent=text;return;}
  const font=style.font;
  if(measureSlot(text,font)<=slot+1){el.textContent=text;return;}
  const lines=wrapNarrow(text,slot,sample=>measureSlot(sample,font));
  if(lines.length<=1||lines.join('')!==text){el.textContent=text;return;}
  // Plain text plus breaks. No extra spans: a nowrap span changes how fullwidth punctuation sits.
  el.replaceChildren();
  for(let i=0;i<lines.length;i++){
    el.append(document.createTextNode(lines[i]));
    if(i<lines.length-1)el.append(document.createElement('br'));
  }
}
function repaintNarrow(){for(const el of document.querySelectorAll('[data-narrow]'))paintNarrow(el,el.dataset.narrow);}
window.addEventListener('resize',repaintNarrow);
function skillVisual(skill){return skill?.icon||sceneConfig.objects.find(item=>item.role===skill?.role)?.icon||'';}
function placeSkillIcon(parent,src,alt){
  if(!src)return;
  const image=document.createElement('img');image.alt=alt||'';
  image.addEventListener('error',()=>image.remove());
  image.src=src;parent.append(image);
}
function renderSkillSlots(slots){
  let row=document.querySelector('#skill-slots');
  const host=document.querySelector('#dialogue-content');
  if(!slots){if(row)row.hidden=true;return;}
  if(!row){row=document.createElement('div');row.id='skill-slots';host.append(row);}
  else if(row.parentElement!==host)host.append(row);
  row.hidden=false;row.replaceChildren();row.style.gridTemplateColumns=`repeat(${slots.length},minmax(0,1fr))`;
  for(const skill of slots){
    const figure=document.createElement('figure'),caption=document.createElement('figcaption');
    const label=skill.status==='got'?skill.name:'???';
    if(skill.status==='got')placeSkillIcon(figure,skillVisual(skill),skill.name);
    caption.dataset.narrow=label;caption.textContent=label;
    figure.append(caption);row.append(figure);
  }
}
function lines(ids){return ids.map(id=>chapter.text(id)).filter(Boolean);}
function persist(after){
  if(!saving){after();return;}
  if(chapter.save(storage,snapshot)){playSavingReady=true;document.querySelector('#save-status').textContent='进度已保存';after();savePlayState();return;}
  storageProblem('写入失败，之前的已保存进度没有被删除。可以重试，或仅在本次继续。',after,true);
}
function storageProblem(message,after,retry=false){
  playSavingReady=false;
  show('进度保存', [message], [
    ...(retry?[{label:'重试保存',id:'retry-save',run:()=>persist(after)}]:[]),
    {label:retry?'本次继续，不保存':'重新开始本章',id:'reset-save',run:()=>{if(retry){saving=false;document.querySelector('#save-status').textContent='本次未保存，刷新后回到上次保存的位置';after();}else{snapshot=chapter.initial();saving=true;persist(()=>{position=chapterSpawn();enterScene();});}}},
    ...(!retry?[{label:'本次继续，不覆盖存档',id:'continue-unsaved',run:()=>{saving=false;snapshot=chapter.initial();document.querySelector('#save-status').textContent='本次未保存，原存档保留；刷新后仍会提示';position=chapterSpawn();enterScene();}}]:[])
  ],false,'player',true);
}
function accept(event){
  hideObjectCard();dialogueSpeaker='player';
  const next=chapter.advance(snapshot,event);if(!next.accepted)return;
  const changed=next.snapshot.state!==snapshot.state;snapshot=next.snapshot;
  persist(()=>{
    if(event==='open_journey'){openJourney('chapter');return;}
    const follow=sceneConfig.follow?.[event];
    if(follow){
      const choices=[];
      if(follow.continueEvent)choices.push({label:'继续',id:'continue-line',run:()=>{
        const transition=chapter.actions(snapshot,follow.continueRole||'boss').find(item=>item.event===follow.continueEvent);
        if(transition)confirmPage(transition,false);
      }});
      show(follow.title,lines(follow.lines),choices,true,follow.speaker||'player');return;
    }
    if(changed){enterScene();return;}
    if(sceneConfig.chainDialog){
      const pending=chapter.actions(snapshot,'dialog');
      if(pending[0]){
        if(sceneConfig.transitionLines?.[pending[0].event]){beginTransition(pending[0].event);return;}
        presentDialog(pending[0]);return;
      }
      if(sceneConfig.directTalk){settleExplore();return;}
      show('已经记下',[sceneTarget(sceneConfig,chapter,snapshot)],[],true);return;
    }
    show('已经记下',[chapter.target(snapshot)],[],true);
  });
}
function presentDialog(transition){
  dialogueSpeaker=sceneConfig.eventSpeakers?.[transition.event]||'player';
  const run=sceneConfig.transitionLines?.[transition.event]?()=>beginTransition(transition.event):()=>accept(transition.event);
  show(eventTitle(transition.event)||transition.label,lines([transition.dialogue]),[{label:transition.label,event:transition.event,run}],false,dialogueSpeaker,false,{spoken:true});
}
function applyBeat(beat){
  roomImage=beat.map==='night'?nightImage:dayImage;
  dimOpacity=beat.dim||0;
  lampOn=dimOpacity>0;
}
function showNarrationBar(text){
  dialoguePlate='';
  currentSpeaker='narrator';
  const content=document.querySelector('#dialogue-content');
  if(systemDialog.open)systemDialog.close();
  conversation.append(content);conversation.hidden=false;
  document.querySelector('#speaker').textContent='旁白';
  document.querySelector('#portrait').hidden=true;
  const body=document.querySelector('#dialogue');body.replaceChildren();
  const paragraph=document.createElement('p');paragraph.dataset.narrow=text;paragraph.textContent=text;body.append(paragraph);
  document.querySelector('#choices').replaceChildren();
  dismissible=false;delete conversation.dataset.spoken;repaintNarrow();placeBubble();
}
function settleExplore(){
  hideObjectCard();conversation.hidden=true;speakerArrow.hidden=true;dialogueObject=null;selectedTargetID='';
  document.querySelector('#dialogue').replaceChildren();document.querySelector('#speaker').textContent='';
  if(systemDialog.open)systemDialog.close();pageContext=null;setState('explore');stage.focus({preventScroll:true});updateUI();savePlayState();
}
function beginTransition(event){
  if(transitionEvent)return;
  const next=chapter.advance(snapshot,event);if(!next.accepted)return;
  snapshot=next.snapshot;castSnapshot=null;
  hideObjectCard();dialogueObject=null;selectedTargetID='';
  persist(()=>{
    transitionEvent=event;transitionStarted=cinematicOn?cinematicClock():performance.now();transitionIndex=-1;setState('transition');
    showNarrationBar(chapter.text(sceneConfig.transitionLines[event]));
    applyBeat(sceneConfig.transitionBeats[event][0]);
    updateUI();
  });
}
function finishTransition(){
  const event=transitionEvent;if(!event)return;
  transitionEvent=null;transitionIndex=-1;
  conversation.hidden=true;speakerArrow.hidden=true;
  const beats=sceneConfig.transitionBeats[event];
  if(beats)applyBeat(beats[beats.length-1]);
  dimOpacity=0;lampOn=false;
  enterScene();
  if(queuedAward){const skill=queuedAward;queuedAward=null;showSkillAward(skill);}
}
function hideObjectCard(){if(!card)return;card.hidden=true;cardImg.removeAttribute('src');delete cardImg.dataset.src;}
function objectCardSrc(object){return object.cardLit&&object.litWhen&&object.litWhen.every(flag=>chapter.has(snapshot,flag))?object.cardLit:object.card;}
function showObjectCard(object){
  if(object.cardIn&&!object.cardIn.includes(snapshot.state)){hideObjectCard();return;}
  const src=objectCardSrc(object);if(!src){hideObjectCard();return;}
  if(!card){card=document.createElement('figure');card.id='object-card';cardImg=document.createElement('img');cardImg.alt='物件大图';const cap=document.createElement('figcaption');cap.textContent='';card.append(cardImg,cap);stage.append(card);}
  if(cardImg.dataset.src!==src){cardImg.src=src;cardImg.dataset.src=src;}
  card.hidden=false;
}
function confirmPage(transition,linkParent=true){
  const parent=linkParent?capturePage():null;
  dialogueSpeaker=sceneConfig.eventSpeakers?.[transition.event]||'player';
  const run=()=>sceneConfig.transitionLines?.[transition.event]?beginTransition(transition.event):accept(transition.event);
  show(eventTitle(transition.event)||transition.label,lines(pageLines[transition.event]||[transition.dialogue]),[{label:transition.label,event:transition.event,run}],true,dialogueSpeaker,false,{back:parent?()=>restorePage(parent):null,parent,spoken:true});
}
function manual(){
  dialogueSpeaker='player';
  const written=chapter.has(snapshot,'manual_entry_written')||snapshot.state==='complete';
  const slots=chapter.skillSlots?.(snapshot)||null;
  show('工作手册',written?lines([chapter.manualId]):['这页还没有写完。',chapter.target(snapshot)],snapshot.state==='complete'?[{label:'从办公室重玩',id:'replay',run:confirmReplay}]:[],true,'player',false,{slots});
}
function confirmReplay(){
  const parent=capturePage();
  show('从办公室重玩',[saving?'这会替换本章已保存的进度，其他站点数据不会被清除。':'这会重新开始本次体验。原存档仍会保留，本次不会保存。'],[{label:'确认重新开始',id:'confirm-replay',run:()=>{snapshot=chapter.initial();position=chapterSpawn();currentAward='';awardOpen=false;persist(enterScene);}}],true,'player',true,{back:parent?()=>restorePage(parent):null,parent});
}
function enterHefei(){
  if(nightImage){
    roomImage=snapshot.state==='night_study'?nightImage:dayImage;
    dimOpacity=0;lampOn=false;
  }
  const dialog=chapter.actions(snapshot,'dialog');
  if(dialog.length&&sceneConfig.transitionLines?.[dialog[0].event]){beginTransition(dialog[0].event);return;}
  if(dialog.length){presentDialog(dialog[0]);return;}
  if(snapshot.state==='interview'){show('旁白',lines(['interview-narrator']),[],true,'narrator',false,{plate:chapter.nameplate('interview-narrator')});return;}
  if(snapshot.state==='raise'){show('旁白',lines(['raise-narrator']),[],true,'narrator');return;}
  if(snapshot.state==='complete'){
    show('合肥 · 本章完成',lines(['manual-1']).concat('这句话记在手册里。'),[{label:'从合肥走到南京',id:'journey',run:()=>openJourney('bridge')},{label:'从办公室重玩',id:'replay',run:confirmReplay}],true,'narrator');
    return;
  }
  settleExplore();
}
function enterHangzhou(){
  const dialog=chapter.actions(snapshot,'dialog');
  if(dialog.length){presentDialog(dialog[0]);return;}
  const copy={
    arrive:{title:'报到',lines:['arrive-1'],extra:['去前台报到。']},
    night:{title:'深夜苦读',lines:['night-1'],extra:['设计模式的书还摊着。']},
    plugins:{title:'扒插件',lines:['plugins-1'],extra:['Webpack 一屏，Babel 一屏。']},
    sheets:{title:'五条业务线',lines:['sheets-1'],extra:['五张需求单，看完回到白板。']},
    board:{title:'白板',lines:['board-1'],extra:['五条线亮了。拾取之后，到门口结束这一章。']},
    complete:{title:'杭州 · 本章完成',lines:['manual-1'],extra:['这一页记着商品发布。'],choices:[{label:'从办公室重玩',id:'replay',run:confirmReplay}]},
  }[snapshot.state];
  show(copy.title,lines(copy.lines).concat(copy.extra),copy.choices||[],true);
}
function enterScene(){
  dialogueSpeaker='player';
  document.querySelector('.game-shell').classList.toggle('two-hours',snapshot.state==='restored');
  if(sceneConfig.id==='hefei-office'){enterHefei();return;}
  if(sceneConfig.id==='hangzhou-office'){enterHangzhou();return;}
  const available=chapter.actions(snapshot,'dialog');
  if(snapshot.state==='report')show('读到反馈',lines(['report-reaction','report-player-1']),available.map(t=>({label:t.label,event:t.event,run:()=>accept(t.event)})),false);
  else if(snapshot.state==='incident')show('我呆住了',lines(['incident-freeze']).concat('随后，CTO 开始排查。走到 CTO 身边看看。'));
  else if(snapshot.state==='investigation')show('排查',lines(['investigation-n1']));
  else if(snapshot.state==='restored')show('整整两小时后',lines(['restored-n1','restored-n3','restored-awe']),available.map(t=>({label:t.label,event:t.event,run:()=>accept(t.event)})),false);
  else if(snapshot.state==='learning')show('留下这次教训',lines(['learning-n1']).concat('去中间的排查电脑，分别看看补测清单和坑点注释；两项都看过后，到右侧书架写下这页手册。'));
  else if(snapshot.state==='journey'){if(chapter.has(snapshot,'journey_opened'))openJourney('chapter');else show('手册写好了',lines(['learning-manual-1']).concat('书架上会留下这次学到的东西。通道里有一张从合肥走到南京的地图。'));}
  else if(snapshot.state==='complete')show('南京 · 本章完成',lines(['learning-manual-1','complete-n1','complete-n2']).concat('这次记住的，是第一次把 C 端交给真实用户，以及从失败里写下的测试和注释。'),[{label:'从南京走到杭州',id:'bridge-hangzhou',run:()=>openJourney('to-hangzhou')},{label:'从办公室重玩',id:'replay',run:confirmReplay}]);
  else show('南京的办公室',lines(['office-n1','office-daily']).concat('这是我第一次做 C 端。走到左侧电脑，看看论坛。'));
  updateUI();
}
function finishSkillAward(){
  awardOpen=false;currentAward='';
  hideObjectCard();speakerArrow.hidden=true;
  const back=returnToJourney;returnToJourney=false;
  conversation.hidden=true;dialogueObject=null;selectedTargetID='';
  document.querySelector('#skill-award-icon')?.remove();
  if(back){pageContext=null;setState('journey');openJourney('chapter',true);savePlayState();return;}
  pageContext=null;setState('explore');stage.focus({preventScroll:true});savePlayState();
}
function showSkillAward(skill){
  currentAward=skill.id;
  returnToJourney=journeyMode==='chapter'||state==='journey';
  if(journeyPanel)journeyPanel.hidden=true;
  awardOpen=true;awardFlashUntil=(cinematicOn?cinematicClock():performance.now())+1600;playSkillDing();
  show('获得技能',[`获得技能：${skill.name}`],[{label:'确定',id:'skill-ok',run:finishSkillAward}],false,'player',false);
  paintAwardIcon(skill);savePlayState();
}
function paintAwardIcon(skill){
  document.querySelector('#skill-award-icon')?.remove();
  const holder=document.createElement('span');
  placeSkillIcon(holder,skillVisual(skill),'');
  const image=holder.firstElementChild;if(!image)return;
  image.id='skill-award-icon';
  document.querySelector('#dialogue').prepend(image);
}
function collectSkill(skill){
  const next=chapter.collect(snapshot,skill.id);if(!next.accepted)return;
  snapshot=next.snapshot;castSnapshot=null;
  persist(()=>showSkillAward(skill));
}
function readySkill(object){
  if(!object?.role)return null;
  return (chapter.skillSlots?.(snapshot)||[]).find(item=>item.role===object.role&&item.status==='ready')||null;
}
const journeyPanel=document.createElement('section');
journeyPanel.id='journey-map';journeyPanel.hidden=true;journeyPanel.dataset.artSlot='hefei-nanjing';
journeyPanel.innerHTML='<p id="journey-slogan"></p><div id="journey-stage"><canvas id="journey-canvas" width="384" height="216"></canvas></div><p id="journey-copy" hidden></p><div id="journey-choices" class="choices"></div>';
stage.append(journeyPanel);
document.querySelector('#journey-slogan').textContent=GAME_TITLE;
let journeyPack=null,journeyMap=null,journeyProgress=0,journeyArrived=false,journeyFrame=0,journeyRoute='hefei-nanjing';
window.careerJourney=()=>({progress:journeyProgress,arrived:journeyArrived,route:journeyRoute,hangzhouUnlocked:journeyRoute==='nanjing-hangzhou'&&journeyArrived});
async function journeyDefinition(){
  if(chapter?.journey)return chapter.journey;
  if(!journeyPack){const response=await fetch('./design/chapter-01.json');if(!response.ok)throw new Error('旅程地图资料加载失败');journeyPack=await response.json();}
  return journeyPack.journey;
}
async function loadJourneyMap(){
  if(journeyMap)return journeyMap;
  const base='./art/transition-map/';
  const [map,marker,check,ring,lock,data]=await Promise.all([
    loadImage(base+'map-384x216.png'),loadImage(base+'player-marker-24.png'),loadImage(base+'check-12.png'),loadImage(base+'highlight-ring.png'),loadImage(base+'lock-10.png'),
    fetch(base+'transition-map.json').then(response=>{if(!response.ok)throw new Error('旅程地图坐标加载失败');return response.json();}),
  ]);
  journeyMap={map,marker,check,ring,lock,data};
  return journeyMap;
}
function easeInOut(t){return t<.5?4*t*t*t:1-((-2*t+2)**3)/2;}
const pixelLabels=new Map();
// Name plates on the map are only 12px tall, so an 8–14px system glyph turns 肥 into a blob and crowds 州. Stamp 28×22 bitmaps (ink ≥16px) into a larger plate.
const glyphW=28,glyphH=22,glyphGap=2,platePad=4,plateEdge=1;
const placeGlyphs={
  '合':['.............##.............','............####............','...........##..##...........','..........##....##..........','.........##......##.........','........##........##........','.......##..........##.......','......##............##......','.....##..............##.....','....##................##....','..########################..','..########################..','............................','......################......','......################......','......##............##......','......##............##......','......##............##......','......##............##......','......################......','......################......','......################......'],
  '肥':['..########..#############...','..########..#############...','..##....##..##...##...##....','..##....##..##...##...##....','..##....##..##...##...##....','..########..##...##...##....','..########..##...##...##....','..##....##..##...##...##....','..##....##..##...##...##....','..##....##..#############...','..########..#############...','..########..##..............','..##....##..##..............','..##....##..##..............','..##....##..##..........##..','..##....##..##..........##..','..##....##..##..........##..','..######....##........####..','..######....##############..','..##........##############..','.##.........##..............','##..........##..............'],
  '南':['..............##............','..............##............','############################','############################','..............##............','..............##............','..########################..','..########################..','..##......##......##....##..','..##......##......##....##..','..##....##########......##..','..##....##########......##..','..##..##################..##','..##..##################..##','..########################..','..########################..','..##........##..........##..','..##........##..........##..','..##........##..........##..','..##........##..........##..','..##................######..','..##................######..'],
  '京':['..............##............','..............##............','############################','############################','....####################....','....####################....','....##................##....','....##................##....','....##................##....','....##................##....','....####################....','....####################....','........##..####..##........','........##..####..##........','......####..####..####......','......####..####..####......','..####......####......####..','..####......####......####..','........######..............','........######..............','............................','............................'],
  '杭':['....##..........##..........','....##..........##..........','....##..........##..........','....##..........##..........','############################','############################','....##......................','....##......................','....####......##########....','....####......##########....','..######......##......##....','..######......##......##....','..######......##......##....','..######......##......##....','########......##......##....','########......##......##....','....##......####......##....','....##......####......##....','....##......####......##....','....##......####......##....','....##....##..........####..','....##....##..........####..'],
  '州':['.....###......###......###..','.....###......###......###..','.....###......###......###..','.....###......###......###..','.....###......###......###..','.....###......###......###..','.....###......###......###..','.....###......###......###..','.....###......###......###..','.....###......###......###..','.##..###..##..###..##..###..','.##..###..##..###..##..###..','.....###......###......###..','.....###......###......###..','.....###......###......###..','.....###......###......###..','.....###......###......###..','.....###......###......###..','.....###......###......###..','.....###......###......###..','.....###......###......###..','.....###......###......###..'],
};
function pixelLabel(text){
  if(pixelLabels.has(text))return pixelLabels.get(text);
  const width=text.length*glyphW+Math.max(0,text.length-1)*glyphGap;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=glyphH;
  const pen=canvas.getContext('2d');pen.imageSmoothingEnabled=false;
  const image=pen.createImageData(width,glyphH);
  for(let i=0;i<text.length;i++){
    const rows=placeGlyphs[text[i]];if(!rows)continue;
    const ox=i*(glyphW+glyphGap);
    for(let y=0;y<glyphH;y++)for(let x=0;x<glyphW;x++){
      if(rows[y][x]!=='#')continue;
      const p=(y*width+ox+x)*4;image.data[p]=0x16;image.data[p+1]=0x12;image.data[p+2]=0x0e;image.data[p+3]=255;
    }
  }
  pen.putImageData(image,0,0);
  pixelLabels.set(text,canvas);
  return canvas;
}
function drawPlaceNames(ctx,nodes){
  const plates=journeyMap?.data?.text?.label_plates_logical;
  const centers=plates?Object.fromEntries(plates.map(plate=>[plate.id,Math.round((plate.box[0]+plate.box[2])/2)])):{hefei:49,nanjing:189,hangzhou:325};
  ctx.imageSmoothingEnabled=false;
  for(const id of ['hefei','nanjing','hangzhou']){
    const node=nodes[id];if(!node||centers[id]==null)continue;
    const label=pixelLabel(node.name);
    const w=label.width+platePad*2+plateEdge*2,h=label.height+platePad*2+plateEdge*2;
    const x=centers[id]-Math.floor(w/2),y=128;
    ctx.fillStyle='#16120e';ctx.fillRect(x,y,w,h);
    ctx.fillStyle='#fad6a6';ctx.fillRect(x+plateEdge,y+plateEdge,w-plateEdge*2,h-plateEdge*2);
    ctx.drawImage(label,x+plateEdge+platePad,y+plateEdge+platePad);
  }
}
function drawJourney(progress){
  const ctx=document.querySelector('#journey-canvas').getContext('2d'),art=journeyMap,nodes=Object.fromEntries(art.data.nodes.map(node=>[node.id,node]));
  ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,384,216);ctx.drawImage(art.map,0,0);
  const nanjing=nodes.nanjing,hangzhou=nodes.hangzhou,toHangzhou=journeyRoute==='nanjing-hangzhou';
  ctx.drawImage(art.check,58,62);
  if(toHangzhou){
    ctx.drawImage(art.check,nanjing.coords_logical.x-6,nanjing.coords_logical.y-38);
    const focus=progress>=1?hangzhou:nanjing;
    ctx.drawImage(art.ring,focus.coords_logical.x-21,focus.coords_logical.y-24);
    if(progress<1){ctx.save();ctx.globalAlpha=Math.max(0,1-progress);ctx.drawImage(art.lock,hangzhou.coords_logical.x-5,hangzhou.coords_logical.y-34);ctx.restore();}
    else ctx.drawImage(art.check,hangzhou.coords_logical.x-6,hangzhou.coords_logical.y-38);
  }else{
    ctx.drawImage(art.ring,nanjing.coords_logical.x-21,nanjing.coords_logical.y-24);
    ctx.drawImage(art.lock,hangzhou.coords_logical.x-5,hangzhou.coords_logical.y-34);
  }
  drawPlaceNames(ctx,nodes);
  const t=easeInOut(Math.min(1,Math.max(0,progress)));
  const from=toHangzhou?nanjing.marker_stop:nodes.hefei.marker_stop,to=toHangzhou?hangzhou.marker_stop:nanjing.marker_stop;
  const x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t;
  ctx.drawImage(art.marker,Math.round(x-art.data.marker_anchor.x),Math.round(y-art.data.marker_anchor.y));
}
function journeyButton(label,id,run){
  const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.action=id;
  button.addEventListener('click',event=>{if(event.detail>0&&performance.now()<choicesReady)return;run();});
  return button;
}
function showJourneyChoices(){
  const copy=document.querySelector('#journey-copy'),choices=document.querySelector('#journey-choices');
  const stops=(journeyMode==='bridge'?journeyPackStops.filter(stop=>!stop.skill):journeyPackStops);
  const journeyText=stops.map(stop=>stop.text).join('');
  copy.hidden=false;paintNarrow(copy,journeyText);
  choices.replaceChildren();
  if(journeyMode==='bridge')choices.append(journeyButton('走到南京','journey-arrive',closeJourney));
  else if(journeyMode==='to-hangzhou')choices.append(journeyButton('走到杭州','journey-arrive',closeJourney));
  else{
    const skill=(chapter.skillSlots?.(snapshot)||[]).find(entry=>entry.id==='react');
    if(skill?.status==='ready')choices.append(journeyButton('拾取','journey-pickup',()=>collectSkill(skill)));
    choices.append(journeyButton('这段路程看完了','journey-finish',finishJourney));
  }
  choicesReady=performance.now()+180;choices.querySelector('button')?.focus();
}
function paintJourney(now){
  if(suspended)return;
  const suggestion=journeyMap.data.animation_suggestion;
  const duration=journeyRoute==='nanjing-hangzhou'?(suggestion.duration_ms_nanjing_to_hangzhou||3200):(suggestion.duration_ms_hefei_to_nanjing||3200);
  journeyProgress=journeyArrived?1:Math.min(1,(now-journeyStarted)/duration);
  drawJourney(journeyProgress);
  if(journeyProgress>=1&&!journeyArrived){journeyArrived=true;ensureReact();}
  if(!journeyArrived&&!cinematicOn)journeyFrame=requestAnimationFrame(paintJourney);
}
let journeyStarted=0,journeyPackStops=[];
function ensureReact(){
  if(journeyMode!=='chapter'||chapter.has(snapshot,'react_noticed')){showJourneyChoices();return;}
  const next=chapter.advance(snapshot,'notice_react');if(!next.accepted){showJourneyChoices();return;}
  snapshot=next.snapshot;castSnapshot=null;persist(showJourneyChoices);
}
function finishJourney(){
  const next=chapter.advance(snapshot,'finish_journey');if(!next.accepted)return;
  snapshot=next.snapshot;castSnapshot=null;closeJourney();persist(enterScene);
}
function closeJourney(){
  const mode=journeyMode;
  cancelAnimationFrame(journeyFrame);journeyMode=null;journeyPanel.hidden=true;
  setState('explore');
  if(sceneConfig.id==='hefei-office'){enterHefei();return;}
  if(mode==='to-hangzhou')enterScene();
}
async function openJourney(mode,resume=false){
  const definition=await journeyDefinition();if(!definition)return;
  await loadJourneyMap();
  const bridge=mode==='to-hangzhou'?definition.toHangzhou:null;
  if(mode==='to-hangzhou'&&!bridge)return;
  journeyMode=mode;journeyRoute=mode==='to-hangzhou'?'nanjing-hangzhou':'hefei-nanjing';
  journeyPackStops=(bridge?bridge.stops:definition.stops)||[];
  journeyPanel.dataset.artSlot=bridge?.artSlot||definition.artSlot||'hefei-nanjing';
  document.querySelector('#journey-slogan').textContent=GAME_TITLE;
  journeyPanel.hidden=false;conversation.hidden=true;
  if(!resume||!journeyArrived){journeyArrived=false;journeyProgress=0;journeyStarted=cinematicOn?cinematicClock():performance.now();document.querySelector('#journey-copy').hidden=true;document.querySelector('#journey-choices').replaceChildren();}
  setState('journey');
  cancelAnimationFrame(journeyFrame);
  if(journeyArrived){drawJourney(1);showJourneyChoices();}
  else if(!cinematicOn)journeyFrame=requestAnimationFrame(paintJourney);
}
function openConversation(){
  if(state!=='explore'||!active)return;
  const pending=actionsFor(chapter,snapshot,active);
  const skill=readySkill(active);
  if(skill&&!pending.length){collectSkill(skill);return;}
  dialogueObject=active;showObjectCard(active);
  dialogueSpeaker=active.atlas?active.id:'player';
  const object=active.id;
  if(object==='journey-map'&&snapshot.state==='journey'&&chapter.has(snapshot,'journey_opened')){openJourney('chapter');return;}
  if(snapshot.state==='complete'&&!active.atlas){manual();return;}
  const available=actionsFor(chapter,snapshot,active);
  if(sceneConfig.id==='hefei-office'&&available[0]?.event==='take_day_task'){
    const transition=available[0];
    show('我',['开始今天的需求'],[
      {label:'确定',event:transition.event,run:()=>accept(transition.event)},
      {label:'继续探索办公室',id:'explore-office',run:settleExplore}
    ],false,'player');return;
  }
  if(available[0]&&sceneConfig.instantSkills?.includes(available[0].event)){
    const next=chapter.advance(snapshot,available[0].event);if(!next.accepted)return;
    snapshot=next.snapshot;castSnapshot=null;
    const learned=chapter.skillSlots(snapshot).find(item=>item.role===active.role);
    const acquired=chapter.collect(snapshot,learned.id);if(!acquired.accepted)return;
    snapshot=acquired.snapshot;
    const transition=chapter.actions(snapshot,'dialog')[0];
    if(transition&&sceneConfig.transitionLines?.[transition.event]){queuedAward=learned;beginTransition(transition.event);}
    else persist(()=>showSkillAward(learned));
    return;
  }
  if(object==='manual'){
    if(available.length){confirmPage(available[0]);return;}
    manual();return;
  }
  if(sceneConfig.directTalk&&available.length<=1){
    if(available.length===1){
      const preface=prefaceText(active);
      if(preface){show('旁白',[preface],[{label:active.prefaceAction||'继续',id:'preface-'+available[0].event,run:()=>confirmPage(available[0],false)}],true,'narrator');return;}
      confirmPage(available[0],false);return;
    }
    const line=spokenLine(active);
    if(!line){dialogueObject=null;hideObjectCard();return;}
    const speaker=active.atlas?active.id:'narrator';
    show(speaker==='narrator'?'旁白':active.name,[line],[],true,speaker);return;
  }
  const choices=available.map(t=>({label:eventTitle(t.event)||t.label,event:'view_'+t.event,run:()=>confirmPage(t)}));
  const words=active.dialogue?[active.dialogue[snapshot.state]||active.dialogue.default]:[available.length?'选择一项，读完后再确认。':sceneTarget(sceneConfig,chapter,snapshot)];
  show(active.name,words,choices);
}
function lineText(object,id){
  if(!id)return '';
  return object.lineIds?chapter.text(id):id;
}
function spokenLine(object){
  if(object.lines){
    const id=snapshot.state==='interview'?object.lines.interview:(object.lines[snapshot.state]||object.lines.day||'');
    return lineText(object,id);
  }
  const bank=object.dialogue;
  if(!bank)return '';
  return bank[snapshot.state]||bank.default||'';
}
function prefaceText(object){
  const id=object.preface?.[snapshot.state]||object.preface?.default||'';
  return lineText(object,id);
}
function updateUI(){
  const candidates=state==='explore'?nearbyAll(position,visibleRoom()):[];
  active=candidates.find(o=>o.id===selectedTargetID)||candidates.find(o=>actionsFor(chapter,snapshot,o).length)||candidates.find(o=>readySkill(o))||candidates[0]||null;
  const hint=active?`E / Enter · ${readySkill(active)&&!actionsFor(chapter,snapshot,active).length?'拾取':active.name}${candidates.length>1?' · Q 切换对象':''}`:'';
  if(hint!==lastInteraction){interaction.textContent=hint;lastInteraction=hint;}
  if(chapter&&snapshot&&snapshot!==lastUISnapshot){task.textContent=sceneTarget(sceneConfig,chapter,snapshot);lastUISnapshot=snapshot;updateMarkers();updateExpressions();}
}
function drawPortrait(canvas,actorID){
  const actor=sceneConfig.actors.find(a=>a.id===actorID)||sceneConfig.actors[0];
  const emotionKey=actor.emotionAtlas||(actor.controllable?'emotions':null);
  const data=atlasData[emotionKey||actor.atlas];if(!data)return;
  const expression=expressionFor(actor,snapshot);
  const index=emotionKey?(actor.expressions||sceneConfig.expressions)[expression]??0:(actor.column||0);
  const bounds=data.frames[index],ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;
  const h=emotionKey?bounds.height:Math.floor(bounds.height*.43);
  const scale=Math.min(canvas.width/bounds.width,canvas.height/h),w=bounds.width*scale,height=h*scale;
  ctx.drawImage(data.image,bounds.left,bounds.top,bounds.width,h,(canvas.width-w)/2,(canvas.height-height)/2,w,height);
  canvas.dataset.expression=expression;canvas.dataset.actor=actor.id;
}
function isTyping(actor){return actor.posture==='seatedTyping'||(actor.controllable&&state==='dialogue'&&!systemDialog.open&&!!dialogueObject?.seat&&!dialogueObject.atlas);}
function renderPosition(actor){return isTyping(actor)?(actor.controllable?dialogueObject.seat:actor.seat||actor):(actor.controllable?position:actor);}
function screenPoint(actor,head=true){
  const p=renderPosition(actor);
  const gy=p.y-(head?(isTyping(actor)?(actor.seatedHeight||40):actor.height):0);
  if(cinematicView){
    const v=cinematicView;
    return {x:(p.x-v.x)/v.size*stage.clientWidth,y:(gy-v.y)/v.size*stage.clientHeight};
  }
  return {x:p.x/sceneConfig.width*stage.clientWidth,y:gy/sceneConfig.height*stage.clientHeight};
}
function placeBubble(){
  conversation.style.left='';conversation.style.right='';conversation.style.top='';conversation.style.bottom='';conversation.style.width='';
  const plate=document.querySelector('#nameplate');
  if(conversation.hidden){speakerArrow.hidden=true;if(plate)plate.hidden=true;conversation.classList.remove('scene-title');return;}
  const actor=sceneConfig.actors.find(item=>item.id===currentSpeaker)||null;
  const narrating=!actor||currentSpeaker==='narrator';
  conversation.classList.add('docked');
  conversation.classList.toggle('narration',narrating);
  conversation.classList.remove('below');
  conversation.dataset.actor=narrating?'':actor.id;
  const heading=document.querySelector('#speaker').textContent;
  const spoken=conversation.dataset.spoken==='1';
  const actorPlate=!!actor&&!narrating&&(actor.id!=='player'||heading===actor.name||spoken);
  // Scene title stays narration: same nameplate, no portrait and no arrow.
  const titlePlate=narrating&&dialoguePlate?dialoguePlate:'';
  conversation.classList.toggle('scene-title',!!titlePlate);
  const showPlate=actorPlate||!!titlePlate;
  if(plate){plate.textContent=actorPlate?actor.name:titlePlate;plate.hidden=!showPlate;}
  document.querySelector('#dialogue')?.setAttribute('aria-labelledby',showPlate?'nameplate':'speaker');
  if(!actorPlate){speakerArrow.hidden=true;delete speakerArrow.dataset.actor;return;}
  const point=screenPoint(actor);
  speakerArrow.hidden=false;speakerArrow.dataset.actor=actor.id;
  speakerArrow.style.left=`${point.x}px`;speakerArrow.style.top=`${point.y-18}px`;
}
function updateMarkers(){
  const layer=document.querySelector('#task-markers');layer.replaceChildren();
  for(const marker of pendingMarkers(visibleRoom(),chapter,snapshot)){
    const element=marker.sprite?document.createElement('img'):document.createElement('span');
    element.className='task-marker';element.dataset.object=marker.id;element.dataset.events=marker.events.join(' ');
    if(marker.sprite){element.src=marker.sprite.url;element.alt='';element.style.width=`${marker.sprite.w/sceneConfig.width*100}%`;element.style.height=`${marker.sprite.h/sceneConfig.height*100}%`;element.dataset.ww=String(marker.sprite.w);element.dataset.wh=String(marker.sprite.h);}
    else element.textContent='!';
    element.dataset.wx=String(marker.x);element.dataset.wy=String(marker.y-marker.offsetY);
    element.style.left=`${marker.x/sceneConfig.width*100}%`;element.style.top=`${(marker.y-marker.offsetY)/sceneConfig.height*100}%`;layer.append(element);
  }
}
function updateExpressions(){
  const layer=document.querySelector('#actor-effects');layer.replaceChildren();
  for(const actor of visibleRoom().actors){
    if(!actor.controllable){const name=document.createElement('span');name.className='actor-label';name.textContent=actor.name;name.dataset.actor=actor.id;layer.append(name);}
    else if(expressionFor(actor,snapshot)!=='normal'){
      const badge=document.createElement('canvas');badge.width=badge.height=48;badge.className='emotion-badge';badge.dataset.actor=actor.id;drawPortrait(badge,actor.id);layer.append(badge);
    }
  }
  positionEffects();
}
function positionEffects(){
  for(const element of document.querySelectorAll('#actor-effects [data-actor]')){
    const actor=sceneConfig.actors.find(a=>a.id===element.dataset.actor),point=screenPoint(actor);
    element.style.left=`${point.x+(actor.controllable?20:0)}px`;element.style.top=`${point.y-3}px`;
  }
}
function frame(now,elapsedOverride){
  if(!cinematicOn)raf=requestAnimationFrame(frame);
  if(suspended){previous=0;return;}
  const elapsed=elapsedOverride!=null?elapsedOverride:(previous?Math.min((now-previous)/1000,.1):0);
  if(!cinematicOn)previous=now;
  const oldX=position.x,oldY=position.y;let intent=false;
  if(state==='explore'){
    let dx=0,dy=0;
    if(cinematicOn){
      const wish=cinematicDirector?.takeWish();
      if(wish){dx=wish[0];dy=wish[1];}
    }else for(const key of keys){const delta=movement.get(key);if(delta){dx+=delta[0];dy+=delta[1];}}
    intent=!!(dx||dy);
    if(dx||dy)facing=Math.abs(dx)>=Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');
    const step=integrateWalk(position,dx,dy,elapsed,sceneConfig,walkRemainder);
    position={x:step.x,y:step.y};walkRemainder=step.remainder;
  }else walkRemainder=0;
  const dist=Math.hypot(position.x-oldX,position.y-oldY);
  const motion=motionForRender(state==='explore',intent,dist>0,now,lastMovedAt);moving=motion.moving;lastMovedAt=motion.lastMovedAt;walkTime=walkClock(walkTime,moving,dist,MOVE_SPEED);
  if(state==='transition'&&transitionEvent){
    const beats=sceneConfig.transitionBeats[transitionEvent];
    const index=transitionBeat(beats.length,now-transitionStarted,sceneConfig.beatMs);
    if(index!==transitionIndex){transitionIndex=index;applyBeat(beats[index]);}
    if(transitionFinished(beats.length,now-transitionStarted,sceneConfig.beatMs))finishTransition();
    else if(transitionIndex!==-1)saveTransitionCheckpoint();
  }
  if(cinematicOn&&state==='journey')paintJourney(now);
  for(let i=0;i<propViews.length;i++){
    const item=propViews[i];
    let show=!item.presentIn||item.presentIn.includes(snapshot.state)||readyRoles().has(item.role);
    if(show&&item.iconHiddenIn&&item.iconHiddenIn.includes(snapshot.state))show=false;
    if(show&&item.iconAfterFlag&&!chapter.has(snapshot,item.iconAfterFlag))show=false;
    item.visible=show;
    if(!show)continue;
    const litOn=item.lit&&item.litWhen&&item.litWhen.every(flag=>chapter.has(snapshot,flag));
    const glow=item.glowUntilFlag&&!chapter.has(snapshot,item.glowUntilFlag);
    item.image=litOn?item.lit:(glow||(state==='explore'&&active&&active.id===item.id)?item.hi:item.base);
    item.showing=litOn?'lit':item.image===item.hi?'hi':'base';
    item.opacity=item.nightDim&&snapshot.state==='night_study'?0.45:1;
  }
  const here=visibleRoom(),hide=here!==sceneConfig;
  const sprites=[];
  for(const actor of sceneConfig.actors){
    const views=actorViews.get(actor.id);
    const shown=!hide||here.actors.includes(actor);
    const typing=shown&&isTyping(actor)&&!!views.seated;
    views.standing.visible=shown&&!typing;if(views.seated)views.seated.visible=!!typing;
    if(!shown)continue;
    const sprite=typing?views.seated:views.standing;
    const play=state!=='paused'&&!(state==='dialogue'&&currentSpeaker===actor.id&&!actor.controllable);
    const pose=typing&&actor.sitAtlas?sceneConfig.atlases[actor.sitAtlas]:typing?sceneConfig.atlases.typing:null;
    const sitStill=!!(pose&&pose.columns===1&&pose.rows===1);
    sprite.update(renderPosition(actor),actor.controllable?facing:'down',actor.controllable&&moving&&!sitStill,walkTime,pose?seatedFrame(pose,actor.typingColumn??0,now/1000,play&&!sitStill):null,actor.controllable&&(!typing||sitStill));
    sprites.push(sprite);
  }
  let cinematicStill=null;
  if(cinematicOn&&cinematicDirector){
    const shot=cinematicDirector.beforeRender(position);
    cinematicView=shot.view;
    cinematicStill=shot.still;
    applyCinematicCamera(cinematicView);
  }
  drawSkillGlints(now);
  positionEffects();placeBubble();updateUI();
  if(cinematicOn)placeCinematicMarkers();
  view.draw(roomImage,dimOpacity,lampOn?lampImage:null,propViews,sprites);
  if(cinematicOn&&cinematicDirector){
    cinematicDirector.afterRender(cinematicApi(),simFrame);
    if(cinematicStill)cinematicPendingStill=cinematicStill;
  }
}
let cinematicPendingStill=null;
function applyCinematicCamera(shot){
  view.setPixelRatio(1);
  view.setCamera({x:shot.x,y:shot.y,size:shot.size});
}
function placeCinematicMarkers(){
  if(!cinematicView)return;
  const v=cinematicView,w=stage.clientWidth,h=stage.clientHeight;
  for(const element of document.querySelectorAll('.task-marker')){
    const wx=+element.dataset.wx,wy=+element.dataset.wy;
    element.style.left=`${(wx-v.x)/v.size*w}px`;element.style.top=`${(wy-v.y)/v.size*h}px`;
    if(element.dataset.ww){element.style.width=`${element.dataset.ww/v.size*w}px`;element.style.height=`${element.dataset.wh/v.size*h}px`;}
  }
}
function cinematicButtons(){return [...document.querySelectorAll('#choices button, #journey-choices button')].map(button=>button.textContent);}
function cinematicApi(){
  return {
    state:()=>state,
    position:()=>({x:position.x,y:position.y}),
    buttons:cinematicButtons,
    focus(id){
      updateUI();
      const list=nearbyAll(position,visibleRoom());
      if(!list.some(item=>item.id===id))return false;
      selectedTargetID=id;updateUI();
      return active?.id===id;
    },
    interact(){openConversation();},
    choose(label){
      const button=[...document.querySelectorAll('#choices button, #journey-choices button')].filter(item=>!item.disabled&&item.textContent.includes(label)&&item.getClientRects().length).sort((a,b)=>a.textContent.length-b.textContent.length)[0];
      if(!button)return false;
      button.click();
      return true;
    },
    dismiss(){
      const button=document.querySelector('#close-dialogue');
      if(button){button.click();return true;}
      if(state==='explore')return true;
      if(dismissible&&state==='dialogue'){closeConversation();return true;}
      return false;
    },
    manual(){manual();},
    face(tx,ty){
      const wish=walkIntent(position,[tx,ty],(x,y)=>blocked(x,y,sceneConfig));
      if(!wish)return false;
      facing=wish[0]?(wish[0]<0?'left':'right'):(wish[1]<0?'up':'down');
      cinematicDirector.setWish(wish);
      return true;
    },
  };
}
function cinematicTick(){
  try{
    if(cinematicDirector.poll(cinematicApi()))return {skip:true,frame:simFrame,done:false};
    simFrame+=1;
    cinematicPendingStill=null;
    frame(cinematicClock(),1/60);
    const still=cinematicPendingStill?{name:cinematicPendingStill,png:view.canvas.toDataURL('image/png'),width:view.canvas.width,height:view.canvas.height}:null;
    cinematicPendingStill=null;
    return {skip:false,done:cinematicDirector.phase==='done',frame:simFrame,shot:cinematicDirector.shotId,view:cinematicDirector.view,still,error:null,phase:cinematicDirector.phase,index:cinematicDirector.index};
  }catch(error){
    return {skip:false,done:false,error:String(error&&error.stack||error),frame:simFrame,phase:cinematicDirector?.phase,index:cinematicDirector?.index};
  }
}
function drawCinematicGlints(now){
  const view=cinematicView;
  glintCanvas.style.zIndex=now<awardFlashUntil?'8':'2';
  if(glintCanvas.width!==view.size||glintCanvas.height!==view.size){glintCanvas.width=view.size;glintCanvas.height=view.size;}
  glintCtx.clearRect(0,0,view.size,view.size);
  const slots=chapter.skillSlots(snapshot)||[];
  glintCtx.imageSmoothingEnabled=false;
  const ready=slots.filter(skill=>skill.status==='ready');
  for(const skill of ready){
    const object=sceneConfig.objects.find(item=>item.role===skill.role);
    if(!object?.iconAt)continue;
    const shared=ready.filter(item=>item.role===skill.role);
    const index=shared.indexOf(skill);
    const ox=object.iconAt.x+(shared.length>1?(index-(shared.length-1)/2)*12:0);
    for(let i=0;i<8;i++){
      const angle=now/420+i*Math.PI/4,x=ox+Math.cos(angle)*10-view.x,y=object.iconAt.y+Math.sin(angle)*8-view.y;
      glintCtx.fillStyle=i%2?'#f4e35a':'#fffaf0';
      glintCtx.fillRect(x|0,y|0,2,2);
    }
  }
}
function drawSkillGlints(now){
  if(!glintCtx||!chapter?.skillSlots)return;
  if(cinematicView){drawCinematicGlints(now);return;}
  glintCanvas.style.zIndex=now<awardFlashUntil?'8':'2';
  glintCtx.clearRect(0,0,sceneConfig.width,sceneConfig.height);
  const slots=chapter.skillSlots(snapshot)||[];
  glintCtx.imageSmoothingEnabled=false;
  const ready=slots.filter(skill=>skill.status==='ready');
  for(const skill of ready){
    const object=sceneConfig.objects.find(item=>item.role===skill.role);
    if(!object?.iconAt)continue;
    const shared=ready.filter(item=>item.role===skill.role);
    const index=shared.indexOf(skill);
    const ox=object.iconAt.x+(shared.length>1?(index-(shared.length-1)/2)*12:0);
    for(let i=0;i<8;i++){
      const angle=now/420+i*Math.PI/4,x=ox+Math.cos(angle)*10,y=object.iconAt.y+Math.sin(angle)*8;
      glintCtx.fillStyle=i%2?'#f4e35a':'#fffaf0';
      glintCtx.fillRect(x|0,y|0,2,2);
    }
  }
  if(now<awardFlashUntil){
    const left=Math.min(1,(awardFlashUntil-now)/1600);
    for(let i=0;i<12;i++){
      const angle=i/12*Math.PI*2,radius=(1-left)*28+6;
      glintCtx.fillStyle=i%2?'#f4e35a':'#ffffff';
      glintCtx.fillRect((sceneConfig.width/2+Math.cos(angle)*radius)|0,(sceneConfig.height/2+Math.sin(angle)*radius)|0,2,2);
    }
  }
}
function loadImage(url){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(`无法加载素材 ${url}，请检查文件并刷新。`));image.src=url;});}
async function start(){
  const atlasEntries=Object.entries(sceneConfig.atlases);
  if(sceneConfig.page){
    document.title=GAME_TITLE;
    const heading=document.querySelector('#chapter-heading');if(heading)heading.textContent=sceneConfig.page.heading;
    const lead=document.querySelector('header p:last-of-type');if(lead)lead.textContent=sceneConfig.page.lead;
    document.querySelector('.game-shell')?.setAttribute('aria-label',sceneConfig.page.shell);
    const summary=document.querySelector('#chapter-summary p');if(summary)summary.textContent=sceneConfig.page.summary;
  }
  const roomURLs=sceneConfig.backgrounds?[sceneConfig.backgrounds.day,sceneConfig.backgrounds.night,sceneConfig.backgrounds.lightMask]:[sceneConfig.background];
  // UI illustrations do not imply another object drawn on the room furniture.
  const props=sceneConfig.objects.filter(o=>o.worldSprite===true);
  const loadProp=async object=>({base:await loadImage(object.icon),hi:await loadImage(object.iconHighlight||object.icon),lit:object.iconLit?await loadImage(object.iconLit):null});
  const cinematicPromise=cinematicOn?fetch(`./cinematic/${cinematicName}.json`).then(r=>{if(!r.ok)throw new Error('拍摄脚本加载失败');return r.json();}):null;
  const loadingAssets=Promise.all([
    Promise.all(roomURLs.map(loadImage)),
    fetch(sceneConfig.chapter).then(r=>{if(!r.ok)throw new Error('章节资料加载失败');return r.json();}),
    Promise.all(atlasEntries.map(async([,atlas])=>{const image=await loadImage(atlas.url);return {image,frames:await scanAtlas(image,atlas)};})),
    Promise.all(props.map(loadProp)),
    cinematicPromise,
  ]);
  const [roomImages,chapterData,atlasPacks,propPacks,cinematicScript]=await loadingAssets;
  atlasEntries.forEach(([id],i)=>atlasData[id]=atlasPacks[i]);
  chapterDefinition=chapterData;chapter=createChapter(chapterData);
  const bounds=atlasData.player.frames[0];
  view=createView(stage,{width:sceneConfig.width,height:sceneConfig.height});
  view.canvas.addEventListener('contextlost',event=>{event.preventDefault();showFailure('图形上下文已丢失，游戏已停止。可重新加载尝试恢复图形，或继续文字阅读。');});
  if(cinematicOn)view.setPixelRatio(1);
  dayImage=roomImages[0];roomImage=dayImage;
  if(roomImages[1]){nightImage=roomImages[1];lampImage=maskedImage(dayImage,roomImages[2]);}
  props.forEach((object,i)=>{
    const pack=propPacks[i];
    propViews.push({id:object.id,role:object.role,visible:true,image:pack.base,base:pack.base,hi:pack.hi,lit:pack.lit,showing:'base',x:object.iconAt.x,y:object.iconAt.y,w:object.iconSize[0],h:object.iconSize[1],opacity:1,litWhen:object.litWhen||null,presentIn:object.presentIn||null,nightDim:!!object.nightDim,iconHiddenIn:object.iconHiddenIn||null,iconAfterFlag:object.iconAfterFlag||'',glowUntilFlag:object.glowUntilFlag||''});
  });
  for(const actor of sceneConfig.actors){
    const data=atlasData[actor.atlas],standing=createActor(data.image,sceneConfig.atlases[actor.atlas],actor,sceneConfig.height,data.frames);
    const sit=actor.sitAtlas&&sceneConfig.atlases[actor.sitAtlas];
    const seatedSpec=sit?{image:atlasData[actor.sitAtlas].image,atlas:sit,frames:atlasData[actor.sitAtlas].frames,column:0,height:actor.seatedHeight||30}:actor.typingColumn===undefined?null:{image:atlasData.typing.image,atlas:sceneConfig.atlases.typing,frames:atlasData.typing.frames,column:actor.typingColumn,height:actor.seatedHeight||40};
    const seated=seatedSpec?createActor(seatedSpec.image,seatedSpec.atlas,{...actor,column:seatedSpec.column,height:seatedSpec.height},sceneConfig.height,seatedSpec.frames):null;
    actorViews.set(actor.id,{standing,seated});
  }
  glintCanvas=document.createElement('canvas');glintCanvas.id='skill-glints';glintCanvas.width=sceneConfig.width;glintCanvas.height=sceneConfig.height;glintCtx=glintCanvas.getContext('2d');stage.append(glintCanvas);
  loading.remove();document.querySelector('#manual').disabled=false;setState('explore');
  if(cinematicOn){
    cinematicDirector=createDirector(validateScript(cinematicScript));
    document.documentElement.classList.add('cinematic');
    document.documentElement.style.setProperty('--cinematic-size',`${cinematicScript.output}px`);
    stage.style.width=`${cinematicScript.output}px`;stage.style.height=`${cinematicScript.output}px`;
    saving=false;snapshot=chapter.initial();position={...sceneConfig.entryPoints[snapshot.state]};
    enterScene();
    window.careerCinematic={tick:cinematicTick,output:cinematicScript.output,report:()=>({played:cinematicDirector.played,stills:cinematicDirector.stills,phase:cinematicDirector.phase})};
    if(window.__cinematicExternal!==true){
      const loop=()=>{const report=cinematicTick();if(report.error){console.error(report.error);showFailure('拍摄中断。');return;}if(!report.done)raf=requestAnimationFrame(loop);};
      raf=requestAnimationFrame(loop);
    }
  }else{
  let restored;try{storage=window.localStorage;restored=chapter.inspect(storage);}catch{restored={kind:'unavailable'};}
  snapshot=restored.snapshot||chapter.initial();const savedPlay=snapshot.play;delete snapshot.play;
  position={...sceneConfig.entryPoints[snapshot.state]};playSavingReady=restored.kind==='valid'||restored.kind==='fresh';
  if(restored.kind==='invalid')storageProblem('这份存档无法识别或已经损坏。它没有被覆盖。可以明确重新开始，或保留原存档仅在本次体验。',enterScene);
  else if(restored.kind==='unavailable'){saving=false;document.querySelector('#save-status').textContent='浏览器存储不可用，本次进度不会保存';enterScene();}
  else if(restored.kind==='fresh')persist(enterScene);
  else{document.querySelector('#save-status').textContent='已恢复上次确认的进度';if(!await restorePlayState(savedPlay))enterScene();savePlayState();}
  loopReady=true;cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);
  }
  // Read-only diagnostics support browser acceptance without changing game state.
  window.careerPrototype={snapshot:()=>({position:{...position},state,active:active?.id||null,chapter:structuredClone(snapshot),saving,saveKey:chapter.key,bounds,three:'canvas',facing,moving,walkTime,walkMetrics:actorViews.get('player').standing.metrics(),sit:actorViews.get('player').seated?.visible?actorViews.get('player').seated.metrics():null,actors:visibleRoom().actors.map(a=>({id:a.id,position:renderPosition(a),posture:isTyping(a)?'seatedTyping':'standing'})),frames:Object.fromEntries([...actorViews].map(([id,views])=>[id,(views.seated?.visible?views.seated:views.standing).frame()])),markers:pendingMarkers(visibleRoom(),chapter,snapshot),boardLit:propViews.some(item=>item.showing==='lit')})};
  window.addEventListener('pagehide',()=>{savePlayState();cancelAnimationFrame(raf);hideObjectCard();},{once:true});
}
function navigateOption(key){
  const buttons=enabledOptions();if(!buttons.length)return;
  const current=Math.max(0,buttons.indexOf(document.activeElement)),rows=[];
  for(const button of buttons){const r=button.getBoundingClientRect(),item={button,x:r.left+r.width/2,y:r.top+r.height/2,height:r.height};let row=rows.find(a=>Math.abs(a[0].y-item.y)<Math.min(a[0].height,item.height)/2);if(!row){row=[];rows.push(row);}row.push(item);}
  const step=key==='ArrowUp'||key==='ArrowLeft'?-1:1;
  if(rows.length===1){buttons[(current+step+buttons.length)%buttons.length].focus();return;}
  const rowIndex=rows.findIndex(row=>row.some(a=>a.button===buttons[current])),row=rows[rowIndex],column=row.findIndex(a=>a.button===buttons[current]);
  if(key==='ArrowLeft'||key==='ArrowRight')row[(column+step+row.length)%row.length].button.focus();
  else{const target=rows[(rowIndex+step+rows.length)%rows.length],x=row[column].x;target.reduce((a,b)=>Math.abs(a.x-x)<=Math.abs(b.x-x)?a:b).button.focus();}
}
window.addEventListener('keydown',event=>{
  ensureAudio();
  const key=event.key.length===1?event.key.toLowerCase():event.key;
  if(state==='error'||state==='loading'){if(event.repeat&&(key==='Enter'||key===' '))event.preventDefault();return;}
  if(state==='transition'){event.preventDefault();if(!event.repeat&&(key==='Enter'||key===' '||key==='Escape'))finishTransition();return;}
  const scope=optionScope(),focused=document.activeElement,inScope=scope?.contains(focused),inOptions=inScope&&focused.matches('.choices button');
  // Route confirmation by the active UI, even after a scene/pointer focus change.
  if(scope&&(key.startsWith('Arrow')||key==='Enter'||key===' ')){
    event.preventDefault();
    const buttons=enabledOptions(scope);
    if(!buttons.includes(document.activeElement))buttons[0]?.focus({preventScroll:true});
    if(key.startsWith('Arrow')){navigateOption(key);return;}
    if(event.repeat||confirmationKeys.has(key))return;
    confirmationKeys.add(key);
    const button=buttons.includes(document.activeElement)?document.activeElement:buttons[0];
    if(button)button.click();else if(state==='dialogue')closeConversation();
    return;
  }
  if(inScope&&focused.id==='dialogue'&&readingKeys.has(key)){
    const atStart=focused.scrollTop<=0,atEnd=focused.scrollTop+focused.clientHeight>=focused.scrollHeight-1;
    // Let the browser scroll the focused prose, but never chain a boundary key into the page/scene.
    if((['PageUp','Home','ArrowUp'].includes(key)&&atStart)||(['PageDown','End','ArrowDown'].includes(key)&&atEnd))event.preventDefault();
    return;
  }
  if(inOptions&&['PageUp','PageDown','Home','End'].includes(key)){event.preventDefault();return;}
  if(inOptions&&key.startsWith('Arrow')){event.preventDefault();navigateOption(key);return;}
  if(inOptions&&(key==='Enter'||key===' ')){
    event.preventDefault();if(event.repeat||confirmationKeys.has(key))return;confirmationKeys.add(key);
    const button=document.activeElement;
    if(button.matches('.choices button')&&!button.disabled&&button.getAttribute('aria-disabled')!=='true')button.click();
    return;
  }
  if(movement.has(key)&&state==='explore'){
    if(document.activeElement!==stage)return;
    event.preventDefault();keys.add(key);
  }
  if(event.repeat){if(state!=='explore')event.preventDefault();return;}
  if(key==='m'&&state==='explore'&&document.activeElement===stage){event.preventDefault();manual();return;}
  if(key==='q'&&state==='explore'&&document.activeElement===stage){const list=nearbyAll(position,visibleRoom());if(list.length>1){event.preventDefault();selectedTargetID=list[(list.findIndex(o=>o.id===active?.id)+1)%list.length].id;updateUI();}return;}
  if(awardOpen&&key==='Escape'){event.preventDefault();finishSkillAward();return;}
  if(state==='journey'&&key==='Escape'){event.preventDefault();return;}
  if(key==='Escape'){
    event.preventDefault();
    if(state==='explore')savePlayState();
    else if(state==='dialogue')closeConversation();
    return;
  }
  if((key==='e'||key==='Enter')&&state==='explore'&&document.activeElement===stage){event.preventDefault();if(confirmationKeys.has(key))return;if(key==='Enter')confirmationKeys.add(key);openConversation();}
},true);
window.addEventListener('keyup',event=>{const key=event.key.length===1?event.key.toLowerCase():event.key;keys.delete(key);if(confirmationKeys.has(key)){event.preventDefault();confirmationKeys.delete(key);}savePlayState();},true);
document.addEventListener('focusin',event=>{if(event.target===stage||event.target.id==='dialogue'||event.target.matches('.game-shell button, .choices button')){lastGameFocus=event.target;savePlayState();}});
function loseWindowFocus(){if(cinematicOn)return;savePlayState();suspended=true;cancelAnimationFrame(raf);cancelAnimationFrame(journeyFrame);clearInput();moving=false;confirmationKeys.clear();}
function regainWindowFocus(){
  if(cinematicOn||document.hidden)return;suspended=false;previous=0;
  if(loopReady&&state!=='error'&&state!=='loading'){cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);}
  if(state==='journey'&&journeyMap&&!journeyArrived){const a=journeyMap.data.animation_suggestion;journeyStarted=performance.now()-journeyProgress*(journeyRoute==='nanjing-hangzhou'?(a.duration_ms_nanjing_to_hangzhou||3200):(a.duration_ms_hefei_to_nanjing||3200));cancelAnimationFrame(journeyFrame);journeyFrame=requestAnimationFrame(paintJourney);}
  focusCurrentUI();
}
window.addEventListener('blur',loseWindowFocus);
window.addEventListener('focus',regainWindowFocus);
document.addEventListener('visibilitychange',()=>{if(document.hidden)loseWindowFocus();else regainWindowFocus();});
stage.addEventListener('blur',clearInput);stage.addEventListener('pointerdown',()=>{if(state==='explore')stage.focus({preventScroll:true});});
document.querySelector('#manual').addEventListener('click',()=>{if(state==='explore')manual();});
systemDialog.addEventListener('cancel',event=>{event.preventDefault();closeConversation();});
new ResizeObserver(()=>{placeBubble();positionEffects();}).observe(stage);
// Retrying from text reading must not restore the summary fragment over the game's focus.
document.querySelector('#retry-game').addEventListener('click',()=>{const url=new URL(window.location.href);url.hash='';window.location.replace(url.href);});
start().catch(error=>{showFailure(`办公室暂未打开：${error.message} 请检查浏览器的图形支持、网络与本地 HTTP 服务后重试。`);console.error(error);});
