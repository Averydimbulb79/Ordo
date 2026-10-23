import { createAudioChain } from './audio-engine';
import { loadProjectFonts } from './fonts';
import { duration, layersAt } from './model';
import type { Project } from './model';
import { decodeImage } from './media';
import type { LocalMedia } from './media';
import { paintComposition } from './composition';
export class Preview {
 private audioContext?:AudioContext;private graphs=new Map<string,ReturnType<typeof createAudioChain>>();
 private project!:Project;private files!:Map<string,LocalMedia>;
 private pictures=new Map<string,ImageBitmap>();
 private players=new Map<string,HTMLVideoElement>();private token=0;private request=0;
 private clock=0;private origin=0;private active='';
 frame=0;playing=false;
 constructor(private canvas:HTMLCanvasElement,private onTime:(f:number)=>void,private onState:()=>void,private onError:(s:string)=>void){}
 setProject(project:Project,files:Map<string,LocalMedia>){this.pause();this.project=project;this.files=files;for(const media of this.players.values()){media.removeAttribute('src');media.load();}this.players.clear();for(const image of this.pictures.values())image.close();this.pictures.clear();for(const graph of this.graphs.values())graph.dispose();this.graphs.clear();}
 pause(){this.token++;this.playing=false;for(const media of this.players.values())media.pause();cancelAnimationFrame(this.request);this.onState();}
 private bypassAdjustments=false;
 setBypassAdjustments(value:boolean){this.bypassAdjustments=value;this.paint();}
 setDraft(project:Project,live=false){this.project=project;if(this.canvas.width!==project.width||this.canvas.height!==project.height){this.canvas.width=project.width;this.canvas.height=project.height;}if(live)this.paint();else void this.seek(this.frame);}
 private paint(){for(const entry of layersAt(this.project,this.frame)){const graph=this.graphs.get(entry.clip.id);if(graph){graph.update(entry.clip.audio,this.bypassAdjustments);graph.setLevel(entry.clip.volume*entry.audioWeight,this.playing);}}const images=new Map<string,CanvasImageSource>();for(const entry of layersAt(this.project,this.frame)){const image=this.pictures.get(entry.clip.assetId);if(image)images.set(entry.clip.id,image);}for(const [id,media] of this.players)if(media.readyState>=2)images.set(id,media);paintComposition(this.canvas.getContext('2d')!,this.project,this.frame,images,this.bypassAdjustments);}
 async seek(frame:number,resume=false){
  this.pause();const token=this.token;this.frame=Math.min(Math.max(0,Math.round(frame)),Math.max(0,duration(this.project)-1));this.onTime(this.frame);
  const layers=layersAt(this.project,this.frame);this.active=layers.map(e=>e.clip.id).join(',');
  const keep=new Set(layers.map(e=>e.clip.id));
  const pictureIds=new Set(layers.map(e=>e.clip.assetId));for(const [id,image] of this.pictures)if(!pictureIds.has(id)){image.close();this.pictures.delete(id);}
  for(const [id,media] of this.players)if(!keep.has(id)){media.removeAttribute('src');media.load();this.players.delete(id);this.graphs.get(id)?.dispose();this.graphs.delete(id);}
  try{
   if(resume){this.audioContext??=new AudioContext();await this.audioContext.resume();if(token!==this.token)return;}
   await loadProjectFonts(this.project);if(token!==this.token)return;
   await Promise.all(layers.map(async entry=>{
    const local=this.files.get(entry.clip.assetId);if(!local)throw new Error('Media is missing. Use Relink in Project media.');
    if(this.project.assets.find(a=>a.id===entry.clip.assetId)?.kind==='image'){if(!this.pictures.has(entry.clip.assetId)){const image=await decodeImage(local.file);if(token!==this.token){image.close();return;}if(this.pictures.has(entry.clip.assetId))image.close();else this.pictures.set(entry.clip.assetId,image);}return;}
    let media=this.players.get(entry.clip.id);
    if(!media){media=document.createElement('video');media.playsInline=true;media.preload='auto';media.src=local.url;this.players.set(entry.clip.id,media);}
    await this.wait(media,'loadedmetadata',()=>media!.readyState>=1);if(token!==this.token)return;
    if(this.audioContext&&!this.graphs.has(entry.clip.id))this.graphs.set(entry.clip.id,createAudioChain(this.audioContext,this.audioContext.createMediaElementSource(media),this.audioContext.destination));
    const position=(entry.clip.inFrame+entry.offset)/30;media.volume=this.graphs.has(entry.clip.id)?1:entry.clip.volume*entry.audioWeight;
    if(Math.abs(media.currentTime-position)>.001||media.readyState<2){media.currentTime=position;await this.wait(media,'seeked',()=>!media!.seeking&&media!.readyState>=2);}
   }));
   if(token!==this.token)return;this.paint();
   if(resume){await Promise.all(layers.map(e=>this.players.get(e.clip.id)?.play()));if(token!==this.token)return;this.origin=this.frame;this.clock=performance.now();this.playing=true;this.onState();this.tick();}
  }catch(error){if(token===this.token){this.pause();this.onError(`Preview unavailable: ${error instanceof Error?error.message:String(error)}`);}}
 }
 private wait(media:HTMLVideoElement,event:string,ready:()=>boolean):Promise<void>{
  if(ready())return Promise.resolve();
  return new Promise((resolve,reject)=>{
   const clear=()=>{clearTimeout(timeout);media.removeEventListener(event,done);media.removeEventListener('error',fail);};
   const done=()=>{clear();resolve();},fail=()=>{clear();reject(new Error('This device cannot play the selected media.'));};
   const timeout=setTimeout(()=>{clear();reject(new Error('Media loading timed out.'));},12000);
   media.addEventListener(event,done,{once:true});media.addEventListener('error',fail,{once:true});
  });
 }
 private tick=()=>{
  if(!this.playing)return;
  const frame=this.origin+Math.floor((performance.now()-this.clock)*30/1000);
  if(frame>=duration(this.project)){this.pause();this.frame=Math.max(0,duration(this.project)-1);this.onTime(this.frame);return;}
  const layers=layersAt(this.project,frame),active=layers.map(e=>e.clip.id).join(',');
  if(active!==this.active){void this.seek(frame,true);return;}
  this.frame=frame;
  this.onTime(frame);this.paint();this.request=requestAnimationFrame(this.tick);
 };
 async toggle(){if(this.playing)this.pause();else await this.seek(this.frame>=duration(this.project)-1?0:this.frame,true);}
}
