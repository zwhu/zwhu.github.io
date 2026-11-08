// Serializable UI checkpoint; callbacks and DOM nodes stay in the runtime.
export function encodePage(page,depth=0){
  if(!page||depth>5)return null;
  const choices=page.choices.map(({label,event,id,disabled})=>({label,event:event||'',id:id||'',disabled:!!disabled}));
  if(choices.some(choice=>!choice.event&&!choice.id))return null;
  return {title:page.title,paragraphs:page.paragraphs,paragraphIds:page.paragraphIds||[],choices,
    canDismiss:page.canDismiss,speaker:page.speaker,system:page.system,plate:page.plate||'',
    objectId:page.object?.id||page.objectId||'',selectedIndex:Math.max(0,page.selectedIndex||0),
    spoken:!!page.spoken,manual:!!page.slots||!!page.manual,parent:encodePage(page.parent,depth+1)};
}
function validPage(page,depth=0){
  if(depth>5||!page||typeof page.title!=='string'||page.title.length>200)return false;
  if(!Array.isArray(page.paragraphs)||page.paragraphs.length>40||page.paragraphs.some(text=>typeof text!=='string'||text.length>20000))return false;
  if(!Array.isArray(page.choices)||page.choices.length>30||page.choices.some(choice=>!choice||typeof choice.label!=='string'||typeof choice.event!=='string'||typeof choice.id!=='string'||(!choice.event&&!choice.id)))return false;
  if(!Number.isInteger(page.selectedIndex)||page.selectedIndex<0||page.selectedIndex>page.choices.length||typeof page.speaker!=='string')return false;
  return !page.parent||validPage(page.parent,depth+1);
}
export function inspectPlay(play,bounds){
  if(!play||play.version!==1||!['explore','dialogue','transition','journey'].includes(play.state))return null;
  const p=play.position;
  if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<bounds.left||p.x>bounds.right||p.y<bounds.top||p.y>bounds.bottom)return null;
  if(!['up','down','left','right'].includes(play.facing))return null;
  if(play.state==='dialogue'&&!validPage(play.page))return null;
  if(play.state==='transition'&&(typeof play.transition!=='string'||!Number.isInteger(play.index)||play.index<0))return null;
  if(play.state==='journey'&&(!play.journey||!['bridge','chapter','to-hangzhou'].includes(play.journey.mode)||!Number.isFinite(play.journey.progress)||play.journey.progress<0||play.journey.progress>1))return null;
  return play;
}
