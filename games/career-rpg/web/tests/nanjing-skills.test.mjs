import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChapter} from '../story.mjs';
import {GAME_TITLE} from '../title.mjs';

const data=JSON.parse(readFileSync(new URL('../../design/chapter-01.json',import.meta.url),'utf8'));
const chapter=createChapter(data);
const names=['fibjs／nodejs 做全栈','CI/CD 做集成测试','对上线要有敬畏之心（灰度、观测、回滚）','学会从失败中学习经验','React／Webpack'];
const prefix=['open_forum_post','read_feedback','cto_rallies_team','confirm_recheck_visited','confirm_impact_scope','confirm_feedback_reviewed','resume_narrative','comfort_read'];
function play(events,start=chapter.initial()){return events.reduce((snapshot,event)=>{const next=chapter.advance(snapshot,event);assert.equal(next.accepted,true,event);return next.snapshot;},start);}
const memory=()=>{const saved=new Map();return {saved,store:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)}}};

test('nanjing lists five skills',()=>{
  assert.deepEqual(chapter.skillSlots(chapter.initial()).map(skill=>skill.name),names);
  assert.deepEqual(chapter.skillSlots(chapter.initial()).map(skill=>skill.status),['none','none','none','none','none']);
  assert.equal(GAME_TITLE,'像素前端');
  const banned='欢迎你游戏我的职业前半生';
  for(const file of ['../main.mjs','../index.html','../story.mjs','../scene-config.mjs','../title.mjs','../../design/chapter-01.json'])assert.equal(readFileSync(new URL(file,import.meta.url),'utf8').includes(banned),false,file);
  assert.equal(readFileSync(new URL('../index.html',import.meta.url),'utf8').includes('一路写来'),false);
  assert.match(readFileSync(new URL('../main.mjs',import.meta.url),'utf8'),/GAME_TITLE/);
  const map=JSON.parse(readFileSync(new URL('../art/transition-map/transition-map.json',import.meta.url),'utf8'));
  assert.equal(map.animation_suggestion.duration_ms_hefei_to_nanjing,3200);
  assert.equal(map.animation_suggestion.easing,'ease-in-out');
  assert.deepEqual(map.nodes.map(node=>node.id),['hefei','nanjing','hangzhou']);
  assert.equal(data.journey.artSlot,'hefei-nanjing');
  assert.deepEqual(data.journey.stops.map(stop=>stop.id),['hefei','road','nanjing','next']);
  assert.equal(data.journey.stops.at(-1).skill,'react');
  for(const line of data.dialogues)assert.equal(/有人扛|一起扛|一起承担/.test(line.text),false,line.id);
});

test('each task readies only its skill, and a second collect does nothing',()=>{
  const desk=play(['open_forum_post']);
  assert.equal(desk.skills.fibjs,'ready');
  assert.equal(desk.skills.cicd,'none');
  const got=chapter.collect(desk,'fibjs');
  assert.equal(got.accepted,true);
  assert.equal(got.snapshot.skills.fibjs,'got');
  assert.deepEqual(got.snapshot.flags,desk.flags);
  assert.equal(chapter.collect(got.snapshot,'fibjs').accepted,false);
  const learning=play(prefix.slice(1),desk);
  assert.equal(learning.skills.release,'ready');
  assert.equal(learning.skills.cicd,'none');
  const tested=chapter.advance(learning,'review_test_plan').snapshot;
  assert.equal(tested.skills.cicd,'ready');
  assert.equal(chapter.collect(tested,'react').accepted,false);
});

test('the manual skill waits on the journey, and the chapter grants anything still uncollected',()=>{
  const ready=play([...prefix,'review_test_plan','review_trap_comment','write_manual_entry']);
  assert.equal(ready.state,'journey');
  assert.equal(ready.skills.failure,'ready');
  assert.equal(ready.skills.react,'none');
  const opened=play(['open_journey','notice_react'],ready);
  assert.equal(opened.skills.react,'ready');
  const skipped=play(['finish_journey'],opened);
  assert.equal(skipped.state,'complete');
  assert.deepEqual(Object.values(skipped.skills),['got','got','got','got','got']);
  const untouched=play([...prefix,'review_test_plan','review_trap_comment','write_manual_entry','open_journey','notice_react','finish_journey']);
  assert.deepEqual(untouched.skills,{fibjs:'got',cicd:'got',release:'got',failure:'got',react:'got'});
});

test('legacy saves stay valid, replay starts empty, and a collected skill survives a save',()=>{
  const legacy={schema:1,chapter:data.id,state:'learning',flags:data.legalSnapshots.learning.find(flags=>flags.includes('test_reviewed')&&!flags.includes('comment_reviewed'))};
  assert.equal(chapter.valid(legacy),true);
  assert.equal(chapter.skillSlots(legacy).find(skill=>skill.id==='cicd').status,'ready');
  assert.equal(chapter.skillSlots(legacy).find(skill=>skill.id==='failure').status,'none');
  const finished={schema:1,chapter:data.id,state:'complete',flags:data.legalSnapshots.complete[0]};
  assert.equal(chapter.valid(finished),true);
  assert.equal(chapter.skillSlots(finished).every(skill=>skill.status==='got'),true);
  const {store}=memory();
  const got=chapter.collect(play(['open_forum_post']),'fibjs').snapshot;
  assert.equal(chapter.save(store,got),true);
  assert.equal(chapter.inspect(store).snapshot.skills.fibjs,'got');
  assert.deepEqual(chapter.skillSlots(chapter.initial()).map(skill=>skill.status),['none','none','none','none','none']);
});
