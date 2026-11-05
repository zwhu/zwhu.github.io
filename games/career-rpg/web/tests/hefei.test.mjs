import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createChapter} from '../story.mjs';
import {HEFEI,OFFICE,pendingMarkers,expressionFor,presentCast,transitionBeat,transitionFinished} from '../scene-config.mjs';
import {blocked,nearby} from '../world.mjs';

const nanjingData=JSON.parse(readFileSync(new URL('../../design/chapter-01.json',import.meta.url),'utf8'));
const nanjing=createChapter(nanjingData);
const data=JSON.parse(readFileSync(new URL('../../design/chapter-hefei.json',import.meta.url),'utf8'));
const chapter=createChapter(data);
const facts={
  'interview-narrator':'原本录用的人嫌工资低，没来。',
  'interview-boss-1':'你能力不行，来了也干不了活。',
  'interview-player':'我不要工资，让我来试试就行。',
  'interview-boss-2':'行，那你想试试我也不拦你，反正不要工资，到时候你自己也会受不了就走。',
  'day-narrator':'第一次用 Linux 开发机，第一次用 Git，第一次写前端，还第一次写 E2E 测试。不会的就 Google。',
  'night-narrator':'天黑以后，我还在学。白天写前端，晚上啃 Java、数据库和 NoSQL。',
  'days-pass':'日夜颠倒地学新东西，拼命把活干好。',
  'raise-narrator':'入职两个月，加了两次薪。',
  'raise-boss':'努力工作的人一定会被看到的。',
  'manual-1':'努力工作的人一定会被看到的。',
};
function play(events,api=chapter){return events.reduce((s,e)=>{const r=api.advance(s,e);assert.equal(r.accepted,true,e);return r.snapshot;},api.initial());}

test('nanjing copy and object roles still come from chapter data',()=>{
  assert.equal(nanjing.text('restored-n1'),'整整两小时后，问题恢复了。');
  assert.equal(nanjing.text('restored-n1').includes('画面压暗'),false);
  assert.equal(nanjing.target(nanjing.initial()),'去左侧电脑，打开用户论坛');
  const asked=play(['open_forum_post','read_feedback','cto_rallies_team'],nanjing);
  assert.equal(nanjing.target(asked),'排查 0/3 · 右侧电脑：查看排查记录');
  const recheck=nanjing.advance(asked,'confirm_recheck_visited').snapshot;
  assert.equal(nanjing.target(recheck),'排查 1/3 · 右侧电脑：确认影响到谁');
  const impact=nanjing.advance(recheck,'confirm_impact_scope').snapshot;
  assert.equal(nanjing.target(impact),'排查 2/3 · 左侧电脑：重读论坛反馈');
  const done=nanjing.advance(impact,'confirm_feedback_reviewed').snapshot;
  assert.equal(nanjing.target(done),'排查 3/3 · 右侧电脑：结束这轮排查');
  const learning=play(['open_forum_post','read_feedback','cto_rallies_team','confirm_recheck_visited','confirm_impact_scope','confirm_feedback_reviewed','resume_narrative','comfort_read'],nanjing);
  assert.equal(nanjing.target(learning),'看过 0/2 · 右侧电脑：分别查看测试和坑点注释');
  const both=play(['open_forum_post','read_feedback','cto_rallies_team','confirm_recheck_visited','confirm_impact_scope','confirm_feedback_reviewed','resume_narrative','comfort_read','review_test_plan','review_trap_comment'],nanjing);
  assert.equal(nanjing.target(both),'看过 2/2 · 去右侧书架，把这一页写进手册');
  assert.equal(nanjing.actions(nanjing.initial(),'forum')[0].event,'open_forum_post');
  assert.equal(OFFICE.entryPoints.office.x,172);
});

test('hefei keeps five states, ten events and the author wording',()=>{
  assert.equal(chapter.key,'career-rpg:hefei:v1');
  assert.deepEqual(Object.keys(data.legalSnapshots),['interview','day_tasks','night_study','raise','complete']);
  assert.deepEqual(data.transitions.map(t=>t.event),['ask_for_chance','boss_lets_try','take_day_task','review_linux_git','review_frontend','night_falls','study_java','study_db_nosql','days_pass','raise_read']);
  for(const [id,text] of Object.entries(facts))assert.equal(chapter.text(id),text,id);
  assert.equal(chapter.text(chapter.manualId),chapter.text('raise-boss'));
  const blob=JSON.stringify(data.dialogues)+JSON.stringify(data.objectives);
  assert.doesNotMatch(blob,/20\d\d|安风|\d+\s*元/);
});

