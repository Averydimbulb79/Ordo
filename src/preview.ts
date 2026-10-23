import { loadProjectFonts } from './fonts';
import { duration, layersAt } from './model';
import type { Project } from './model';
import type { LocalMedia } from './media';
import { paintComposition } from './composition';
export class Preview {
 private project!:Project;private files!:Map<string,LocalMedia>;
 private players=new Map<string,HTMLVideoElement>();private token=0;private request=0;
 private clock=0;private origin=0;private active='';
 frame=0;playing=false;
 constructor(private canvas:HTMLCanvasElement,private onTime:(f:number)=>void,private onState:()=>void,private onError:(s:string)=>void){}
 setProject(project:Project,files:Map<string,LocalMedia>){this.pause();this.project=project;this.files=files;for(const media of this.players.values()){media.removeAttribute('src');media.load();}this.players.clear();}
 pause(){this.token++;this.playing=false;for(const media of this.players.values())media.pause();cancelAnimationFrame(this.request);this.onState();}
 setDraft(project:Project){this.project=project;if(this.canvas.width!==project.width||this.canvas.height!==project.height){this.canvas.width=project.width;this.canvas.height=project.height;}void this.seek(this.frame);}
 private paint(){const images=new Map<string,CanvasImageSource>();for(const [id,media] of this.players)if(media.readyState>=2)images.set(id,media);paintComposition(this.canvas.getContext('2d')!,this.project,this.frame,images);}
 async seek(frame:number,resume=false){
  this.pause();const token=this.token;this.frame=Math.min(Math.max(0,Math.round(frame)),Math.max(0,duration(this.project)-1));this.onTime(this.frame);
  const layers=layersAt(this.project,this.frame);this.active=layers.map(e=>e.clip.id).join(',');
  const keep=new Set(layers.map(e=>e.clip.id));
  for(const [id,media] of this.players)if(!keep.has(id)){media.removeAttribute('src');media.load();this.players.delete(id);}
  try{
   await loadProjectFonts(this.project);if(token!==this.token)return;
   await Promise.all(layers.map(async entry=>{
    const local=this.files.get(entry.clip.assetId);if(!local)throw new Error('Media is missing. Use Relink in Project media.');
    let media=this.players.get(entry.clip.id);
    if(!media){media=document.createElement('video');media.playsInline=true;media.preload='auto';media.src=local.url;this.players.set(entry.clip.id,media);}
    await this.wait(media,'loadedmetadata',()=>media!.readyState>=1);if(token!==this.token)return;
    const position=(entry.clip.inFrame+entry.offset)/30;media.volume=entry.clip.volume*entry.weight;
    if(Math.abs(media.currentTime-position)>.001||media.readyState<2){media.currentTime=position;await this.wait(media,'seeked',()=>!media!.seeking&&media!.readyState>=2);}
   }));
   if(token!==this.token)return;this.paint();
   if(resume){await Promise.all(layers.map(e=>this.players.get(e.clip.id)!.play()));if(token!==this.token)return;this.origin=this.frame;this.clock=performance.now();this.playing=true;this.onState();this.tick();}
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
  this.frame=frame;for(const e of layers)this.players.get(e.clip.id)!.volume=e.clip.volume*e.weight;
  this.onTime(frame);this.paint();this.request=requestAnimationFrame(this.tick);
 };
 async toggle(){if(this.playing)this.pause();else await this.seek(this.frame>=duration(this.project)-1?0:this.frame,true);}
}
