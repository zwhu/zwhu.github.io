// Scene-specific art, placement and roles live here; the renderer and bubble UI reuse this interface.
// 主角行走图集 7 列：idle 只在站立。走路是 walk-01…06，10Hz，循环里不插入 idle。步速仍是 60px/s。
export const OFFICE={
  id:'nanjing-office',width:384,height:216,background:'./art/office-room-v2.png',chapter:'./design/chapter-01.json',
  bounds:{left:6,right:378,top:72,bottom:211},
  obstacles:[{x:0,y:0,w:384,h:69},{x:41,y:69,w:77,h:47},{x:148,y:69,w:77,h:47},{x:257,y:69,w:78,h:47},{x:341,y:0,w:39,h:73},{x:353,y:111,w:27,h:42},{x:41,y:156,w:80,h:47},{x:257,y:156,w:80,h:47},{x:0,y:161,w:38,h:43},{x:7,y:55,w:24,h:46}],
  navigation:{transitY:137},
  atlases:{player:{url:'./art/player-walk-v2-sheet.png',columns:7,rows:4,referenceGrouping:'row',directions:['down','up','left','right'],walkSequence:[1,2,3,4,5,6],poseHz:10},team:{url:'./art/npc-team-v1.png',columns:3,rows:1,directions:['down']},emotions:{url:'./art/player-emotions-v1.png',columns:3,rows:1,directions:['down']},typing:{url:'./art/typing-team-v1.png',columns:4,rows:2,referenceGrouping:'column',directions:['down','up']},sit:{url:'./art/sit-back-hz-18x30.png',columns:1,rows:1,directions:['up']}},
  expressions:{normal:0,tense:1,happy:2},
  actors:[
    {id:'player',name:'我',atlas:'player',height:44,controllable:true,typingColumn:0,sitAtlas:'sit',seatedHeight:30,expressionByState:{report:'tense',incident:'tense',investigation:'tense',restored:'happy',complete:'happy'}},
    {id:'cto',name:'CTO',role:'cto',atlas:'team',column:0,typingColumn:1,height:44,x:185,y:108,seat:{x:185,y:108},interaction:{x:185,y:127},posture:'seatedTyping',events:['cto_rallies_team','resume_narrative'],marker:true,dialogue:{default:'CTO 在工位旁。这次上线，用户已经在用。',restored:'问题恢复后，CTO、老板和同事过来安抚。',learning:'测试和注释里记下了这次失败。'}},
    {id:'colleague-dev',name:'费翔🐘',atlas:'team',column:1,typingColumn:2,height:42,x:296,y:108,seat:{x:296,y:108},interaction:{x:296,y:127},posture:'seatedTyping',dialogue:{default:'同伴也在办公室。出了问题，先看用户反馈。',restored:'同事们告诉我，没关系，大家都经历过。',complete:'这次经历留在了手册里，测试和注释也留给后来改代码的人。'}},
    {id:'colleague-team',name:'同伴 · 协作',atlas:'team',column:2,typingColumn:3,height:42,x:82,y:197,seat:{x:82,y:197},interaction:{x:125,y:190},posture:'seatedTyping',dialogue:{default:'工位上的日常是 fibjs 和 nodejs，全栈都在这台机器上。',restored:'同事过来安抚。这次失败，要补进测试和注释。',complete:'往后还有新的学习，也会遇到新的问题。'}},
  ],
  objects:[
    {id:'forum',role:'forum',markerPosition:{x:82,y:52},name:'我的电脑 · 论坛',x:82,y:127,seat:{x:82,y:108},iconAt:{x:82,y:70},events:['open_forum_post','confirm_feedback_reviewed'],marker:true},
    {id:'cto-pc',role:'cto',markerPosition:{x:185,y:52},name:'排查电脑',x:185,y:127,seat:{x:185,y:108},events:['confirm_recheck_visited','confirm_impact_scope','review_test_plan','review_trap_comment'],marker:true},
    {id:'manual',role:'manual',name:'书架 · 工作手册',x:344,y:86,iconAt:{x:344,y:58},events:['write_manual_entry'],marker:true},
    {id:'ci-notes',role:'ci_desk',name:'补测与 CI',x:230,y:148,iconAt:{x:230,y:120},events:[],dialogue:{default:'集成测试还写在排查电脑的补测清单上。'}},
    {id:'recovery-note',role:'recovery',name:'事故与恢复',x:120,y:148,iconAt:{x:120,y:120},events:[],dialogue:{default:'登录还没恢复。灰度、观测、回滚，等这次过去再记。'}},
    {id:'journey-map',role:'journey_map',name:'旅程地图',x:320,y:150,iconAt:{x:320,y:122},markerPosition:{x:320,y:122},events:['open_journey'],marker:true,dialogue:{default:'从合肥到南京的这段路，等手册写完再打开。'}},
  ],
  entryPoints:{office:{x:172,y:154},report:{x:82,y:127},incident:{x:82,y:127},investigation:{x:185,y:127},restored:{x:185,y:127},learning:{x:185,y:127},journey:{x:344,y:86},complete:{x:344,y:86}},
  eventSpeakers:{cto_rallies_team:'cto',resume_narrative:'cto'},
};