test('hefei gates trial, day notes and night notes, and a repeat writes nothing',()=>{
  const start=chapter.initial();
  assert.equal(chapter.advance(start,'boss_lets_try').accepted,false);
  assert.equal(chapter.advance(start,'night_falls').accepted,false);
  const asked=chapter.advance(start,'ask_for_chance');
  assert.equal(asked.snapshot.state,'interview');
  assert.equal(chapter.advance(asked.snapshot,'ask_for_chance').accepted,false);
  assert.equal(chapter.advance(asked.snapshot,'ask_for_chance').snapshot,asked.snapshot);
  const day=chapter.advance(asked.snapshot,'boss_lets_try').snapshot;
  assert.equal(chapter.target(day),'去自己的工位，接过电脑上的任务');
  assert.equal(chapter.advance(day,'review_linux_git').accepted,false);
  const tasked=chapter.advance(day,'take_day_task').snapshot;
  assert.match(chapter.target(tasked),/白天 0\/2/);
  const one=chapter.advance(tasked,'review_frontend').snapshot;
  assert.match(chapter.target(one),/白天 1\/2/);
  assert.equal(chapter.advance(one,'night_falls').accepted,false);
  assert.equal(chapter.actions(one,'jquery_book').length,0);
  const ready=chapter.advance(one,'review_linux_git').snapshot;
  assert.deepEqual(chapter.actions(ready,'dialog').map(t=>t.event),['night_falls']);
  const night=chapter.advance(ready,'night_falls').snapshot;
  assert.equal(night.state,'night_study');
  assert.equal(chapter.advance(night,'days_pass').accepted,false);
  const studied=play(['ask_for_chance','boss_lets_try','take_day_task','review_linux_git','review_frontend','night_falls','study_db_nosql','study_java']);
  assert.match(chapter.target(studied),/深夜 2\/2/);
  const raised=chapter.advance(studied,'days_pass').snapshot;
  assert.equal(raised.state,'raise');
  const done=chapter.advance(raised,'raise_read').snapshot;
  assert.equal(done.state,'complete');
  assert.equal(chapter.has(done,'raise_seen'),true);
  assert.equal(chapter.advance(done,'raise_read').accepted,false);
});

