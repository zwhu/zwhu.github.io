// Pure chapter rules and storage boundary; no DOM or rendering dependencies.
// Player-facing copy, object roles and entry placement live in chapter data or scene config.
export const SCHEMA=1;
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
  const text=id=>{const line=data.dialogues.find(d=>d.id===id);return line?(line.playerText??line.text):'';};
  const manualId=data.manualDialogue||'learning-manual-1';
  const has=(snapshot,flag)=>snapshot.flags.includes(flag);
  function target(snapshot){
    const rule=data.objectives?.[snapshot.state];
    if(!rule)return '';
    if(typeof rule==='string')return rule;
    if(rule.until&&!has(snapshot,rule.until))return rule.before;
    if(!rule.count)return rule.pending||'';
    const n=rule.count.filter(f=>has(snapshot,f)).length;
    const template=n===rule.count.length&&rule.done?rule.done:rule.pending;
    let next=rule.elseStep||'';
    if(rule.steps){const step=rule.steps.find(s=>!has(snapshot,s.unless));if(step)next=step.text;}
    return template.replaceAll('{n}',String(n)).replaceAll('{next}',next);
  }
  function actions(snapshot,object){
    const available=data.transitions.filter(t=>possible(snapshot,t));
    const targets=data.roleTargets?.[object];
    return targets?available.filter(t=>targets.includes(t.target)):[];
  }
  return {key,initial,valid,advance,inspect,save,text,target,actions,has,manualId};
}
