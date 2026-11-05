import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChapter} from '../story.mjs';
import {HANGZHOU,pendingMarkers} from '../scene-config.mjs';
import {blocked,nearby} from '../world.mjs';
import {GAME_TITLE} from '../title.mjs';

const data=JSON.parse(readFileSync(new URL('../../design/chapter-hangzhou.json',import.meta.url),'utf8'));
const chapter=createChapter(data);
const hefei=createChapter(JSON.parse(readFileSync(new URL('../../design/chapter-hefei.json',import.meta.url),'utf8')));
const nanjing=createChapter(JSON.parse(readFileSync(new URL('../../design/chapter-01.json',import.meta.url),'utf8')));
const names=['读懂商品发布这摊业务','精读 23 种设计模式','吃透 Webpack 插件机制','吃透 Babel 插件机制','一套表单架构，撑起五条业务线'];
const head=['check_in','review_publish','to_night'];
function play(events,start=chapter.initial()){return events.reduce((snapshot,event)=>{const next=chapter.advance(snapshot,event);assert.equal(next.accepted,true,event);return next.snapshot;},start);}
const memory=()=>{const saved=new Map();return {store:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)}}};
const sheets=['read_line_1','read_line_2','read_line_3','read_line_4','read_line_5','light_board','finish_chapter'];

test('hangzhou lists five skills and does not replace hefei or nanjing',()=>{
  assert.deepEqual(chapter.skillSlots(chapter.initial()).map(skill=>skill.name),names);
  assert.deepEqual(chapter.skillSlots(chapter.initial()).map(skill=>skill.status),['none','none','none','none','none']);
  assert.deepEqual(hefei.skillSlots(hefei.initial()).map(skill=>skill.id),['linux','jquery','java','db']);
  assert.deepEqual(nanjing.skillSlots(nanjing.initial()).map(skill=>skill.id),['fibjs','cicd','release','failure','react']);
  assert.equal(chapter.collect(chapter.initial(),'fibjs').accepted,false);
  assert.equal(chapter.collect(chapter.initial(),'linux').accepted,false);
  assert.equal(nanjing.collect(nanjing.initial(),'publish').accepted,false);
  assert.equal(hefei.collect(hefei.initial(),'forms').accepted,false);
  assert.equal(chapter.key,'career-rpg:hangzhou:v1');
  assert.equal(GAME_TITLE,'像素前端');
  assert.equal(chapter.skillSlots(chapter.initial()).filter(skill=>skill.role==='webpack_screen').map(skill=>skill.id).join(','),'webpack,babel');
  assert.equal(readFileSync(new URL('../main.mjs',import.meta.url),'utf8').includes('欢迎你游戏我的职业前半生'),false);
});

test('each beat readies only its skill, and a second collect does nothing',()=>{
  const desk=play(head);
  assert.equal(desk.state,'night');
  assert.equal(desk.skills.publish,'ready');
  assert.equal(desk.skills.patterns,'none');
  const got=chapter.collect(desk,'publish');
  assert.equal(got.accepted,true);
  assert.equal(got.snapshot.skills.publish,'got');
  assert.deepEqual(got.snapshot.flags,desk.flags);
  assert.equal(chapter.collect(got.snapshot,'publish').accepted,false);
  const plugins=play(['study_patterns','to_plugins','study_webpack'],desk);
  assert.equal(plugins.skills.patterns,'ready');
  assert.equal(plugins.skills.webpack,'ready');
  assert.equal(plugins.skills.babel,'none');
  assert.equal(chapter.collect(plugins,'forms').accepted,false);
  const babelFirst=play(['study_patterns','to_plugins','study_babel','study_webpack','to_sheets'],desk);
  assert.equal(babelFirst.state,'sheets');
  assert.equal(babelFirst.skills.babel,'ready');
});

test('the whiteboard skill waits on five sheets, and the chapter grants anything still uncollected',()=>{
  const ready=play([...head,'study_patterns','to_plugins','study_webpack','study_babel','to_sheets',...sheets.slice(0,5)]);
  assert.equal(ready.state,'sheets');
  assert.equal(ready.skills.forms,'none');
  assert.equal(chapter.target(ready),'五张单齐了 · 回到白板');
  const lit=chapter.advance(ready,'light_board').snapshot;
  assert.equal(lit.state,'board');
  assert.equal(lit.skills.forms,'ready');
  const skipped=chapter.advance(lit,'finish_chapter').snapshot;
  assert.equal(skipped.state,'complete');
  assert.deepEqual(Object.values(skipped.skills),['got','got','got','got','got']);
  const untouched=play([...head,'study_patterns','to_plugins','study_babel','study_webpack','to_sheets',...sheets]);
  assert.deepEqual(untouched.skills,{publish:'got',patterns:'got',webpack:'got',babel:'got',forms:'got'});
});

