import { ALL_FORMATS, BlobSource, CanvasSink, Input } from 'mediabunny';

// One small image per live File. A weak cache releases images with imported media.
const cache=new WeakMap<File,Promise<string|null>>();
let queue=Promise.resolve();
export function thumbnail(file: File): Promise<string|null> {
 const known=cache.get(file);if(known)return known;
 const result=queue.then(async()=>{
  const input=new Input({source:new BlobSource(file),formats:ALL_FORMATS});
  try{
   const track=await input.getPrimaryVideoTrack();if(!track)return null;
   const sink=new CanvasSink(track,{width:240,height:135,fit:'contain',poolSize:1});
   const sample=await sink.getCanvas(0);if(!sample)return null;
   const canvas=document.createElement('canvas');canvas.width=240;canvas.height=135;
   canvas.getContext('2d')!.drawImage(sample.canvas,0,0,240,135);
   return canvas.toDataURL('image/jpeg',.75);
  }catch{return null;}finally{input.dispose();}
 });
 cache.set(file,result);queue=result.then(()=>{});return result;
}
export function mediaLength(seconds: number): string {
 const total=Math.max(0,Math.floor(seconds)),h=Math.floor(total/3600),m=Math.floor(total/60)%60,s=total%60;
 return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`;
}
