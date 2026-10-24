import {clone,placements,trackOf,transitionLength,sourceSpan,validateTracks} from './model.ts';
import type {Project} from './model.ts';
/** Preserve selected source ranges, ripple only the edited lanes, and reject collisions atomically. */
export function setClipSpeed(project:Project,id:string,speed:number,preservePitch=true,ripple=true,all=false):Project{
 if(!Number.isFinite(speed)||speed<.25||speed>4)throw new Error('Set speed between 0.25 and 4.');
 const selected=project.clips.find(c=>c.id===id),kind=project.assets.find(a=>a.id===selected?.assetId)?.kind;
 if(!selected||!kind||kind==='image')throw new Error('Select a video or audio clip.');
 const p=clone(project);p.version=6;const before=placements(project),changed=new Set<string>();
 for(const c of p.clips)if(c.id===id||(all&&p.assets.find(a=>a.id===c.assetId)?.kind===kind)){
  const span=sourceSpan(c);c.sourceFrames=span;c.speed=speed;c.preservePitch=preservePitch;c.frames=Math.max(1,Math.ceil(span/speed-1e-8));changed.add(c.id);
  if(c.audio){if(c.audio.fadeIn!==undefined)c.audio.fadeIn=Math.min(c.audio.fadeIn,c.frames/30);if(c.audio.fadeOut!==undefined)c.audio.fadeOut=Math.min(c.audio.fadeOut,c.frames/30);}
 }
 for(const track of ['v1','v2','a1','a2']){
  const lane=before.filter(e=>e.track===track).sort((a,b)=>a.start-b.start);if(!lane.some(e=>changed.has(e.clip.id)))continue;
  let shift=0,cursor=0;
  for(const [i,e] of lane.entries()){
   const c=p.clips.find(c=>c.id===e.clip.id)!;
   const desired=Math.max(0,e.start+(ripple?shift:0));
   if(track==='v1'&&desired<=cursor)delete c.startFrame;else c.startFrame=desired;
   const next=lane[i+1];
   if(track==='v1'){cursor=Math.max(cursor,desired)+c.frames-(next?transitionLength(p,c):0);shift+=c.frames-e.clip.frames-(next?transitionLength(p,c)-transitionLength(project,e.clip):0);}
   else{
    if(c.audioCrossfadeFrames){const n=p.clips.find(c=>c.id===next?.clip.id);c.audioCrossfadeFrames=Math.min(c.audioCrossfadeFrames,c.frames,n?.frames??0);}
    shift+=c.frames-e.clip.frames-((c.audioCrossfadeFrames??0)-(e.clip.audioCrossfadeFrames??0));
   }
  }
 }
 if(!ripple){const after=placements(p);for(const e of before)if(after.find(n=>n.clip.id===e.clip.id)!.start!==e.start)throw new Error('This speed would overlap the next clip. Enable ripple or make room first.');}
 try{validateTracks(p);}catch{throw new Error('This speed would overlap another clip or break a crossfade. Enable ripple or make room first.');}
 return p;
}
