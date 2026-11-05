import test from 'node:test';
import assert from 'node:assert/strict';
import {blocked,move,nearby} from '../world.mjs';
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
