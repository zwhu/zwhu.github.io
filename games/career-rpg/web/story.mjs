// Pure chapter rules and storage boundary; no DOM or rendering dependencies.
// Player-facing copy, object roles and entry placement live in chapter data or scene config.
export const SCHEMA=1;
const sameFlags=(a,b)=>a.length===b.length&&[...a].sort().every((x,i)=>x===[...b].sort()[i]);
const skillList=data=>data.skills||[];
function skillRecord(data,snapshot){
  const skills=skillList(data);
  if(!skills.length)return null;
  const stored=snapshot.skills&&typeof snapshot.skills==='object'?snapshot.skills:null;
  const record={};
  for(const skill of skills){
    const done=snapshot.flags.includes(skill.flag);
    let status=stored&&(stored[skill.id]==='none'||stored[skill.id]==='ready'||stored[skill.id]==='got')?stored[skill.id]:done?'ready':'none';
    if(!done)status='none';
    else if(status==='none')status='ready';
    if(snapshot.state===data.terminal)status='got';
    record[skill.id]=status;
  }
  return record;
}
function skillsMatch(data,snapshot){
  const record=skillRecord(data,snapshot);
  if(!record||snapshot.skills==null)return true;
  const keys=Object.keys(snapshot.skills);
  return keys.length===skillList(data).length&&skillList(data).every(skill=>keys.includes(skill.id)&&snapshot.skills[skill.id]===record[skill.id]);
}
export function createChapter(data){
  const key=data.savePolicy.key;
  const initial=()=>{const snapshot={schema:SCHEMA,chapter:data.id,state:data.entry,flags:[]};if(skillList(data).length)snapshot.skills=Object.fromEntries(skillList(data).map(skill=>[skill.id,'none']));return snapshot;};
  const valid=value=>!!value&&value.schema===SCHEMA&&value.chapter===data.id&&Array.isArray(value.flags)&&value.flags.every(x=>typeof x==='string')&&new Set(value.flags).size===value.flags.length&&Array.isArray(data.legalSnapshots[value.state])&&data.legalSnapshots[value.state].some(flags=>sameFlags(flags,value.flags))&&skillsMatch(data,value);
  const possible=(snapshot,t)=>t.from===snapshot.state&&t.requires.every(x=>snapshot.flags.includes(x))&&t.effects.some(x=>!snapshot.flags.includes(x));
  function advance(snapshot,event){
    if(!valid(snapshot))throw new Error('Invalid chapter snapshot');
    const transition=data.transitions.find(t=>t.event===event&&possible(snapshot,t));
    if(!transition)return {accepted:false,snapshot};
    const next={schema:SCHEMA,chapter:data.id,state:transition.to,flags:[...new Set([...snapshot.flags,...transition.effects])]};
    if(skillList(data).length){
      const carried={...(snapshot.skills||{})};
      const skill=skillList(data).find(item=>item.event===event);
      if(skill)carried[skill.id]='ready';
      if(transition.to===data.terminal)for(const item of skillList(data))carried[item.id]='got';
      next.skills=skillRecord(data,{...next,skills:carried});
    }
    if(!valid(next))throw new Error('Transition produced invalid snapshot');
    return {accepted:true,snapshot:next};
  }
  function collect(snapshot,id){
    if(!skillList(data).length)return {accepted:false,snapshot};
    if(!valid(snapshot))throw new Error('Invalid chapter snapshot');
    const record=skillRecord(data,snapshot);
    if(!record||record[id]!=='ready')return {accepted:false,snapshot};
    const next={...snapshot,skills:{...record,[id]:'got'}};
    if(!valid(next))throw new Error('Collect produced invalid snapshot');
    return {accepted:true,snapshot:next};
  }
  function skillSlots(snapshot){
    const record=skillRecord(data,snapshot);
    if(!record)return null;
    return skillList(data).map(skill=>({id:skill.id,name:skill.name,role:skill.role,status:record[skill.id]}));
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
  return {key,initial,valid,advance,collect,inspect,save,text,target,actions,has,manualId,skillSlots};
}
