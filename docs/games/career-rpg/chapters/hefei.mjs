import {OFFICE} from './nanjing.mjs';
const H='./art/hefei';
// v3 room: one long table, six facing seats. Coordinates started from art/processed/hefei-v3/walkable-seats/walkable-seats.json. T1–T3 stay empty because there is no front-facing seated frame.
export const HEFEI={
  id:'hefei-office',width:384,height:216,chapter:'./design/chapter-hefei.json',
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
    {id:'player',name:'我',atlas:'player',height:44,controllable:true,typingColumn:0,sitAtlas:'sit',seatedHeight:30,expressionByState:{interview:'tense',raise:'happy',complete:'happy'}},
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
