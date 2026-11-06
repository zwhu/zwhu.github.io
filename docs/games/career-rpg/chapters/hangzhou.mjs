import {OFFICE} from './nanjing.mjs';
// 杭州运行图来自 hangzhou-v1。坐标按可走区域微调，不另做像素管线。
const HZ='./art/hangzhou',HP=`${HZ}/props`,LINES=['line_1','line_2','line_3','line_4','line_5'];
export const HANGZHOU={
  id:'hangzhou-office',width:384,height:216,chapter:'./design/chapter-hangzhou.json',
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
    {id:'player',name:'我',atlas:'player',height:44,controllable:true,typingColumn:0,sitAtlas:'sit',seatedHeight:30,expressionByState:{arrive:'tense',board:'happy',complete:'happy'}},
  ],
  objects:[
    {id:'check-in',role:'check_in',name:'前台',x:46,y:108,events:['check_in'],marker:true,dialogue:{default:'前台。先报到。'}},
    {id:'publish',role:'publish_desk',name:'商品发布',x:180,y:120,iconAt:{x:180,y:86},events:['review_publish'],marker:true,dialogue:{default:'商品发布这摊业务。'}},
    {id:'patterns-book',role:'patterns_book',name:'设计模式',x:46,y:168,iconAt:{x:63,y:157},iconSize:[14,17],icon:`${HP}/design-pattern-book/design-pattern-book-small-14x17.png`,card:`${HP}/design-pattern-book/design-pattern-book-card-192x238.png`,events:['study_patterns'],marker:true,dialogue:{default:'设计模式的书还摊着。'}},
    {id:'webpack-screen',role:'webpack_screen',name:'Webpack / Babel',x:78,y:190,seat:{x:82,y:172},iconAt:{x:85,y:141},iconSize:[26,13],icon:`${HP}/webpack-screen/webpack-screen-small-26x13.png`,card:`${HP}/webpack-screen/webpack-screen-card-192x120.png`,events:['study_webpack','study_babel'],marker:true,dialogue:{default:'这一屏写着 Webpack，也写着 Babel。'}},
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
