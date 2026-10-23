import type { Project, Clip, Track } from './model.ts';
export const AUDIO_CONTROLS=[
 ['gainDb','Gain (dB)',-24,24,0,.5],['pan','Pan (left / right)',-1,1,0,.05],
 ['bass','Bass (dB)',-18,18,0,.5],['mid','Mid (dB)',-18,18,0,.5],['treble','Treble (dB)',-18,18,0,.5],
 ['threshold','Compressor threshold (dB)',-60,0,-18,1],['ratio','Compressor ratio',1,20,4,.5],
 ['attack','Attack (ms)',1,200,10,1],['release','Release (ms)',10,1000,150,10],
 ['fadeIn','Fade in (seconds)',0,120,0,.1],['fadeOut','Fade out (seconds)',0,120,0,.1]
] as const;
export type AudioSettings=Partial<Record<typeof AUDIO_CONTROLS[number][0],number>>&{compressor?:boolean;limiter?:boolean};
export function validateAudio(value:unknown):AudioSettings{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid audio adjustments.');
 const result:AudioSettings={};for(const [key,,min,max] of AUDIO_CONTROLS){const v=(value as AudioSettings)[key];if(v!==undefined){if(!Number.isFinite(v)||v<min||v>max)throw new Error('Invalid audio '+key);result[key]=v;}}
 for(const key of ['compressor','limiter'] as const){const v=(value as AudioSettings)[key];if(v!==undefined){if(typeof v!=='boolean')throw new Error('Invalid audio '+key);result[key]=v;}}return result;
}
export function audioTrack(p:Project,track:Track){return p.clips.filter(c=>(c.track??'v1')===track).sort((a,b)=>(a.startFrame??0)-(b.startFrame??0));}
export function crossfadeAudio(base:Project,track:'a1'|'a2',ids:string[],frames:number):Project{
 const p=structuredClone(base),clips=audioTrack(p,track);
 for(let i=0;i<clips.length-1;i++){
  const c=clips[i],next=clips[i+1];if(!ids.includes(c.id))continue;
  const old=c.audioCrossfadeFrames??0,gap=(next.startFrame??0)-((c.startFrame??0)+c.frames)+old;
  if(Math.abs(gap)>0){if(ids.length===1)throw new Error('Move these audio clips together before adding a crossfade.');continue;}
  const overlap=Math.max(0,Math.min(frames,Math.floor(c.frames/2),Math.floor(next.frames/2)));
  if(overlap)c.audioCrossfadeFrames=overlap;else delete c.audioCrossfadeFrames;
  for(const tail of clips.slice(i+1))tail.startFrame=(tail.startFrame??0)+old-overlap;
 }
 return p;
}
export function edgeFades(base:Project,track:'a1'|'a2',fadeIn:number,fadeOut:number):Project{
 const p=structuredClone(base),clips=audioTrack(p,track);if(!clips.length)return p;
 clips[0].audio={...clips[0].audio,fadeIn:Math.min(fadeIn,clips[0].frames/30)};clips.at(-1)!.audio={...clips.at(-1)!.audio,fadeOut:Math.min(fadeOut,clips.at(-1)!.frames/30)};return p;
}
export function copyAudio(base:Project,ids:string[],values:AudioSettings):Project{
 const p=structuredClone(base);for(const c of p.clips)if(ids.includes(c.id))c.audio={...values,...(values.fadeIn!==undefined?{fadeIn:Math.min(values.fadeIn,c.frames/30)}:{}),...(values.fadeOut!==undefined?{fadeOut:Math.min(values.fadeOut,c.frames/30)}:{})};return p;
}
export function fadeEnvelope(c:Clip,offset:number){const a=Math.min(c.frames,(c.audio?.fadeIn??0)*30),b=Math.min(c.frames,(c.audio?.fadeOut??0)*30);return Math.min(1,a?Math.max(0,offset/a):1,b?Math.max(0,(c.frames-offset)/b):1);}
export function disconnectAudioJoins(base:Project,id:string):Project{
 const p=structuredClone(base),c=p.clips.find(c=>c.id===id);if(!c||!c.track?.startsWith('a'))return p;
 const lane=audioTrack(p,c.track),i=lane.findIndex(c=>c.id===id);if(lane[i-1])delete lane[i-1].audioCrossfadeFrames;delete c.audioCrossfadeFrames;return p;
}
