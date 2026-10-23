import { ALL_FORMATS, AudioBufferSink, AudioBufferSource, BlobSource, BufferTarget, CanvasSink, CanvasSource, Input, Mp4OutputFormat, Output, WebMOutputFormat, canEncodeAudio, canEncodeVideo } from 'mediabunny';
import type { AudioCodec, VideoCodec } from 'mediabunny';
import type { Project } from './model';
import { duration, layersAt, placements } from './model';
import type { LocalMedia } from './media';
import { paintComposition } from './composition';
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
    videos.set(clip.assetId, new CanvasSink(video, { width: Math.max(1,Math.round(video.displayWidth*Math.min(1,project.width/video.displayWidth,project.height/video.displayHeight))), poolSize: 2 }));
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
  await output.start();
  const videoIterators=new Map<string,ReturnType<CanvasSink["canvasesAtTimestamps"]>>();
  const copies=new Map<string,HTMLCanvasElement>();
  for(const entry of placements(project)){
   if(entry.track==='a1'||entry.track==='a2')continue;
   const sink=videos.get(entry.clip.assetId);if(!sink)continue;
   const stamps=function*(){for(let f=0;f<entry.clip.frames;f++)yield (entry.clip.inFrame+f)/30;};
   videoIterators.set(entry.clip.id,sink.canvasesAtTimestamps(stamps()));
  }
  let renderedAudio:AudioBuffer|null=null;
  for(let frame=0;frame<frames;frame++){
   check();
   if(audioSource&&frame%30===0){
    const blockFrames=Math.min(30,frames-frame),offline=new OfflineAudioContext(2,blockFrames*1600,48000),blockEnd=frame+blockFrames;
    for(const entry of placements(project)){
     const clip=entry.clip,sink=audios.get(clip.assetId),left=Math.max(frame,entry.start),right=Math.min(blockEnd,entry.end);
     if(!sink||clip.volume===0||right<=left)continue;
     const sourceIn=(clip.inFrame+left-entry.start)/30,sourceOut=(clip.inFrame+right-entry.start)/30;
     const gain=offline.createGain();gain.connect(offline.destination);
     for(let f=left;f<right;f++)gain.gain.setValueAtTime(clip.volume*(layersAt(project,f).find(e=>e.clip.id===clip.id)?.weight??0),(f-frame)/30);
     for await(const packet of sink.buffers(sourceIn,sourceOut)){
      check();const a=Math.max(sourceIn,packet.timestamp),b=Math.min(sourceOut,packet.timestamp+packet.buffer.duration);
      if(b>a){const node=offline.createBufferSource();node.buffer=packet.buffer;node.connect(gain);node.start((left-frame)/30+a-sourceIn,a-packet.timestamp,b-a);}
     }
    }
    renderedAudio=await offline.startRendering();check();
   }
   const images=new Map<string,CanvasImageSource>(),activeLayers=layersAt(project,frame),activeIds=new Set(activeLayers.map(e=>e.clip.id));
   for(const [id,copy] of copies)if(!activeIds.has(id)){copy.width=0;copy.height=0;copies.delete(id);}
   for(const layer of activeLayers){
    const iterator=videoIterators.get(layer.clip.id);if(!iterator)continue;
    const next=await iterator.next(),image=next.done?null:next.value;
    if(!image)throw new Error('A source video frame could not be decoded. Export stopped.');
    // The same source can appear on several tracks. Copy before advancing its shared decoder pool.
    let copy=copies.get(layer.clip.id);if(!copy){copy=document.createElement('canvas');copy.width=image.canvas.width;copy.height=image.canvas.height;copies.set(layer.clip.id,copy);}
    copy.getContext('2d')!.drawImage(image.canvas,0,0,copy.width,copy.height);images.set(layer.clip.id,copy);
   }
   paintComposition(ctx,project,frame,images);
   for(const layer of activeLayers)if(layer.end===frame+1){const iterator=videoIterators.get(layer.clip.id);if(iterator){await iterator.return(undefined);videoIterators.delete(layer.clip.id);}}
   await videoSource.add(frame/30,1/30);
   if(audioSource&&renderedAudio){
    const offset=(frame%30)*1600,buffer=new AudioBuffer({length:1600,numberOfChannels:2,sampleRate:48000});
    for(let channel=0;channel<2;channel++)buffer.copyToChannel(renderedAudio.getChannelData(channel).subarray(offset,offset+1600),channel);
    await audioSource.add(buffer);
   }
   progress((frame+1)/frames,'Rendering');if(frame%10===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  for(const iterator of videoIterators.values())await iterator.return(undefined);
  check(); progress(1, 'Finalising'); await output.finalize(); check();
  if (!target.buffer) throw new Error('No output was produced.');
  return new Blob([target.buffer], { type: format === 'mp4' ? 'video/mp4' : 'video/webm' });
 } catch (error) {
  if (output && output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => {});
  throw error;
 } finally { for (const input of inputs.values()) input.dispose(); }
}
