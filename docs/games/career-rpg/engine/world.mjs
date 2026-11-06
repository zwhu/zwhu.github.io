// 60px/s is one world pixel per 60Hz frame. 54px/s was 0.9, so integer
// placement dropped a step about every ten frames and the sprite hitched.
export const MOVE_SPEED=60;
export function blocked(x,y,config) {
  const b=config.bounds;
  if(x<b.left||x>b.right||y<b.top||y>b.bottom)return true;
  return config.obstacles.some(o=>x+4>o.x&&x-4<o.x+o.w&&y+1>o.y&&y-2<o.y+o.h);
}
export function move(position,dx,dy,seconds,config) {
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
// Whole pixels for one displayed frame. The remainder keeps 60Hz jitter from
// skipping or doubling a step: a stable frame stays on exactly one pixel.
export function integrateWalk(position,dx,dy,seconds,config,remainder=0) {
  if(!(dx||dy)||!(seconds>0))return {x:position.x,y:position.y,remainder:0};
  const raw=remainder+MOVE_SPEED*Math.min(seconds,.1);
  const pixels=Math.max(0,Math.round(raw));
  const nextRemainder=raw-pixels;
  if(!pixels)return {x:position.x,y:position.y,remainder:nextRemainder};
  const distance=Math.hypot(dx,dy),sx=dx/distance,sy=dy/distance;
  let next=position;
  for(let i=0;i<pixels;i++){
    if(sy===0){const nx=next.x+Math.sign(sx);next=blocked(nx,next.y,config)?next:{x:nx,y:next.y};}
    else if(sx===0){const ny=next.y+Math.sign(sy);next=blocked(next.x,ny,config)?next:{x:next.x,y:ny};}
    else next=move(next,dx,dy,1/MOVE_SPEED,config);
  }
  return {x:next.x,y:next.y,remainder:nextRemainder};
}
export function nearbyAll(position,config) {
  const point=o=>o.interaction||o;
  return [...config.objects,...config.actors.filter(a=>!a.controllable)].filter(o=>Math.hypot(position.x-point(o).x,position.y-point(o).y)<=22)
    .sort((a,b)=>Math.hypot(position.x-point(a).x,position.y-point(a).y)-Math.hypot(position.x-point(b).x,position.y-point(b).y));
}
export function nearby(position,config){return nearbyAll(position,config)[0]||null;}