test('legacy saves stay valid, replay starts empty, and a collected skill survives a save',()=>{
  const {store}=memory();
  const legacy={schema:1,chapter:data.id,state:'night',flags:['checked_in','publish_read','night_started']};
  assert.equal(chapter.valid(legacy),true);
  assert.equal(chapter.save(store,legacy),true);
  assert.deepEqual(chapter.inspect(store).snapshot,legacy);
  assert.equal(chapter.skillSlots(legacy).find(skill=>skill.id==='publish').status,'ready');
  assert.equal(chapter.skillSlots(legacy).find(skill=>skill.id==='patterns').status,'none');
  const finished={schema:1,chapter:data.id,state:'complete',flags:data.legalSnapshots.complete[0]};
  assert.equal(chapter.valid(finished),true);
  assert.equal(chapter.skillSlots(finished).every(skill=>skill.status==='got'),true);
  const got=chapter.collect(play(head),'publish').snapshot;
  assert.equal(chapter.save(store,got),true);
  assert.equal(chapter.inspect(store).snapshot.skills.publish,'got');
  assert.deepEqual(chapter.skillSlots(chapter.initial()).map(skill=>skill.status),['none','none','none','none','none']);
});

test('every designed snapshot is reachable and the placeholder room can reach each stop',()=>{
  const seen=new Set();const queue=[chapter.initial()];
  while(queue.length){
    const current=queue.pop();
    const id=`${current.state}\0${[...current.flags].sort().join('\0')}`;
    if(seen.has(id))continue;seen.add(id);
    for(const transition of data.transitions){const next=chapter.advance(current,transition.event);if(next.accepted)queue.push(next.snapshot);}
  }
  const legal=new Set();
  for(const [state,groups] of Object.entries(data.legalSnapshots))for(const flags of groups){
    const snapshot={schema:1,chapter:data.id,state,flags};
    assert.equal(chapter.valid(snapshot),true,state);
    legal.add(`${state}\0${[...flags].sort().join('\0')}`);
  }
  assert.equal(seen.size,legal.size);
  for(const id of seen)assert.equal(legal.has(id),true,id);
  const arrive=chapter.initial();
  assert.equal(chapter.target(arrive),'去前台报到');
  assert.deepEqual(pendingMarkers(HANGZHOU,chapter,arrive).map(marker=>marker.id),['check-in']);
  const floor=new Set();const walk=[[HANGZHOU.entryPoints.arrive.x,HANGZHOU.entryPoints.arrive.y]];
  while(walk.length){
    const [x,y]=walk.pop();const key=`${x},${y}`;if(floor.has(key)||blocked(x,y,HANGZHOU))continue;floor.add(key);
    walk.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
  const points=[...Object.values(HANGZHOU.entryPoints),...HANGZHOU.objects];
  for(const point of points){
    assert.equal(blocked(point.x,point.y,HANGZHOU),false,point.id||'entry');
    assert.equal(floor.has(`${point.x},${point.y}`),true,point.id||'entry');
  }
  for(let i=0;i<HANGZHOU.objects.length;i++)for(let j=i+1;j<HANGZHOU.objects.length;j++){
    const a=HANGZHOU.objects[i],b=HANGZHOU.objects[j];
    assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>30,`${a.id} ${b.id}`);
  }
  assert.equal(nearby(HANGZHOU.objects.find(object=>object.id==='check-in'),HANGZHOU).id,'check-in');
  assert.equal(HANGZHOU.background.endsWith('day-384x216.png'),true);
  assert.deepEqual(HANGZHOU.objects.find(object=>object.id==='webpack-screen').events,['study_webpack','study_babel']);
  assert.equal(HANGZHOU.objects.some(object=>object.id==='babel-screen'),false);
});

test('nanjing still walks hefei to nanjing, and the new bridge walks nanjing to hangzhou',()=>{
  const nanjingData=JSON.parse(readFileSync(new URL('../../design/chapter-01.json',import.meta.url),'utf8'));
  const map=JSON.parse(readFileSync(new URL('../art/transition-map/transition-map.json',import.meta.url),'utf8'));
  assert.equal(map.animation_suggestion.duration_ms_hefei_to_nanjing,3200);
  assert.equal(map.animation_suggestion.duration_ms_nanjing_to_hangzhou,3600);
  assert.equal(map.animation_suggestion.easing,'ease-in-out');
  assert.equal(map.text.baked_labels,false);
  assert.deepEqual(map.text.labels,['合肥','南京','杭州']);
  assert.equal(nanjingData.journey.artSlot,'hefei-nanjing');
  assert.deepEqual(nanjingData.journey.stops.map(stop=>stop.id),['hefei','road','nanjing','next']);
  assert.equal(nanjingData.journey.toHangzhou.artSlot,'nanjing-hangzhou');
  assert.deepEqual(nanjingData.journey.toHangzhou.stops.map(stop=>stop.id),['nanjing','road','hangzhou']);
  const main=readFileSync(new URL('../main.mjs',import.meta.url),'utf8');
  assert.match(main,/to-hangzhou/);
  assert.match(main,/hangzhouUnlocked/);
  assert.match(main,/HANGZHOU/);
});
