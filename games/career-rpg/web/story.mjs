// Pure chapter rules and storage boundary; no DOM or rendering dependencies.
export const SCHEMA=1;
export const ENTRY_POINTS=Object.freeze({office:{x:172,y:154},report:{x:80,y:124},incident:{x:80,y:124},investigation:{x:255,y:124},restored:{x:255,y:124},learning:{x:255,y:124},complete:{x:330,y:88}});
const sameFlags=(a,b)=>a.length===b.length&&[...a].sort().every((x,i)=>x===[...b].sort()[i]);
export function createChapter(data){
  const key=data.savePolicy.key;
  const initial=()=>({schema:SCHEMA,chapter:data.id,state:data.entry,flags:[]});
  const valid=value=>!!value&&value.schema===SCHEMA&&value.chapter===data.id&&Array.isArray(value.flags)&&value.flags.every(x=>typeof x==='string')&&new Set(value.flags).size===value.flags.length&&Array.isArray(data.legalSnapshots[value.state])&&data.legalSnapshots[value.state].some(flags=>sameFlags(flags,value.flags));
  const possible=(snapshot,t)=>t.from===snapshot.state&&t.requires.every(x=>snapshot.flags.includes(x))&&t.effects.some(x=>!snapshot.flags.includes(x));
  function advance(snapshot,event){
    if(!valid(snapshot))throw new Error('Invalid chapter snapshot');
    const transition=data.transitions.find(t=>t.event===event&&possible(snapshot,t));
    if(!transition)return {accepted:false,snapshot};
    const next={schema:SCHEMA,chapter:data.id,state:transition.to,flags:[...new Set([...snapshot.flags,...transition.effects])]};
    if(!valid(next))throw new Error('Transition produced invalid snapshot');
    return {accepted:true,snapshot:next};
  }
  function inspect(storage){
    let raw;
    try{raw=storage.getItem(key);}catch{return {kind:'unavailable',snapshot:initial()};}
    if(raw===null)return {kind:'fresh',snapshot:initial()};
    let value;try{value=JSON.parse(raw);}catch{return {kind:'invalid',raw};}
    return valid(value)?{kind:'valid',snapshot:value}:{kind:'invalid',raw};
  }
  function save(storage,snapshot){
    if(!valid(snapshot))throw new Error('Refusing invalid snapshot');
    try{storage.setItem(key,JSON.stringify(snapshot));return true;}catch{return false;}
  }
  // Design copy also contains a stage direction; keep that out of player-facing prose.
  const text=id=>id==='restored-n1'?'整整两小时后，问题恢复了。':data.dialogues.find(d=>d.id===id)?.text||'';
  const has=(snapshot,flag)=>snapshot.flags.includes(flag);
  function target(snapshot){
    const {state}=snapshot;
    if(state==='office')return '去左侧电脑，打开用户论坛';
    if(state==='report')return '读完用户反馈，继续';
    if(state==='incident')return '去右侧电脑，和 CTO 一起排查';
    if(state==='investigation'){
      const count=['feedback_reviewed','recheck_visited','impact_confirmed'].filter(f=>has(snapshot,f)).length;
      const next=!has(snapshot,'recheck_visited')?'右侧电脑：查看排查记录':!has(snapshot,'impact_confirmed')?'右侧电脑：确认影响到谁':!has(snapshot,'feedback_reviewed')?'左侧电脑：重读论坛反馈':'右侧电脑：结束这轮排查';
      return `排查 ${count}/3 · ${next}`;
    }
    if(state==='restored')return '两小时后，读完同事们的宽慰';
    if(state==='learning')return `看过 ${['test_reviewed','comment_reviewed'].filter(f=>has(snapshot,f)).length}/2 · ${has(snapshot,'test_reviewed')&&has(snapshot,'comment_reviewed')?'去右侧书架，把这一页写进手册':'右侧电脑：分别查看测试和坑点注释'}`;
    return '南京这一章完成 · 手册可以随时回看';
  }
  function actions(snapshot,object){
    const available=data.transitions.filter(t=>possible(snapshot,t));
    if(object==='forum')return available.filter(t=>t.target==='forum_pc');
    if(object==='cto')return available.filter(t=>['cto_pc','test_notes','trap_note'].includes(t.target));
    if(object==='manual')return available.filter(t=>t.target==='manual_shelf');
    if(object==='dialog')return available.filter(t=>t.target==='dialog');
    return [];
  }
  return {key,initial,valid,advance,inspect,save,text,target,actions,has};
}
