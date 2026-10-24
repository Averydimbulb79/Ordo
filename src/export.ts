import { PlaybackFrameReader } from './playback-frame';
import { renderAudioMix } from './audio-export';
import { EXPORT_FORMATS } from './export-formats';
import type { Format } from './export-formats';
export type { Format } from './export-formats';
import { loadProjectFonts } from './fonts';
import { DEFAULT_EXPORT, exportDimensions } from './export-settings';
import type { ExportSettings } from './export-settings';
import { ALL_FORMATS, AudioBufferSink, AudioBufferSource, BlobSource, BufferTarget, CanvasSink, CanvasSource, Input, Mp4OutputFormat, Output, WebMOutputFormat, canEncodeAudio, canEncodeVideo } from 'mediabunny';
import type { Project } from './model';
import { duration, layersAt, placements } from './model';
import { decodeImage } from './media';
import type { LocalMedia } from './media';
import { paintComposition } from './composition';
export async function supported(format: Format, includeAudio: boolean, settings:ExportSettings=DEFAULT_EXPORT, project:Pick<Project,"width"|"height">={width:1280,height:720}) {
 try {
  const c = EXPORT_FORMATS[format],options=exportDimensions(project,settings);
  return await canEncodeVideo(c.video, {width:options.width,height:options.height,frameRate:options.fps,bitrate:options.bitrate}) && (!includeAudio || await canEncodeAudio(c.audio, { sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 }));
 } catch { return false; }
}
export async function exportSequence(project: Project, files: Map<string, LocalMedia>, format: Format, signal: AbortSignal, progress: (n: number, phase: string) => void, settings:ExportSettings=DEFAULT_EXPORT): Promise<Blob> {
 const timelineFrames=duration(project),options=exportDimensions(project,settings),fps=options.fps,samplesPerFrame=48000/fps,frames=Math.ceil(timelineFrames/30*fps);
 if (!frames) throw new Error('Add a clip before exporting.');
 const check = () => { if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError'); };
 check();await loadProjectFonts(project);check();
 const pictures=new Map<string,ImageBitmap>(),imageAssets=new Set<string>();
 const inputs = new Map<string, Input>();
 const videos = new Map<string, CanvasSink>();
 const audios = new Map<string, AudioBufferSink>();
 const videoAssets=new Set<string>(),playbackAssets=new Set<string>();
 const videoIterators=new Map<string,ReturnType<CanvasSink["canvasesAtTimestamps"]>>();
 const playbackReaders=new Map<string,PlaybackFrameReader>();
 const copies=new Map<string,HTMLCanvasElement>();
 let output: Output | undefined;
 try {
  for (const clip of project.clips) {
   check(); if (inputs.has(clip.assetId)||imageAssets.has(clip.assetId)) continue;
   const local = files.get(clip.assetId); if (!local) throw new Error('Relink all timeline media before exporting.');
   if(project.assets.find(a=>a.id===clip.assetId)?.kind==='image'){imageAssets.add(clip.assetId);continue;}
   const input = new Input({ source: new BlobSource(local.file), formats: ALL_FORMATS }); inputs.set(clip.assetId, input);
   const video = await input.getPrimaryVideoTrack(), audio = await input.getPrimaryAudioTrack();
   if (video) {
    videoAssets.add(clip.assetId);
    if (!await video.canDecode()) playbackAssets.add(clip.assetId);
    else videos.set(clip.assetId, new CanvasSink(video, { width: Math.max(1,Math.round(video.displayWidth*Math.min(1,options.width/video.displayWidth,options.height/video.displayHeight))), poolSize: 2 }));
   }
   if (audio) {
    if (!await audio.canDecode()) throw new Error(`Audio decoder unavailable for ${local.file.name}. Audio will not be silently omitted.`);
    audios.set(clip.assetId, new AudioBufferSink(audio));
   }
  }
  const includeAudio = project.clips.some(c => c.volume > 0 && audios.has(c.assetId));
  if (!await supported(format, includeAudio, settings,project)) throw new Error(`${EXPORT_FORMATS[format].label} encoding is unavailable with these settings on this device. Choose another format or lower the resolution / FPS.`);
  check();
  const target = new BufferTarget();
  output = new Output({ format: EXPORT_FORMATS[format].container === 'mp4' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(), target });
  const canvas = document.createElement('canvas'); canvas.width = options.width; canvas.height = options.height;
  const ctx = canvas.getContext('2d')!;
  const videoSource = new CanvasSource(canvas, { codec: EXPORT_FORMATS[format].video, bitrate: options.bitrate });
  output.addVideoTrack(videoSource, { frameRate: fps });
  const audioSource = includeAudio ? new AudioBufferSource({ codec: EXPORT_FORMATS[format].audio, bitrate: 128000 }) : null;
  if (audioSource) output.addAudioTrack(audioSource);
  await output.start();
  for(const entry of placements(project)){
   if(entry.track==='a1'||entry.track==='a2')continue;
   const sink=videos.get(entry.clip.assetId);if(!sink)continue;
   const stamps=function*(){for(let f=Math.ceil(entry.start/30*fps-1e-8);f<Math.ceil(entry.end/30*fps-1e-8);f++)yield entry.clip.inFrame/30+f/fps-entry.start/30;};
   videoIterators.set(entry.clip.id,sink.canvasesAtTimestamps(stamps()));
  }
  const renderedAudio=audioSource?await renderAudioMix(project,audios,frames,fps,signal,n=>progress(n*.2,'Mixing audio')):null;
  for(let frame=0;frame<frames;frame++){
   check();
   const images=new Map<string,CanvasImageSource>(),activeLayers=layersAt(project,frame*30/fps),activeIds=new Set(activeLayers.map(e=>e.clip.id));
   const activeAssets=new Set(activeLayers.map(e=>e.clip.assetId));for(const [id,image] of pictures)if(!activeAssets.has(id)){image.close();pictures.delete(id);}
   for(const [id,copy] of copies)if(!activeIds.has(id)){copy.width=0;copy.height=0;copies.delete(id);}
   for(const layer of activeLayers){
    if(layer.track==='a1'||layer.track==='a2')continue;
    if(imageAssets.has(layer.clip.assetId)&&!pictures.has(layer.clip.assetId)){pictures.set(layer.clip.assetId,await decodeImage(files.get(layer.clip.assetId)!.file));check();}
    const still=pictures.get(layer.clip.assetId);if(still){images.set(layer.clip.id,still);continue;}
    if(!videoAssets.has(layer.clip.assetId))continue;
    const sourceTime=(layer.clip.inFrame+layer.offset)/30;
    let source:HTMLVideoElement|HTMLCanvasElement|OffscreenCanvas|undefined;
    if(!playbackAssets.has(layer.clip.assetId)){
     try{
      const next=await videoIterators.get(layer.clip.id)?.next();check();
      if(next&&!next.done&&next.value)source=next.value.canvas;
     }catch(error){check();/* Retry this exact frame with the preview decoder below. */}
     if(!source)playbackAssets.add(layer.clip.assetId);
    }
    if(!source){
     const iterator=videoIterators.get(layer.clip.id);
     if(iterator){await iterator.return(undefined).catch(()=>{});videoIterators.delete(layer.clip.id);}
     try{
      let reader=playbackReaders.get(layer.clip.id);
      if(!reader){reader=new PlaybackFrameReader(files.get(layer.clip.assetId)!.url,signal);playbackReaders.set(layer.clip.id,reader);}
      source=await reader.frame(sourceTime);check();
     }catch(error){
      check();throw new Error(`Cannot export "${files.get(layer.clip.assetId)!.file.name}" at timeline ${(frame/fps).toFixed(3)}s (source ${sourceTime.toFixed(3)}s). Preview decoder: ${error instanceof Error?error.message:String(error)}`);
     }
    }
    // Copy before advancing a decoder shared by another layer of the same source.
    let copy=copies.get(layer.clip.id);
    if(!copy){
     copy=document.createElement('canvas');
     const width=source instanceof HTMLVideoElement?source.videoWidth:source.width;
     const height=source instanceof HTMLVideoElement?source.videoHeight:source.height;
     const scale=Math.min(1,options.width/width,options.height/height);
     copy.width=Math.max(1,Math.round(width*scale));copy.height=Math.max(1,Math.round(height*scale));copies.set(layer.clip.id,copy);
    }
    copy.getContext('2d')!.drawImage(source,0,0,copy.width,copy.height);images.set(layer.clip.id,copy);
   }
   paintComposition(ctx,project,frame*30/fps,images);
   for(const layer of activeLayers)if(frame+1>=Math.ceil(layer.end/30*fps-1e-8)){const iterator=videoIterators.get(layer.clip.id);if(iterator){await iterator.return(undefined);videoIterators.delete(layer.clip.id);}playbackReaders.get(layer.clip.id)?.dispose();playbackReaders.delete(layer.clip.id);}
   await videoSource.add(frame/fps,1/fps);
   if(audioSource&&renderedAudio){
    const offset=frame*samplesPerFrame,buffer=new AudioBuffer({length:samplesPerFrame,numberOfChannels:2,sampleRate:48000});
    for(let channel=0;channel<2;channel++)buffer.copyToChannel(renderedAudio.getChannelData(channel).subarray(offset,offset+samplesPerFrame),channel);
    await audioSource.add(buffer);
   }
   progress((audioSource ? .2 : 0)+(audioSource ? .8 : 1)*(frame+1)/frames,playbackAssets.size?'Rendering with preview decoder':'Rendering');if(frame%10===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  for(const iterator of videoIterators.values())await iterator.return(undefined);videoIterators.clear();
  check(); progress(1, 'Finalising'); await output.finalize(); check();
  if (!target.buffer) throw new Error('No output was produced.');
  return new Blob([target.buffer], { type: EXPORT_FORMATS[format].mime });
 } catch (error) {
  if (output && output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => {});
  throw error;
 } finally {
  for(const reader of playbackReaders.values())reader.dispose();
  for(const iterator of videoIterators.values())await iterator.return(undefined).catch(()=>{});
  for(const copy of copies.values()){copy.width=0;copy.height=0;}
  for(const image of pictures.values())image.close();for (const input of inputs.values()) input.dispose();
 }
}
