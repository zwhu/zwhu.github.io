// Frame selection and DOM placement are pure; atlas reading never changes the source image.
// 3-column sheets keep idle, stride A, idle, stride B. A walkSequence lists only
// the moving columns, so a standing pose is not inserted into the stride.
export const WALK_POSE_HZ=4;
export const WALK_SEQUENCE=Object.freeze([0,1,0,2]);
const walkColumns=atlas=>atlas.walkSequence||WALK_SEQUENCE;
const walkRate=atlas=>atlas.poseHz||WALK_POSE_HZ;
export function frameIndex(atlas,facing,moving,time,column=0){
  const row=Math.max(0,atlas.directions.indexOf(facing));
  const sequence=walkColumns(atlas);
  const col=moving&&atlas.columns>1?sequence[Math.floor(time*walkRate(atlas))%sequence.length]:column;
  return row*atlas.columns+col;
}
export const typingFrame=(column,time,playing)=>column+(playing?Math.floor(time*3)%2*4:0);
// A one-cell sit sheet has no typing cycle. Its bottom edge is the hip, not a sole.
export function seatedFrame(atlas,column,time,playing){
  if((atlas.columns||1)===1&&(atlas.rows||1)===1)return 0;
  return typingFrame(column,time,playing);
}
// Pose phase is distance / speed, so a frame that does not move does not step the legs.
export function walkClock(walkTime,moving,distance,speed){
  if(!moving)return 0;
  return walkTime+(speed>0?distance/speed:0);
}
export function placeActor(x,y,offset,height,worldHeight,snap){
  const px=x+offset,py=worldHeight-y+height/2;
  return snap?{x:Math.round(px),y:Math.round(py)}:{x:px,y:py};
}
// One integer anchor for the whole sheet. Per-direction offsets round to
// different pixels and the first step of a turn jumps an extra pixel.
export function sheetAnchor(offsets){
  const values=[...offsets].sort((a,b)=>a-b);
  return Math.round(values[values.length>>1]||0);
}
export function motionForRender(enabled,intent,moved,now,lastMovedAt){
  const latest=moved?now:lastMovedAt;
  return {moving:enabled&&intent&&(moved||now-latest<80),lastMovedAt:latest};
}
export function stableFrameRects(frames,atlas){
  return frames.map((frame,index)=>{
    const row=Math.floor(index/atlas.columns),column=index%atlas.columns;
    const group=frames.filter((_,i)=>atlas.referenceGrouping==='row'?Math.floor(i/atlas.columns)===row:atlas.referenceGrouping==='column'?i%atlas.columns===column:i===index);
    const left=Math.min(...group.map(f=>f.left-f.cell.left)),right=Math.max(...group.map(f=>f.right-f.cell.left));
    const height=Math.max(...group.map(f=>f.height)),width=right-left+1;
    return {left:frame.cell.left+left,top:frame.bottom+1-height,width,height,centerOffset:left+width/2-frame.cell.width/2};
  });
}
export function bubblePosition(anchor,size,viewport){
  const margin=8,width=Math.min(size.width,viewport.width-margin*2),height=Math.min(size.height,viewport.height-margin*2);
  let left=anchor.x<viewport.width/2?anchor.x+14:anchor.x-width-14;
  let top=anchor.y-height-14,below=false;
  if(top<margin){top=anchor.y+16;below=true;}
  left=Math.max(margin,Math.min(left,viewport.width-width-margin));
  top=Math.max(margin,Math.min(top,viewport.height-height-margin));
  return {left,top,below,tail:Math.max(14,Math.min(anchor.x-left,width-14))};
}
export function atlasBounds(image,atlas){
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
  const rgba=context.getImageData(0,0,image.width,image.height).data;
  const frames=[];
  for(let row=0;row<atlas.rows;row++)for(let col=0;col<atlas.columns;col++){
    const x0=Math.floor(col*image.width/atlas.columns),x1=Math.floor((col+1)*image.width/atlas.columns),y0=Math.floor(row*image.height/atlas.rows),y1=Math.floor((row+1)*image.height/atlas.rows);
    let left=x1,top=y1,right=-1,bottom=-1;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(rgba[(y*image.width+x)*4+3]>128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    if(right<left)throw new Error(`角色图集第${frames.length+1}格没有可见像素`);
    frames.push({left,top,right,bottom,width:right-left+1,height:bottom-top+1,cell:{left:x0,top:y0,width:x1-x0,height:y1-y0}});
  }
  return frames;
}
export function createActor(THREE,image,atlas,definition,worldHeight){
  const frames=atlasBounds(image,atlas),references=stableFrameRects(frames,atlas),texture=new THREE.Texture(image);
  texture.needsUpdate=true;texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.5,depthTest:false}));
  const anchor=sheetAnchor(references.map(b=>b.centerOffset*definition.height/b.height));
  let current=-1,offset=0;
  return {mesh,frames,update(position,facing,moving,time,explicitFrame=null,snap=false){
    const next=explicitFrame??frameIndex(atlas,facing,moving,time,definition.column||0);
    if(next!==current){const b=references[next];texture.repeat.set(b.width/image.width,b.height/image.height);texture.offset.set(b.left/image.width,1-(b.top+b.height)/image.height);mesh.scale.set(definition.height*b.width/b.height,definition.height,1);offset=b.centerOffset*definition.height/b.height;current=next;}
    const placed=placeActor(position.x,position.y,snap?anchor:offset,definition.height,worldHeight,snap);
    mesh.position.set(placed.x,placed.y,2);mesh.renderOrder=1+position.y;
  },frame:()=>current,metrics:()=>({frame:current,width:mesh.scale.x,height:mesh.scale.y,offset,x:mesh.position.x,y:mesh.position.y,reference:references[current]})};
}
