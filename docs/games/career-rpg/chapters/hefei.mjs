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
  foregrounds:[
    {depth:178,rect:{x:63,y:157,w:23,h:24}},
    {depth:178,rect:{x:135,y:157,w:23,h:24}},
    {depth:178,rect:{x:204,y:157,w:23,h:24}},
  ],
  atlases:{
    ...OFFICE.atlases,
    boss:{url:`${H}/hefei-founder-walk/walk-sheet-32x48.png`,columns:3,rows:4,referenceGrouping:'row',directions:['down','up','left','right']},
    bossEmotions:{url:`${H}/hefei-founder-emotions/emotions-strip-64x32.png`,columns:2,rows:1,directions:['down']},
  },
  expressions:OFFICE.expressions,
  actors:[
    {id:'player',name:'我',atlas:'player',height:44,controllable:true,typingColumn:0,sitAtlas:'sit',seatedHeight:30,expressionByState:{interview:'tense',raise:'happy',complete:'happy'}},
    {id:'boss',name:'老板',role:'boss',atlas:'boss',height:44,x:326,y:128,interaction:{x:310,y:128},events:['ask_for_chance','boss_lets_try','raise_read'],presentIn:['interview','day_tasks','raise','complete'],emotionAtlas:'bossEmotions',expressions:{doubtful:0,approving:1,normal:0},expressionByState:{interview:'doubtful',raise:'approving',complete:'approving'}},
    {id:'colleague-b2',name:'同事',atlas:'team',column:1,typingColumn:2,height:42,x:147,y:176,seat:{x:147,y:176},interaction:{x:147,y:192},posture:'seatedTyping',presentIn:['interview','day_tasks','raise','complete'],lines:{interview:'colleague-near-interview',day:'colleague-near-day'},lineIds:true},
    {id:'colleague-b3',name:'同事',atlas:'team',column:2,typingColumn:3,height:42,x:215,y:176,seat:{x:215,y:176},interaction:{x:215,y:192},posture:'seatedTyping',presentIn:['interview','day_tasks','raise','complete'],lines:{interview:'colleague-far-interview',day:'colleague-far-day'},lineIds:true},
  ],
  // Back-view player art ends at the hips, ten pixels above the NPC foot anchor.
  objects:[
    {id:'my-pc',role:'my_pc',markerPosition:{x:75,y:124},markerSprite:true,name:'我的电脑',x:75,y:192,seat:{x:75,y:166},events:['take_day_task'],marker:true,presentIn:['day_tasks']},
    {id:'linux-screen',glintAt:{x:75,y:124},role:'linux_screen',name:'Linux / Git',x:75,y:192,seat:{x:75,y:166},iconAt:{x:75,y:130},iconSize:[28,25],icon:`${H}/hefei-props/linux-git-screen/icon.png`,iconHighlight:`${H}/hefei-props/linux-git-screen/icon-highlight.png`,card:`${H}/hefei-props/linux-git-screen/card-192.png`,events:['review_linux_git'],presentIn:['day_tasks'],iconAfterFlag:'day_task_taken'},
    {id:'jquery-book',glintAt:{x:24,y:48},role:'jquery_book',name:'《锋利的 jQuery》',x:24,y:90,iconAt:{x:20,y:46},iconSize:[34,29],icon:`${H}/hefei-props/frontend-jquery/icon.png`,iconHighlight:`${H}/hefei-props/frontend-jquery/icon-highlight.png`,card:`${H}/hefei-props/frontend-jquery/card-192.png`,events:['review_frontend'],presentIn:['interview','day_tasks'],iconHiddenIn:['interview'],glowUntilFlag:'frontend_reviewed',cardIn:['day_tasks'],lines:{interview:'shelf-interview',day:'jquery-found'},lineIds:true,preface:{day_tasks:'jquery-found'},prefaceAction:'拿下来'},
    {id:'java-book',glintAt:{x:75,y:124},role:'java_book',name:'Java',x:75,y:192,seat:{x:75,y:166},iconAt:{x:62,y:128},iconSize:[17,18],icon:`${H}/hefei-props/java-book/icon.png`,iconHighlight:`${H}/hefei-props/java-book/icon-highlight.png`,card:`${H}/hefei-props/java-book/card-192.png`,events:['study_java'],presentIn:['night_study'],nightDim:true},
    {id:'db-screen',glintAt:{x:75,y:124},role:'db_screen',name:'数据库和 NoSQL',x:84,y:192,seat:{x:75,y:166},iconAt:{x:90,y:130},iconSize:[32,24],icon:`${H}/hefei-props/db-nosql-screen/icon.png`,iconHighlight:`${H}/hefei-props/db-nosql-screen/icon-highlight.png`,card:`${H}/hefei-props/db-nosql-screen/card-192.png`,events:['study_db_nosql'],presentIn:['night_study'],nightDim:true},
    {id:'manual',role:'manual',name:'书架 · 工作手册',x:24,y:90,events:[],marker:false},
  ],
  entryPoints:{interview:{x:190,y:196},day_tasks:{x:120,y:192},night_study:{x:75,y:192},raise:{x:190,y:196},complete:{x:24,y:90}},
  eventSpeakers:{ask_for_chance:'boss',boss_lets_try:'boss',raise_read:'boss',take_day_task:'player',review_linux_git:'player',review_frontend:'player',study_java:'player',study_db_nosql:'player'},
  actionTitles:{ask_for_chance:'听老板说',boss_lets_try:'继续听',take_day_task:'接任务',review_linux_git:'记下来',review_frontend:'记下来',study_java:'记下来',study_db_nosql:'记下来',raise_read:'听老板说',night_falls:'天黑了',days_pass:'日夜交替'},
  follow:{ask_for_chance:{continueEvent:'boss_lets_try',continueRole:'boss'}},
  chainDialog:true,
  directTalk:true,
  instantSkills:['review_linux_git'],
  learningGlints:true,
  transitionLines:{boss_lets_try:'stayed',night_falls:'night-falls',days_pass:'days-pass'},
  transitionBeats:{
    boss_lets_try:[{map:'day',dim:0},{map:'day',dim:0},{map:'day',dim:0},{map:'day',dim:0},{map:'day',dim:0}],
    night_falls:[{map:'day',dim:0},{map:'day',dim:.35},{map:'day',dim:.7},{map:'night',dim:0},{map:'night',dim:0},{map:'night',dim:0}],
    days_pass:[{map:'day',dim:0},{map:'night',dim:0},{map:'day',dim:0},{map:'night',dim:0},{map:'day',dim:0},{map:'night',dim:0},{map:'day',dim:0}],
  },
  beatMs:600,
  page:{documentTitle:'像素前端',heading:'合肥，争取一次机会',lead:'合肥办公室。从门口走到老板桌前。同事沿用南京人物。',summary:'原本录用的人嫌工资低，没来。老板说：「你能力不行，来了也干不了活。」我说：「我不要工资，让我来试试就行。」老板说：「行，那你想试试我也不拦你，反正不要工资，到时候你自己也会受不了就走。」入职两个月，加了两次薪。老板说：「努力工作的人一定会被看到的。」',shell:'合肥办公室游戏'},
};
