import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createChapter} from '../story.mjs';
const data=JSON.parse(readFileSync(new URL('../../design/chapter-01.json',import.meta.url),'utf8'));
const chapter=createChapter(data);
test('restoration prose preserves the two hours without exposing the stage direction',()=>{
  assert.equal(chapter.text('restored-n1'),'整整两小时后，问题才恢复。');
});
const prefix=['open_forum_post','read_feedback','cto_rallies_team','confirm_recheck_visited','confirm_impact_scope','confirm_feedback_reviewed','resume_narrative','comfort_read'];
function apply(events){return events.reduce((s,e)=>{const r=chapter.advance(s,e);assert.equal(r.accepted,true,e);return r.snapshot;},chapter.initial());}
test('both learning orders complete only after both reviews and manual confirmation',()=>{
  for(const order of [['review_test_plan','review_trap_comment'],['review_trap_comment','review_test_plan']]){
    let s=apply(prefix);assert.equal(chapter.advance(s,'write_manual_entry').accepted,false);
    s=chapter.advance(s,order[0]).snapshot;assert.equal(chapter.advance(s,'write_manual_entry').accepted,false);
    s=chapter.advance(s,order[1]).snapshot;s=chapter.advance(s,'write_manual_entry').snapshot;
    assert.equal(s.state,'journey');assert.ok(s.flags.includes('comfort_read'));
    s=chapter.advance(s,'open_journey').snapshot;s=chapter.advance(s,'notice_react').snapshot;s=chapter.advance(s,'finish_journey').snapshot;
    assert.equal(s.state,'complete');
  }
});
test('prerequisites and duplicate confirmations cannot advance, remove flags or shadow later actions',()=>{
  let s=apply(prefix.slice(0,3));assert.equal(chapter.advance(s,'confirm_impact_scope').accepted,false);
  s=chapter.advance(s,'confirm_recheck_visited').snapshot;
  const duplicate=chapter.advance(s,'confirm_recheck_visited');assert.equal(duplicate.accepted,false);assert.equal(duplicate.snapshot,s);
  assert.deepEqual(chapter.actions(s,'cto').map(t=>t.event),['confirm_impact_scope']);
  s=chapter.advance(s,'confirm_impact_scope').snapshot;s=chapter.advance(s,'confirm_feedback_reviewed').snapshot;
  assert.deepEqual(chapter.actions(s,'cto').map(t=>t.event),['resume_narrative']);
});
test('every designed legal configuration restores exactly through a single atomic value',()=>{
  let writes=0;const store={value:null,getItem(){return this.value;},setItem(key,value){writes++;this.value=value;}};
  let configurations=0;
  for(const [state,sets] of Object.entries(data.legalSnapshots))for(const flags of sets){
    const s={schema:1,chapter:data.id,state,flags};assert.equal(chapter.valid(s),true);
    const before=writes;assert.equal(chapter.save(store,s),true);assert.equal(writes,before+1);
    assert.deepEqual(chapter.inspect(store),{kind:'valid',snapshot:s});configurations++;
  }
  assert.equal(configurations,18);
});
test('damaged, old and impossible snapshots are preserved and reported, never silently reset',()=>{
  for(const raw of ['{broken',JSON.stringify({state:'office'}),JSON.stringify({...chapter.initial(),schema:0}),JSON.stringify({...chapter.initial(),state:'__proto__'}),JSON.stringify({...chapter.initial(),flags:['test_reviewed']})]){
    const store={getItem:()=>raw,setItem:()=>assert.fail('must not write while inspecting')};
    assert.deepEqual(chapter.inspect(store),{kind:'invalid',raw});
  }
  const raw=JSON.stringify(chapter.initial());const denied={getItem:()=>raw,setItem(){throw Error('quota');}};
  assert.equal(chapter.save(denied,chapter.initial()),false);assert.equal(denied.getItem(),raw);
  assert.equal(chapter.inspect({getItem(){throw Error('disabled');}}).kind,'unavailable');
});
test('runtime maps both learning items to the right computer, while manual remains separate',()=>{
  const s=apply(prefix);assert.deepEqual(chapter.actions(s,'cto').map(t=>t.event),['review_test_plan','review_trap_comment']);
  assert.equal(chapter.actions(s,'manual').length,0);
  const ready=apply([...prefix,'review_test_plan','review_trap_comment']);assert.equal(chapter.actions(ready,'manual')[0].event,'write_manual_entry');
});
test('identical semantic journeys replay equally across independent instances and stable saves',()=>{
  const clone=value=>JSON.parse(JSON.stringify(value));
  const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
  // The public manual outcome is its persisted flag and the same text ID read by main.manual().
  const view=(api,snapshot)=>({snapshot:clone(snapshot),manual:{written:api.has(snapshot,'manual_entry_written'),text:api.has(snapshot,'manual_entry_written')?api.text('learning-manual-1'):null}});
  const runs=[];
  for(const order of [['review_test_plan','review_trap_comment'],['review_trap_comment','review_test_plan']]){
    const left=createChapter(clone(data));let right=createChapter(clone(data));
    assert.notEqual(left,right);let a=left.initial(),b=right.initial();assert.notEqual(a,b);
    const memory=new Map(),store={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)};
    const trace=[],recoveries=[];
    const recover=()=>{
      assert.equal(right.save(store,b),true);
      right=createChapter(clone(data));const restored=right.inspect(store);
      assert.equal(restored.kind,'valid');b=restored.snapshot;
      assert.equal(JSON.stringify(view(left,a)),JSON.stringify(view(right,b)),'restore preserves state and manual');
      recoveries.push({beforeStep:trace.length+1,state:b.state,flags:[...b.flags],serializedSHA256:digest(b)});
    };
    const accepted=event=>({event,accepted:true});
    const sequence=[...prefix.slice(0,4).map(accepted),{event:'confirm_recheck_visited',accepted:false},
      ...prefix.slice(4).map(accepted),...order.map(accepted),{event:order[0],accepted:false},
      {event:'write_manual_entry',accepted:true},{event:'open_forum_post',accepted:false},{event:'write_manual_entry',accepted:false},
      {event:'open_journey',accepted:true},{event:'notice_react',accepted:true},{event:'finish_journey',accepted:true}];
    const initial=view(left,a);assert.deepEqual(initial,view(right,b));
    for(const step of sequence){
      recover();const before=view(left,a);
      const x=left.advance(a,step.event),y=right.advance(b,step.event);
      assert.equal(x.accepted,step.accepted,step.event);assert.equal(y.accepted,step.accepted,step.event);
      a=x.snapshot;b=y.snapshot;
      assert.equal(JSON.stringify(view(left,a)),JSON.stringify(view(right,b)),step.event);
      if(!step.accepted)assert.deepEqual(view(left,a),before,'old event must not change state or manual');
      trace.push({step:trace.length+1,event:step.event,accepted:x.accepted,state:a.state,flags:[...a.flags],
        serializedSHA256:digest(a),manualWritten:before.manual.written,manualAfter:view(left,a).manual});
    }
    recover();const final=view(left,a);assert.equal(final.snapshot.state,'complete');assert.equal(final.manual.written,true);
    assert.equal(final.manual.text,data.dialogues.find(d=>d.id==='learning-manual-1').text);
    assert.match(final.manual.text,/补了测试/);
    assert.equal(/有人扛|一起扛|一起承担/.test(final.manual.text),false);
    runs.push({learningOrder:order,initial,trace,recoveries,final});
  }
  // Different learning orders may serialize flag insertion order differently; semantic outcomes agree.
  const semanticFinal=run=>({...run.final,snapshot:{...run.final.snapshot,flags:[...run.final.snapshot.flags].sort()}});
  assert.deepEqual(semanticFinal(runs[0]),semanticFinal(runs[1]));
  if(process.env.STORY_DETERMINISM_EVIDENCE)writeFileSync(process.env.STORY_DETERMINISM_EVIDENCE,JSON.stringify({
    test:'identical semantic journeys replay equally across independent instances and stable saves',
    publicAPI:['createChapter','initial','advance','save','inspect','has','text'],
    fixtureSHA256:createHash('sha256').update(readFileSync(new URL('../../design/chapter-01.json',import.meta.url))).digest('hex'),runs
  },null,2)+'\n');
});
