import { Capacitor,registerPlugin } from '@capacitor/core';
import { isAndroid,nativeUriFor } from './native';
const engine=registerPlugin<{read(options:{id:string;uri:string;seconds:number;width:number;height:number}):Promise<{data:string}>;prepareSource(options:{id:string}):Promise<void>;appendSource(options:{id:string;data:string;offset:number}):Promise<void>;close(options:{id:string}):Promise<void>}>('OrdoFrames');
export function canReadNativeFrames(file:File){return isAndroid&&Capacitor.isPluginAvailable('OrdoFrames');}
export class NativeFrameReader {
 private id=crypto.randomUUID();private image?:ImageBitmap;private disposed=false;private uri:string|undefined;
 constructor(private file:File,private width:number,private height:number,private signal:AbortSignal){}
 async frame(seconds:number){
  const check=()=>{if(this.disposed||this.signal.aborted)throw new DOMException('Export cancelled','AbortError');};check();
  const read=async()=>{
   if(this.uri===undefined){this.uri=nativeUriFor(this.file);
    if(!this.uri){await engine.prepareSource({id:this.id});check();
     for(let offset=0;offset<this.file.size;offset+=192000){check();const bytes=new Uint8Array(await this.file.slice(offset,offset+192000).arrayBuffer());let data='';for(let p=0;p<bytes.length;p+=8192)data+=String.fromCharCode(...bytes.subarray(p,p+8192));await engine.appendSource({id:this.id,offset,data:btoa(data)});}this.uri='';
    }
   }
   check();return engine.read({id:this.id,uri:this.uri,seconds,width:this.width,height:this.height});
  };
  const request=read();
  let abort:()=>void=()=>{},timer:ReturnType<typeof setTimeout>|undefined;
  try{
   const result=await Promise.race([request,new Promise<never>((_,reject)=>{abort=()=>reject(new DOMException('Export cancelled','AbortError'));this.signal.addEventListener('abort',abort,{once:true});if(this.signal.aborted)abort();}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Native frame recovery timed out. Try relinking this source or restarting Ordo.')),60000);})]);check();
   const bytes=Uint8Array.from(atob(result.data),c=>c.charCodeAt(0)),image=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
   if(this.disposed||this.signal.aborted){image.close();check();}
   this.image?.close();this.image=image;return image;
  }finally{clearTimeout(timer);this.signal.removeEventListener('abort',abort);}
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.image?.close();this.image=undefined;void engine.close({id:this.id}).catch(()=>{});}
}
