import { ALL_FORMATS, AudioBufferSink, AudioBufferSource, BlobSource, BufferTarget, CanvasSink, CanvasSource, Input, Mp4OutputFormat, Output, WebMOutputFormat, canEncodeAudio, canEncodeVideo } from 'mediabunny';
import type { AudioCodec, VideoCodec } from 'mediabunny';
import type { Project } from './model';
import { duration } from './model';
import type { LocalMedia } from './media';
import { drawContained } from './media';
export type Format = 'mp4' | 'webm';
export const LIMIT_SECONDS = 120;
const codecs: Record<Format, { video: VideoCodec; audio: AudioCodec }> = { mp4: { video: 'avc', audio: 'aac' }, webm: { video: 'vp8', audio: 'opus' } };
export async function supported(format: Format, includeAudio: boolean) {
 try {
  const c = codecs[format];
  return await canEncodeVideo(c.video, { width: 1280, height: 720, frameRate: 30, bitrate: 4_000_000 }) && (!includeAudio || await canEncodeAudio(c.audio, { sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 }));
 } catch { return false; }
}
export async function exportSequence(project: Project, files: Map<string, LocalMedia>, format: Format, signal: AbortSignal, progress: (n: number, phase: string) => void): Promise<Blob> {
 const frames = duration(project);
 if (!frames) throw new Error('Add a clip before exporting.');
 if (frames > LIMIT_SECONDS * 30) throw new Error('This initial release supports exports up to 2 minutes. Shorten the sequence before exporting.');
 const check = () => { if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError'); };
 check();
 const inputs = new Map<string, Input>();
 const videos = new Map<string, CanvasSink>();
 const audios = new Map<string, AudioBufferSink>();
 let output: Output | undefined;
 try {
  for (const clip of project.clips) {
   check(); if (inputs.has(clip.assetId)) continue;
   const local = files.get(clip.assetId); if (!local) throw new Error('Relink all timeline media before exporting.');
   const input = new Input({ source: new BlobSource(local.file), formats: ALL_FORMATS }); inputs.set(clip.assetId, input);
   const video = await input.getPrimaryVideoTrack(), audio = await input.getPrimaryAudioTrack();
   if (video) {
    if (!await video.canDecode()) throw new Error(`Video decoder unavailable for ${local.file.name}.`);
    videos.set(clip.assetId, new CanvasSink(video, { width: project.width, height: project.height, fit: 'contain', poolSize: 2 }));
   }
   if (audio) {
    if (!await audio.canDecode()) throw new Error(`Audio decoder unavailable for ${local.file.name}. Audio will not be silently omitted.`);
    audios.set(clip.assetId, new AudioBufferSink(audio));
   }
  }
  const includeAudio = project.clips.some(c => c.volume > 0 && audios.has(c.assetId));
  if (!await supported(format, includeAudio)) throw new Error(`${format.toUpperCase()} encoding is unavailable with these settings. Try the other format in Chrome or Edge.`);
  check();
  const target = new BufferTarget();
  output = new Output({ format: format === 'mp4' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(), target });
  const canvas = document.createElement('canvas'); canvas.width = project.width; canvas.height = project.height;
  const ctx = canvas.getContext('2d')!;
  const videoSource = new CanvasSource(canvas, { codec: codecs[format].video, bitrate: 4_000_000 });
  output.addVideoTrack(videoSource, { frameRate: 30 });
  const audioSource = includeAudio ? new AudioBufferSource({ codec: codecs[format].audio, bitrate: 128000 }) : null;
  if (audioSource) output.addAudioTrack(audioSource);
  await output.start(); let timelineFrame = 0;
  for (const clip of project.clips) {
   check(); const seconds = clip.frames / 30, sourceIn = clip.inFrame / 30;
   let renderedAudio: AudioBuffer | null = null;
   if (audioSource) {
    progress(timelineFrame / frames, 'Preparing audio');
    const offline = new OfflineAudioContext(2, clip.frames * 1600, 48000);
    const sink = audios.get(clip.assetId);
    if (sink && clip.volume > 0) {
     const gain = offline.createGain(); gain.gain.value = clip.volume; gain.connect(offline.destination);
     for await (const packet of sink.buffers(sourceIn, sourceIn + seconds)) {
      check();
      const left = Math.max(sourceIn, packet.timestamp), right = Math.min(sourceIn + seconds, packet.timestamp + packet.buffer.duration);
      if (right > left) {
       const node = offline.createBufferSource(); node.buffer = packet.buffer; node.connect(gain);
       node.start(left - sourceIn, left - packet.timestamp, right - left);
      }
     }
    }
    renderedAudio = await offline.startRendering(); check();
   }
   const sink = videos.get(clip.assetId);
   // Monotonic timestamp iteration avoids re-decoding the same GOP for each output frame.
   const stamps = function* () { for (let f = 0; f < clip.frames; f++) yield (clip.inFrame + f) / 30; };
   const iterator = sink?.canvasesAtTimestamps(stamps());
   for (let f = 0; f < clip.frames; f++) {
    check(); const item = iterator ? await iterator.next() : null; const image = item && !item.done ? item.value : null;
    if (sink && !image) throw new Error('A source video frame could not be decoded. Export stopped.');
    drawContained(ctx, image?.canvas, image?.canvas.width, image?.canvas.height);
    await videoSource.add((timelineFrame + f) / 30, 1 / 30);
    // Feed audio in small matching chunks so muxing does not buffer an entire video track.
    if (audioSource && renderedAudio) {
     const start = f * 1600, buffer = new AudioBuffer({ length: 1600, numberOfChannels: 2, sampleRate: 48000 });
     for (let channel = 0; channel < 2; channel++) buffer.copyToChannel(renderedAudio.getChannelData(channel).subarray(start, start + 1600), channel);
     await audioSource.add(buffer);
    }
    progress((timelineFrame + f + 1) / frames, 'Rendering');
    if (f % 10 === 0) await new Promise(resolve => setTimeout(resolve, 0));
   }
   timelineFrame += clip.frames;
  }
  check(); progress(1, 'Finalising'); await output.finalize(); check();
  if (!target.buffer) throw new Error('No output was produced.');
  return new Blob([target.buffer], { type: format === 'mp4' ? 'video/mp4' : 'video/webm' });
 } catch (error) {
  if (output && output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => {});
  throw error;
 } finally { for (const input of inputs.values()) input.dispose(); }
}
