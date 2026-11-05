import {OFFICE} from './scene-config.mjs';
export const WORLD=OFFICE;
export const OBSTACLES=OFFICE.obstacles;
export const COMPUTERS=OFFICE.objects;
export const MOVE_SPEED=54;
export function blocked(x,y,config=OFFICE) {
  const b=config.bounds;
  if(x<b.left||x>b.right||y<b.top||y>b.bottom)return true;
  return config.obstacles.some(o=>x+4>o.x&&x-4<o.x+o.w&&y+1>o.y&&y-2<o.y+o.h);
}
export function move(position,dx,dy,seconds,config=OFFICE) {
  const distance=Math.hypot(dx,dy);
  if(!distance||seconds<=0)return {...position};
  const scale=MOVE_SPEED*Math.min(seconds,.05)/distance;
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx*scale),Math.abs(dy*scale))));
  let {x,y}=position;
  for(let i=0;i<steps;i++) {
    const nx=x+dx*scale/steps,ny=y+dy*scale/steps;
    if(!blocked(nx,y,config))x=nx;
    if(!blocked(x,ny,config))y=ny;
  }
  return {x,y};
}
// One displayed frame. The frame dt is spent as-is: a 1/60 bucket moves 0 or 2
// steps whenever vsync is not an exact multiple of 1/60, so the body hitches.
export function integrateWalk(position,dx,dy,seconds,config=OFFICE) {
  if(!(dx||dy)||!(seconds>0))return {x:position.x,y:position.y};
  let remain=Math.min(seconds,.1),next=position;
  do {
    const step=Math.min(remain,.05);
    next=move(next,dx,dy,step,config);
    remain-=step;
  } while(remain>1e-9);
  return next;
}
export function nearbyAll(position,config=OFFICE) {
  const point=o=>o.interaction||o;
  return [...config.objects,...config.actors.filter(a=>!a.controllable)].filter(o=>Math.hypot(position.x-point(o).x,position.y-point(o).y)<=22)
    .sort((a,b)=>Math.hypot(position.x-point(a).x,position.y-point(a).y)-Math.hypot(position.x-point(b).x,position.y-point(b).y));
}
export function nearby(position,config=OFFICE){return nearbyAll(position,config)[0]||null;}
