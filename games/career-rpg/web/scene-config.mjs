// Scene-specific art, placement and roles live here; the renderer and bubble UI reuse this interface.
export const OFFICE={
  id:'nanjing-office',width:384,height:216,background:'./art/office-room-v2.png',
  bounds:{left:6,right:378,top:72,bottom:211},
  obstacles:[{x:0,y:0,w:384,h:69},{x:41,y:69,w:77,h:47},{x:148,y:69,w:77,h:47},{x:257,y:69,w:78,h:47},{x:341,y:0,w:39,h:73},{x:353,y:111,w:27,h:42},{x:41,y:156,w:80,h:47},{x:257,y:156,w:80,h:47},{x:0,y:161,w:38,h:43},{x:7,y:55,w:24,h:46}],
  navigation:{transitY:137},
  atlases:{player:{url:'./art/player-walk-v1.png',columns:3,rows:4,referenceGrouping:'row',directions:['down','up','left','right']},team:{url:'./art/npc-team-v1.png',columns:3,rows:1,directions:['down']},emotions:{url:'./art/player-emotions-v1.png',columns:3,rows:1,directions:['down']},typing:{url:'./art/typing-team-v1.png',columns:4,rows:2,referenceGrouping:'column',directions:['down','up']}},
  expressions:{normal:0,tense:1,happy:2},
  actors:[
    {id:'player',name:'我',atlas:'player',height:44,controllable:true,typingColumn:0,expressionByState:{report:'tense',incident:'tense',investigation:'tense',restored:'happy',complete:'happy'}},
    {id:'cto',name:'CTO',role:'cto',atlas:'team',column:0,typingColumn:1,height:44,x:185,y:108,seat:{x:185,y:108},interaction:{x:185,y:127},posture:'seatedTyping',events:['cto_rallies_team','resume_narrative'],marker:true,dialogue:{default:'CTO 在工位旁，和大家一起关注这次上线。',restored:'问题恢复后，CTO 和老板、同事都在安慰我。',learning:'CTO 和大家一起把教训留在测试与注释里。'}},
    {id:'colleague-dev',name:'费翔🐘',atlas:'team',column:1,typingColumn:2,height:42,x:296,y:108,seat:{x:296,y:108},interaction:{x:296,y:127},posture:'seatedTyping',dialogue:{default:'同伴也在办公室。出问题时，大家会一起排查。',restored:'同事们告诉我，没关系，大家都经历过。',complete:'这次经历留在了手册里，测试和注释也留给后来改代码的人。'}},
    {id:'colleague-team',name:'同伴 · 协作',atlas:'team',column:2,typingColumn:3,height:42,x:82,y:197,seat:{x:82,y:197},interaction:{x:125,y:190},posture:'seatedTyping',dialogue:{default:'这里并不只有我一个人。遇到问题，还有一起做事的人。',restored:'大家的宽慰，让我从第一次事故里慢慢缓过来。',complete:'往后还有新的学习，也会遇到新的问题。'}},
  ],
  objects:[
    {id:'forum',role:'forum',markerPosition:{x:82,y:52},name:'我的电脑 · 论坛',x:82,y:127,seat:{x:82,y:108},events:['open_forum_post','confirm_feedback_reviewed'],marker:true},
    {id:'cto-pc',role:'cto',markerPosition:{x:185,y:52},name:'排查电脑',x:185,y:127,seat:{x:185,y:108},events:['confirm_recheck_visited','confirm_impact_scope','review_test_plan','review_trap_comment'],marker:true},
    {id:'manual',role:'manual',name:'书架 · 工作手册',x:344,y:86,events:['write_manual_entry'],marker:true},
  ],
  entryPoints:{office:{x:172,y:154},report:{x:82,y:127},incident:{x:82,y:127},investigation:{x:185,y:127},restored:{x:185,y:127},learning:{x:185,y:127},complete:{x:344,y:86}},
  eventSpeakers:{cto_rallies_team:'cto',resume_narrative:'cto'},
};
export const expressionFor=(actor,snapshot)=>actor.expressionByState?.[snapshot.state]||'normal';
export function actionsFor(chapter,snapshot,object){return object.role?chapter.actions(snapshot,object.role).filter(t=>object.events?.includes(t.event)):[];}
export function pendingMarkers(config,chapter,snapshot){return [...config.objects,...config.actors.filter(a=>a.marker)].flatMap(object=>{
  const events=actionsFor(chapter,snapshot,object).map(t=>t.event);
  return object.marker&&events.length?[{id:object.id,x:object.markerPosition?.x??object.x,y:object.markerPosition?.y??object.y,offsetY:object.markerPosition?0:object.atlas?48:28,events,actor:!!object.atlas}]:[];
});}
export function sceneTarget(config,chapter,snapshot){
  if(snapshot.state==='incident')return '去 CTO 身边，和大家一起排查';
  if(snapshot.state==='investigation'&&chapter.has(snapshot,'feedback_reviewed')&&chapter.has(snapshot,'recheck_visited')&&chapter.has(snapshot,'impact_confirmed'))return '排查 3/3 · 回到 CTO 身边';
  return chapter.target(snapshot).replaceAll('右侧电脑','中间的排查电脑');
}
