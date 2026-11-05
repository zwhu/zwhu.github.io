import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChapter} from '../story.mjs';
import {OFFICE,pendingMarkers,actionsFor,expressionFor} from '../scene-config.mjs';
import {frameIndex,bubblePosition,typingFrame,stableFrameRects,motionForRender,WALK_POSE_HZ} from '../actors.mjs';
const data=JSON.parse(readFileSync(new URL('../../design/chapter-01.json',import.meta.url),'utf8')),chapter=createChapter(data);
test('direction rows and idle/step frames remain distinct, including typing clips',()=>{
  const atlas=OFFICE.atlases.player;
  assert.equal(frameIndex(atlas,'down',false,0),0);assert.equal(frameIndex(atlas,'up',false,0),3);assert.equal(frameIndex(atlas,'left',false,0),6);assert.equal(frameIndex(atlas,'right',false,0),9);
  assert.equal(WALK_POSE_HZ,4);
  assert.equal(frameIndex(atlas,'left',true,0),6);assert.equal(frameIndex(atlas,'left',true,.26),7);assert.equal(frameIndex(atlas,'left',true,.51),6);assert.equal(frameIndex(atlas,'left',true,.76),8);assert.equal(frameIndex(atlas,'left',false,.76),6);
  assert.equal(typingFrame(2,0,true),2);assert.equal(typingFrame(2,.4,true),6);assert.equal(typingFrame(2,.4,false),2);
});
test('pose references keep one direction at a stable scale and align every visible sole',()=>{
  const frames=[
    {left:10,right:60,top:10,bottom:89,width:51,height:80,cell:{left:0,top:0,width:100,height:100}},
    {left:110,right:170,top:12,bottom:89,width:61,height:78,cell:{left:100,top:0,width:100,height:100}},
    {left:215,right:260,top:8,bottom:89,width:46,height:82,cell:{left:200,top:0,width:100,height:100}},
  ];
  const refs=stableFrameRects(frames,{columns:3,referenceGrouping:'row'});
  assert.deepEqual(refs.map(r=>[r.width,r.height,r.centerOffset]),[[61,82,-9.5],[61,82,-9.5],[61,82,-9.5]]);
  for(let i=0;i<3;i++)assert.equal(refs[i].top+refs[i].height,frames[i].bottom+1);
});
test('render frames without a fixed physics tick do not reset walking, but key release does',()=>{
  let motion=motionForRender(true,true,true,100,-Infinity);assert.equal(motion.moving,true);
  motion=motionForRender(true,true,false,108,motion.lastMovedAt);assert.equal(motion.moving,true);
  motion=motionForRender(true,true,false,116,motion.lastMovedAt);assert.equal(motion.moving,true);
  assert.equal(motionForRender(true,false,false,117,motion.lastMovedAt).moving,false);
  assert.equal(motionForRender(false,true,false,118,motion.lastMovedAt).moving,false);
  assert.equal(motionForRender(true,true,false,200,motion.lastMovedAt).moving,false);
});
test('bubble placement stays inside every viewport edge and changes side when needed',()=>{
  for(const anchor of [{x:0,y:0},{x:100,y:5},{x:390,y:240},{x:1,y:230}]){
    const b=bubblePosition(anchor,{width:280,height:160},{width:400,height:250});
    assert.ok(b.left>=8&&b.left+280<=392);assert.ok(b.top>=8&&b.top+160<=242);
  }
  assert.equal(bubblePosition({x:80,y:5},{width:180,height:80},{width:400,height:250}).below,true);
});
test('task marker survives opening a page and disappears only after accepted event',()=>{
  let s=chapter.initial();const first=pendingMarkers(OFFICE,chapter,s);
  assert.ok(first.some(m=>m.events.includes('open_forum_post')));
  assert.deepEqual(pendingMarkers(OFFICE,chapter,s),first);
  s=chapter.advance(s,'open_forum_post').snapshot;
  assert.ok(!pendingMarkers(OFFICE,chapter,s).some(m=>m.events.includes('open_forum_post')));
  assert.deepEqual(pendingMarkers(OFFICE,chapter,JSON.parse(JSON.stringify(s))),pendingMarkers(OFFICE,chapter,s));
  assert.deepEqual(pendingMarkers(OFFICE,chapter,chapter.initial()),first);
});
test('CTO is an interactable actor, both companions exist, and expressions follow story state',()=>{
  const cto=OFFICE.actors.find(a=>a.id==='cto');assert.ok(cto.atlas&&cto.role==='cto');
  const incident={schema:1,chapter:data.id,state:'incident',flags:data.legalSnapshots.incident[0]};
  assert.equal(actionsFor(chapter,incident,cto)[0].event,'cto_rallies_team');
  assert.equal(OFFICE.actors.filter(a=>!a.controllable).length,3);
  assert.equal(OFFICE.actors.find(a=>a.id==='colleague-dev').name,'费翔🐘');
  const player=OFFICE.actors.find(a=>a.controllable);assert.equal(expressionFor(player,incident),'tense');assert.equal(expressionFor(player,{state:'complete'}),'happy');
});
