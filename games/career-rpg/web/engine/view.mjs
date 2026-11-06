// Pixel view. One 2D canvas, nearest-neighbor, world y grows downward.
// A camera rect is the cinematic window; without one the whole room is shown.

export function maskedImage(image,mask){
  const canvas=document.createElement('canvas');
  canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d');
  ctx.drawImage(mask,0,0,canvas.width,canvas.height);
  ctx.globalCompositeOperation='source-in';
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas;
}

export function createView(stage,world){
  const canvas=document.createElement('canvas');
  canvas.setAttribute('aria-hidden','true');
  const ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});
  if(!ctx)throw new Error('无法创建图形上下文');
  let ratio=2,camera=null;
  const fit=()=>{
    const w=camera?camera.size:world.width,h=camera?camera.size:world.height;
    const nextW=Math.max(1,Math.floor(w*ratio)),nextH=Math.max(1,Math.floor(h*ratio));
    if(canvas.width!==nextW||canvas.height!==nextH){canvas.width=nextW;canvas.height=nextH;}
  };
  fit();
  stage.append(canvas);
  return {
    canvas,
    setPixelRatio(next){ratio=next;fit();},
    setCamera(next){camera=next;fit();},
    draw(room,dim,lamp,props,sprites){
      fit();
      const ox=camera?camera.x:0,oy=camera?camera.y:0,ow=camera?camera.size:world.width,oh=camera?camera.size:world.height;
      ctx.setTransform(ratio,0,0,ratio,-ox*ratio,-oy*ratio);
      ctx.imageSmoothingEnabled=false;
      ctx.fillStyle='#e8dfc8';
      ctx.fillRect(ox,oy,ow,oh);
      if(room)ctx.drawImage(room,0,0,world.width,world.height);
      if(dim>0){ctx.save();ctx.globalAlpha=dim;ctx.fillStyle='#000';ctx.fillRect(0,0,world.width,world.height);ctx.restore();}
      if(lamp)ctx.drawImage(lamp,0,0,world.width,world.height);
      for(const prop of props){
        if(!prop.visible)continue;
        ctx.save();ctx.globalAlpha=prop.opacity;
        ctx.drawImage(prop.image,prop.x-prop.w/2,prop.y-prop.h/2,prop.w,prop.h);
        ctx.restore();
      }
      const ordered=sprites.filter(sprite=>sprite.visible&&sprite.draw).sort((a,b)=>a.feet-b.feet);
      for(const sprite of ordered){
        const d=sprite.draw;
        ctx.drawImage(d.image,d.sx,d.sy,d.sw,d.sh,d.dx,d.dy,d.dw,d.dh);
      }
    },
  };
}
