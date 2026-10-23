import { validateAudio, fadeEnvelope } from './audio-model.ts';
import type { AudioSettings } from './audio-model.ts';
import { validateCrop } from './crop.ts';
import type { Crop } from './crop.ts';
import { TRANSITIONS, FONT_NAMES, validateAdjustments, parseTexts } from './creative-model.ts';
import type { Transition, Adjustments, TextItem } from './creative-model.ts';
export type Asset = { id: string; name: string; size: number; modified: number; duration: number; kind: 'video' | 'audio'; width: number; height: number; sha256?:string };
export const TRACKS = ['v1','v2','a1','a2'] as const;
export type Track = typeof TRACKS[number];
export type Clip = { id: string; assetId: string; inFrame: number; frames: number; volume: number; track?: Track; startFrame?: number; transitionFrames?: number; scale?: number; x?: number; y?: number; opacity?: number; transition?: Transition; adjustments?: Adjustments; crop?: Crop; audio?:AudioSettings; audioCrossfadeFrames?:number };
export type Project = { format: 'ordo-project'; version: 4; name: string; fps: 30; width: number; height: number; assets: Asset[]; clips: Clip[]; texts?: TextItem[] };
export const clone = <T>(value: T): T => structuredClone(value);
export const fresh = (): Project => ({ format: 'ordo-project', version: 4, name: 'Untitled sequence', fps: 30, width: 1280, height: 720, assets: [], clips: [] });
export const trackOf = (c: Clip): Track => c.track ?? 'v1';
export type Placement = { clip: Clip; start: number; end: number; index: number; track: Track };
export function transitionLength(p: Project, clip: Clip): number {
 const main=p.clips.filter(c=>trackOf(c)==='v1'),next=main[main.findIndex(c=>c.id===clip.id)+1];
 return trackOf(clip)==='v1'&&next?Math.min(clip.transitionFrames??0,Math.floor(clip.frames/2),Math.floor(next.frames/2)):0;
}
export function placements(p: Project): Placement[] {
 let mainStart=0;
 const main=p.clips.filter(c=>trackOf(c)==='v1'),nextById=new Map(main.map((c,i)=>[c.id,main[i+1]]));
 return p.clips.map((clip,index)=>{const track=trackOf(clip),start=track==='v1'?mainStart:clip.startFrame??0,next=nextById.get(clip.id);
  if(track==='v1')mainStart+=clip.frames-(next?Math.min(clip.transitionFrames??0,Math.floor(clip.frames/2),Math.floor(next.frames/2)):0);
  return {clip,start,end:start+clip.frames,index,track};
 });
}
export const duration = (p: Project): number => Math.max(0,...placements(p).map(e=>e.end),...(p.texts??[]).map(t=>t.startFrame+t.frames));
export function layersAt(p: Project, frame: number) {
 const entries=placements(p),main=entries.filter(e=>e.track==='v1');
 return entries.filter(e=>frame>=e.start&&frame<e.end).map(e=>{
  let weight=1;
  if(e.track==='v1'){
   const i=main.findIndex(m=>m.clip.id===e.clip.id),previous=main[i-1],next=main[i+1];
   if(previous&&frame<previous.end)weight=Math.min(1,(frame-e.start)/Math.max(1,previous.end-e.start));
   if(next&&frame>=next.start)weight=Math.min(weight,(e.end-frame)/Math.max(1,e.end-next.start));
  }
  let audioWeight=weight;
  if(e.track==='a1'||e.track==='a2'){
   const lane=entries.filter(m=>m.track===e.track).sort((a,b)=>a.start-b.start),i=lane.findIndex(m=>m.clip.id===e.clip.id),previous=lane[i-1],next=lane[i+1];
   if(previous?.clip.audioCrossfadeFrames&&frame<previous.end)audioWeight*=Math.sin(Math.PI/2*Math.min(1,(frame-e.start)/previous.clip.audioCrossfadeFrames));
   if(e.clip.audioCrossfadeFrames&&next&&frame>=next.start)audioWeight*=Math.cos(Math.PI/2*Math.min(1,(frame-next.start)/e.clip.audioCrossfadeFrames));
  }
  audioWeight*=fadeEnvelope(e.clip,frame-e.start);
  return {...e,offset:frame-e.start,weight,audioWeight};
 }).sort((a,b)=>TRACKS.indexOf(a.track)-TRACKS.indexOf(b.track)||a.start-b.start);
}
export function validateTracks(p: Project) {
 for(const track of TRACKS.filter(t=>t!=='v1')){
  const entries=placements(p).filter(e=>e.track===track).sort((a,b)=>a.start-b.start);
  for(let i=0;i<entries.length;i++){
   const c=entries[i],next=entries[i+1],overlap=c.clip.audioCrossfadeFrames??0;
   if(overlap&&(!track.startsWith('a')||!next||overlap>Math.min(c.clip.frames,next.clip.frames)||next.start!==c.end-overlap))throw new Error('Audio crossfade no longer matches its adjacent clips. Remove the crossfade before changing this join.');
   if(i&&c.start<entries[i-1].end&&((entries[i-1].clip.audioCrossfadeFrames??0)!==entries[i-1].end-c.start||track==='v2'))throw new Error(`Clips on ${track.toUpperCase()} overlap. Choose another track or start time.`);
   if(i>1&&c.start<entries[i-2].end)throw new Error('Three clips cannot overlap on one audio track.');
  }
 }
 if(duration(p)>86400*30)throw new Error('Keep the timeline within 24 hours.');
}
export const sourceFrames = (a: Asset): number => Math.floor(a.duration * 30 + 1e-6);
export function locate(p: Project, frame: number): { clip: Clip; start: number; offset: number; index: number } | null {
 const entry=layersAt(p,frame).find(e=>e.track==='v1')??layersAt(p,frame)[0];
 return entry?{clip:entry.clip,start:entry.start,offset:entry.offset,index:entry.index}:null;
}
export function split(p: Project, clipId: string, frame: number, newId: string): Project {
 const result = clone(p); const index = result.clips.findIndex(c => c.id === clipId);
 if (index < 0) throw new Error('Select a clip first.');
 const start = placements(p).find(e=>e.clip.id===clipId)!.start;
 const left = frame - start; const clip = result.clips[index];
 if (left <= 0 || left >= clip.frames) throw new Error('Move the playhead inside the selected clip to split it.');
 const right={ ...clip, ...(clip.audio?{audio:{...clip.audio,fadeIn:0}}:{}), id: newId, inFrame: clip.inFrame + left, frames: clip.frames - left };
 if(trackOf(clip)!=='v1')right.startFrame=start+left;
 result.clips.splice(index, 1, { ...clip, frames: left, ...(clip.audio?{audio:{...clip.audio,fadeOut:0}}:{}), ...(clip.audioCrossfadeFrames!==undefined?{audioCrossfadeFrames:0}:{}), ...(clip.transitionFrames!==undefined?{transitionFrames:0}:{}) }, right);
 validateTracks(result);
 return result;
}
export function trim(p: Project, id: string, inFrame: number, outFrame: number): Project {
 const result = clone(p), clip = result.clips.find(c => c.id === id);
 if (!clip) throw new Error('Select a clip first.');
 const asset = result.assets.find(a => a.id === clip.assetId)!;
 if (![inFrame, outFrame].every(Number.isSafeInteger) || inFrame < 0 || outFrame <= inFrame || outFrame > sourceFrames(asset)) throw new Error('Set a valid source range of at least one frame.');
 if(clip.audioCrossfadeFrames){const delta=outFrame-inFrame-clip.frames;for(const tail of result.clips)if(tail.id!==clip.id&&trackOf(tail)===trackOf(clip)&&(tail.startFrame??0)>(clip.startFrame??0))tail.startFrame=(tail.startFrame??0)+delta;}
 Object.assign(clip, { inFrame, frames: outFrame - inFrame }); validateTracks(result);return result;
}
export class History {
 private past: Project[] = []; private future: Project[] = [];
 get canUndo() { return this.past.length > 0; } get canRedo() { return this.future.length > 0; }
 push(previous: Project) { this.past.push(clone(previous)); if (this.past.length > 100) this.past.shift(); this.future = []; }
 undo(current: Project) { const previous = this.past.pop(); if (!previous) return current; this.future.push(clone(current)); return clone(previous); }
 redo(current: Project) { const next = this.future.pop(); if (!next) return current; this.past.push(clone(current)); return clone(next); }
 clear() { this.past = []; this.future = []; }
}
export function parseProject(text: string): Project {
 if (text.length > 5_000_000) throw new Error('Project files must be smaller than 5 MB.');
 const p = JSON.parse(text);
 if (!p || p.format !== 'ordo-project' || ![1,2,3,4].includes(p.version)) throw new Error('Unsupported Ordo project format or version.');
 if(p.fps!==30||![p.width,p.height].every(n=>Number.isSafeInteger(n)&&n>=64&&n<=4096&&n%2===0))throw new Error('Invalid canvas dimensions or timeline frame rate.');
 if (typeof p.name !== 'string' || p.name.length > 200 || !Array.isArray(p.assets) || !Array.isArray(p.clips) || p.assets.length > 1000 || p.clips.length > 1000) throw new Error('Invalid project structure.');
 const ids = new Set<string>();
 const assets: Asset[] = p.assets.map((a: Asset) => {
  if (!a || typeof a.id !== 'string' || !a.id || ids.has(a.id) || typeof a.name !== 'string' || a.name.length > 1000 || !Number.isSafeInteger(a.size) || a.size < 0 || !Number.isFinite(a.modified) || a.modified < 0 || !Number.isFinite(a.duration) || a.duration < 1 / 30 || a.duration > 86400 || !['video','audio'].includes(a.kind) || !Number.isSafeInteger(a.width) || !Number.isSafeInteger(a.height) || a.width < 0 || a.height < 0 || a.width > 32768 || a.height > 32768) throw new Error('Invalid or duplicate media entry.');
  if(a.sha256!==undefined&&(typeof a.sha256!=='string'||!/^[a-f0-9]{64}$/.test(a.sha256)))throw new Error('Invalid media fingerprint.');
  ids.add(a.id); return { ...(a.sha256?{sha256:a.sha256}:{}), id: a.id, name: a.name, size: a.size, modified: a.modified, duration: a.duration, kind: a.kind, width: a.width, height: a.height };
 });
 ids.clear(); const assetMap = new Map(assets.map(a => [a.id, a]));
 const clips: Clip[] = p.clips.map((c: Clip) => {
  const asset = c && assetMap.get(c.assetId);
  if (!asset || typeof c.id !== 'string' || !c.id || ids.has(c.id) || !Number.isSafeInteger(c.inFrame) || c.inFrame < 0 || !Number.isSafeInteger(c.frames) || c.frames < 1 || c.inFrame + c.frames > sourceFrames(asset) || !Number.isFinite(c.volume) || c.volume < 0 || c.volume > 1) throw new Error('Invalid clip or source range.');
  if(c.track!==undefined&&!TRACKS.includes(c.track))throw new Error('Invalid timeline track.');
  if(c.startFrame!==undefined&&(!Number.isSafeInteger(c.startFrame)||c.startFrame<0||c.startFrame>86400*30))throw new Error('Invalid clip start time.');
  if(c.transitionFrames!==undefined&&(!Number.isSafeInteger(c.transitionFrames)||c.transitionFrames<0||c.transitionFrames>60||trackOf(c)!=='v1'))throw new Error('Invalid transition.');
  if(c.transition!==undefined&&(!TRANSITIONS.some(t=>t[0]===c.transition)||trackOf(c)!=='v1'))throw new Error('Invalid transition type.');
  for(const [key,min,max] of [['scale',.1,2],['x',0,1],['y',0,1],['opacity',0,1]] as const)if(c[key]!==undefined&&(!Number.isFinite(c[key])||c[key]!<min||c[key]!>max))throw new Error('Invalid clip transform.');
  if(c.audioCrossfadeFrames!==undefined&&(!Number.isSafeInteger(c.audioCrossfadeFrames)||c.audioCrossfadeFrames<0||c.audioCrossfadeFrames>300||!trackOf(c).startsWith('a')))throw new Error('Invalid audio crossfade.');
  ids.add(c.id); const clip:Clip={ id: c.id, assetId: c.assetId, inFrame: c.inFrame, frames: c.frames, volume: c.volume };
  for(const key of ['track','startFrame','transitionFrames','scale','x','y','opacity','transition','audioCrossfadeFrames'] as const)if(c[key]!==undefined)Object.assign(clip,{[key]:c[key]});
  if(c.audio!==undefined)clip.audio=validateAudio(c.audio);
  if(c.adjustments!==undefined)clip.adjustments=validateAdjustments(c.adjustments);if(c.crop!==undefined)clip.crop=validateCrop(c.crop);
  return clip;
 });
 const result:Project={ ...fresh(), name: p.name, width:p.width, height:p.height, assets, clips };if(p.texts!==undefined)result.texts=parseTexts(p.texts,FONT_NAMES);validateTracks(result);return result;
}
export function timecode(frame: number) {
 const f = Math.max(0, Math.floor(frame)); return [Math.floor(f / 108000), Math.floor(f / 1800) % 60, Math.floor(f / 30) % 60, f % 30].map(v => String(v).padStart(2, '0')).join(':');
}