test('either order reaches the same manual and every snapshot restores on the hefei key only',()=>{
  const head=['ask_for_chance','boss_lets_try','take_day_task'];
  const finals=[];
  for(const day of [['review_linux_git','review_frontend'],['review_frontend','review_linux_git']]){
    for(const night of [['study_java','study_db_nosql'],['study_db_nosql','study_java']]){
      const done=play([...head,...day,'night_falls',...night,'days_pass','raise_read']);
      finals.push([...done.flags].sort());
      assert.equal(done.state,'complete');
    }
  }
  assert.deepEqual(finals[0],finals[3]);
  const seen=new Set();const queue=[chapter.initial()];
  while(queue.length){
    const current=queue.pop();
    const id=`${current.state}\0${[...current.flags].sort().join('\0')}`;
    if(seen.has(id))continue;seen.add(id);
    for(const transition of data.transitions){const next=chapter.advance(current,transition.event);if(next.accepted)queue.push(next.snapshot);}
  }
  assert.equal(seen.size,13);
  const memory=new Map();const store={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
  for(const [state,groups] of Object.entries(data.legalSnapshots))for(const flags of groups){
    const snapshot={schema:1,chapter:data.id,state,flags};
    assert.equal(chapter.valid(snapshot),true);
    assert.equal(chapter.save(store,snapshot),true);
    assert.deepEqual(chapter.inspect(store).snapshot,snapshot);
  }
  assert.deepEqual([...memory.keys()],['career-rpg:hefei:v1']);
  const raw='{broken';
  assert.deepEqual(chapter.inspect({getItem:()=>raw,setItem(){throw new Error('write');}}),{kind:'invalid',raw});
});

test('hefei marker sits on my_pc, cards stay off the startup sheets, and the aisle reaches each point',()=>{
  const day=play(['ask_for_chance','boss_lets_try']);
  const myPc=HEFEI.objects.find(o=>o.id==='my-pc');
  const marks=pendingMarkers(HEFEI,chapter,day);
  assert.deepEqual(marks.map(m=>m.id),['my-pc']);
  assert.equal(marks[0].sprite,HEFEI.marker);
  assert.equal(marks[0].x,myPc.markerPosition.x);assert.equal(marks[0].y,myPc.markerPosition.y);
  const taken=chapter.advance(day,'take_day_task').snapshot;
  assert.equal(pendingMarkers(HEFEI,chapter,taken).some(m=>m.id==='my-pc'),false);
  assert.equal(pendingMarkers(HEFEI,chapter,chapter.initial()).some(m=>m.id==='my-pc'),false);
  const card=HEFEI.objects.find(o=>o.id==='db-screen').card;
  assert.equal(card.endsWith('db-nosql-screen/card-192.png'),true);
  assert.equal(HEFEI.backgrounds.day.includes(card),false);
  const hash=name=>createHash('sha256').update(readFileSync(new URL(`../art/hefei/hefei-props/db-nosql-screen/${name}`,import.meta.url))).digest('hex');
  assert.equal(hash('card-192.png'),'4b3372520eb8432b1fcc627cebd548d63bd3f71f2c0adbcf79a879d579019836');
  assert.equal(hash('icon.png'),'8a5161aecda94d0889fecd941d58fc842a14cb41e2102a8a4c580b225f253145');
  assert.equal(hash('icon-highlight.png'),'a73455057d3752075659430479d442354c5154c939a52cf0ffc1c817f81fec7b');
  const boss=HEFEI.actors.find(a=>a.id==='boss');
  assert.equal(boss.emotionAtlas,'bossEmotions');
  assert.equal(expressionFor(boss,{state:'interview'}),'doubtful');
  assert.equal(expressionFor(boss,{state:'raise'}),'approving');
  assert.equal(expressionFor(HEFEI.actors[0],{state:'interview'}),'tense');
  assert.equal(presentCast(OFFICE,{state:'office'}),OFFICE);
  const night=presentCast(HEFEI,{state:'night_study'});
  assert.deepEqual(night.actors.map(a=>a.id),['player']);
  assert.ok(night.objects.some(o=>o.id==='db-screen'));
  assert.equal(night.objects.some(o=>o.id==='linux-screen'),false);
  const start=HEFEI.entryPoints.interview;
  const seen=new Set();const queue=[[start.x,start.y]];
  while(queue.length){
    const [x,y]=queue.pop();const key=`${x},${y}`;if(seen.has(key)||blocked(x,y,HEFEI))continue;seen.add(key);
    queue.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
  const points=[...Object.values(HEFEI.entryPoints),...HEFEI.objects,...HEFEI.actors.filter(a=>a.interaction).map(a=>a.interaction)];
  for(const point of points){
    assert.equal(blocked(point.x,point.y,HEFEI),false,point.id||'point');
    assert.equal(seen.has(`${point.x},${point.y}`),true,point.id||'point');
  }
  assert.equal(nearby(myPc,presentCast(HEFEI,{state:'day_tasks'})).id,'my-pc');
  const nightBeats=HEFEI.transitionBeats.night_falls.length,beatMs=HEFEI.beatMs;
  assert.equal(transitionBeat(nightBeats,0,beatMs),0);
  assert.equal(transitionBeat(nightBeats,beatMs,beatMs),1);
  assert.equal(transitionFinished(nightBeats,nightBeats*beatMs-1,beatMs),false);
  assert.equal(transitionFinished(nightBeats,nightBeats*beatMs,beatMs),true);
  assert.equal(transitionFinished(HEFEI.transitionBeats.days_pass.length,HEFEI.transitionBeats.days_pass.length*HEFEI.beatMs,HEFEI.beatMs),true);
  assert.ok(HEFEI.transitionBeats.days_pass.length*HEFEI.beatMs<=6000);
});
