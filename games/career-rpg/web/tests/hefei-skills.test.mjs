import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChapter} from '../story.mjs';

const data=JSON.parse(readFileSync(new URL('../../design/chapter-hefei.json',import.meta.url),'utf8'));
const chapter=createChapter(data);
const nanjing=createChapter(JSON.parse(readFileSync(new URL('../../design/chapter-01.json',import.meta.url),'utf8')));
const names=['精通 Linux 系统重装','熟练使用 jQuery 切西瓜','细品 Java ☕️','问 SQL 你 No 不 No'];
const head=['ask_for_chance','boss_lets_try','take_day_task'];
function play(events,start=chapter.initial()){return events.reduce((snapshot,event)=>{const next=chapter.advance(snapshot,event);assert.equal(next.accepted,true,event);return next.snapshot;},start);}
const memory=()=>{const saved=new Map();return {saved,store:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)}}};

test('hefei lists four skills and does not replace the nanjing list',()=>{
  assert.deepEqual(chapter.skillSlots(chapter.initial()).map(skill=>skill.status),['none','none','none','none']);
  assert.deepEqual(chapter.skillSlots(chapter.initial()).map(skill=>skill.name),names);
  assert.deepEqual(nanjing.skillSlots(nanjing.initial()).map(skill=>skill.id),['fibjs','cicd','release','failure','react']);
  assert.equal(nanjing.collect(nanjing.initial(),'linux').accepted,false);
  assert.equal(chapter.collect(chapter.initial(),'fibjs').accepted,false);
});

test('finishing a task makes that skill ready and a second collect does nothing',()=>{
  const ready=play([...head,'review_linux_git']);
  assert.equal(ready.skills.linux,'ready');
  assert.equal(ready.skills.jquery,'none');
  assert.equal(chapter.collect(ready,'jquery').accepted,false);
  const got=chapter.collect(ready,'linux');
  assert.equal(got.accepted,true);
  assert.equal(got.snapshot.skills.linux,'got');
  assert.deepEqual(got.snapshot.flags,ready.flags);
  assert.equal(chapter.collect(got.snapshot,'linux').accepted,false);
  assert.equal(chapter.collect(got.snapshot,'linux').snapshot,got.snapshot);
});

test('chapter completion grants every skill that was not picked up',()=>{
  const picked=chapter.collect(play([...head,'review_linux_git']),'linux').snapshot;
  const done=play(['review_frontend','night_falls','study_java','study_db_nosql','days_pass','raise_read'],picked);
  assert.equal(done.state,'complete');
  assert.deepEqual(Object.values(done.skills),['got','got','got','got']);
  const untouched=play([...head,'review_linux_git','review_frontend','night_falls','study_java','study_db_nosql','days_pass','raise_read']);
  assert.deepEqual(untouched.skills,{linux:'got',jquery:'got',java:'got',db:'got'});
});

test('legacy saves stay valid and derive ready or granted skills without rewriting the stored value',()=>{
  const {store}=memory();
  const legacy={schema:1,chapter:data.id,state:'day_tasks',flags:['asked','hired_trial','day_task_taken','linux_git_reviewed']};
  assert.equal(chapter.valid(legacy),true);
  assert.equal(chapter.save(store,legacy),true);
  assert.deepEqual(chapter.inspect(store).snapshot,legacy);
  assert.equal(chapter.skillSlots(legacy).find(skill=>skill.id==='linux').status,'ready');
  assert.equal(chapter.skillSlots(legacy).find(skill=>skill.id==='java').status,'none');
  const finished={schema:1,chapter:data.id,state:'complete',flags:data.legalSnapshots.complete[0]};
  assert.equal(chapter.valid(finished),true);
  assert.equal(chapter.skillSlots(finished).every(skill=>skill.status==='got'),true);
});

test('replay starts empty and a collected skill survives a save round trip',()=>{
  const {store}=memory();
  const got=chapter.collect(play([...head,'review_frontend']),'jquery').snapshot;
  assert.equal(chapter.save(store,got),true);
  const restored=chapter.inspect(store).snapshot;
  assert.equal(restored.skills.jquery,'got');
  assert.equal(restored.skills.linux,'none');
  assert.deepEqual(chapter.skillSlots(chapter.initial()).map(skill=>skill.status),['none','none','none','none']);
});
