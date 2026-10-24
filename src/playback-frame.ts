// Use the same HTML video decoding path as preview when WebCodecs cannot supply a frame.
// Audio stays in the offline mixer; this player must never send sound to the speakers.
export class PlaybackFrameReader {
 private video: HTMLVideoElement;
 private loaded=false;
 constructor(url:string,private signal:AbortSignal){
  this.video=document.createElement('video');
  this.video.muted=true;this.video.playsInline=true;this.video.preload='auto';
  this.video.src=url;
 }
 private check(){if(this.signal.aborted)throw new DOMException('Export cancelled','AbortError');}
 private wait(ready:()=>boolean,action?:()=>void):Promise<void>{
  this.check();
  return new Promise((resolve,reject)=>{
   const events=['loadedmetadata','loadeddata','canplay','seeked'];
   const clear=()=>{clearTimeout(timer);for(const event of events)this.video.removeEventListener(event,done);this.video.removeEventListener('error',fail);this.signal.removeEventListener('abort',abort);};
   const done=()=>{if(ready()){clear();resolve();}};
   const fail=()=>{clear();reject(new Error(`Playback decoder failed${this.video.error?` (media error ${this.video.error.code})`:''}.`));};
   const abort=()=>{clear();reject(new DOMException('Export cancelled','AbortError'));};
   const timer=setTimeout(()=>{clear();reject(new Error('Playback decoder timed out while loading a frame.'));},15000);
   for(const event of events)this.video.addEventListener(event,done);
   this.video.addEventListener('error',fail);this.signal.addEventListener('abort',abort,{once:true});
   try{action?.();if(this.video.error)fail();else done();}catch(error){clear();reject(error);}
  });
 }
 async frame(seconds:number):Promise<HTMLVideoElement>{
  this.check();
  if(!this.loaded){await this.wait(()=>this.video.readyState>=2,()=>this.video.load());this.loaded=true;}
  // Container/audio duration can slightly exceed the final picture timestamp.
  const end=Number.isFinite(this.video.duration)?Math.max(0,this.video.duration-.001):seconds;
  const position=Math.max(0,Math.min(seconds,end));
  if(Math.abs(this.video.currentTime-position)>.000001||this.video.readyState<2)
   await this.wait(()=>!this.video.seeking&&this.video.readyState>=2,()=>{this.video.currentTime=position;});
  this.check();return this.video;
 }
 dispose(){this.video.pause();this.video.removeAttribute('src');this.video.load();}
}
