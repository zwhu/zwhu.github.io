// Opaque bounds for one atlas grid. Alpha is byte 3; the shift is endian-safe.
const alphaShift=new Uint32Array(new Uint8Array([0,0,0,255]).buffer)[0]===0xff000000?24:0;

export function boundsFromPixels(pixels,width,height,columns,rows){
  const frames=[];
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const x0=Math.floor(col*width/columns),x1=Math.floor((col+1)*width/columns),y0=Math.floor(row*height/rows),y1=Math.floor((row+1)*height/rows);
    let left=x1,top=y1,right=-1,bottom=-1;
    for(let y=y0;y<y1;y++){
      const start=y*width;
      for(let x=x0;x<x1;x++)if(((pixels[start+x]>>>alphaShift)&255)>128){if(x<left)left=x;if(x>right)right=x;if(y<top)top=y;if(bottom<y)bottom=y;}
    }
    if(right<left)throw new Error(`角色图集第${frames.length+1}格没有可见像素`);
    frames.push({left,top,right,bottom,width:right-left+1,height:bottom-top+1,cell:{left:x0,top:y0,width:x1-x0,height:y1-y0}});
  }
  return frames;
}
