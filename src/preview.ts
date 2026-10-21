import { duration, locate } from './model';
import type { Project } from './model';
import type { LocalMedia } from './media';
import { drawContained } from './media';
export class Preview {
 private media = document.createElement('video');
 private project!: Project; private files!: Map<string, LocalMedia>;
 private token = 0; private request = 0; private active = ''; private start = 0;
 frame = 0; playing = false;
 constructor(private canvas: HTMLCanvasElement, private onTime: (f: number) => void, private onState: () => void, private onError: (s: string) => void) {
  this.media.playsInline = true; this.media.preload = 'auto';
  this.media.addEventListener('ended', () => { if (this.playing) void this.advance(); });
 }
 setProject(project: Project, files: Map<string, LocalMedia>) { this.pause(); this.project = project; this.files = files; }
 private paint() {
  const entry = locate(this.project, this.frame), a = this.project.assets.find(a => a.id === entry?.clip.assetId);
  drawContained(this.canvas.getContext('2d')!, a?.kind === 'video' && this.media.readyState >= 2 ? this.media : null, this.media.videoWidth, this.media.videoHeight);
 }
 pause() { this.token++; this.playing = false; this.media.pause(); cancelAnimationFrame(this.request); this.onState(); }
 async seek(frame: number, resume = false) {
  this.pause(); const token = this.token;
  this.frame = Math.min(Math.max(0, Math.round(frame)), Math.max(0, duration(this.project) - 1)); this.onTime(this.frame);
  const entry = locate(this.project, this.frame);
  if (!entry) { this.media.removeAttribute('src'); this.media.load(); this.active = ''; this.paint(); return; }
  const local = this.files.get(entry.clip.assetId);
  if (!local) { this.active = ''; drawContained(this.canvas.getContext('2d')!); this.onError('Media is missing. Use Relink in the media bin.'); return; }
  try {
   if (this.active !== local.url) {
    this.active = local.url; this.media.src = local.url;
    await this.wait('loadedmetadata', () => this.media.readyState >= 1);
   }
   if (token !== this.token) return;
   const position = (entry.clip.inFrame + entry.offset) / 30;
   this.media.volume = entry.clip.volume;
   if (Math.abs(this.media.currentTime - position) > 0.001 || this.media.readyState < 2) {
    this.media.currentTime = position;
    await this.wait('seeked', () => !this.media.seeking && this.media.readyState >= 2);
   }
   if (token !== this.token) return;
   this.start = entry.start; this.paint();
   if (resume) { await this.media.play(); if (token !== this.token) { this.media.pause(); return; } this.playing = true; this.onState(); this.tick(); }
  } catch (error) { if (token === this.token) { this.pause(); this.onError(`Preview unavailable: ${error instanceof Error ? error.message : String(error)}`); } }
 }
 private wait(event: string, ready: () => boolean): Promise<void> {
  if (ready()) return Promise.resolve();
  return new Promise((resolve, reject) => {
   const clear = () => { clearTimeout(timeout); this.media.removeEventListener(event, done); this.media.removeEventListener('error', fail); };
   const done = () => { clear(); resolve(); }, fail = () => { clear(); reject(new Error('This browser cannot play the selected media.')); };
   const timeout = setTimeout(() => { clear(); reject(new Error('Media loading timed out.')); }, 12_000);
   this.media.addEventListener(event, done, { once: true }); this.media.addEventListener('error', fail, { once: true });
  });
 }
 private tick = () => {
  if (!this.playing) return;
  const entry = locate(this.project, this.frame); if (!entry) return;
  const offset = Math.floor(this.media.currentTime * 30 + 1e-5) - entry.clip.inFrame;
  if (offset >= entry.clip.frames) { void this.advance(); return; }
  this.frame = this.start + Math.max(0, offset); this.onTime(this.frame); this.paint(); this.request = requestAnimationFrame(this.tick);
 };
 private async advance() {
  const entry = locate(this.project, this.frame); if (!entry) { this.pause(); return; }
  const next = entry.start + entry.clip.frames;
  if (next >= duration(this.project)) { this.pause(); this.frame = duration(this.project) - 1; this.onTime(this.frame); return; }
  await this.seek(next, true);
 }
 async toggle() { if (this.playing) this.pause(); else await this.seek(this.frame >= duration(this.project) - 1 ? 0 : this.frame, true); }
}
