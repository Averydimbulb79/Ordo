import { clone, placements, sourceFrames, trackOf, transitionLength } from './model.ts';
import type { Project, Track } from './model.ts';
import type { Adjustments, Transition } from './creative-model.ts';

// Pure operations keep each bulk edit atomic in the project's history.
export function appendMedia(base:Project, ids:string[], video:'v1'|'v2', audio:'a1'|'a2', frame:number, makeId:()=>string):Project {
 const p=clone(base),ends=new Map<Track,number>();
 for(const e of placements(p))ends.set(e.track,Math.max(ends.get(e.track)??0,e.end));
 for(const id of ids){
  const asset=p.assets.find(a=>a.id===id);if(!asset)continue;
  const track=asset.kind==='video'?video:audio,frames=sourceFrames(asset);
  const start=Math.max(frame,ends.get(track)??0);
  p.clips.push({id:makeId(),assetId:id,inFrame:0,frames,volume:1,...(track==='v1'?{}:{track,startFrame:start}),...(track==='v2'?{scale:.4,x:.75,y:.75}:{})});
  ends.set(track,(track==='v1'?(ends.get(track)??0):start)+frames);
 }
 return p;
}
export function setTransitions(base:Project, ids:string[], type:Transition|'cut', frames:number):Project {
 const p=clone(base),main=p.clips.filter(c=>trackOf(c)==='v1');
 for(const c of main.slice(0,-1))if(ids.includes(c.id)){
  c.transitionFrames=type==='cut'?0:frames;
  c.transitionFrames=transitionLength(p,c);
  if(type==='cut'||c.transitionFrames===0)delete c.transition;else c.transition=type;
 }
 return p;
}
export function setAdjustments(base:Project, ids:string[], values:Adjustments):Project {
 const p=clone(base),videos=new Set(p.assets.filter(a=>a.kind==='video').map(a=>a.id));
 for(const c of p.clips)if(ids.includes(c.id)&&videos.has(c.assetId)&&['v1','v2'].includes(trackOf(c)))c.adjustments={...values};
 return p;
}
