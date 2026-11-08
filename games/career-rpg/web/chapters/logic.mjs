// Chapter-agnostic scene queries. Chapter files do not import this.
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
  if(config.id==='nanjing-office')return chapter.target(snapshot);
  if(snapshot.state==='incident')return '去 CTO 身边，看这轮排查';
  if(snapshot.state==='investigation'&&chapter.has(snapshot,'feedback_reviewed')&&chapter.has(snapshot,'recheck_visited')&&chapter.has(snapshot,'impact_confirmed'))return '排查 3/3 · 回到 CTO 身边';
  return chapter.target(snapshot).replaceAll('右侧电脑','中间的排查电脑');
}
