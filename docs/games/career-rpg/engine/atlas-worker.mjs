import {boundsFromPixels} from './atlas-bounds.mjs';

self.onmessage=event=>{
  const {bitmap,columns,rows}=event.data;
  const width=bitmap.width,height=bitmap.height;
  const canvas=new OffscreenCanvas(width,height);
  const context=canvas.getContext('2d',{willReadFrequently:true});
  context.drawImage(bitmap,0,0);
  if(typeof bitmap.close==='function')bitmap.close();
  const rgba=context.getImageData(0,0,width,height).data;
  const pixels=new Uint32Array(rgba.buffer,rgba.byteOffset,rgba.length>>2);
  self.postMessage(boundsFromPixels(pixels,width,height,columns,rows));
};
