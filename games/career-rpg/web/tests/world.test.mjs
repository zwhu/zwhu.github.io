import test from 'node:test';
import assert from 'node:assert/strict';
import {blocked,move,nearby,integrateWalk,MOVE_SPEED} from '../world.mjs';
test('feet cannot cross desk collision or room edges',()=>{
  let p={x:80,y:130};for(let i=0;i<120;i++)p=move(p,0,-1,1/60);
  assert.ok(p.y>=117);assert.equal(blocked(p.x,p.y),false);
  p={x:200,y:150};for(let i=0;i<600;i++)p=move(p,1,0,1/60);assert.ok(p.x<=378);
});
test('diagonal movement has the same speed as a cardinal direction',()=>{
  const p={x:180,y:150},a=move(p,1,0,1/60),b=move(p,1,1,1/60);
  assert.ok(Math.abs(Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))<1e-9);
});
test('interaction is local and long frame stalls do not teleport',()=>{
  assert.equal(nearby({x:80,y:124}).id,'forum');assert.equal(nearby({x:170,y:150}),null);
  const p=move({x:170,y:150},1,0,30);assert.ok(p.x<=172.700001);
});
test('display frames that are not exact 1/60 slices still move every frame',()=>{
  // Recorded left-walk dts. The old 1/60 bucket turned this into 0, 1.8, 0, 1.8.
  const dts=[0.0167,0.0167,0.0167,0.0166,0.0167,0.0166,0.0168,0.0166,0.0167,0.0166,0.0167,0.0167,0.0166,0.0167,0.0167,0.0167,0.0166,0.0167,0.0166,0.0166];
  const variance=vals=>{const mean=vals.reduce((a,b)=>a+b,0)/vals.length;return vals.reduce((a,b)=>a+(b-mean)**2,0)/vals.length;};
  let acc=0.0166,fixed={x:180,y:150};const fixedDeltas=[];
  for(const dt of dts){
    acc+=dt;const before=fixed.x;
    while(acc>=1/60){fixed=move(fixed,1,0,1/60);acc-=1/60;}
    fixedDeltas.push(fixed.x-before);
  }
  let live={x:180,y:150};const liveDeltas=[];
  for(const dt of dts){const next=integrateWalk(live,1,0,dt);liveDeltas.push(next.x-live.x);live=next;}
  assert.ok(fixedDeltas.some(d=>d===0)&&fixedDeltas.some(d=>d>1.5));
  assert.ok(liveDeltas.every(d=>d>0));
  assert.ok(variance(liveDeltas)<variance(fixedDeltas)/20);
  const time=dts.reduce((a,b)=>a+b,0);
  assert.ok(Math.abs((live.x-180)-MOVE_SPEED*time)<1e-6);
});
