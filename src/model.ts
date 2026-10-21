export type Asset = { id: string; name: string; size: number; modified: number; duration: number; kind: 'video' | 'audio'; width: number; height: number };
export type Clip = { id: string; assetId: string; inFrame: number; frames: number; volume: number };
export type Project = { format: 'ordo-project'; version: 1; name: string; fps: 30; width: 1280; height: 720; assets: Asset[]; clips: Clip[] };
export const clone = <T>(value: T): T => structuredClone(value);
export const fresh = (): Project => ({ format: 'ordo-project', version: 1, name: 'Untitled sequence', fps: 30, width: 1280, height: 720, assets: [], clips: [] });
export const duration = (p: Project): number => p.clips.reduce((sum, c) => sum + c.frames, 0);
export const sourceFrames = (a: Asset): number => Math.floor(a.duration * 30 + 1e-6);
export function locate(p: Project, frame: number): { clip: Clip; start: number; offset: number; index: number } | null {
 let start = 0;
 for (let index = 0; index < p.clips.length; index++) {
  const clip = p.clips[index];
  if (frame >= start && frame < start + clip.frames) return { clip, start, offset: frame - start, index };
  start += clip.frames;
 }
 return null;
}
export function split(p: Project, clipId: string, frame: number, newId: string): Project {
 const result = clone(p); const index = result.clips.findIndex(c => c.id === clipId);
 if (index < 0) throw new Error('Select a clip first.');
 const start = result.clips.slice(0, index).reduce((s, c) => s + c.frames, 0);
 const left = frame - start; const clip = result.clips[index];
 if (left <= 0 || left >= clip.frames) throw new Error('Move the playhead inside the selected clip to split it.');
 result.clips.splice(index, 1, { ...clip, frames: left }, { ...clip, id: newId, inFrame: clip.inFrame + left, frames: clip.frames - left });
 return result;
}
export function trim(p: Project, id: string, inFrame: number, outFrame: number): Project {
 const result = clone(p), clip = result.clips.find(c => c.id === id);
 if (!clip) throw new Error('Select a clip first.');
 const asset = result.assets.find(a => a.id === clip.assetId)!;
 if (![inFrame, outFrame].every(Number.isSafeInteger) || inFrame < 0 || outFrame <= inFrame || outFrame > sourceFrames(asset)) throw new Error('Set a valid source range of at least one frame.');
 Object.assign(clip, { inFrame, frames: outFrame - inFrame }); return result;
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
 if (!p || p.format !== 'ordo-project' || p.version !== 1) throw new Error('Unsupported Ordo project format or version.');
 if (p.fps !== 30 || p.width !== 1280 || p.height !== 720) throw new Error('This release supports 1280 × 720 projects at 30 fps.');
 if (typeof p.name !== 'string' || p.name.length > 200 || !Array.isArray(p.assets) || !Array.isArray(p.clips) || p.assets.length > 1000 || p.clips.length > 1000) throw new Error('Invalid project structure.');
 const ids = new Set<string>();
 const assets: Asset[] = p.assets.map((a: Asset) => {
  if (!a || typeof a.id !== 'string' || !a.id || ids.has(a.id) || typeof a.name !== 'string' || a.name.length > 1000 || !Number.isSafeInteger(a.size) || a.size < 0 || !Number.isFinite(a.modified) || a.modified < 0 || !Number.isFinite(a.duration) || a.duration < 1 / 30 || a.duration > 86400 || !['video','audio'].includes(a.kind) || !Number.isSafeInteger(a.width) || !Number.isSafeInteger(a.height) || a.width < 0 || a.height < 0 || a.width > 32768 || a.height > 32768) throw new Error('Invalid or duplicate media entry.');
  ids.add(a.id); return { id: a.id, name: a.name, size: a.size, modified: a.modified, duration: a.duration, kind: a.kind, width: a.width, height: a.height };
 });
 ids.clear(); const assetMap = new Map(assets.map(a => [a.id, a]));
 const clips: Clip[] = p.clips.map((c: Clip) => {
  const asset = c && assetMap.get(c.assetId);
  if (!asset || typeof c.id !== 'string' || !c.id || ids.has(c.id) || !Number.isSafeInteger(c.inFrame) || c.inFrame < 0 || !Number.isSafeInteger(c.frames) || c.frames < 1 || c.inFrame + c.frames > sourceFrames(asset) || !Number.isFinite(c.volume) || c.volume < 0 || c.volume > 1) throw new Error('Invalid clip or source range.');
  ids.add(c.id); return { id: c.id, assetId: c.assetId, inFrame: c.inFrame, frames: c.frames, volume: c.volume };
 });
 return { ...fresh(), name: p.name, assets, clips };
}
export function timecode(frame: number) {
 const f = Math.max(0, Math.floor(frame)); return [Math.floor(f / 108000), Math.floor(f / 1800) % 60, Math.floor(f / 30) % 60, f % 30].map(v => String(v).padStart(2, '0')).join(':');
}
