import type { Project } from './model.ts';
export function setSourceVolume(base:Project,id:string,volume:number,all=false):Project {
 if(!Number.isFinite(volume)||volume<0||volume>1)throw new Error('Set source volume between 0 and 100%.');
 const source=base.clips.find(c=>c.id===id),kind=base.assets.find(a=>a.id===source?.assetId)?.kind;
 if(!source||kind==='image'||!kind)throw new Error('Select a video or audio clip.');
 const p=structuredClone(base);for(const c of p.clips)if(c.id===id||(all&&base.assets.find(a=>a.id===c.assetId)?.kind===kind))c.volume=volume;
 return p;
}
