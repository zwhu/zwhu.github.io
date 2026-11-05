// Scene-specific art, placement and roles live here; the renderer and bubble UI reuse this interface.
export const OFFICE={
  id:'nanjing-office',width:384,height:216,background:'./art/office-room-v2.png',chapter:'../design/chapter-01.json',
  bounds:{left:6,right:378,top:72,bottom:211},
  obstacles:[{x:0,y:0,w:384,h:69},{x:41,y:69,w:77,h:47},{x:148,y:69,w:77,h:47},{x:257,y:69,w:78,h:47},{x:341,y:0,w:39,h:73},{x:353,y:111,w:27,h:42},{x:41,y:156,w:80,h:47},{x:257,y:156,w:80,h:47},{x:0,y:161,w:38,h:43},{x:7,y:55,w:24,h:46}],
  navigation:{transitY:137},
  atlases:{player:{url:'./art/player-walk-v1.png',columns:3,rows:4,referenceGrouping:'row',directions:['down','up','left','right']},team:{url:'./art/npc-team-v1.png',columns:3,rows:1,directions:['down']},emotions:{url:'./art/player-emotions-v1.png',columns:3,rows:1,directions:['down']},typing:{url:'./art/typing-team-v1.png',columns:4,rows:2,referenceGrouping:'column',directions:['down','up']}},
  expressions:{normal:0,tense:1,happy:2},
  actors:[
    {id:'player',name:'我',atlas:'player',height:44,controllable:true,typingColumn:0,expressionByState:{report:'tense',incident:'tense',investigation:'tense',restored:'happy',complete:'happy'}},
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
const H='./art/hefei';
// v3 room: one long table, six facing seats. Coordinates started from art/processed/hefei-v3/walkable-seats/walkable-seats.json. T1–T3 stay empty because there is no front-facing seated frame.
export const HEFEI={
  id:'hefei-office',width:384,height:216,chapter:'../design/chapter-hefei.json',
  background:`${H}/hefei-office-day/day-384x216.png`,
  backgrounds:{day:`${H}/hefei-office-day/day-384x216.png`,night:`${H}/hefei-office-night/night-384x216.png`,lightMask:`${H}/hefei-office-night/light-mask-384x216.png`},
  marker:{url:`${H}/hefei-marker/marker-7x16.png`,w:7,h:16},
  bounds:{left:4,right:380,top:78,bottom:200},
  obstacles:[
    {x:6,y:0,w:36,h:82},{x:192,y:0,w:26,h:87},{x:217,y:0,w:41,h:84},{x:263,y:0,w:23,h:83},
    {x:38,y:106,w:216,h:68},
    {x:64,y:94,w:22,h:12},{x:136,y:94,w:22,h:12},{x:204,y:94,w:22,h:12},
    {x:63,y:157,w:23,h:27},{x:135,y:157,w:23,h:27},{x:204,y:157,w:23,h:27},
    {x:309,y:82,w:64,h:39},{x:287,y:131,w:78,h:44},{x:300,y:168,w:21,h:25},{x:330,y:168,w:21,h:25},
  ],
  navigation:{transitY:192},
  atlases:{
    ...OFFICE.atlases,
    boss:{url:`${H}/hefei-founder-walk/walk-sheet-32x48.png`,columns:3,rows:4,referenceGrouping:'row',directions:['down','up','left','right']},
    bossEmotions:{url:`${H}/hefei-founder-emotions/emotions-strip-64x32.png`,columns:2,rows:1,directions:['down']},
  },
  expressions:OFFICE.expressions,
  actors:[
    {id:'player',name:'我',atlas:'player',height:44,controllable:true,typingColumn:0,expressionByState:{interview:'tense',raise:'happy',complete:'happy'}},
    {id:'boss',name:'老板',role:'boss',atlas:'boss',height:44,x:326,y:128,interaction:{x:310,y:128},events:['ask_for_chance','boss_lets_try','raise_read'],presentIn:['interview','day_tasks','raise','complete'],emotionAtlas:'bossEmotions',expressions:{doubtful:0,approving:1,normal:0},expressionByState:{interview:'doubtful',raise:'approving',complete:'approving'},dialogue:{default:'老板在茶桌旁。'},readPages:[{flag:'asked',title:'我',lines:['interview-player'],label:'我说过的话 · 回看',speaker:'player'},{flag:'hired_trial',title:'老板',lines:['interview-boss-2'],label:'老板当时的回复 · 回看',speaker:'boss'},{flag:'raise_seen',title:'老板',lines:['raise-boss'],label:'老板那句话 · 回看',speaker:'boss'}]},
    {id:'colleague-b2',name:'同事',atlas:'team',column:1,typingColumn:2,height:42,x:147,y:176,seat:{x:147,y:176},interaction:{x:147,y:192},posture:'seatedTyping',presentIn:['interview','day_tasks','raise','complete'],dialogue:{default:'同事坐在长桌对面写东西。'}},
    {id:'colleague-b3',name:'同事',atlas:'team',column:2,typingColumn:3,height:42,x:215,y:176,seat:{x:215,y:176},interaction:{x:215,y:192},posture:'seatedTyping',presentIn:['interview','day_tasks','raise','complete'],dialogue:{default:'同事坐在长桌对面写东西。'}},
  ],
  objects:[
    {id:'my-pc',role:'my_pc',markerPosition:{x:75,y:124},markerSprite:true,name:'我的电脑',x:75,y:192,seat:{x:75,y:176},events:['take_day_task'],marker:true,presentIn:['day_tasks'],dialogue:{default:'黄色感叹号标在这台电脑上。'},readPages:[{flag:'day_task_taken',title:'我的电脑',lines:['day-task'],label:'接过的任务 · 回看',speaker:'player'}]},
    {id:'linux-screen',role:'linux_screen',name:'Linux 终端和 Git',x:147,y:192,seat:{x:147,y:176},iconAt:{x:148,y:140},iconSize:[28,25],icon:`${H}/hefei-props/linux-git-screen/icon.png`,iconHighlight:`${H}/hefei-props/linux-git-screen/icon-highlight.png`,card:`${H}/hefei-props/linux-git-screen/card-192.png`,events:['review_linux_git'],presentIn:['day_tasks'],dialogue:{default:'开发机还开着。'},readPages:[{flag:'linux_git_reviewed',title:'Linux 终端和 Git',lines:['day-linux'],label:'看过的这一屏 · 回看',speaker:'player'}]},
    {id:'jquery-book',role:'jquery_book',name:'前端和《锋利的 jQuery》',x:111,y:180,seat:{x:111,y:176},iconAt:{x:111,y:132},iconSize:[34,29],icon:`${H}/hefei-props/frontend-jquery/icon.png`,iconHighlight:`${H}/hefei-props/frontend-jquery/icon-highlight.png`,card:`${H}/hefei-props/frontend-jquery/card-192.png`,events:['review_frontend'],presentIn:['day_tasks'],dialogue:{default:'前端那一页还摊着。'},readPages:[{flag:'frontend_reviewed',title:'前端和《锋利的 jQuery》',lines:['day-jquery'],label:'看过的这一页 · 回看',speaker:'player'}]},
    {id:'java-book',role:'java_book',name:'Java',x:240,y:180,seat:{x:215,y:176},iconAt:{x:240,y:138},iconSize:[17,18],icon:`${H}/hefei-props/java-book/icon.png`,iconHighlight:`${H}/hefei-props/java-book/icon-highlight.png`,card:`${H}/hefei-props/java-book/card-192.png`,events:['study_java'],presentIn:['night_study'],nightDim:true,dialogue:{default:'Java 还在手边。'},readPages:[{flag:'java_studied',title:'Java',lines:['night-java'],label:'看过的这本书 · 回看',speaker:'player'}]},
    {id:'db-screen',role:'db_screen',name:'数据库和 NoSQL',x:215,y:192,seat:{x:215,y:176},iconAt:{x:217,y:139},iconSize:[32,24],icon:`${H}/hefei-props/db-nosql-screen/icon.png`,iconHighlight:`${H}/hefei-props/db-nosql-screen/icon-highlight.png`,card:`${H}/hefei-props/db-nosql-screen/card-192.png`,events:['study_db_nosql'],presentIn:['night_study'],nightDim:true,dialogue:{default:'数据库那一屏还开着。'},readPages:[{flag:'db_nosql_studied',title:'数据库和 NoSQL',lines:['night-db'],label:'看过的这一屏 · 回看',speaker:'player'}]},
    {id:'manual',role:'manual',name:'书架 · 工作手册',x:24,y:90,events:[],marker:false},
  ],
  entryPoints:{interview:{x:190,y:196},day_tasks:{x:120,y:192},night_study:{x:75,y:192},raise:{x:190,y:196},complete:{x:24,y:90}},
  eventSpeakers:{ask_for_chance:'boss',boss_lets_try:'boss',raise_read:'boss',night_falls:'player',days_pass:'player'},
  actionTitles:{ask_for_chance:'听老板说',boss_lets_try:'继续听',take_day_task:'接任务',review_linux_git:'记下来',review_frontend:'记下来',study_java:'记下来',study_db_nosql:'记下来',raise_read:'听老板说',night_falls:'天黑了',days_pass:'日夜交替'},
  follow:{ask_for_chance:{title:'我',lines:['interview-player'],speaker:'player'}},
  chainDialog:true,
  transitionLines:{night_falls:'night-falls',days_pass:'days-pass'},
  transitionBeats:{
    night_falls:[{map:'day',dim:0},{map:'day',dim:.35},{map:'day',dim:.7},{map:'night',dim:0}],
    days_pass:[{map:'day',dim:0},{map:'night',dim:0},{map:'day',dim:0},{map:'night',dim:0},{map:'day',dim:0}],
  },
  beatMs:600,
  page:{documentTitle:'像素前端',heading:'合肥，争取一次机会',lead:'合肥办公室。从门口走到老板桌前。同事沿用南京人物。',summary:'原本录用的人嫌工资低，没来。老板说：「你能力不行，来了也干不了活。」我说：「我不要工资，让我来试试就行。」老板说：「行，那你想试试我也不拦你，反正不要工资，到时候你自己也会受不了就走。」入职两个月，加了两次薪。老板说：「努力工作的人一定会被看到的。」',shell:'合肥办公室游戏'},
};
// 杭州运行图来自 hangzhou-v1。坐标按可走区域微调，不另做像素管线。
const HZ='./art/hangzhou',HP=`${HZ}/props`,LINES=['line_1','line_2','line_3','line_4','line_5'];
export const HANGZHOU={
  id:'hangzhou-office',width:384,height:216,chapter:'../design/chapter-hangzhou.json',
  background:`${HZ}/hangzhou-office-day/day-384x216.png`,
  bounds:{left:30,right:380,top:66,bottom:200},
  obstacles:[
    {x:0,y:0,w:30,h:122},{x:30,y:30,w:18,h:40},{x:56,y:60,w:244,h:44},{x:52,y:126,w:246,h:40},
    {x:76,y:100,w:20,h:12},{x:134,y:100,w:20,h:12},{x:194,y:100,w:20,h:12},{x:254,y:100,w:20,h:12},
    {x:72,y:164,w:20,h:12},{x:132,y:164,w:20,h:12},{x:192,y:164,w:20,h:12},{x:252,y:164,w:20,h:12},
    {x:320,y:30,w:20,h:38},{x:348,y:14,w:34,h:62},{x:318,y:106,w:56,h:44},{x:318,y:150,w:56,h:40},{x:0,y:156,w:32,h:46},
  ],
  navigation:{transitY:140},
  atlases:{...OFFICE.atlases},
  expressions:OFFICE.expressions,
  actors:[
    {id:'player',name:'我',atlas:'player',height:44,controllable:true,typingColumn:0,expressionByState:{arrive:'tense',board:'happy',complete:'happy'}},
  ],
  objects:[
    {id:'check-in',role:'check_in',name:'前台',x:46,y:108,events:['check_in'],marker:true,dialogue:{default:'前台。先报到。'}},
    {id:'publish',role:'publish_desk',name:'商品发布',x:180,y:120,iconAt:{x:180,y:86},events:['review_publish'],marker:true,dialogue:{default:'商品发布这摊业务。'}},
    {id:'patterns-book',role:'patterns_book',name:'设计模式',x:46,y:168,iconAt:{x:63,y:157},iconSize:[14,17],icon:`${HP}/design-pattern-book/design-pattern-book-small-14x17.png`,card:`${HP}/design-pattern-book/design-pattern-book-card-192x238.png`,events:['study_patterns'],marker:true,dialogue:{default:'设计模式的书还摊着。'}},
    {id:'webpack-screen',role:'webpack_screen',name:'Webpack / Babel',x:78,y:190,iconAt:{x:85,y:141},iconSize:[26,13],icon:`${HP}/webpack-screen/webpack-screen-small-26x13.png`,card:`${HP}/webpack-screen/webpack-screen-card-192x120.png`,events:['study_webpack','study_babel'],marker:true,dialogue:{default:'这一屏写着 Webpack，也写着 Babel。'}},
    {id:'line-1',role:'line_1',name:'淘宝',x:123,y:112,iconAt:{x:123,y:84},iconSize:[10,15],icon:`${HP}/req-taobao/req-taobao-small-10x15.png`,card:`${HP}/req-taobao/req-taobao-card-192x279.png`,events:['read_line_1'],marker:true,dialogue:{default:'淘宝的需求单。'}},
    {id:'line-2',role:'line_2',name:'天猫',x:276,y:118,iconAt:{x:291,y:80},iconSize:[10,15],icon:`${HP}/req-tmall/req-tmall-small-10x15.png`,card:`${HP}/req-tmall/req-tmall-card-192x279.png`,events:['read_line_2'],marker:true,dialogue:{default:'天猫的需求单。'}},
    {id:'line-3',role:'line_3',name:'闲鱼',x:112,y:178,iconAt:{x:103,y:141},iconSize:[10,15],icon:`${HP}/req-xianyu/req-xianyu-small-10x15.png`,card:`${HP}/req-xianyu/req-xianyu-card-192x279.png`,events:['read_line_3'],marker:true,dialogue:{default:'闲鱼的需求单。'}},
    {id:'line-4',role:'line_4',name:'飞猪',x:160,y:178,iconAt:{x:179,y:147},iconSize:[10,14],icon:`${HP}/req-fliggy/req-fliggy-small-10x14.png`,card:`${HP}/req-fliggy/req-fliggy-card-192x277.png`,events:['read_line_4'],marker:true,dialogue:{default:'飞猪的需求单。'}},
    {id:'line-5',role:'line_5',name:'盒马',x:230,y:178,iconAt:{x:223,y:140},iconSize:[10,14],icon:`${HP}/req-hema/req-hema-small-10x14.png`,card:`${HP}/req-hema/req-hema-card-192x276.png`,events:['read_line_5'],marker:true,dialogue:{default:'盒马的需求单。'}},
    {id:'whiteboard',role:'whiteboard',name:'白板',x:304,y:148,iconAt:{x:346,y:129},iconSize:[53,42],icon:`${HP}/whiteboard/whiteboard-unlit-small-53x42.png`,iconLit:`${HP}/whiteboard/whiteboard-lit-small-53x42.png`,card:`${HP}/whiteboard/whiteboard-unlit-card-192x128.png`,cardLit:`${HP}/whiteboard/whiteboard-lit-card-192x128.png`,litWhen:LINES,events:['light_board'],marker:true,dialogue:{default:'白板。五条线还没对齐。'}},
    {id:'exit',role:'exit',name:'门口',x:192,y:196,events:['finish_chapter'],marker:true,dialogue:{default:'门口。这一章还没写完。'}},
  ],
  entryPoints:{arrive:{x:192,y:196},night:{x:46,y:168},plugins:{x:78,y:190},sheets:{x:123,y:112},board:{x:304,y:148},complete:{x:192,y:196}},
  chainDialog:true,
  actionTitles:{check_in:'报到',review_publish:'看这摊业务',to_night:'夜深了',study_patterns:'翻开设计模式',to_plugins:'去看插件',study_webpack:'看 Webpack',study_babel:'看 Babel',to_sheets:'去看需求单',read_line_1:'看第一条',read_line_2:'看第二条',read_line_3:'看第三条',read_line_4:'看第四条',read_line_5:'看第五条',light_board:'回到白板',finish_chapter:'这一章先到这里'},
  page:{documentTitle:'像素前端',heading:'杭州，商品发布',lead:'杭州。先报到，再把商品发布这摊业务读懂。',summary:'到杭州负责商品发布。深夜读设计模式，再在同一屏里拆 Webpack 和 Babel 的插件。五条业务线的需求对齐之后，白板亮起来。',shell:'杭州办公室游戏'},
};
export function transitionBeat(count,elapsed,beatMs){if(elapsed<0)return 0;return Math.min(count-1,Math.floor(elapsed/beatMs));}
export function transitionFinished(count,elapsed,beatMs){return elapsed>=count*beatMs;}
export function presentCast(config,snapshot){
  if(!config.actors.some(a=>a.presentIn)&&!config.objects.some(o=>o.presentIn))return config;
  const allow=item=>!item.presentIn||item.presentIn.includes(snapshot.state);
  return {actors:config.actors.filter(allow),objects:config.objects.filter(allow)};
}
export const expressionFor=(actor,snapshot)=>actor.expressionByState?.[snapshot.state]||'normal';
export function actionsFor(chapter,snapshot,object){return object.role?chapter.actions(snapshot,object.role).filter(t=>object.events?.includes(t.event)):[];}
export function pendingMarkers(config,chapter,snapshot){return [...config.objects,...config.actors.filter(a=>a.marker)].flatMap(object=>{
  const events=actionsFor(chapter,snapshot,object).map(t=>t.event);
  return object.marker&&events.length?[{id:object.id,x:object.markerPosition?.x??object.x,y:object.markerPosition?.y??object.y,offsetY:object.markerPosition?0:object.atlas?48:28,events,actor:!!object.atlas,sprite:object.markerSprite?config.marker:null}]:[];
});}
export function sceneTarget(config,chapter,snapshot){
  if(snapshot.state==='incident')return '去 CTO 身边，看这轮排查';
  if(snapshot.state==='investigation'&&chapter.has(snapshot,'feedback_reviewed')&&chapter.has(snapshot,'recheck_visited')&&chapter.has(snapshot,'impact_confirmed'))return '排查 3/3 · 回到 CTO 身边';
  return chapter.target(snapshot).replaceAll('右侧电脑','中间的排查电脑');
}
